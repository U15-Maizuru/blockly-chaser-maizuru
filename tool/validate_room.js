// アップロードされたルーム定義の共通バリデーション。
// HTTP 経由 (app.js の /api/upload-map) と Socket.io 経由 (chaser/server.js の create_new_map) の
// 双方から必ずこの関数を通し、検証内容が経路ごとにずれないようにする。
//
// 数値項目は範囲を見る前に Number.isInteger() で型を確定させる。
// 文字列や配列などをそのまま比較演算子に渡すと NaN 比較となり、
// 大小比較がすべて false になって範囲チェックをすり抜けるため。

const map_format = require('../public/javascripts/map_format.js');

// マップサイズの許容範囲
const MAP_SIZE_MIN = 5;
const MAP_SIZE_MAX = 30;

// ターン数の許容範囲
const TURN_MIN = 1;
const TURN_MAX = 500;

// ルーム名の最大文字数
const NAME_MAX_LENGTH = 32;

// legend の値として許可するマス種別名 (床/ブロック/アイテムのみ)。
// プレイヤー位置は cool/hot で別管理するため、legend に cool/hot 相当の種別を
// 定義しているアップロードは不正データとして拒否する。
const CELL_TYPE_ALLOWED = new Set(['floor', 'block', 'item']);

// 制御文字 (改行・タブ含む) を除去する。ログ汚染と表示崩れの防止
function sanitizeName(value) {
    return value.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

// 整数かつ min〜max の範囲内かを判定する
function isIntInRange(value, min, max) {
    return Number.isInteger(value) && value >= min && value <= max;
}

// ルーム定義を検証し、正常なら { ok: true, value: 正規化済みデータ } を返す。
// 不正なら { ok: false, errors: [メッセージ...] } を返す。
function validateRoom(input) {
    const errors = [];

    // オブジェクト以外 (null・配列・プリミティブ) は以降の参照が成立しないため即座に打ち切る
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        return { ok: false, errors: ['ルームデータの形式が正しくありません'] };
    }

    // name
    let name = '';
    if (typeof input.name !== 'string') {
        errors.push('name は文字列で指定してください');
    }
    else {
        name = sanitizeName(input.name);
        if (name.length < 1) {
            errors.push('name が必要です');
        }
        else if (name.length > NAME_MAX_LENGTH) {
            errors.push('name は ' + NAME_MAX_LENGTH + ' 文字以内');
        }
    }

    // auto_symmetry
    if (input.auto_symmetry !== undefined && typeof input.auto_symmetry !== 'boolean') {
        errors.push('auto_symmetry は true / false で指定してください');
    }

    // map (行文字列グリッドJSON) が指定されていれば具体的なグリッドを持つマップ、
    // 指定がなければ map_size_x/map_size_y/turn + auto_block/auto_point によるサーバー側自動生成。
    const hasMap = input.map !== null && typeof input.map === 'object' && !Array.isArray(input.map);

    let sizeX, sizeY, turnMax, mapOut = null;

    if (hasMap) {
        const map = input.map;

        sizeX = map.width;
        sizeY = map.height;
        turnMax = map.turnMax;

        if (!isIntInRange(sizeX, MAP_SIZE_MIN, MAP_SIZE_MAX)) {
            errors.push('map の width は ' + MAP_SIZE_MIN + '〜' + MAP_SIZE_MAX + ' の整数');
        }
        if (!isIntInRange(sizeY, MAP_SIZE_MIN, MAP_SIZE_MAX)) {
            errors.push('map の height は ' + MAP_SIZE_MIN + '〜' + MAP_SIZE_MAX + ' の整数');
        }
        if (!isIntInRange(turnMax, TURN_MIN, TURN_MAX)) {
            errors.push('map の turnMax は ' + TURN_MIN + '〜' + TURN_MAX + ' の整数');
        }

        // legend: 省略可(省略時は既定の . # * を使う)。指定する場合は1文字キー -> floor/block/item のみ。
        const legend = (map.legend === undefined) ? map_format.DEFAULT_LEGEND : map.legend;
        let legendValid = legend !== null && typeof legend === 'object' && !Array.isArray(legend);
        if (legendValid) {
            for (const sym in legend) {
                if (typeof sym !== 'string' || sym.length !== 1 || !CELL_TYPE_ALLOWED.has(legend[sym])) {
                    legendValid = false;
                    break;
                }
            }
        }
        if (!legendValid) {
            errors.push('map の legend は「1文字 -> floor/block/item」の形式で指定してください');
        }

        // rows: legendValid の場合のみ意味のある検証ができる
        if (legendValid && !errors.length) {
            if (!Array.isArray(map.rows) || map.rows.length !== sizeY) {
                errors.push('map の rows の行数が height と一致しません');
            }
            else {
                let rowError = false;
                for (let y = 0; y < map.rows.length && !rowError; y++) {
                    const rowStr = map.rows[y];
                    if (typeof rowStr !== 'string' || rowStr.length !== sizeX) {
                        errors.push('map の rows の行の文字数が width と一致しません');
                        rowError = true;
                        break;
                    }
                    for (let x = 0; x < rowStr.length; x++) {
                        if (!(rowStr[x] in legend)) {
                            errors.push('map の rows に legend で定義されていない文字が含まれています');
                            rowError = true;
                            break;
                        }
                    }
                }
            }
        }

        if (!errors.length) {
            const parsed = map_format.parseMap(map);

            const inBounds = function (pos) {
                return !!pos && isIntInRange(pos.x, 0, sizeX - 1) && isIntInRange(pos.y, 0, sizeY - 1);
            };
            // 範囲外のまま床判定に進むと rows への添字アクセスがクラッシュするため、
            // 範囲内であることを確認できた場合のみ床判定を行う。
            const isOnFloor = function (pos) {
                return inBounds(pos) && legend[map.rows[pos.y][pos.x]] === 'floor';
            };

            if (map.cool !== undefined) {
                if (!inBounds(parsed.coolPos)) {
                    errors.push('map の cool が盤面の範囲外です');
                } else if (!isOnFloor(parsed.coolPos)) {
                    errors.push('map の cool が床以外のマス(壁・アイテム)の上にあります');
                }
            }
            if (map.hot !== undefined) {
                if (!inBounds(parsed.hotPos)) {
                    errors.push('map の hot が盤面の範囲外です');
                } else if (!isOnFloor(parsed.hotPos)) {
                    errors.push('map の hot が床以外のマス(壁・アイテム)の上にあります');
                }
            }
            if (parsed.coolPos && parsed.hotPos && parsed.coolPos.x === parsed.hotPos.x && parsed.coolPos.y === parsed.hotPos.y) {
                errors.push('map の cool と hot が同じマスになっています');
            }

            if (!errors.length) {
                mapOut = map_format.serializeMap({
                    name: name,
                    sizeX: sizeX,
                    sizeY: sizeY,
                    turnMax: turnMax,
                    cells: parsed.cells,
                    coolPos: parsed.coolPos,
                    hotPos: parsed.hotPos
                });
            }
        }
    }
    else {
        if (!isIntInRange(input.map_size_x, MAP_SIZE_MIN, MAP_SIZE_MAX)) {
            errors.push('map_size_x は ' + MAP_SIZE_MIN + '〜' + MAP_SIZE_MAX + ' の整数');
        }
        if (!isIntInRange(input.map_size_y, MAP_SIZE_MIN, MAP_SIZE_MAX)) {
            errors.push('map_size_y は ' + MAP_SIZE_MIN + '〜' + MAP_SIZE_MAX + ' の整数');
        }
        if (!isIntInRange(input.turn, TURN_MIN, TURN_MAX)) {
            errors.push('turn は ' + TURN_MIN + '〜' + TURN_MAX + ' の整数');
        }
        sizeX = input.map_size_x;
        sizeY = input.map_size_y;
        turnMax = input.turn;
    }

    // ここまでで寸法が確定していない場合、これ以降の検証は意味を成さないため打ち切る
    if (errors.length) {
        return { ok: false, errors: errors };
    }

    const cellCount = sizeX * sizeY;

    // auto_block / auto_point (未指定なら既定値)。
    // map を渡さなかった場合のみサーバー側で自動生成が走るため、
    // そのときだけマス数を上限とする。マス数を超える指定は生成時に配置先を使い果たす。
    const autoBlock = (input.auto_block === undefined || input.auto_block === null) ? 20 : input.auto_block;
    const autoPoint = (input.auto_point === undefined || input.auto_point === null) ? 30 : input.auto_point;
    const autoMax = hasMap ? Number.MAX_SAFE_INTEGER : cellCount;

    if (!isIntInRange(autoBlock, 0, autoMax)) {
        errors.push('auto_block は 0〜' + autoMax + ' の整数');
    }
    if (!isIntInRange(autoPoint, 0, autoMax)) {
        errors.push('auto_point は 0〜' + autoMax + ' の整数');
    }

    if (errors.length) {
        return { ok: false, errors: errors };
    }

    // 検証を通った項目だけを組み直して返す。入力オブジェクトをそのまま使うと
    // 未知のキー (内部状態を上書きしうるもの) が混入するため、明示的に列挙する
    const value = {
        name: name,
        auto_block: autoBlock,
        auto_point: autoPoint,
        auto_symmetry: input.auto_symmetry === true
    };
    if (hasMap) {
        value.map = mapOut;
    }
    else {
        value.map_size_x = sizeX;
        value.map_size_y = sizeY;
        value.map_data = [];
        value.turn = turnMax;
    }

    return { ok: true, value: value };
}

module.exports = {
    validateRoom: validateRoom,
    MAP_SIZE_MIN: MAP_SIZE_MIN,
    MAP_SIZE_MAX: MAP_SIZE_MAX,
    TURN_MIN: TURN_MIN,
    TURN_MAX: TURN_MAX,
    NAME_MAX_LENGTH: NAME_MAX_LENGTH
};

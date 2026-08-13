// アップロードされたルーム定義の共通バリデーション。
// HTTP 経由 (app.js の /api/upload-map) と Socket.io 経由 (chaser/server.js の create_new_map) の
// 双方から必ずこの関数を通し、検証内容が経路ごとにずれないようにする。
//
// 数値項目は範囲を見る前に Number.isInteger() で型を確定させる。
// 文字列や配列などをそのまま比較演算子に渡すと NaN 比較となり、
// 大小比較がすべて false になって範囲チェックをすり抜けるため。

// マップサイズの許容範囲
const MAP_SIZE_MIN = 5;
const MAP_SIZE_MAX = 30;

// ターン数の許容範囲
const TURN_MIN = 1;
const TURN_MAX = 500;

// ルーム名の最大文字数
const NAME_MAX_LENGTH = 32;

// map_data のセルが取りうる値 (0:空 1:ブロック 2:ポイント 3:cool 4:hot)
const CELL_MIN = 0;
const CELL_MAX = 4;

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

    // map_size_x / map_size_y
    if (!isIntInRange(input.map_size_x, MAP_SIZE_MIN, MAP_SIZE_MAX)) {
        errors.push('map_size_x は ' + MAP_SIZE_MIN + '〜' + MAP_SIZE_MAX + ' の整数');
    }
    if (!isIntInRange(input.map_size_y, MAP_SIZE_MIN, MAP_SIZE_MAX)) {
        errors.push('map_size_y は ' + MAP_SIZE_MIN + '〜' + MAP_SIZE_MAX + ' の整数');
    }

    // turn
    if (!isIntInRange(input.turn, TURN_MIN, TURN_MAX)) {
        errors.push('turn は ' + TURN_MIN + '〜' + TURN_MAX + ' の整数');
    }

    // ここまでで寸法が確定していない場合、これ以降の検証は意味を成さないため打ち切る
    if (errors.length) {
        return { ok: false, errors: errors };
    }

    const sizeX = input.map_size_x;
    const sizeY = input.map_size_y;
    const cellCount = sizeX * sizeY;

    // auto_symmetry
    if (input.auto_symmetry !== undefined && typeof input.auto_symmetry !== 'boolean') {
        errors.push('auto_symmetry は true / false で指定してください');
    }

    // map_data (省略時は空配列 = サーバー側で自動生成)
    let mapData = [];
    if (input.map_data !== undefined && input.map_data !== null) {
        if (!Array.isArray(input.map_data)) {
            errors.push('map_data は配列で指定してください');
        }
        else if (input.map_data.length > 0) {
            if (input.map_data.length !== sizeY) {
                errors.push('map_data の行数が map_size_y と一致しません');
            }
            else {
                // 全行を検証する。先頭行だけの確認では行ごとの長さ不一致を見逃す
                let rowError = false;
                for (let y = 0; y < input.map_data.length && !rowError; y++) {
                    const row = input.map_data[y];
                    if (!Array.isArray(row) || row.length !== sizeX) {
                        errors.push('map_data の列数が map_size_x と一致しません');
                        rowError = true;
                        break;
                    }
                    for (let x = 0; x < row.length; x++) {
                        if (!isIntInRange(row[x], CELL_MIN, CELL_MAX)) {
                            errors.push('map_data には ' + CELL_MIN + '〜' + CELL_MAX + ' の整数のみ指定できます');
                            rowError = true;
                            break;
                        }
                    }
                }
                if (!rowError) {
                    mapData = input.map_data;
                }
            }
        }
    }

    // auto_block / auto_point (未指定なら既定値)。
    // map_data を渡さなかった場合のみサーバー側で自動生成が走るため、
    // そのときだけマス数を上限とする。マス数を超える指定は生成時に配置先を使い果たす。
    const autoBlock = (input.auto_block === undefined || input.auto_block === null) ? 20 : input.auto_block;
    const autoPoint = (input.auto_point === undefined || input.auto_point === null) ? 30 : input.auto_point;
    const autoMax = mapData.length ? Number.MAX_SAFE_INTEGER : cellCount;

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
    return {
        ok: true,
        value: {
            name: name,
            map_size_x: sizeX,
            map_size_y: sizeY,
            map_data: mapData,
            auto_block: autoBlock,
            auto_point: autoPoint,
            auto_symmetry: input.auto_symmetry === true,
            turn: input.turn
        }
    };
}

module.exports = {
    validateRoom: validateRoom,
    MAP_SIZE_MIN: MAP_SIZE_MIN,
    MAP_SIZE_MAX: MAP_SIZE_MAX,
    TURN_MIN: TURN_MIN,
    TURN_MAX: TURN_MAX,
    NAME_MAX_LENGTH: NAME_MAX_LENGTH
};

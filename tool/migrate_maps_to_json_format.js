// 使い捨てスクリプト。load_data/game_server_data・load_data/tutorial_stage_data 配下で
// map_text (N:/T:/S:/D:/C:/H: テキスト形式) を持つファイルを、新スキーマの map
// (行文字列グリッドJSON) フィールドへ変換する。実行後は削除して構わない(記録として残す場合を除く)。
//
// 変換後、旧パーサ(このスクリプト内に複製)で map_text を独立に再パースした結果と、
// 新パーサ(map_format.parseMap)で map を再パースした結果を突き合わせて
// ラウンドトリップの一致を検証する。
const fs = require('fs');
const path = require('path');

const map_format = require('../public/javascripts/map_format.js');

// map_format.js が旧テキスト形式のparseMapTextを持っていた頃の実装をここに複製する
// (現在の map_format.js は新形式専用になったため)。
function oldParseMapText(text) {
    var sizeX = 15, sizeY = 17, turnMax = 150;
    var rows = [];
    var coolPos = null, hotPos = null;

    (text || '').split(/\r?\n/).forEach(function (rawLine) {
        var line = rawLine.trim();
        if (line.length < 2 || line[1] !== ':') return;
        var prefix = line[0];
        var body = line.slice(2);

        if (prefix === 'T') {
            var t = parseInt(body, 10);
            if (!isNaN(t)) turnMax = t;
        } else if (prefix === 'S') {
            var s = body.split(',').map(Number);
            if (s.length === 2 && s.every(function (n) { return !isNaN(n); })) {
                sizeX = s[0];
                sizeY = s[1];
            }
        } else if (prefix === 'D') {
            rows.push(body.split(',').map(Number));
        } else if (prefix === 'C') {
            var c = body.split(',').map(Number);
            if (c.length === 2) coolPos = { x: c[0], y: c[1] };
        } else if (prefix === 'H') {
            var h = body.split(',').map(Number);
            if (h.length === 2) {
                if (!coolPos) {
                    coolPos = { x: h[0], y: h[1] };
                } else {
                    hotPos = { x: h[0], y: h[1] };
                }
            }
        }
    });

    var cells = [];
    for (var y = 0; y < sizeY; y++) {
        var srcRow = rows[y] || [];
        var row = [];
        for (var x = 0; x < sizeX; x++) {
            row.push(srcRow[x] !== undefined && !isNaN(srcRow[x]) ? srcRow[x] : 0);
        }
        cells.push(row);
    }

    return { sizeX: sizeX, sizeY: sizeY, turnMax: turnMax, cells: cells, coolPos: coolPos, hotPos: hotPos };
}

function cellsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var y = 0; y < a.length; y++) {
        if (a[y].length !== b[y].length) return false;
        for (var x = 0; x < a[y].length; x++) {
            if (a[y][x] !== b[y][x]) return false;
        }
    }
    return true;
}

function posEqual(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y;
}

function migrateFile(filePath) {
    var raw = fs.readFileSync(filePath, 'utf8');
    var json = JSON.parse(raw);

    if (typeof json.map_text !== 'string' || json.map_text.trim().length === 0) {
        return { skipped: true };
    }

    var oldParsed = oldParseMapText(json.map_text);
    var map = map_format.serializeMap({
        name: json.name,
        sizeX: oldParsed.sizeX,
        sizeY: oldParsed.sizeY,
        turnMax: oldParsed.turnMax,
        cells: oldParsed.cells,
        coolPos: oldParsed.coolPos,
        hotPos: oldParsed.hotPos
    });

    // ラウンドトリップ検証: 新形式を再パースし、変換前のパース結果と一致することを確認
    var reparsed = map_format.parseMap(map);
    if (
        reparsed.sizeX !== oldParsed.sizeX ||
        reparsed.sizeY !== oldParsed.sizeY ||
        reparsed.turnMax !== oldParsed.turnMax ||
        !cellsEqual(reparsed.cells, oldParsed.cells) ||
        !posEqual(reparsed.coolPos, oldParsed.coolPos) ||
        !posEqual(reparsed.hotPos, oldParsed.hotPos)
    ) {
        throw new Error('round-trip mismatch: ' + filePath);
    }

    delete json.map_text;
    json.map = map;

    fs.writeFileSync(filePath, JSON.stringify(json, null, 4) + '\n');
    return { skipped: false, coolPos: oldParsed.coolPos, hotPos: oldParsed.hotPos, sizeX: oldParsed.sizeX, sizeY: oldParsed.sizeY, turnMax: oldParsed.turnMax };
}

function migrateDir(dirPath, label) {
    var files = fs.readdirSync(dirPath).filter(function (f) { return f.endsWith('.json'); });
    var migrated = 0;
    files.forEach(function (fileName) {
        var filePath = path.join(dirPath, fileName);
        var result = migrateFile(filePath);
        if (result.skipped) {
            console.log('[SKIP] ' + label + '/' + fileName + ': map_text が無い(手続き生成ルーム)');
        } else {
            migrated++;
            console.log('[OK]   ' + label + '/' + fileName + ': map (' + result.sizeX + 'x' + result.sizeY + ', turn=' + result.turnMax + ') cool=' + JSON.stringify(result.coolPos) + ' hot=' + JSON.stringify(result.hotPos));
        }
    });
    return migrated;
}

var gameServerDir = path.join(__dirname, '..', 'load_data', 'game_server_data');
var tutorialDir = path.join(__dirname, '..', 'load_data', 'tutorial_stage_data');

var totalMigrated = 0;
totalMigrated += migrateDir(gameServerDir, 'game_server_data');
totalMigrated += migrateDir(tutorialDir, 'tutorial_stage_data');

console.log('\n=== 完了: ' + totalMigrated + ' ファイルを移行しました ===');

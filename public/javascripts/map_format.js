// マップの永続化フォーマット（行文字列グリッドJSON）のパーサ・シリアライザ。
// server_store/io/socket に依存しない純粋関数のみを置く。
// socket_events.js と同じ形で、ブラウザでは window.MAP_FORMAT として、
// Node.js では require() で module.exports として、同じ内容を参照できる。
(function (root) {

    // 実盤面（ライブ配信 UPDATE_BOARD/NEW_BOARD）のセルコード。
    // rows(保存フォーマット)は FLOOR/BLOCK/ITEM のみを使う。COOL/HOT はここでは書き込まれず、
    // bakeMapData でプレイヤー位置を重ねた時にのみ現れる。
    var CELL = {
        FLOOR: 0,
        BLOCK: 2,
        ITEM: 3,
        COOL: 4,
        HOT: 5,
        OVERLAP_COOL_ON_HOT: 45,
        OVERLAP_HOT_ON_COOL: 54
    };

    // 保存フォーマットの記号 <-> セルコード対応表(固定)。
    var DEFAULT_LEGEND = { '.': 'floor', '#': 'block', '*': 'item' };
    var TYPE_TO_CELL = { floor: CELL.FLOOR, block: CELL.BLOCK, item: CELL.ITEM };
    var CELL_TO_SYMBOL = { 0: '.', 2: '#', 3: '*' };

    // python版統合前(map_text導入前, commit 399d64e より前)のマップエディタが書き出していた
    // 形式: { name, turn, map_size_x, map_size_y, map_data, cool, hot }。
    // セルコードも現行と異なる(floor=0, block=1, item=2, cool=3, hot=4)。
    // 読み込み専用の互換維持であり、ダウンロードはこの形式では行わない。
    var LEGACY_CELL_TO_CURRENT = { 0: CELL.FLOOR, 1: CELL.BLOCK, 2: CELL.ITEM, 3: CELL.COOL, 4: CELL.HOT };

    // 現行の map オブジェクトではなく、上記の旧フィールドを持つかどうかを判定する。
    function isLegacyMap(json) {
        return !!json && (Array.isArray(json.map_data) || Number.isInteger(json.map_size_x));
    }

    // 旧形式の json(上位オブジェクト) -> { sizeX, sizeY, turnMax, cells, coolPos, hotPos, name }
    function parseLegacyMap(json) {
        json = json || {};
        var sizeX = Number.isInteger(json.map_size_x) ? json.map_size_x : 15;
        var sizeY = Number.isInteger(json.map_size_y) ? json.map_size_y : 17;
        var turnMax = Number.isInteger(json.turn) ? json.turn : 150;

        var coolPos = null, hotPos = null;
        var cells = [];

        if (Array.isArray(json.map_data) && json.map_data.length > 0) {
            for (var y = 0; y < sizeY; y++) {
                var srcRow = json.map_data[y] || [];
                var row = [];
                for (var x = 0; x < sizeX; x++) {
                    var legacyValue = srcRow[x];
                    var cellValue = LEGACY_CELL_TO_CURRENT[legacyValue];
                    if (cellValue === undefined) cellValue = CELL.FLOOR;
                    if (cellValue === CELL.COOL) { coolPos = { x: x, y: y }; cellValue = CELL.FLOOR; }
                    else if (cellValue === CELL.HOT) { hotPos = { x: x, y: y }; cellValue = CELL.FLOOR; }
                    row.push(cellValue);
                }
                cells.push(row);
            }
        } else {
            for (var y2 = 0; y2 < sizeY; y2++) {
                cells.push(new Array(sizeX).fill(CELL.FLOOR));
            }
            if (json.cool && json.cool.x >= 0) coolPos = { x: json.cool.x, y: json.cool.y };
            if (json.hot && json.hot.x >= 0) hotPos = { x: json.hot.x, y: json.hot.y };
        }

        return { sizeX: sizeX, sizeY: sizeY, turnMax: turnMax, cells: cells, coolPos: coolPos, hotPos: hotPos, name: json.name };
    }

    // map(保存用オブジェクト: {name,turnMax,width,height,legend,rows,cool,hot}) ->
    // { sizeX, sizeY, turnMax, cells, coolPos, hotPos, name }
    function parseMap(map) {
        map = map || {};
        var sizeX = Number.isInteger(map.width) ? map.width : 15;
        var sizeY = Number.isInteger(map.height) ? map.height : 17;
        var turnMax = Number.isInteger(map.turnMax) ? map.turnMax : 150;

        var legend = map.legend || DEFAULT_LEGEND;
        var symbolToCell = {};
        for (var sym in legend) {
            var cellValue = TYPE_TO_CELL[legend[sym]];
            symbolToCell[sym] = cellValue !== undefined ? cellValue : CELL.FLOOR;
        }

        var rows = Array.isArray(map.rows) ? map.rows : [];
        var cells = [];
        for (var y = 0; y < sizeY; y++) {
            var rowStr = rows[y] || '';
            var row = [];
            for (var x = 0; x < sizeX; x++) {
                var ch = rowStr[x];
                row.push(ch !== undefined && symbolToCell[ch] !== undefined ? symbolToCell[ch] : CELL.FLOOR);
            }
            cells.push(row);
        }

        var coolPos = map.cool ? { x: map.cool.x, y: map.cool.y } : null;
        var hotPos = map.hot ? { x: map.hot.x, y: map.hot.y } : null;

        return { sizeX: sizeX, sizeY: sizeY, turnMax: turnMax, cells: cells, coolPos: coolPos, hotPos: hotPos, name: map.name };
    }

    // { name, sizeX, sizeY, turnMax, cells, coolPos, hotPos } -> 保存用オブジェクト
    function serializeMap(internal) {
        var rows = [];
        for (var y = 0; y < internal.sizeY; y++) {
            var chars = [];
            for (var x = 0; x < internal.sizeX; x++) {
                chars.push(CELL_TO_SYMBOL[internal.cells[y][x]] || '.');
            }
            rows.push(chars.join(''));
        }

        var out = {
            name: internal.name || 'CustomMap',
            turnMax: internal.turnMax,
            width: internal.sizeX,
            height: internal.sizeY,
            legend: DEFAULT_LEGEND,
            rows: rows
        };
        if (internal.coolPos) out.cool = { x: internal.coolPos.x, y: internal.coolPos.y };
        if (internal.hotPos) out.hot = { x: internal.hotPos.x, y: internal.hotPos.y };
        return out;
    }

    // cells に coolPos/hotPos を焼き込んだ表示用の 2D 配列を返す（元の cells は変更しない）。
    function bakeMapData(cells, coolPos, hotPos) {
        var baked = cells.map(function (row) { return row.slice(); });
        if (coolPos) baked[coolPos.y][coolPos.x] = CELL.COOL;
        if (hotPos) baked[hotPos.y][hotPos.x] = CELL.HOT;
        return baked;
    }

    var MAP_FORMAT = {
        CELL: CELL,
        DEFAULT_LEGEND: DEFAULT_LEGEND,
        parseMap: parseMap,
        serializeMap: serializeMap,
        bakeMapData: bakeMapData,
        isLegacyMap: isLegacyMap,
        parseLegacyMap: parseLegacyMap
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MAP_FORMAT;
    }
    else {
        root.MAP_FORMAT = MAP_FORMAT;
    }
})(typeof window !== 'undefined' ? window : this);

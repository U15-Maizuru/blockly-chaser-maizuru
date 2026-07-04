// map_data 上の周辺セル分類ロジック。server_store/io/socket に依存しない純粋関数のみを置く。
// move_player/look/search/put_wall (chaser/server.js) から共通利用する。

// 1マスを 0(空き)/1(相手・壁)/2(範囲外)/3(不明) に分類する
function classifyCell(mapData, x, y, mapSizeX, mapSizeY, ownNum, oppNum) {
    if (0 > x || (mapSizeX - 1) < x || 0 > y || (mapSizeY - 1) < y) {
        return 2;
    }
    var cell = mapData[y][x];
    if (cell == oppNum || cell == 34) {
        return 1;
    }
    if (cell == 0 || cell == ownNum) {
        return 0;
    }
    if (cell == 1) {
        return 2;
    }
    return 3;
}

function scanCells(mapData, originX, originY, xRange, yRange, mapSizeX, mapSizeY, ownNum, oppNum) {
    var result = [];
    for (var dy of yRange) {
        for (var dx of xRange) {
            result.push(classifyCell(mapData, originX + dx, originY + dy, mapSizeX, mapSizeY, ownNum, oppNum));
        }
    }
    return result;
}

exports.classifyCell = classifyCell;
exports.scanCells = scanCells;

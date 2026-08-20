// map_data 上の周辺セル分類ロジック。server_store/io/socket に依存しない純粋関数のみを置く。
// move_player/look/search/put_wall (chaser/server.js) から共通利用する。

// 1マスを 0(空き)/1(相手・壁)/2(範囲外)/3(不明) に分類する
// mapData の生の格納コード（Python-CHaser-Web 準拠: floor=0,block=2,item=3,cool=4,hot=5, 重なり=45）を
// 9マス周辺情報の意味論（Floor=0,Enemy=1,Block=2,Item=3）に変換する。
// この関数自体の出力の意味は変更しない -- floor/block/itemの数値が偶然一致しているのは
// 入力側(mapData)と出力側(9マス配列)の数値体系がたまたま揃っているだけで、直接の等価関係ではない。
function classifyCell(mapData, x, y, mapSizeX, mapSizeY, ownNum, oppNum) {
    if (0 > x || (mapSizeX - 1) < x || 0 > y || (mapSizeY - 1) < y) {
        return 2;
    }
    var cell = mapData[y][x];
    if (cell == oppNum || cell == 45) {
        return 1;
    }
    if (cell == 0 || cell == ownNum) {
        return 0;
    }
    if (cell == 2) {
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

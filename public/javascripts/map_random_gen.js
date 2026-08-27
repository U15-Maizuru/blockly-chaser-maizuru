// ランダムマップ生成。public/javascripts/python/lib/pyCHaser.local.py の
// generate_random_map_data() をそのままJSに移植したもの(Pyodide非依存)。
// 対戦モード・Python版どちらのマップエディタからも呼べるよう共有モジュール化する。
// map_format.js と同じUMD形式。
(function (root) {

    function uniformNorm(pos, center) {
        return Math.max(Math.abs(pos.x - center.x), Math.abs(pos.y - center.y));
    }

    function mirrorPoint(pos, sizeX, sizeY) {
        return { x: sizeX - 1 - pos.x, y: sizeY - 1 - pos.y };
    }

    function samePos(a, b) {
        return a.x === b.x && a.y === b.y;
    }

    function randInt(n) {
        return Math.floor(Math.random() * n);
    }

    // { sizeX, sizeY, turnMax, blockNum, itemNum, mirror } ->
    // { sizeX, sizeY, turnMax, cells, coolPos, hotPos, name } (map_format.js の内部モデルと同じ形)
    function generateRandomMap(options) {
        options = options || {};
        var sizeX = options.sizeX || 15;
        var sizeY = options.sizeY || 17;
        var blockNum = options.blockNum !== undefined ? options.blockNum : 20;
        var itemNum = options.itemNum !== undefined ? options.itemNum : 35;
        var turnMax = options.turnMax || 150;
        var mirror = options.mirror !== false;

        var center = { x: Math.floor(sizeX / 2), y: Math.floor(sizeY / 2) };
        var halfX = Math.floor(sizeX / 2);
        var halfY = Math.floor(sizeY / 2);

        var pos0;
        while (true) {
            pos0 = { x: randInt(sizeX), y: randInt(sizeY) };
            if (uniformNorm(pos0, center) <= 1) continue;
            if (pos0.x < halfX || (pos0.x === halfX && pos0.y < halfY)) break;
        }

        var pos1;
        if (mirror) {
            pos1 = mirrorPoint(pos0, sizeX, sizeY);
        } else {
            while (true) {
                pos1 = { x: randInt(sizeX), y: randInt(sizeY) };
                if (uniformNorm(pos1, center) <= 1) continue;
                if (pos1.x > halfX || (pos1.x === halfX && pos1.y > halfY)) break;
            }
        }

        var cells = [];
        for (var y = 0; y < sizeY; y++) cells.push(new Array(sizeX).fill(0));

        var i = 0;
        while (i < blockNum) {
            var pos = { x: randInt(sizeX), y: randInt(sizeY) };
            var mp = mirrorPoint(pos, sizeX, sizeY);
            if (!samePos(pos, pos0) && !samePos(pos, pos1) && cells[pos.y][pos.x] !== 2 && !samePos(pos, center)) {
                cells[pos.y][pos.x] = 2;
                if (mirror) {
                    if (!samePos(mp, pos0) && !samePos(mp, pos1) && cells[mp.y][mp.x] !== 2 && !samePos(mp, center)) {
                        cells[mp.y][mp.x] = 2;
                        i++;
                    }
                }
            } else if (i > 0) {
                i--;
            }
            i++;
        }

        i = 0;
        while (i < itemNum) {
            var ipos = { x: randInt(sizeX), y: randInt(sizeY) };
            var imp = mirrorPoint(ipos, sizeX, sizeY);
            var aroundOk = !(uniformNorm(pos0, ipos) <= 1 || uniformNorm(pos1, ipos) <= 1);
            if (aroundOk && !samePos(ipos, pos0) && !samePos(ipos, pos1) &&
                cells[ipos.y][ipos.x] !== 3 && cells[ipos.y][ipos.x] !== 2 && !samePos(ipos, center)) {
                cells[ipos.y][ipos.x] = 3;
                if (mirror) {
                    if (!samePos(imp, pos0) && !samePos(imp, pos1) &&
                        cells[imp.y][imp.x] !== 3 && cells[imp.y][imp.x] !== 2 && !samePos(imp, center)) {
                        cells[imp.y][imp.x] = 3;
                        i++;
                    }
                }
            } else if (i > 0) {
                i--;
            }
            i++;
        }
        if (mirror) cells[center.y][center.x] = 3;

        return { sizeX: sizeX, sizeY: sizeY, turnMax: turnMax, cells: cells, coolPos: pos0, hotPos: pos1, name: 'RandomMap' };
    }

    var MAP_RANDOM_GEN = { generateRandomMap: generateRandomMap };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MAP_RANDOM_GEN;
    } else {
        root.MAP_RANDOM_GEN = MAP_RANDOM_GEN;
    }
})(typeof window !== 'undefined' ? window : this);

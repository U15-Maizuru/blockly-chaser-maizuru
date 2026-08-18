// 対戦モード用(map-editor.js)とPython版(python/python-map-editor.js)の
// マップエディタで共通利用するグリッド描画・ペイント・ツールバーのUIロジック。
// map_format.js と同じUMD形式で、ブラウザでは window.MAP_GRID_UI として、
// Node.js では require() で module.exports として、同じ内容を参照できる。
(function (root) {

    // グリッドの許容サイズ範囲。tool/validate_room.js の MAP_SIZE_MIN/MAX と一致させる
    // (サーバー側のバリデーションを通過できるマップだけをエディタ上でも作れるようにするため)。
    var SIZE_MIN = 5;
    var SIZE_MAX = 30;

    var MAP_TOOL_CELL_VALUE = { floor: 0, block: 2, item: 3 };
    var CELL_CLASS_BY_VALUE = { 0: 'floor', 2: 'block', 3: 'item' };

    function emptyCells(sizeX, sizeY) {
        var cells = [];
        for (var y = 0; y < sizeY; y++) cells.push(new Array(sizeX).fill(0));
        return cells;
    }

    function createEmptyGrid(sizeX, sizeY, turnMax) {
        return { sizeX: sizeX, sizeY: sizeY, turnMax: turnMax, cells: emptyCells(sizeX, sizeY), coolPos: null, hotPos: null };
    }

    // 指定サイズにクロップ/パディングした新しい cells を作り、範囲外に出た coolPos/hotPos は破棄する。
    function resizeGrid(grid, newX, newY) {
        newX = Math.max(SIZE_MIN, Math.min(SIZE_MAX, newX));
        newY = Math.max(SIZE_MIN, Math.min(SIZE_MAX, newY));
        var newCells = [];
        for (var y = 0; y < newY; y++) {
            var row = [];
            for (var x = 0; x < newX; x++) {
                row.push((grid.cells[y] && grid.cells[y][x] !== undefined) ? grid.cells[y][x] : 0);
            }
            newCells.push(row);
        }
        grid.cells = newCells;
        grid.sizeX = newX;
        grid.sizeY = newY;
        if (grid.coolPos && (grid.coolPos.x >= newX || grid.coolPos.y >= newY)) grid.coolPos = null;
        if (grid.hotPos && (grid.hotPos.x >= newX || grid.hotPos.y >= newY)) grid.hotPos = null;
        return grid;
    }

    // 対称モードに応じた対のセル座標を返す。対称なし、または軸上で自分自身と一致する場合は null。
    function mirrorCoord(grid, x, y, symmetryMode) {
        var mx = x, my = y;
        if (symmetryMode === 'mirror') { mx = grid.sizeX - 1 - x; }
        else if (symmetryMode === 'rotate') { mx = grid.sizeX - 1 - x; my = grid.sizeY - 1 - y; }
        else { return null; }
        if (mx === x && my === y) return null;
        return { x: mx, y: my };
    }

    // coolPos/hotPos の一方に pos を設定する。同じマスに他方が既にある場合はそちらを消す
    // (1マスに Cool/Hot が同時に存在できないという既存の仕様を維持するため)。
    function setPlayerPos(grid, key, pos) {
        var otherKey = key === 'coolPos' ? 'hotPos' : 'coolPos';
        if (grid[otherKey] && grid[otherKey].x === pos.x && grid[otherKey].y === pos.y) {
            grid[otherKey] = null;
        }
        grid[key] = pos;
    }

    // grid を破壊的に更新する。tool は 'floor'|'block'|'item'|'cool'|'hot'。
    function paintCell(grid, x, y, tool, symmetryMode) {
        var mirror = mirrorCoord(grid, x, y, symmetryMode);

        if (tool === 'cool' || tool === 'hot') {
            var key = tool === 'cool' ? 'coolPos' : 'hotPos';
            var otherToolKey = tool === 'cool' ? 'hotPos' : 'coolPos';
            setPlayerPos(grid, key, { x: x, y: y });
            if (mirror) setPlayerPos(grid, otherToolKey, mirror);
            return;
        }

        var value = MAP_TOOL_CELL_VALUE[tool];
        if (value === undefined) return;
        grid.cells[y][x] = value;
        if (mirror) grid.cells[mirror.y][mirror.x] = value;
    }

    function cellClassName(grid, x, y) {
        if (grid.coolPos && grid.coolPos.x === x && grid.coolPos.y === y) return 'map-edit-cell player0';
        if (grid.hotPos && grid.hotPos.x === x && grid.hotPos.y === y) return 'map-edit-cell player1';
        return 'map-edit-cell ' + (CELL_CLASS_BY_VALUE[grid.cells[y][x]] || 'floor');
    }

    // container(CSS Gridを想定した要素)の中身を grid の内容で作り直す。
    // 対戦モードのようにビューポート追従でセルサイズを決めたい場合のため、
    // 行数/列数を --cols/--rows のCSSカスタムプロパティとしても公開する
    // (未参照でも副作用はないので、固定セルサイズを使うホスト側は無視してよい)。
    function render(container, grid) {
        if (!container) return;
        container.style.setProperty('--cols', grid.sizeX);
        container.style.setProperty('--rows', grid.sizeY);
        container.style.gridTemplateColumns = 'repeat(' + grid.sizeX + ', var(--map-cell-size, 20px))';
        container.style.gridTemplateRows = 'repeat(' + grid.sizeY + ', var(--map-cell-size, 20px))';
        container.innerHTML = '';
        var fragment = document.createDocumentFragment();
        for (var y = 0; y < grid.sizeY; y++) {
            for (var x = 0; x < grid.sizeX; x++) {
                var cell = document.createElement('div');
                cell.className = cellClassName(grid, x, y);
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.title = '(' + x + ', ' + y + ')';
                fragment.appendChild(cell);
            }
        }
        container.appendChild(fragment);
    }

    // container 上のセルへのポインタ操作(クリック、およびドラッグでの連続ペイント)を配線する。
    // onCellAt(x, y) はセルへの入力があるたびに呼ばれる。render() で container の中身を
    // 作り直しても再アタッチ不要なよう、イベント委譲で実装する。
    function attachPaintHandler(container, onCellAt) {
        var painting = false;

        function cellAt(target) {
            var cell = target.closest ? target.closest('.map-edit-cell') : null;
            if (!cell || !container.contains(cell)) return null;
            return cell;
        }

        container.addEventListener('pointerdown', function (e) {
            var cell = cellAt(e.target);
            if (!cell) return;
            painting = true;
            onCellAt(parseInt(cell.dataset.x, 10), parseInt(cell.dataset.y, 10));
            e.preventDefault();
        });
        container.addEventListener('pointerover', function (e) {
            if (!painting) return;
            var cell = cellAt(e.target);
            if (!cell) return;
            onCellAt(parseInt(cell.dataset.x, 10), parseInt(cell.dataset.y, 10));
        });
        document.addEventListener('pointerup', function () { painting = false; });
    }

    // ボタン群の排他選択を配線する汎用ヘルパー。ツールボタン・対称モードボタンの両方で使う。
    function bindToolbarGroup(selector, activeClass, datasetKey, onSelect) {
        var buttons = Array.prototype.slice.call(document.querySelectorAll(selector));
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                buttons.forEach(function (b) { b.classList.remove(activeClass); });
                btn.classList.add(activeClass);
                onSelect(btn.dataset[datasetKey]);
            });
        });
    }

    var MAP_GRID_UI = {
        SIZE_MIN: SIZE_MIN,
        SIZE_MAX: SIZE_MAX,
        createEmptyGrid: createEmptyGrid,
        resizeGrid: resizeGrid,
        paintCell: paintCell,
        render: render,
        attachPaintHandler: attachPaintHandler,
        bindToolbarGroup: bindToolbarGroup
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MAP_GRID_UI;
    } else {
        root.MAP_GRID_UI = MAP_GRID_UI;
    }
})(typeof window !== 'undefined' ? window : this);

// モード③（オフライン練習）専用のローカル練習マップのグリッドエディタ。
// グリッド描画・ペイント・リサイズ・対称配置は public/javascripts/map_grid_ui.js
// (window.MAP_GRID_UI) を対戦モード用エディタ(map-editor.js)と共有する。
// パース/シリアライズ部分も同様に public/javascripts/map_format.js (window.MAP_FORMAT)
// を共有利用する。サーバー側のルームマップ編集ツールとはUI・保存先が別物だが、
// グリッド操作とテキストフォーマットの実装は1つに統一する。
(function (root) {

    function createLocalMapEditor() {
        var mapTool = 'floor';
        var symmetryMode = 'none';
        var mapGrid = root.MAP_GRID_UI.createEmptyGrid(15, 17, 150);

        function renderMapGrid() {
            root.MAP_GRID_UI.render(document.getElementById('map-editor-grid'), mapGrid);
        }

        function initToolbar() {
            root.MAP_GRID_UI.bindToolbarGroup('.map-tool-button', 'active', 'tool', function (tool) {
                mapTool = tool;
            });
            root.MAP_GRID_UI.bindToolbarGroup('.map-sym-button', 'active', 'mode', function (mode) {
                symmetryMode = mode;
            });

            var resizeBtn = document.getElementById('map-resize-button');
            if (resizeBtn) {
                resizeBtn.addEventListener('click', function () {
                    var sizeXInput = document.getElementById('map-size-x');
                    var sizeYInput = document.getElementById('map-size-y');
                    var newX = parseInt(sizeXInput.value, 10) || mapGrid.sizeX;
                    var newY = parseInt(sizeYInput.value, 10) || mapGrid.sizeY;
                    root.MAP_GRID_UI.resizeGrid(mapGrid, newX, newY);
                    sizeXInput.value = mapGrid.sizeX;
                    sizeYInput.value = mapGrid.sizeY;
                    renderMapGrid();
                });
            }

            var turnInput = document.getElementById('map-turn-max');
            if (turnInput) {
                turnInput.addEventListener('change', function () {
                    var t = parseInt(this.value, 10);
                    mapGrid.turnMax = (!isNaN(t) && t > 0) ? t : mapGrid.turnMax;
                    this.value = mapGrid.turnMax;
                });
            }

            var clearBtn = document.getElementById('clear-map-button');
            if (clearBtn) {
                clearBtn.addEventListener('click', function () {
                    mapGrid = root.MAP_GRID_UI.createEmptyGrid(mapGrid.sizeX, mapGrid.sizeY, mapGrid.turnMax);
                    renderMapGrid();
                });
            }
        }

        // サーバー側のルーム(chaser/server.jsのplayer_spon())と同様、cool/hotの
        // 固定座標(C:/H:)を持たないマップ(ランダム配置ルーム)は、床マスの中から
        // 左右に分かれた位置をランダムに選んで割り当てる。これを省略すると
        // isCustomMapEnabled()が常にfalseになり、せっかく引き継いだレイアウトが
        // 無視されて全く無関係なランダムマップにすり替わってしまう。
        function assignRandomSpawnPositions(grid) {
            var leftCandidates = [];
            var rightCandidates = [];
            var midX = Math.floor(grid.sizeX / 2);
            for (var y = 0; y < grid.sizeY; y++) {
                for (var x = 0; x < grid.sizeX; x++) {
                    if (grid.cells[y][x] !== 0) continue;
                    if (x <= midX) leftCandidates.push({ x: x, y: y });
                    else rightCandidates.push({ x: x, y: y });
                }
            }
            if (rightCandidates.length === 0) rightCandidates = leftCandidates;
            if (leftCandidates.length === 0) leftCandidates = rightCandidates;
            if (leftCandidates.length === 0) return;
            grid.coolPos = leftCandidates[Math.floor(Math.random() * leftCandidates.length)];
            grid.hotPos = rightCandidates[Math.floor(Math.random() * rightCandidates.length)];
        }

        // 既存のCodeMirrorエディタと同じインターフェース(getValue/setValue/refresh)を
        // 持つアダプタにすることで、python-editor-core.js のタブ切替・アップロード・
        // ダウンロードの共通コードをそのまま流用できるようにする。
        var adapter = {
            getValue: function () {
                return JSON.stringify(root.MAP_FORMAT.serializeMap(mapGrid), null, 2);
            },
            setValue: function (text) {
                var mapObj;
                try {
                    mapObj = JSON.parse(text);
                } catch (e) {
                    alert('マップの読み込みに失敗しました(JSONの解析エラー)。');
                    return;
                }
                var parsed = root.MAP_FORMAT.isLegacyMap(mapObj)
                    ? root.MAP_FORMAT.parseLegacyMap(mapObj)
                    : root.MAP_FORMAT.parseMap(mapObj);
                if (!parsed.coolPos || !parsed.hotPos) {
                    assignRandomSpawnPositions(parsed);
                }
                mapGrid = parsed;
                renderMapGrid();
                var useCustom = document.getElementById('map-use-custom');
                if (useCustom) useCustom.checked = true;
                var sizeXInput = document.getElementById('map-size-x');
                var sizeYInput = document.getElementById('map-size-y');
                var turnInput = document.getElementById('map-turn-max');
                if (sizeXInput) sizeXInput.value = mapGrid.sizeX;
                if (sizeYInput) sizeYInput.value = mapGrid.sizeY;
                if (turnInput) turnInput.value = mapGrid.turnMax;
            },
            refresh: function () { renderMapGrid(); },
            getMapGrid: function () { return mapGrid; },
            isCustomMapEnabled: function () {
                var useCustom = document.getElementById('map-use-custom');
                return !!(useCustom && useCustom.checked && mapGrid.coolPos && mapGrid.hotPos);
            }
        };

        initToolbar();
        renderMapGrid();
        root.MAP_GRID_UI.attachPaintHandler(document.getElementById('map-editor-grid'), function (x, y) {
            root.MAP_GRID_UI.paintCell(mapGrid, x, y, mapTool, symmetryMode);
            renderMapGrid();
        });

        var generateBtn = document.getElementById('generate-random-map-button');
        if (generateBtn) {
            generateBtn.addEventListener('click', function () {
                if (typeof adapter.onGenerateRandomMap === 'function') {
                    adapter.onGenerateRandomMap();
                }
            });
        }

        return adapter;
    }

    var PYTHON_MAP_EDITOR = { createLocalMapEditor: createLocalMapEditor };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PYTHON_MAP_EDITOR;
    } else {
        root.PYTHON_MAP_EDITOR = PYTHON_MAP_EDITOR;
    }
})(typeof window !== 'undefined' ? window : this);

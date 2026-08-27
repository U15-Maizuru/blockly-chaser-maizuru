// Blockly版・Python版で共通の盤面テーブル/スコアパネル描画モジュール。
// Blockly版views/programming.ejs(public/javascripts/game_server_client.js)と
// Python版4画面(local-runner.js/net-runner.js)の両方から利用する、唯一の実装。
// map_dataの値は共通のゲームエンジン(chaser/server.js)由来のエンコーディングをそのまま
// 使う: 0=床 2=ブロック 3=アイテム 4=cool 5=hot 45=cool&hot重複 54=hot&cool重複。
// 対応するCSSは public/stylesheets/game-display.css に共有定義がある。
// なお視界の霧(自分・相手周辺以外を暗くする演出)は観戦/リプレイ専用の
// game_board.js(match.ejs/watching.ejs)のみの挙動とし、ここでは再現しない。
(function (root) {

    var CELL_IMG_CLASS = { 0: 'field_img', 2: 'wall_img', 3: 'hart_img', 4: 'cool_img', 5: 'hot_img', 45: 'ch_img', 54: 'hc_img' };

    // options.cellSize(px数値)を渡すと各tdに明示的な幅・高さを設定する。
    // Blockly版/programmingの既存の動的サイズ計算((450-4*y)/y)を差し込むための
    // 口で、Python版はこれを渡さずCSS側の固定サイズに任せる。
    // 戻り値: { table, itemCount, cx, cy, hx, hy }
    //   cx/cy = coolの座標、hx/hy = hotの座標(見つからなければfalse)。
    //   呼び出し側(被弾エフェクトのハイライト処理等)がtableを直接操作できるようにする。
    function renderBoard(containerId, mapData, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return { table: null, itemCount: 0, cx: false, cy: false, hx: false, hy: false };
        container.innerHTML = '';

        var table = document.createElement('table');
        table.id = 'game_board_table';

        var itemCount = 0;
        var cx = false, cy = false, hx = false, hy = false;

        for (var i = 0; i < mapData.length; i++) {
            var row = table.insertRow(-1);
            for (var j = 0; j < mapData[i].length; j++) {
                var value = mapData[i][j];
                if (value === 3) itemCount++;
                if (value === 4 || value === 45 || value === 54) { cx = j; cy = i; }
                if (value === 5 || value === 45 || value === 54) { hx = j; hy = i; }

                var cell = row.insertCell(-1);
                cell.className = CELL_IMG_CLASS[value] || 'field_img';
                if (options.cellSize) {
                    cell.style.width = options.cellSize + 'px';
                    cell.style.height = options.cellSize + 'px';
                }
            }
        }

        container.appendChild(table);
        return { table: table, itemCount: itemCount, cx: cx, cy: cy, hx: hx, hy: hy };
    }

    // Blockly版game_board.js内で組み立てられる#game_info_div(残ターン数・cool/hot
    // スコア・残アイテム数のバッジ)と同じDOM構造・IDで描画する。
    function renderInfoPanel(containerId, info) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        var odiv = document.createElement('div');
        odiv.id = 'game_info_div';

        var turnDiv = document.createElement('div');
        turnDiv.id = 'turn_div';
        var turnTitle = document.createElement('div');
        turnTitle.id = 'turn_title';
        turnTitle.textContent = '残りターン数';
        var turnN = document.createElement('div');
        turnN.id = 'turn_n';
        turnN.textContent = info.turn;
        turnDiv.appendChild(turnTitle);
        turnDiv.appendChild(turnN);

        var coolDiv = document.createElement('div');
        coolDiv.id = 'cool_info_div';
        var coolName = document.createElement('div');
        coolName.id = 'cool_name';
        coolName.textContent = info.coolName;
        var coolScore = document.createElement('div');
        coolScore.id = 'cool_score';
        coolScore.textContent = info.coolScore;
        coolDiv.appendChild(coolName);
        coolDiv.appendChild(coolScore);

        var hotDiv = document.createElement('div');
        hotDiv.id = 'hot_info_div';
        var hotName = document.createElement('div');
        hotName.id = 'hot_name';
        hotName.textContent = info.hotName;
        var hotScore = document.createElement('div');
        hotScore.id = 'hot_score';
        hotScore.textContent = info.hotScore;
        hotDiv.appendChild(hotName);
        hotDiv.appendChild(hotScore);

        var hartDiv = document.createElement('div');
        hartDiv.id = 'hart_div';
        var hartTitle = document.createElement('div');
        hartTitle.id = 'hart_title';
        hartTitle.textContent = '残りアイテム数';
        var hartN = document.createElement('div');
        hartN.id = 'hart_n';
        hartN.textContent = info.itemCount;
        hartDiv.appendChild(hartTitle);
        hartDiv.appendChild(hartN);

        odiv.appendChild(turnDiv);
        odiv.appendChild(coolDiv);
        odiv.appendChild(hotDiv);
        odiv.appendChild(hartDiv);

        container.appendChild(odiv);
    }

    var GAME_DISPLAY = {
        CELL_IMG_CLASS: CELL_IMG_CLASS,
        renderBoard: renderBoard,
        renderInfoPanel: renderInfoPanel
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GAME_DISPLAY;
    } else {
        root.GAME_DISPLAY = GAME_DISPLAY;
    }
})(typeof window !== 'undefined' ? window : this);

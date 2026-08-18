(function () {
  var DEFAULT_SIZE_X = 15;
  var DEFAULT_SIZE_Y = 17;
  var DEFAULT_TURN = 100;

  var grid = MAP_GRID_UI.createEmptyGrid(DEFAULT_SIZE_X, DEFAULT_SIZE_Y, DEFAULT_TURN);
  var currentTool = 'floor';
  var symmetryMode = 'none';

  // ─── 描画 ─────────────────────────────────────────────────────────────────

  function renderGrid() {
    MAP_GRID_UI.render(document.getElementById('editor_grid'), grid);
  }

  function syncSizeInputs() {
    document.getElementById('map_size_x').value = grid.sizeX;
    document.getElementById('map_size_y').value = grid.sizeY;
  }

  // ─── サイズ変更 ───────────────────────────────────────────────────────────

  function applyResize() {
    var newX = parseInt(document.getElementById('map_size_x').value, 10) || grid.sizeX;
    var newY = parseInt(document.getElementById('map_size_y').value, 10) || grid.sizeY;
    MAP_GRID_UI.resizeGrid(grid, newX, newY);
    syncSizeInputs();
    renderGrid();
  }

  // ─── ランダムマップ生成 ─────────────────────────────────────────────────────

  function generateRandomMap() {
    var turn = parseInt(document.getElementById('map_turn').value, 10) || DEFAULT_TURN;
    grid = MAP_RANDOM_GEN.generateRandomMap({ sizeX: grid.sizeX, sizeY: grid.sizeY, turnMax: turn });
    renderGrid();
    showStatus('ランダムマップを生成しました', false);
  }

  // ─── マップ読み込み ───────────────────────────────────────────────────────

  async function loadMap(file) {
    const text = await file.text();
    let json;
    try { json = JSON.parse(text); }
    catch { showStatus('JSON の解析に失敗しました', true); return; }

    if (json.name) document.getElementById('map_name').value = json.name;

    if (json.map && typeof json.map === 'object') {
      const parsed = MAP_FORMAT.parseMap(json.map);
      document.getElementById('map_turn').value = parsed.turnMax;
      grid = { sizeX: parsed.sizeX, sizeY: parsed.sizeY, turnMax: parsed.turnMax, cells: parsed.cells, coolPos: parsed.coolPos, hotPos: parsed.hotPos };
      syncSizeInputs();
      showStatus('読み込みました', false);
    } else if (MAP_FORMAT.isLegacyMap(json)) {
      const parsed = MAP_FORMAT.parseLegacyMap(json);
      document.getElementById('map_turn').value = parsed.turnMax;
      grid = { sizeX: parsed.sizeX, sizeY: parsed.sizeY, turnMax: parsed.turnMax, cells: parsed.cells, coolPos: parsed.coolPos, hotPos: parsed.hotPos };
      syncSizeInputs();
      showStatus('旧形式のマップを読み込みました', false);
    } else {
      grid = MAP_GRID_UI.createEmptyGrid(DEFAULT_SIZE_X, DEFAULT_SIZE_Y, DEFAULT_TURN);
      syncSizeInputs();
      showStatus('map が見つからないため空のマップを表示しました', true);
    }

    renderGrid();
  }

  // ─── ダウンロード ──────────────────────────────────────────────────────────

  function downloadMap() {
    const name = document.getElementById('map_name').value.trim() || 'my_map';
    const turn = parseInt(document.getElementById('map_turn').value) || DEFAULT_TURN;
    const map = MAP_FORMAT.serializeMap({
      name, sizeX: grid.sizeX, sizeY: grid.sizeY, turnMax: turn, cells: grid.cells, coolPos: grid.coolPos, hotPos: grid.hotPos
    });
    const json = { name, turn, map };
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[\\/:*?"<>|]/g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ─── 対戦ルーム作成 ───────────────────────────────────────────────────────

  async function createRoom() {
    const name = document.getElementById('map_name').value.trim();
    const turn = parseInt(document.getElementById('map_turn').value);

    if (!name) { showStatus('マップ名を入力してください', true); return; }
    if (!turn || turn < 1 || turn > 500) { showStatus('ターン数は 1〜500 で入力してください', true); return; }

    showStatus('作成中…', false);

    const map = MAP_FORMAT.serializeMap({
      name, sizeX: grid.sizeX, sizeY: grid.sizeY, turnMax: turn, cells: grid.cells, coolPos: grid.coolPos, hotPos: grid.hotPos
    });

    const payload = { name, turn, map };

    try {
      const res = await fetch('/api/upload-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json());

      if (res.ok) {
        window.location.href = '/menu-match?select=' + res.room_id;
      } else {
        showStatus(res.errors.join(' / '), true);
      }
    } catch (e) {
      showStatus('通信エラーが発生しました', true);
    }
  }

  // ─── ステータス表示 ───────────────────────────────────────────────────────

  function showStatus(msg, isError) {
    const el = document.getElementById('editor_status');
    el.textContent = msg;
    el.style.color = isError ? '#e05555' : '#2faea1';
  }

  // ─── 起動 ─────────────────────────────────────────────────────────────────

  window.addEventListener('load', function () {
    renderGrid();

    MAP_GRID_UI.attachPaintHandler(document.getElementById('editor_grid'), function (x, y) {
      MAP_GRID_UI.paintCell(grid, x, y, currentTool, symmetryMode);
      renderGrid();
    });

    MAP_GRID_UI.bindToolbarGroup('.tool_btn', 'tool_btn_active', 'tool', function (tool) {
      currentTool = tool;
    });
    MAP_GRID_UI.bindToolbarGroup('.sym_btn', 'sym_btn_active', 'mode', function (mode) {
      symmetryMode = mode;
    });

    document.getElementById('btn_resize').addEventListener('click', applyResize);
    document.getElementById('btn_random').addEventListener('click', generateRandomMap);

    document.getElementById('load_map_file').addEventListener('change', function () {
      if (this.files[0]) { loadMap(this.files[0]); this.value = ''; }
    });

    document.getElementById('btn_clear').addEventListener('click', function () {
      grid = MAP_GRID_UI.createEmptyGrid(grid.sizeX, grid.sizeY, grid.turnMax);
      renderGrid();
      showStatus('', false);
    });

    document.getElementById('btn_download').addEventListener('click', downloadMap);
    document.getElementById('btn_create').addEventListener('click', createRoom);
  });

})();

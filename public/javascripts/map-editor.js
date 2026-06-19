(function () {
  const MAP_W = 15;
  const MAP_H = 17;

  const CELL_TYPES = [
    { value: 0, label: 'なし',       cls: 'field_img' },
    { value: 1, label: 'ブロック',   cls: 'wall_img'  },
    { value: 2, label: 'アイテム',   cls: 'hart_img'  },
    { value: 3, label: 'COOL', cls: 'cool_img' },
    { value: 4, label: 'HOT',  cls: 'hot_img'  },
  ];

  let mapData = [];
  let currentTool = 0;
  let isPainting = false;
  let symmetryMode = 'none'; // 'none' | 'mirror' | 'rotate'

  // ─── 初期化 ───────────────────────────────────────────────────────────────

  function initMap() {
    mapData = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(0));
  }

  function buildGrid() {
    const table = document.getElementById('editor_grid');
    table.innerHTML = '';
    for (let y = 0; y < MAP_H; y++) {
      const tr = table.insertRow(-1);
      for (let x = 0; x < MAP_W; x++) {
        const td = tr.insertCell(-1);
        td.dataset.x = x;
        td.dataset.y = y;
        td.addEventListener('mousedown', onCellDown);
        td.addEventListener('mousemove', onCellMove);
      }
    }
    document.addEventListener('mouseup', () => { isPainting = false; });
  }

  function renderGrid() {
    const table = document.getElementById('editor_grid');
    const rows = table.rows;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const td = rows[y].cells[x];
        td.className = CELL_TYPES[mapData[y][x]].cls;
      }
    }
  }

  // ─── 描画 ─────────────────────────────────────────────────────────────────

  // COOL/HOT は対称配置時に互いに入れ替える
  function symValue(v) {
    if (v === 3) return 4;
    if (v === 4) return 3;
    return v;
  }

  function paintCell(td) {
    const x = parseInt(td.dataset.x);
    const y = parseInt(td.dataset.y);
    const v = currentTool;

    // 対称位置を計算
    let sx = x, sy = y;
    if (symmetryMode === 'mirror') { sx = MAP_W - 1 - x; }
    if (symmetryMode === 'rotate') { sx = MAP_W - 1 - x; sy = MAP_H - 1 - y; }
    const sv = (symmetryMode !== 'none') ? symValue(v) : v;
    const hasSymPair = (sx !== x || sy !== y);

    // 配置するセルのリスト（主・対称）
    const placements = [{ x, y, v }];
    if (hasSymPair) placements.push({ x: sx, y: sy, v: sv });

    // COOL/HOT の重複排除してから配置
    for (const p of placements) {
      if (p.v === 3 || p.v === 4) {
        for (let ry = 0; ry < MAP_H; ry++) {
          for (let rx = 0; rx < MAP_W; rx++) {
            if (mapData[ry][rx] === p.v) mapData[ry][rx] = 0;
          }
        }
      }
      mapData[p.y][p.x] = p.v;
    }

    renderGrid();
  }

  function onCellDown(e) {
    isPainting = true;
    paintCell(e.currentTarget);
    e.preventDefault();
  }

  function onCellMove(e) {
    if (isPainting) paintCell(e.currentTarget);
  }

  // ─── ツールバー ───────────────────────────────────────────────────────────

  function initToolbar() {
    document.querySelectorAll('.tool_btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTool = parseInt(btn.dataset.value);
        document.querySelectorAll('.tool_btn').forEach(b => b.classList.remove('tool_btn_active'));
        btn.classList.add('tool_btn_active');
      });
    });
    document.querySelector('.tool_btn[data-value="0"]').classList.add('tool_btn_active');
  }

  // ─── 対称モード ───────────────────────────────────────────────────────────

  function initSymmetry() {
    document.querySelectorAll('.sym_btn').forEach(btn => {
      btn.addEventListener('click', () => {
        symmetryMode = btn.dataset.mode;
        document.querySelectorAll('.sym_btn').forEach(b => b.classList.remove('sym_btn_active'));
        btn.classList.add('sym_btn_active');
      });
    });
  }

  // ─── マップ読み込み ───────────────────────────────────────────────────────

  async function loadMap(file) {
    const text = await file.text();
    let json;
    try { json = JSON.parse(text); }
    catch { showStatus('JSON の解析に失敗しました', true); return; }

    if (json.name)  document.getElementById('map_name').value = json.name;
    if (json.turn)  document.getElementById('map_turn').value = json.turn;

    if (json.map_data && json.map_data.length > 0) {
      // 寸法が異なる場合は中央にコピー（範囲外は0埋め）
      const srcH = json.map_data.length;
      const srcW = json.map_data[0].length;
      if (srcH !== MAP_H || srcW !== MAP_W) {
        initMap();
        const offY = Math.floor((MAP_H - srcH) / 2);
        const offX = Math.floor((MAP_W - srcW) / 2);
        for (let y = 0; y < srcH && y + offY < MAP_H; y++) {
          for (let x = 0; x < srcW && x + offX < MAP_W; x++) {
            if (y + offY >= 0 && x + offX >= 0) {
              mapData[y + offY][x + offX] = json.map_data[y][x] ?? 0;
            }
          }
        }
        showStatus(`サイズが ${srcW}×${srcH} のため中央に配置しました`, false);
      } else {
        mapData = json.map_data.map(row => [...row]);
        showStatus('読み込みました', false);
      }
    } else {
      // map_data なし（ランダムマップ）→ cool/hot 座標をセルに反映
      initMap();
      if (json.cool && json.cool.x >= 0) mapData[json.cool.y][json.cool.x] = 3;
      if (json.hot  && json.hot.x  >= 0) mapData[json.hot.y ][json.hot.x ] = 4;
      showStatus('ランダムマップのため初期配置のみ読み込みました', false);
    }

    renderGrid();
  }

  // ─── ダウンロード ──────────────────────────────────────────────────────────

  function downloadMap() {
    const name = document.getElementById('map_name').value.trim() || 'my_map';
    const turn = parseInt(document.getElementById('map_turn').value) || 100;
    const json = {
      name,
      map_size_x: MAP_W,
      map_size_y: MAP_H,
      map_data:   mapData,
      turn,
    };
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

    const payload = {
      name,
      turn,
      map_size_x: MAP_W,
      map_size_y: MAP_H,
      map_data:   mapData,
    };

    try {
      const res = await fetch('/api/upload-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json());

      if (res.ok) {
        window.location.href = '/menu-match';
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
    initMap();
    buildGrid();
    renderGrid();
    initToolbar();
    initSymmetry();

    document.getElementById('load_map_file').addEventListener('change', function () {
      if (this.files[0]) { loadMap(this.files[0]); this.value = ''; }
    });

    document.getElementById('btn_clear').addEventListener('click', function () {
      initMap(); renderGrid(); showStatus('', false);
    });

    document.getElementById('btn_download').addEventListener('click', downloadMap);
    document.getElementById('btn_create').addEventListener('click', createRoom);
  });

})();

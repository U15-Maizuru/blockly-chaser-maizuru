function createserverList(get_list) {
  const existingList = [];  // auto_xxx（既存マップ）
  const uploadList   = [];  // upload_xxx（アップロードルーム）

  for (var key in get_list) {
    const server = get_list[key];
    if (server.name.includes('room_onetime')) continue;
    if (server.cpu) {
      existingList.push(server);
    } else if (key.startsWith('upload_') && !key.includes('?')) {
      // token付き（upload_XXXX?token）は除外
      uploadList.push(server);
    } else if (key.startsWith('vs_') && !get_list[key.replace(/^vs_/, 'auto_')]) {
      existingList.push(server);
    }
  }

  renderCards(existingList, document.getElementById('server_list_cards'),  get_list);
  renderCards(uploadList,   document.getElementById('upload_room_cards'),   get_list);
}

function renderCards(list, container, get_list) {
  container.innerHTML = '';
  const rowDiv = document.createElement('div');
  rowDiv.classList.add('server_row');

  list.forEach(server => {
    const one_server_div = document.createElement('div');
    one_server_div.classList.add("one_watching_server");
    one_server_div.setAttribute("id", "link_id_" + server.room_id);

    const server_div = document.createElement('div');
    server_div.classList.add(server.room_id);
    server_div.classList.add("watching_server_div");

    const server_name = document.createElement('div');
    server_name.classList.add("server_name");
    server_name.appendChild(document.createTextNode(server.name.replace("room_onetime_", "")));
    server_div.appendChild(server_name);

    server_div.onclick = function (e) {
      var serverId = this.classList[0];
      document.querySelectorAll('.watching_server_div').forEach(div => {
        div.classList.remove("server_select_on");
      });
      this.classList.add("server_select_on");
      server_info(serverId, get_list);
      e.stopPropagation();
    };

    one_server_div.appendChild(server_div);
    rowDiv.appendChild(one_server_div);
  });

  container.appendChild(rowDiv);
}

function server_info(id, get_list) {

  var data = get_list[id].map_data;
  var c = document.getElementById("map_table");
  if (c) { c.parentNode.removeChild(c); }
  var rows = [];
  var table = document.createElement("table");
  table.setAttribute("id", "map_table");

  for (i = 0; i < data.length; i++) {
    rows.push(table.insertRow(-1));
    for (j = 0; j < data[0].length; j++) {
      cell = rows[i].insertCell(-1);
      if (data[i][j] == 0)       { cell.classList.add("field_img"); }
      else if (data[i][j] == 1)  { cell.classList.add("wall_img"); }
      else if (data[i][j] == 2)  { cell.classList.add("hart_img"); }
      else if (data[i][j] == 3)  { cell.classList.add("cool_img"); }
      else if (data[i][j] == 4)  { cell.classList.add("hot_img"); }
      else if (data[i][j] == 34) { cell.classList.add("ch_img"); }
      else if (data[i][j] == 43) { cell.classList.add("hc_img"); }
    }
  }

  ['server_info_div', 'server_join_div', 'server_watch_div',
   'server_info_name', 'server_access_div', 'server_mode_div'].forEach(elemId => {
    c = document.getElementById(elemId);
    if (c) c.parentNode.removeChild(c);
  });

  const server = get_list[id];
  const hasCpuMode = !!server.cpu;
  const hasVsMode  = !!get_list[id.replace(/^auto_/, 'vs_')];
  let currentMode  = hasVsMode ? 'vs' : 'auto';

  // マップ名
  var server_info_name = document.createElement('div');
  server_info_name.setAttribute("id", "server_info_name");
  server_info_name.appendChild(document.createTextNode(server.name));

  // サーバー情報ボックス
  var server_info_div = document.createElement('div');
  server_info_div.setAttribute("id", "server_info_div");

  var server_info_title = document.createElement('span');
  server_info_title.appendChild(document.createTextNode(lng_list["SERVER_INFO"]));

  var server_info_id = document.createElement('div');
  server_info_id.setAttribute("id", "server_info_id");

  var server_info_map = document.createElement('div');
  server_info_map.setAttribute("id", "server_info_map");
  var map_status = lng_list["FIXITY"];
  if (!server.map_data.length) {
    table.classList.add("auto_create_map");
    map_status = lng_list["AUTOMATIC_GENERATION"];
    map_status += server.auto_symmetry ? lng_list["SYMMETRY"] : lng_list["RANDOM"];
  }
  server_info_map.appendChild(document.createTextNode(map_status));

  var server_info_turn = document.createElement('div');
  server_info_turn.setAttribute("id", "server_info_turn");

  server_info_div.appendChild(server_info_title);
  server_info_div.appendChild(server_info_id);
  server_info_div.appendChild(server_info_map);
  server_info_div.appendChild(server_info_turn);

  // モードセレクター
  var server_mode_div = document.createElement('div');
  server_mode_div.setAttribute("id", "server_mode_div");

  var vs_btn   = null;
  var auto_btn = null;

  if (hasVsMode) {
    vs_btn = document.createElement('button');
    vs_btn.classList.add('mode_btn');
    vs_btn.textContent = 'VS対戦';
    vs_btn.onclick = () => updateMode('vs');
    server_mode_div.appendChild(vs_btn);
  }

  if (hasCpuMode) {
    auto_btn = document.createElement('button');
    auto_btn.classList.add('mode_btn');
    auto_btn.textContent = 'CPU対戦';
    auto_btn.onclick = () => updateMode('auto');
    server_mode_div.appendChild(auto_btn);
  }

  // アクセスエリア
  var server_access_div = document.createElement('div');
  server_access_div.setAttribute("id", "server_access_div");

  var server_token_input = document.createElement('input');
  server_token_input.setAttribute("id", "server_token_input");
  server_token_input.classList.add("server_token_input");
  server_token_input.type = 'text';
  server_token_input.placeholder = '合言葉を入力';
  server_token_input.addEventListener('input', function() {
    this.value = this.value.replace(/[^\x00-\x7F]/g, '');
  });

  var server_match_button = document.createElement('button');
  server_match_button.setAttribute("id", "server_match_button");
  server_match_button.classList.add("server_match_button");
  server_match_button.innerText = lng_list["MATCH"];
  server_match_button.addEventListener('click', function() {
    var effectiveId = (currentMode === 'vs') ? id.replace(/^auto_/, 'vs_') : id;
    var token = encodeURIComponent(server_token_input.value);
    if (token === '') token = 'no_token';
    window.location.href = '/match?room_id=' + effectiveId + '&room_token=' + token;
  });

  var server_watch_button = document.createElement('button');
  server_watch_button.setAttribute("id", "server_watch_button");
  server_watch_button.classList.add("server_watch_button");
  server_watch_button.innerText = lng_list["WATCHING"];
  server_watch_button.addEventListener('click', function() {
    var effectiveId = (currentMode === 'vs') ? id.replace(/^auto_/, 'vs_') : id;
    var token = encodeURIComponent(server_token_input.value);
    if (token === '') token = 'no_token';
    window.location.href = '/watching?room_id=' + effectiveId + '&room_token=' + token;
  });

  server_access_div.appendChild(server_match_button);
  server_access_div.appendChild(server_watch_button);
  server_access_div.appendChild(server_token_input);

  // モード切り替え（ID・ターン情報・ボタン選択状態を更新）
  function updateMode(mode) {
    currentMode = mode;
    var effectiveId = (mode === 'vs') ? id.replace(/^auto_/, 'vs_') : id;

    // upload_ プレフィックスはルームコード（4文字）のみ表示
    server_info_id.textContent = effectiveId.startsWith('upload_')
      ? effectiveId.replace('upload_', '')
      : effectiveId;

    if (mode === 'vs') {
      server_info_turn.textContent = lng_list["CONNECTION_ORDER"];
    } else {
      var turn_status = lng_list["FIXITY"];
      turn_status += (server.cpu.turn == "cool") ? lng_list["TURN_H"] : lng_list["TURN_C"];
      server_info_turn.textContent = turn_status;
    }

    if (vs_btn)   vs_btn.classList.toggle('mode_btn_active', mode === 'vs');
    if (auto_btn) auto_btn.classList.toggle('mode_btn_active', mode === 'auto');
  }

  updateMode(currentMode);

  document.getElementById("watching_info").appendChild(server_info_name);
  document.getElementById("watching_info").appendChild(table);
  document.getElementById("watching_info").appendChild(server_mode_div);
  document.getElementById("watching_info").appendChild(server_info_div);
  document.getElementById("watching_info").appendChild(server_access_div);
  document.getElementById("menu_area").classList.add("select_back");
}


window.addEventListener('load', function () {
  // マップエディタ/アップロード後の ?select= で自動選択
  const params = new URLSearchParams(window.location.search);
  getserverList(params.get('select'));

  const fileInput = document.getElementById('upload_map_file');
  const statusDiv = document.getElementById('upload_map_status');

  // ファイルアップロード
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      return showUploadStatus('.json ファイルを選択してください', true);
    }
    if (file.size > 50 * 1024) {
      return showUploadStatus('50 KB 以下のファイルにしてください', true);
    }
    const text = await file.text();
    let json;
    try { json = JSON.parse(text); }
    catch { return showUploadStatus('JSON の解析に失敗しました', true); }

    showUploadStatus('アップロード中…', false);
    const res = await fetch('/api/upload-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json)
    }).then(r => r.json());

    if (res.ok) {
      showUploadStatus('アップロードしました！　ルームコード: ' + res.shortCode, false);
      getserverList(res.room_id);
    } else {
      showUploadStatus(res.errors.join(' / '), true);
    }
    fileInput.value = '';
  });

  // 更新ボタン
  document.getElementById('btn_refresh_rooms').addEventListener('click', () => {
    getserverList();
  });

  // ルームコード直接入室
  const codeInput = document.getElementById('room_code_input');

  function selectByCode() {
    const code = codeInput.value.trim().split(/[\s―\-]/)[0].toUpperCase().slice(0, 4);
    if (!code) return;
    const room_id = 'upload_' + code;
    fetch('./../api/game?room_id=' + room_id)
      .then(r => r.json())
      .then(function(data) {
        if (data) {
          codeInput.value = ''; // 選択後にクリアしてドロップダウンを全件表示に戻す
          getserverList(room_id);
        } else {
          showUploadStatus('ルームが見つかりません', true);
        }
      });
  }

  // datalist から選択されたとき（「  ―  」を含む値が入った時点）自動実行
  codeInput.addEventListener('input', function() {
    if (codeInput.value.includes('  ―  ')) selectByCode();
  });

  codeInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') selectByCode();
  });

  function showUploadStatus(msg, isError) {
    statusDiv.textContent = msg;
    statusDiv.style.color = isError ? '#e05555' : '#2faea1';
  }
})

function updateRoomCodeList(json) {
  var datalist = document.getElementById('room_code_list');
  if (!datalist) return;
  datalist.innerHTML = '';
  for (var key in json) {
    if (key.startsWith('upload_') && !key.includes('?')) {
      // token付き（upload_XXXX?token）は除外
      var code = key.replace('upload_', '');
      var option = document.createElement('option');
      option.value = code + '  ―  ' + json[key].name;
      datalist.appendChild(option);
    }
  }
}

function getserverList(autoSelectId) {
  fetch('./../api/game')
    .then(function(data) {
      return data.json();
    })
    .then(function(json) {
      createserverList(json);
      updateRoomCodeList(json);
      if (autoSelectId && json[autoSelectId]) {
        document.querySelectorAll('.watching_server_div').forEach(function(d) {
          d.classList.remove('server_select_on');
        });
        var card = document.querySelector('.' + autoSelectId);
        if (card) card.classList.add('server_select_on');
        server_info(autoSelectId, json);
      }
    });
}

const path = require('path');
const logger = require('../bin/logger.js');

const config_load = require('../tool/config_data_load');
const { create } = require('domain');
const config = require('../config/config.js');
const json_dir_load = require('../tool/json_dir_load');
const map_format = require('../public/javascripts/map_format.js');

// map (行文字列グリッドJSON) を持つエントリを、既存コードが期待する
// map_data(2D配列)/map_size_x/map_size_y/turn/cool.x,y/hot.x,y の形状に展開する。
// map を持たないエントリ(map_data:[]の手続き生成ルーム)はそのまま素通しする。
const materialize_map = function (entry) {
  if (!entry.map) return entry;

  var parsed = map_format.parseMap(entry.map);
  entry.map_size_x = parsed.sizeX;
  entry.map_size_y = parsed.sizeY;
  entry.turn = parsed.turnMax;
  entry.map_data = map_format.bakeMapData(parsed.cells, parsed.coolPos, parsed.hotPos);

  var coolXY = parsed.coolPos ? { x: parsed.coolPos.x, y: parsed.coolPos.y } : { x: -1, y: -1 };
  var hotXY = parsed.hotPos ? { x: parsed.hotPos.x, y: parsed.hotPos.y } : { x: -1, y: -1 };
  entry.cool = Object.assign({}, entry.cool, coolXY);
  entry.hot = Object.assign({}, entry.hot, hotXY);

  return entry;
};

var mode_path = config_load.electron_conf_load();

var game_server = {};
var join_list = [];

var additional_game_server = [];

// アップロードで作成できるルーム数の上限。
// アップロードは無認証のため、上限がないとメモリを際限なく消費できてしまう
const MAX_UPLOAD_ROOMS = 100;

// アップロードで作成されたルームかどうか ("?" 付きは対戦ごとの一時コピーなので対象外)
const is_upload_room = function (room_id) {
    return typeof room_id === 'string' && room_id.startsWith('upload_') && !room_id.includes('?');
};

const init = async function () {
  var game_server_dir = path.join(__dirname, mode_path, '..', 'load_data', 'game_server_data');
  var loaded = json_dir_load.loadDirAsMap(game_server_dir, JSON.parse, (parsed) => parsed.room_id, 'game server data');
  for (var room_id in loaded) {
    var temp_game_server = materialize_map(loaded[room_id]);
    game_server[room_id] = temp_game_server;
    if (!temp_game_server.cpu){
      join_list.push(["VS: " + temp_game_server.name, temp_game_server.room_id]);
    } else {
      join_list.push(["AUTO: " + temp_game_server.name, temp_game_server.room_id]);
    }
    // cpu ありの場合、cpu なしの VS ルームを自動生成
    if (temp_game_server.cpu) {
      var vs_map = JSON.parse(JSON.stringify(temp_game_server));
      delete vs_map.cpu;
      vs_map.room_id = temp_game_server.room_id.replace(/^auto_/, 'vs_');
      game_server[vs_map.room_id] = vs_map;
      join_list.push(["VS: " + vs_map.name, vs_map.room_id]);
    }
  }
  for (var map of additional_game_server) {
    game_server[map.room_id] = map;
    join_list.push([map.name, map.room_id]);
  }
};


const reload = async function(){
  game_server = {};
  join_list = [];
  await init();

  console.log("game_server reloaded");
  console.log(join_list);
};

const copy_map_by_id = async function (id) {
  for (let room_id in game_server) {
    if (id.includes(room_id) && id.includes("?")) {
      var copy_room_data = JSON.parse(JSON.stringify(game_server[room_id]));
      copy_room_data.room_id = id;
      copy_room_data.name = "room_onetime_" + copy_room_data.name;
      create_new_map(copy_room_data);
    }
  }
}

// 追加ルームを登録する。作成できた場合は true、上限超過や不正データの場合は false を返す
const create_new_map = async function(json){
  try {
    var temp_game_server = typeof json === 'string' ? JSON.parse(json) : json;
    if(temp_game_server.room_id){
        if (is_upload_room(temp_game_server.room_id)) {
            var upload_count = additional_game_server.filter(map => is_upload_room(map.room_id)).length;
            if (upload_count >= MAX_UPLOAD_ROOMS) {
                logger.error('Upload room limit reached. Rejected room_id: ' + temp_game_server.room_id);
                return false;
            }
        }
        temp_game_server.delete_time = Date.now() + 1000 * 60 * config.deleteRoomTime;
        materialize_map(temp_game_server);
        game_server[temp_game_server.room_id] = temp_game_server;
        join_list.push([temp_game_server.name, temp_game_server.room_id]);
        additional_game_server.push(temp_game_server);
        return true;
    } else {
        logger.error('The format of the game server data is incorrect.');
        return false;
    }
  } catch(e) {
    logger.error('Failed to read the game server data.');
    return false;
  }
};


const delete_map = async function(id){
  if(game_server[id] && game_server[id].delete_time){
    delete game_server[id];
    join_list = join_list.filter(item => item[1] !== id);
    // additional_game_server からも取り除く。ここに残すと init() のたびに復活し、
    // 削除済みルームがプロセス生存中ずっと蓄積してしまう
    additional_game_server = additional_game_server.filter(map => map.room_id !== id);
  }
  else{
    console.log("Don't delete permanet map");
  }
};


const create_map = function (key) {

  var map = new Array(game_server[key].map_size_y);
  for (let y = 0; y < game_server[key].map_size_y; y++) {
    map[y] = new Array(game_server[key].map_size_x).fill(0);
  }

  game_server[key].map_data = map;

  var selectable_list = [];

  var tx = Math.floor((game_server[key].map_size_x - 1) / 2);
  var ty = Math.floor((game_server[key].map_size_y - 1) / 2);

  // cool の対角位置に hot を置くため、対称点が盤面内に収まる位置だけを候補にする。
  // 偶数サイズのマップでは対称点が盤外になる組み合わせがあり、そのまま配置すると例外になる
  var isMirrorInside = function (s_x, s_y) {
    var m_x = tx + (tx - s_x);
    var m_y = ty + (ty - s_y);
    return m_x >= 0 && m_x < game_server[key].map_size_x && m_y >= 0 && m_y < game_server[key].map_size_y;
  };

  for (var s_x = 0; s_x < Math.floor(game_server[key].map_size_x / 2) + 1; s_x++) {
    for (var s_y = 0; s_y < game_server[key].map_size_y; s_y++) {
      if (s_y == Math.floor(game_server[key].map_size_y / 2) - 1 && s_x == Math.floor(game_server[key].map_size_x / 2)) {
        break;
      }
      else if (s_x == Math.floor(game_server[key].map_size_x / 2) - 1 && s_y <= Math.floor(game_server[key].map_size_y / 2) + 1 && s_y >= Math.floor(game_server[key].map_size_y / 2) - 1) {
        continue;
      }
      else if (!isMirrorInside(s_x, s_y)) {
        continue;
      }
      else {
        selectable_list.push([s_x, s_y]);
      }
    }
  }

  if (!selectable_list.length) {
    logger.error('Failed to place players. room_id: ' + key);
    return;
  }

  var cxy = Math.floor(Math.random() * selectable_list.length);

  var cx = selectable_list[cxy][0];
  var cy = selectable_list[cxy][1];

  var hx = tx + (tx - cx);
  var hy = ty + (ty - cy);

  selectable_list.splice(cxy, 1);

  game_server[key].cool.x = cx;
  game_server[key].cool.y = cy;
  game_server[key].hot.x = hx;
  game_server[key].hot.y = hy;

  game_server[key].map_data[cy][cx] = 4;
  game_server[key].map_data[hy][hx] = 5;


  if (game_server[key].auto_symmetry) {
    for (var add_list = 0; add_list < 3; add_list++) {
      selectable_list.push([Math.floor(game_server[key].map_size_x / 2) - 1, Math.floor(game_server[key].map_size_y / 2) - 1 + add_list]);
    }


    var selectable_list_temp = selectable_list;
    selectable_list = [];

    for (var list_data = 0; list_data < selectable_list_temp.length; list_data++) {
      if ((selectable_list_temp[list_data][0] >= cx - 1 && selectable_list_temp[list_data][0] <= cx + 1 && selectable_list_temp[list_data][1] >= cy - 1 && selectable_list_temp[list_data][1] <= cy + 1)) {
        continue;
      }
      else {
        selectable_list.push([selectable_list_temp[list_data][0], selectable_list_temp[list_data][1]]);
      }
    }


    if (game_server[key].auto_point % 2 == 0) {
      if (game_server[key].auto_point == 1) {
        game_server[key].auto_point += 1;
      }
      else {
        game_server[key].auto_point -= 1;
      }
    }

    if (game_server[key].auto_block % 2 == 1) {
      if (game_server[key].auto_block == 1) {
        game_server[key].auto_block += 1;
      }
      else {
        game_server[key].auto_block -= 1;
      }
    }
    game_server[key].map_data[ty][tx] = 3;
    game_server[key].auto_point -= 1;
  }
  else {
    selectable_list = [];
    for (var s_x = 0; s_x < game_server[key].map_size_x; s_x++) {
      for (var s_y = 0; s_y < game_server[key].map_size_y; s_y++) {
        if ((s_x < cx - 1 || s_x > cx + 1 || s_y < cy - 1 || s_y > cy + 1) && (s_x < hx - 1 || s_x > hx + 1 || s_y < hy - 1 || s_y > hy + 1)) {
          selectable_list.push([s_x, s_y]);
        }
      }
    }
  }

  var pxy
  var px;
  var py;
  var bxy
  var bx;
  var by;

  if (game_server[key].auto_symmetry) {
    for (var i = 0; i < game_server[key].auto_point / 2; i++) {
      // 配置先を使い果たしたら打ち切る (指定数がマス数を上回っても落ちないようにする)
      if (!selectable_list.length) break;
      pxy = Math.floor(Math.random() * selectable_list.length);
      px = selectable_list[pxy][0];
      py = selectable_list[pxy][1];

      game_server[key].map_data[py][px] = 3;
      if (isMirrorInside(px, py)) {
        game_server[key].map_data[ty + (ty - py)][tx + (tx - px)] = 3;
      }

      selectable_list.splice(pxy, 1);
    }
  }
  else {
    for (var i = 0; i < game_server[key].auto_point; i++) {
      // 配置先を使い果たしたら打ち切る (指定数がマス数を上回っても落ちないようにする)
      if (!selectable_list.length) break;
      pxy = Math.floor(Math.random() * selectable_list.length);
      px = selectable_list[pxy][0];
      py = selectable_list[pxy][1];

      game_server[key].map_data[py][px] = 3;

      selectable_list.splice(pxy, 1);
    }
  }


  var selectable_list_temp = selectable_list;
  selectable_list = [];
  for (var list_data = 0; list_data < selectable_list_temp.length; list_data++) {
    if (selectable_list_temp[list_data][0] < 1 || selectable_list_temp[list_data][0] > game_server[key].map_size_x - 2 || selectable_list_temp[list_data][1] < 1 || selectable_list_temp[list_data][1] > game_server[key].map_size_y - 2) {
      continue;
    }
    else if ((selectable_list_temp[list_data][0] == cx && (selectable_list_temp[list_data][1] == cy + 9 || selectable_list_temp[list_data][1] == cy - 9)) || (selectable_list_temp[list_data][0] == hx && (selectable_list_temp[list_data][1] == hy + 9 || selectable_list_temp[list_data][1] == hy - 9))) {
      continue;
    }
    else {
      selectable_list.push([selectable_list_temp[list_data][0], selectable_list_temp[list_data][1]]);
    }
  }


  if (game_server[key].auto_symmetry) {
    for (var i = 0; i < game_server[key].auto_block / 2; i++) {
      // 配置先を使い果たしたら打ち切る (指定数がマス数を上回っても落ちないようにする)
      if (!selectable_list.length) break;
      bxy = Math.floor(Math.random() * selectable_list.length);
      bx = selectable_list[bxy][0];
      by = selectable_list[bxy][1];

      game_server[key].map_data[by][bx] = 2;
      if (isMirrorInside(bx, by)) {
        game_server[key].map_data[ty + (ty - by)][tx + (tx - bx)] = 2;
      }

      selectable_list.splice(bxy, 1);
    }
  }
  else {
    for (var i = 0; i < game_server[key].auto_block; i++) {
      // 配置先を使い果たしたら打ち切る (指定数がマス数を上回っても落ちないようにする)
      if (!selectable_list.length) break;
      bxy = Math.floor(Math.random() * selectable_list.length);
      bx = selectable_list[bxy][0];
      by = selectable_list[bxy][1];

      game_server[key].map_data[by][bx] = 2;

      selectable_list.splice(bxy, 1);
    }
  }
};

//player spon
const player_spon = function (key) {

  var selectable_list = [];

  for (var s_x = 0; s_x < Math.floor(server_store[key].map_size_x / 2) + 1; s_x++) {
    for (var s_y = 0; s_y < server_store[key].map_size_y; s_y++) {
      if (server_store[key].map_data[s_y][s_x] == 0
        && (!(s_x == Math.floor(server_store[key].map_size_x / 2) && s_y >= Math.floor(server_store[key].map_size_y / 2)))) {
        selectable_list.push([s_x, s_y]);
      }
    }
  }

  var s_xy = Math.floor(Math.random() * selectable_list.length);

  var s_x = selectable_list[s_xy][0];
  var s_y = selectable_list[s_xy][1];

  server_store[key].cool.x = s_x;
  server_store[key].cool.y = s_y;

  server_store[key].map_data[s_y][s_x] = 4;


  if (server_store[key].auto_symmetry) {
    server_store[key].hot.x = server_store[key].map_size_x - s_x;
    server_store[key].hot.y = server_store[key].map_size_y - s_y;
  }
  else {
    var selectable_list = [];

    for (var s_x = Math.floor(server_store[key].map_size_x / 2) + 1; s_x < server_store[key].map_size_x; s_x++) {
      for (var s_y = 0; s_y < server_store[key].map_size_y; s_y++) {
        if (server_store[key].map_data[s_y][s_x] == 0
          && (!(s_x == Math.floor(server_store[key].map_size_x / 2) && s_y <= Math.floor(server_store[key].map_size_y / 2)))) {
          selectable_list.push([s_x, s_y]);
        }
      }
    }

    var s_xy = Math.floor(Math.random() * selectable_list.length);

    var s_x = selectable_list[s_xy][0];
    var s_y = selectable_list[s_xy][1];

    server_store[key].hot.x = s_x;
    server_store[key].hot.y = s_y;
  }

  server_store[key].map_data[s_y][s_x] = 5;
}

const load = function (room = false) {
  if (room) {
    return game_server[room];
  }
  else {
    return game_server;
  }
};

const list_load = function () {
  return join_list;
};

init();

exports.load = load;
exports.list_load = list_load;
exports.create_map = create_map;
exports.player_spon = player_spon;


exports.reload = reload; 
exports.create_new_map = create_new_map; 
exports.copy_map_by_id = copy_map_by_id;
exports.delete_map = delete_map;

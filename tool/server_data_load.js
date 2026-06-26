const fs = require('fs');
const path = require('path');
const logger = require('../bin/logger.js');

const config_load = require('../tool/config_data_load');
const { create } = require('domain');
const config = require('../config/config.js');

var mode_path = config_load.electron_conf_load();

const game_server_list = fs.readdirSync(path.join(__dirname, mode_path, '..', "load_data", "game_server_data"));
var game_server = {};
var join_list = [];

var additional_game_server = [];

const init = async function () {
  for (var gs of game_server_list) {
    try {
      var temp_game_server = JSON.parse(fs.readFileSync(path.join(__dirname, mode_path, '..', 'load_data', 'game_server_data', gs), 'utf8'));
      if (temp_game_server.room_id) {
        game_server[temp_game_server.room_id] = temp_game_server;
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
      else {
        logger.error('The format of the game server data is incorrect. Data to be loaded "' + gs + '"');
      }
    }
    catch (e) {
      logger.error('Failed to read the game server data. Data to be loaded "' + gs + '"');
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

const create_new_map = async function(json){
  try {
    var temp_game_server = typeof json === 'string' ? JSON.parse(json) : json;
    if(temp_game_server.room_id){
        temp_game_server.delete_time = Date.now() + 1000 * 60 * config.deleteRoomTime;
        game_server[temp_game_server.room_id] = temp_game_server;
        join_list.push([temp_game_server.name, temp_game_server.room_id]);
        additional_game_server.push(temp_game_server);
    } else {
        logger.error('The format of the game server data is incorrect. Data: ' + json);
    }
  } catch(e) {
    logger.error('Failed to read the game server data. Data: ' + json);
  }  
};


const delete_map = async function(id){
  if(game_server[id] && game_server[id].delete_time){
    delete game_server[id];
    join_list = join_list.filter(item => item[1] !== id);
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

  for (var s_x = 0; s_x < Math.floor(game_server[key].map_size_x / 2) + 1; s_x++) {
    for (var s_y = 0; s_y < game_server[key].map_size_y; s_y++) {
      if (s_y == Math.floor(game_server[key].map_size_y / 2) - 1 && s_x == Math.floor(game_server[key].map_size_x / 2)) {
        break;
      }
      else if (s_x == Math.floor(game_server[key].map_size_x / 2) - 1 && s_y <= Math.floor(game_server[key].map_size_y / 2) + 1 && s_y >= Math.floor(game_server[key].map_size_y / 2) - 1) {
        continue;
      }
      else {
        selectable_list.push([s_x, s_y]);
      }
    }
  }



  var cxy = Math.floor(Math.random() * selectable_list.length);

  var cx = selectable_list[cxy][0];
  var cy = selectable_list[cxy][1];

  var tx = Math.floor((game_server[key].map_size_x - 1) / 2);
  var ty = Math.floor((game_server[key].map_size_y - 1) / 2);

  var hx = tx + (tx - cx);
  var hy = ty + (ty - cy);

  selectable_list.splice(cxy, 1);

  game_server[key].cool.x = cx;
  game_server[key].cool.y = cy;
  game_server[key].hot.x = hx;
  game_server[key].hot.y = hy;

  game_server[key].map_data[cy][cx] = 3;
  game_server[key].map_data[hy][hx] = 4;


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
    game_server[key].map_data[ty][tx] = 2;
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
      pxy = Math.floor(Math.random() * selectable_list.length);
      px = selectable_list[pxy][0];
      py = selectable_list[pxy][1];

      game_server[key].map_data[py][px] = 2;
      game_server[key].map_data[ty + (ty - py)][tx + (tx - px)] = 2;

      selectable_list.splice(pxy, 1);
    }
  }
  else {
    for (var i = 0; i < game_server[key].auto_point; i++) {
      pxy = Math.floor(Math.random() * selectable_list.length);
      px = selectable_list[pxy][0];
      py = selectable_list[pxy][1];

      game_server[key].map_data[py][px] = 2;

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
      bxy = Math.floor(Math.random() * selectable_list.length);
      bx = selectable_list[bxy][0];
      by = selectable_list[bxy][1];

      game_server[key].map_data[by][bx] = 1;
      game_server[key].map_data[ty + (ty - by)][tx + (tx - bx)] = 1;

      selectable_list.splice(bxy, 1);
    }
  }
  else {
    for (var i = 0; i < game_server[key].auto_block; i++) {
      bxy = Math.floor(Math.random() * selectable_list.length);
      bx = selectable_list[bxy][0];
      by = selectable_list[bxy][1];

      game_server[key].map_data[by][bx] = 1;

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

  server_store[key].map_data[s_y][s_x] = 3;


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

  server_store[key].map_data[s_y][s_x] = 4;
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

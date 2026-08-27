const path = require('path');

const config_load = require('../tool/config_data_load');
const json_dir_load = require('../tool/json_dir_load');
const map_format = require('../public/javascripts/map_format.js');

var mode_path = config_load.electron_conf_load();

// map (行文字列グリッドJSON) を持つステージを、既存コードが期待する
// map_data(2D配列)/map_size_x/map_size_y/turn/cool_x,cool_y(/hot_x,hot_y) の形状に展開する。
const materialize_map = function (entry) {
    if (!entry.map) return entry;

    var parsed = map_format.parseMap(entry.map);
    entry.map_size_x = parsed.sizeX;
    entry.map_size_y = parsed.sizeY;
    entry.turn = parsed.turnMax;
    entry.map_data = map_format.bakeMapData(parsed.cells, parsed.coolPos, parsed.hotPos);

    if (parsed.coolPos) {
        entry.cool_x = parsed.coolPos.x;
        entry.cool_y = parsed.coolPos.y;
    }
    if (parsed.hotPos) {
        entry.hot_x = parsed.hotPos.x;
        entry.hot_y = parsed.hotPos.y;
    }

    return entry;
};

const stage_data = json_dir_load.loadDirAsMap(
    path.join(__dirname, mode_path, '..', 'load_data', 'tutorial_stage_data'),
    (raw) => materialize_map(JSON.parse(raw)),
    (parsed) => parsed.stage_id,
    'tutorial data'
);

const workspace_data = json_dir_load.loadDirAsMap(
    path.join(__dirname, mode_path, '..', 'load_data', 'workspace_xml_data'),
    (raw) => raw,
    (parsed, fileName) => fileName,
    'tutorial data'
);

const load = function (room = false) {
    if (room) {
        /*
        if("auto_block" in game_server[temp_game_server.room_id]){
          await create_map(temp_game_server.room_id);
        }
        */
        return stage_data[room];
    }
    else {
        return stage_data;
    }
};

const workspace_load = function () {
    return workspace_data;
};

exports.load = load;
exports.workspace_load = workspace_load;

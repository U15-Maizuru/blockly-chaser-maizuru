const path = require('path');

const config_load = require('../tool/config_data_load');
const json_dir_load = require('../tool/json_dir_load');

var mode_path = config_load.electron_conf_load();

const stage_data = json_dir_load.loadDirAsMap(
    path.join(__dirname, mode_path, '..', 'load_data', 'tutorial_stage_data'),
    JSON.parse,
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

function ready_game(elementId) {
    var c = document.getElementById("game_board_table");
    if (c) {
        c.parentNode.removeChild(c);
    }
    c = document.getElementById("game_info_div");
    if (c) {
        c.parentNode.removeChild(c);
    }
    c = document.getElementById("game_result");
    if (c) {
        c.parentNode.removeChild(c);
    }

    var ready_player = document.createElement("div");
    ready_player.setAttribute("id", "ready_player");

    c = document.getElementById("ready_player");
    if (c) {
        c.parentNode.removeChild(c);
    }

    var ready_server = document.createElement("div");
    ready_server.setAttribute("id", "ready_server");
    var newContent = document.createTextNode("マッチング中");
    ready_server.appendChild(newContent);
    ready_player.appendChild(ready_server);

    if (c_name.length) {
        var ready_cool = document.createElement("div");
        ready_cool.setAttribute("id", "ready_cool");
        var newContent = document.createTextNode(c_name);
        ready_cool.appendChild(newContent);
        ready_player.appendChild(ready_cool);
    }

    if (h_name.length) {
        var ready_hot = document.createElement("div");
        ready_hot.setAttribute("id", "ready_hot");
        var newContent = document.createTextNode(h_name);
        ready_hot.appendChild(newContent);
        ready_player.appendChild(ready_hot);
    }
    else {
        var ready_hot = document.createElement("div");
        ready_hot.setAttribute("id", "wait_hot");
        var newContent = document.createTextNode("接続待ち");
        ready_hot.appendChild(newContent);
        ready_player.appendChild(ready_hot);
    }

    document.getElementById(elementId).appendChild(ready_player);

}

function makeTable(msg, y, effect, tableId) {
    var data = msg.map_data;
    var c = document.getElementById("ready_player");
    if (c) {
        c.parentNode.removeChild(c);
    }
    c = document.getElementById("game_result");
    if (c) {
        c.parentNode.removeChild(c);
    }

    var _y = (450 - (4 * y)) / y;

    var built = GAME_DISPLAY.renderBoard(tableId, data, { cellSize: _y });
    var table = built.table;
    var cx = built.cx, cy = built.cy, hx = built.hx, hy = built.hy;

    var x_range = [];
    var y_range = [];

    if (msg.effect) {
        if (msg.effect.t == "l") {
            if (msg.effect.d == "top") {
                x_range = [-1, 0, 1];
                y_range = [-3, -2, -1];
            } else if (msg.effect.d == "bottom") {
                x_range = [1, 0, -1];
                y_range = [3, 2, 1];
            } else if (msg.effect.d == "left") {
                x_range = [-3, -2, -1];
                y_range = [1, 0, -1];
            } else {
                x_range = [3, 2, 1];
                y_range = [-1, 0, 1];
            }
        }
        else if (msg.effect.t == "s") {
            if (msg.effect.d == "top") {
                x_range = [0];
                y_range = [-1, -2, -3, -4, -5, -6, -7, -8, -9];
            } else if (msg.effect.d == "bottom") {
                x_range = [0];
                y_range = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            } else if (msg.effect.d == "left") {
                x_range = [-1, -2, -3, -4, -5, -6, -7, -8, -9];
                y_range = [0];
            } else {
                x_range = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                y_range = [0];
            }
        }

        for (var y of y_range) {
            for (var x of x_range) {
                if (msg.effect.p == "cool" && cx) {
                    if (!(0 > (cx + x) || data[0].length - 1 < (cx + x) || 0 > (cy + y) || data.length - 1 < (cy + y))) {
                        table.rows[cy + y].cells[cx + x].style.border = "2px solid rgba(3, 3, 244, 1.3)";
                    }
                }
                else if (msg.effect.p == "hot" && hx) {
                    if (!(0 > (hx + x) || data[0].length - 1 < (hx + x) || 0 > (hy + y) || data.length - 1 < (hy + y))) {
                        table.rows[hy + y].cells[hx + x].style.border = "2px solid rgba(3, 3, 244, 1.3)";
                    }
                }
            }
        }

        x_range = [-1, 0, 1];
        y_range = [-1, 0, 1];

        for (var y of y_range) {
            for (var x of x_range) {
                if (msg.effect.p == "hot" && hx >= 0) {
                    if (!(0 > (hx + x) || data[0].length - 1 < (hx + x) || 0 > (hy + y) || data.length - 1 < (hy + y))) {
                        table.rows[hy + y].cells[hx + x].style.border = "2px solid rgba(3, 244, 3, 1.3)";
                    }
                }
                else if (msg.effect.p == "cool" && cx >= 0) {
                    if (!(0 > (cx + x) || data[0].length - 1 < (cx + x) || 0 > (cy + y) || data.length - 1 < (cy + y))) {
                        table.rows[cy + y].cells[cx + x].style.border = "2px solid rgba(3, 244, 3, 1.3)";
                    }
                }
            }
        }
    }

    GAME_DISPLAY.renderInfoPanel("game_info", {
        turn: msg.turn,
        coolName: c_name,
        coolScore: msg.cool_score,
        hotName: h_name,
        hotScore: msg.hot_score,
        itemCount: built.itemCount
    });
}

var Sound_Volume = 0.5;
if (localStorage["SOUND_VOLUME"]) {
    Sound_Volume = localStorage["SOUND_VOLUME"] / 100;
}

var gameBgmFile = "sound/01.mp3";
var resultSoundFile = "sound/02.mp3";
if (localStorage["GAME_BGM"]) {
    gameBgmFile = "bgm/" + localStorage["GAME_BGM"];
}
if (localStorage["RESULT_BGM"]) {
    resultSoundFile = "bgm/" + localStorage["RESULT_BGM"];
}


var gameBgm = new Howl({
    src: [gameBgmFile],
    loop: true,
    volume: Sound_Volume
});
var resultSound = new Howl({
    src: [resultSoundFile],
    volume: Sound_Volume
});




var socket = io();
var server_connect_status = false;
var timeId = null;
var my_turn = false;
var look_search_data = false;
var variable_record = {};


var load_map_size_x;
var load_map_size_y;
var now_x = null;
var now_y = null;
var c_name = "NoName";
var h_name = "NoName";

var roop_run;
var next_my_trun = false;


socket.on(SOCKET_EVENTS.JOINED_ROOM, function (msg) {
    server_connect_status = true;
    load_map_size_x = msg.x_size;
    load_map_size_y = msg.y_size;
    if (msg.cool_name) {
        c_name = msg.cool_name;
    }
    if (msg.hot_name) {
        h_name = msg.hot_name;
    }
    if (msg.cpu_name) {
        h_name = msg.cpu_name;
    }
    ready_game("game_board");
});


socket.on(SOCKET_EVENTS.UPDATE_BOARD, function (msg) {
    if (msg.effect) {
        makeTable(msg, load_map_size_y, msg.effect, "game_board");
    }
    else {
        makeTable(msg, load_map_size_y, 0, "game_board");
    }
});

socket.on(SOCKET_EVENTS.NEW_BOARD, function (msg) {
    if (localStorage["SOUND_STATUS"]) {
        if (localStorage["SOUND_STATUS"] == "on") {
            gameBgm.play();
        }
    }
    else {
        gameBgm.play();
    }

    if (msg.effect) {
        makeTable(msg, load_map_size_y, msg.effect, "game_board");
    }
    else {
        makeTable(msg, load_map_size_y, 0, "game_board");
    }
});

socket.on(SOCKET_EVENTS.GET_READY_REC, function (msg) {
    console.log(msg.rec_data);
    if (!my_turn) {
        my_turn = msg.rec_data;
    }
});

socket.on(SOCKET_EVENTS.MOVE_REC, function (msg) {
    if (my_turn) {
        my_turn = false;
        look_search_data = msg.rec_data;
    }
});

socket.on(SOCKET_EVENTS.PUT_REC, function (msg) {
    if (my_turn) {
        my_turn = false;
        look_search_data = msg.rec_data;
    }
});

socket.on(SOCKET_EVENTS.LOOK_REC, function (msg) {
    if (my_turn) {
        my_turn = false;
        look_search_data = msg.rec_data;
    }
});

socket.on(SOCKET_EVENTS.SEARCH_REC, function (msg) {
    if (my_turn) {
        my_turn = false;
        look_search_data = msg.rec_data;
    }
});

socket.on(SOCKET_EVENTS.GAME_RESULT, function (msg) {
    Code.stopJS();

    if (localStorage["SOUND_STATUS"]) {
        if (localStorage["SOUND_STATUS"] == "on") {
            gameBgm.stop();
            resultSound.play();
        }
    }
    else {
        gameBgm.stop();
        resultSound.play();
    }

    var result = document.createElement("div");
    result.setAttribute("id", "game_result");
    var img = document.createElement('img');
    if (msg.winner == "cool") {
        img.src = '/images/coolwin.png';
    }
    else if (msg.winner == "hot") {
        img.src = '/images/hotwin.png';
    }
    else {
        img.src = '/images/draw.png';
    }
    result.appendChild(img);
    document.getElementById("game_board").appendChild(result);
});

socket.on(SOCKET_EVENTS.ERROR, function (msg) {
    Code.stopJS();
    gameBgm.stop();
    window.alert(msg);
});

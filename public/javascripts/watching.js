var socket = io();
var c_name = "NoName";
var h_name = "NoName";
var load_map_size_x;
var load_map_size_y;
var temp_msg;

var query_list = {};
var query = location.search.replace("?", "").split('&');

for (parameters of query) {
    var qp = parameters.split('=');
    if (qp.length == 2) {
        query_list[qp[0]] = qp[1];
    }
}

if (query_list.room_id) {
    var url = './../api/game?room_id=' + query_list.room_id;
    fetch(url)
        .then(function (data) {
            return data.json();
        })
        .then(function (json) {
            if (json) {
                socket.emit(SOCKET_EVENTS.LOOKER_JOIN, query_list.room_id + "?" + query_list.room_token);
                document.getElementById('server_name').textContent = String(json.name);
                document.title += " - " + document.getElementById('server_name').textContent;                
            }
            else {
                document.getElementById('server_name').textContent = "存在しないサーバー";
            }
        });

}


socket.on(SOCKET_EVENTS.JOINED_ROOM, function (msg) {
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
    temp_msg = msg;
    if (msg.effect) {
        makeTable(msg, load_map_size_x, load_map_size_y, msg.effect, "game_board");
    }
    else {
        makeTable(msg, load_map_size_x, load_map_size_y, 0, "game_board");
    }
});

socket.on(SOCKET_EVENTS.NEW_BOARD, function (msg) {
    temp_msg = msg;
    game_bgm_flag = true;
    if (msg.effect) {
        makeTable(msg, load_map_size_x, load_map_size_y, msg.effect, "game_board");
    }
    else {
        makeTable(msg, load_map_size_x, load_map_size_y, 0, "game_board");
    }
});

var game_result_msg = "";
var game_result_info = "";

socket.on(SOCKET_EVENTS.GAME_RESULT, function (msg) {
    //console.log(msg);
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
    game_result_msg = msg.winner;
    game_result_info = msg.info;

    game_result_display(msg.winner, msg.info);

});

socket.on(SOCKET_EVENTS.ERROR, function (msg) {
    gameBgm.stop();
});

function game_result_display(winner, info) {
    var result = document.createElement("div");
    result.setAttribute("id", "game_result");
    var img = document.createElement('img');
    if (winner == "cool") {
        img.src = '/images/coolwin.png';
    }
    else if (winner == "hot") {
        img.src = '/images/hotwin.png';
    }
    else {
        img.src = '/images/draw.png';
    }
    result.appendChild(img);

    document.getElementById("game_board").appendChild(result);


    var winner_info_div = document.createElement("div");
    winner_info_div.setAttribute("id", "winner_info_div");

    var twiner_info = document.createElement("div");
    twiner_info.setAttribute("id", "winner_info_title");
    twiner_info.appendChild(document.createTextNode("リザルト情報"));

    var winner_info = document.createElement("div");
    winner_info.setAttribute("id", "winner_info");
    winner_info.appendChild(document.createTextNode(info));

    winner_info_div.appendChild(twiner_info);
    winner_info_div.appendChild(winner_info);

    document.getElementById("game_info_div").appendChild(winner_info_div);

}

window.addEventListener("resize", function () {
    if (temp_msg) {
        if (temp_msg.effect) {
            makeTable(temp_msg, load_map_size_x, load_map_size_y, temp_msg.effect, "game_board");
        }
        else {
            makeTable(temp_msg, load_map_size_x, load_map_size_y, 0, "game_board");
        }
    }
    if (game_result_msg) {
        game_result_display(game_result_msg, game_result_info);
    }
});



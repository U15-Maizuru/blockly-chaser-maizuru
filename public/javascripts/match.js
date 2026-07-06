var socket = io();
var query_list = {};
var query = location.search.replace("?", "").split('&');
var check_timer;
var c_name = "NoName";
var h_name = "NoName";
var load_map_size_x;
var load_map_size_y;
var temp_msg;
var key;

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
                if (json.cpu) {
                    buttle_mode = "（テスト）";
                } else {
                    buttle_mode = "";
                }
                document.title += " - " + document.getElementById('server_name').textContent + buttle_mode;
                
                var server_init = {};
                server_init.room_id = query_list.room_id + "?" + query_list.room_token;
                if (query_list.my_chara) server_init.player_chara = query_list.my_chara;
                socket.emit(SOCKET_EVENTS.MATCH_INIT, server_init);
            }
            else {
                document.getElementById('server_name').textContent = "存在しないサーバー";
            }
        });
}

var match_start_check = function () {
    socket.emit(SOCKET_EVENTS.MATCH_START_CHECK);
};
var check_flag = true;

socket.on(SOCKET_EVENTS.MATCH_INIT_REC, function (msg) {
    if (!msg.error) {
        var upperChara = (query_list.my_chara === 'hot') ? 'hot' : 'cool';
        var lowerChara = (query_list.my_chara === 'hot') ? 'cool' : 'hot';
        var base = "/match/player?room_id=" + query_list.room_id + "&room_token=" + query_list.room_token;
        var cpuParam = query_list.my_chara ? '&cpu_chara=' + lowerChara : '';
        document.getElementById('cool_player_iframe').src = base + "&chara=" + upperChara + "&key=" + msg.key + cpuParam;
        document.getElementById('hot_player_iframe').src  = base + "&chara=" + lowerChara + "&key=" + msg.key + cpuParam;
        if (upperChara === 'hot') {
            document.getElementById('cool_ready_title').textContent = 'hot';
            document.getElementById('hot_ready_title').textContent  = 'cool';
            document.getElementById('cool_ready').classList.add('hot_color_bg');
            document.getElementById('hot_ready').classList.add('cool_color_bg');
            document.getElementById('cool_ready_title').classList.add('hot_title_bg');
            document.getElementById('hot_ready_title').classList.add('cool_title_bg');
        }
        key = msg.key;
        document.getElementById("game_start").onclick = function () {

            check_flag = false;
            clearInterval(check_timer);
            document.getElementById('ready_area').classList.add("display_off");
            document.getElementById('game_area').classList.remove("display_off");
            socket.emit(SOCKET_EVENTS.MATCH_START, { "room_id": query_list.room_id + "?" + query_list.room_token, "key": key });
        }
        check_flag = true;
        check_timer = setInterval(match_start_check, 500);
    }
    else {
        window.alert("接続先サーバーは使用中です");
        window.location.href = "/menu-match";
    }
});


socket.on(SOCKET_EVENTS.MATCH_START_CHECK_REC, function (msg) {
    var game_start_button = document.getElementById('game_start');
    if (check_flag) {
        if (msg) {
            if (!game_start_button.classList.contains("display_on")) {
                game_start_button.classList.add("display_on");
            }
        }
        else {
            if (game_start_button.classList.contains("display_on")) {
                game_start_button.classList.remove("display_on");
            }
        }
    }
});


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
});

socket.on(SOCKET_EVENTS.UPDATE_BOARD, function (msg) {
    clearInterval(check_timer);
    document.getElementById('ready_area').classList.add("display_off");
    document.getElementById('game_area').classList.remove("display_off");
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

    socket.emit(SOCKET_EVENTS.MATCH_END, { "room_id": query_list.room_id + "?" + query_list.room_token, "key": key });
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


    var back_button = document.createElement("div");
    var re_button = document.createElement("div");

    back_button.setAttribute("id", "back_button");
    re_button.setAttribute("id", "re_button");

    var back_button_link = document.createElement('a');
    back_button_link.classList.add("button_link");
    back_button_link.href = "/menu-match";
    back_button_link.innerText = "戻る";
    back_button.appendChild(back_button_link);

    var re_button_link = document.createElement('a');
    re_button_link.classList.add("button_link");
    var re_chara_param = query_list.my_chara ? "&my_chara=" + query_list.my_chara : "";
    re_button_link.href = "/match?room_id=" + query_list.room_id + "&room_token=" + query_list.room_token + re_chara_param;
    re_button_link.innerText = "もう一度";
    re_button.appendChild(re_button_link);

    result.appendChild(back_button);
    result.appendChild(re_button);

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


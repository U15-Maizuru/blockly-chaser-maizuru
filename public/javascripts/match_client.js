
var socket = io();
var server_connect_status = false;
var timeId = null;
var my_turn = false;
var look_search_data = false;
var variable_record = {};

var roop_run;
var next_my_trun = false;


socket.on(SOCKET_EVENTS.GET_READY_REC, function (msg) {
    //console.log(msg.rec_data);
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
});

socket.on(SOCKET_EVENTS.ERROR, function (msg) {
    Code.stopJS();
});




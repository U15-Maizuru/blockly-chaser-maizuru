

const logger = require('../bin/logger.js');
const SOCKET_EVENTS = require('../public/javascripts/socket_events.js');

//socket.io
var socket_io = require('socket.io');
var io = socket_io();

const server_data = require('../tool/server_data_load');

//game_server_list
var fs = require('fs');
var path = require('path');
const { json } = require('express/lib/response.js');

const config = require('../config/config.js');
const validate_room = require('../tool/validate_room.js');
const { classifyCell, scanCells } = require('./board_scan.js');

var game_server = JSON.parse(JSON.stringify(server_data.load()));

//game_server_store
var store = {};
var looker = {};
var match_room_store = {};
var server_store = JSON.parse(JSON.stringify(game_server));
var room_info = {};

// map_data 上でのキャラクター種別の数値表現（自陣営 / 相手陣営）
const CHARA_NUM = { "cool": 3, "hot": 4 };
const CHARA_NUM_DIFF = { "cool": 4, "hot": 3 };

//create_map
function create_map(key) {

    var map = new Array(server_store[key].map_size_y);
    for (let y = 0; y < server_store[key].map_size_y; y++) {
        map[y] = new Array(server_store[key].map_size_x).fill(0);
    }

    server_store[key].map_data = map;

    var selectable_list = [];

    var tx = Math.floor((server_store[key].map_size_x - 1) / 2);
    var ty = Math.floor((server_store[key].map_size_y - 1) / 2);

    // cool の対角位置に hot を置くため、対称点が盤面内に収まる位置だけを候補にする。
    // 偶数サイズのマップでは対称点が盤外になる組み合わせがあり、そのまま配置すると例外になる
    var isMirrorInside = function (s_x, s_y) {
        var m_x = tx + (tx - s_x);
        var m_y = ty + (ty - s_y);
        return m_x >= 0 && m_x < server_store[key].map_size_x && m_y >= 0 && m_y < server_store[key].map_size_y;
    };

    for (var s_x = 0; s_x < Math.floor(server_store[key].map_size_x / 2) + 1; s_x++) {
        for (var s_y = 0; s_y < server_store[key].map_size_y; s_y++) {
            if (s_y == Math.floor(server_store[key].map_size_y / 2) - 1 && s_x == Math.floor(server_store[key].map_size_x / 2)) {
                break;
            }
            else if (s_x == Math.floor(server_store[key].map_size_x / 2) - 1 && s_y <= Math.floor(server_store[key].map_size_y / 2) + 1 && s_y >= Math.floor(server_store[key].map_size_y / 2) - 1) {
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

    server_store[key].cool.x = cx;
    server_store[key].cool.y = cy;
    server_store[key].hot.x = hx;
    server_store[key].hot.y = hy;

    server_store[key].map_data[cy][cx] = 3;
    server_store[key].map_data[hy][hx] = 4;


    if (server_store[key].auto_symmetry) {
        for (var add_list = 0; add_list < 3; add_list++) {
            selectable_list.push([Math.floor(server_store[key].map_size_x / 2) - 1, Math.floor(server_store[key].map_size_y / 2) - 1 + add_list]);
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


        if (server_store[key].auto_point % 2 == 0) {
            if (server_store[key].auto_point == 1) {
                server_store[key].auto_point += 1;
            }
            else {
                server_store[key].auto_point -= 1;
            }
        }

        if (server_store[key].auto_block % 2 == 1) {
            if (server_store[key].auto_block == 1) {
                server_store[key].auto_block += 1;
            }
            else {
                server_store[key].auto_block -= 1;
            }
        }
        server_store[key].map_data[ty][tx] = 2;
        server_store[key].auto_point -= 1;
    }
    else {
        selectable_list = [];
        for (var s_x = 0; s_x < server_store[key].map_size_x; s_x++) {
            for (var s_y = 0; s_y < server_store[key].map_size_y; s_y++) {
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

    if (server_store[key].auto_symmetry) {
        for (var i = 0; i < server_store[key].auto_point / 2; i++) {
            // 配置先を使い果たしたら打ち切る (指定数がマス数を上回っても落ちないようにする)
            if (!selectable_list.length) break;
            pxy = Math.floor(Math.random() * selectable_list.length);
            px = selectable_list[pxy][0];
            py = selectable_list[pxy][1];

            server_store[key].map_data[py][px] = 2;
            if (isMirrorInside(px, py)) {
                server_store[key].map_data[ty + (ty - py)][tx + (tx - px)] = 2;
            }

            selectable_list.splice(pxy, 1);
        }
    }
    else {
        for (var i = 0; i < server_store[key].auto_point; i++) {
            // 配置先を使い果たしたら打ち切る (指定数がマス数を上回っても落ちないようにする)
            if (!selectable_list.length) break;
            pxy = Math.floor(Math.random() * selectable_list.length);
            px = selectable_list[pxy][0];
            py = selectable_list[pxy][1];

            server_store[key].map_data[py][px] = 2;

            selectable_list.splice(pxy, 1);
        }
    }


    var selectable_list_temp = selectable_list;
    selectable_list = [];
    for (var list_data = 0; list_data < selectable_list_temp.length; list_data++) {
        if (selectable_list_temp[list_data][0] < 1 || selectable_list_temp[list_data][0] > server_store[key].map_size_x - 2 || selectable_list_temp[list_data][1] < 1 || selectable_list_temp[list_data][1] > server_store[key].map_size_y - 2) {
            continue;
        }
        else if ((selectable_list_temp[list_data][0] == cx && (selectable_list_temp[list_data][1] == cy + 9 || selectable_list_temp[list_data][1] == cy - 9)) || (selectable_list_temp[list_data][0] == hx && (selectable_list_temp[list_data][1] == hy + 9 || selectable_list_temp[list_data][1] == hy - 9))) {
            continue;
        }
        else {
            selectable_list.push([selectable_list_temp[list_data][0], selectable_list_temp[list_data][1]]);
        }
    }


    if (server_store[key].auto_symmetry) {
        for (var i = 0; i < server_store[key].auto_block / 2; i++) {
            // 配置先を使い果たしたら打ち切る (指定数がマス数を上回っても落ちないようにする)
            if (!selectable_list.length) break;
            bxy = Math.floor(Math.random() * selectable_list.length);
            bx = selectable_list[bxy][0];
            by = selectable_list[bxy][1];

            server_store[key].map_data[by][bx] = 1;
            if (isMirrorInside(bx, by)) {
                server_store[key].map_data[ty + (ty - by)][tx + (tx - bx)] = 1;
            }

            selectable_list.splice(bxy, 1);
        }
    }
    else {
        for (var i = 0; i < server_store[key].auto_block; i++) {
            // 配置先を使い果たしたら打ち切る (指定数がマス数を上回っても落ちないようにする)
            if (!selectable_list.length) break;
            bxy = Math.floor(Math.random() * selectable_list.length);
            bx = selectable_list[bxy][0];
            by = selectable_list[bxy][1];

            server_store[key].map_data[by][bx] = 1;

            selectable_list.splice(bxy, 1);
        }
    }

}
for (var key in server_store) {
    if (!server_store[key].map_data.length) {
        create_map(key);
    } else {
        if (server_store[key].cool.x < 0 || server_store[key].cool.y < 0) {
            player_spon(key);
        }
    }
}


//player spon
function player_spon(key) {

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


function game_time_out(room, winner) {
    io.in(room).emit(SOCKET_EVENTS.GAME_RESULT, {
        "winner": winner,
        "info": "タイムアウトより"
    });
    
    room_info[room] = {};
    deleteMap(room);
    game_server_reset(room);
}

function game_result_check(room, chara, effect_t = "r", effect_d = false, winner = false, winner_info = false) {

    if (server_store[room].cool.status && server_store[room].hot.status) {

        clearTimeout(server_store[room].timer);

        var effect_chara = { "cool": "hot", "hot": "cool" };

        if (chara == "hot") {
            server_store[room].turn -= 1;
        }

        var effect = {
            "t": effect_t,
            "p": chara
        }

        if (effect_d) {
            effect.d = effect_d;
        }

        io.in(room).emit(SOCKET_EVENTS.UPDATE_BOARD, {
            "map_data": server_store[room].map_data,
            "cool_score": server_store[room].cool.score,
            "hot_score": server_store[room].hot.score,
            "turn": server_store[room].turn,
            "effect": effect
        });

        if (!winner) {
            if (server_store[room].turn == 0) {
                if (server_store[room].cool.score > server_store[room].hot.score) {
                    winner = "cool";
                }
                else if (server_store[room].cool.score < server_store[room].hot.score) {
                    winner = "hot";
                }
                else {
                    winner = "draw";
                }
                winner_info = "スコアより";
            }
            else {

                var rcx = server_store[room].cool.x;
                var rcy = server_store[room].cool.y;
                var rhx = server_store[room].hot.x;
                var rhy = server_store[room].hot.y;

                if (server_store[room].map_data[rcy][rcx] != 34 && server_store[room].map_data[rcy][rcx] != 3 && server_store[room].map_data[rhy][rhx] != 4) {
                    winner = "draw";
                    winner_info = "アタックにより";
                }
                else if (server_store[room].map_data[rcy][rcx] != 34 && server_store[room].map_data[rcy][rcx] != 3) {
                    winner = "hot";
                    if (winner_info) {
                        winner_info = "アタックにより";
                    }
                    else {
                        winner_info = "ブロック衝突により";
                    }
                }
                else if (server_store[room].map_data[rcy][rcx] != 34 && server_store[room].map_data[rhy][rhx] != 4) {
                    winner = "cool";
                    if (winner_info) {
                        winner_info = "アタックにより";
                    }
                    else {
                        winner_info = "ブロック衝突により";
                    }
                }
                else {
                    var c_t, c_b, c_r, c_l, h_t, h_b, h_r, h_l;

                    if (rcx - 1 < 0) {
                        c_l = 1;
                        c_r = server_store[room].map_data[rcy][rcx + 1];
                    }
                    else if (rcx + 1 > server_store[room].map_size_x - 1) {
                        c_l = server_store[room].map_data[rcy][rcx - 1];
                        c_r = 1;
                    }
                    else {
                        c_l = server_store[room].map_data[rcy][rcx - 1];
                        c_r = server_store[room].map_data[rcy][rcx + 1];
                    }

                    if (rcy - 1 < 0) {
                        c_t = 1;
                        c_b = server_store[room].map_data[rcy + 1][rcx];
                    }
                    else if (rcy + 1 > server_store[room].map_size_y - 1) {
                        c_t = server_store[room].map_data[rcy - 1][rcx];
                        c_b = 1;
                    }
                    else {
                        c_t = server_store[room].map_data[rcy - 1][rcx];
                        c_b = server_store[room].map_data[rcy + 1][rcx];
                    }


                    if (rhx - 1 < 0) {
                        h_l = 1;
                        h_r = server_store[room].map_data[rhy][rhx + 1];
                    }
                    else if (rhx + 1 > server_store[room].map_size_x - 1) {
                        h_l = server_store[room].map_data[rhy][rhx - 1];
                        h_r = 1;
                    }
                    else {
                        h_l = server_store[room].map_data[rhy][rhx - 1];
                        h_r = server_store[room].map_data[rhy][rhx + 1];
                    }

                    if (rhy - 1 < 0) {
                        h_t = 1;
                        h_b = server_store[room].map_data[rhy + 1][rhx];
                    }
                    else if (rhy + 1 > server_store[room].map_size_y - 1) {
                        h_t = server_store[room].map_data[rhy - 1][rhx];
                        h_b = 1;
                    }
                    else {
                        h_t = server_store[room].map_data[rhy - 1][rhx];
                        h_b = server_store[room].map_data[rhy + 1][rhx];
                    }


                    if (c_t == 1 && c_b == 1 && c_r == 1 && c_l == 1) {
                        winner = "hot";
                        winner_info = "ブロック閉じ込めにより";
                    }

                    if (h_t == 1 && h_b == 1 && h_r == 1 && h_l == 1) {
                        winner = "cool";
                        winner_info = "ブロック閉じ込めにより";
                    }

                    if (c_t == 1 && c_b == 1 && c_r == 1 && c_l == 1 && h_t == 1 && h_b == 1 && h_r == 1 && h_l == 1) {
                        winner = "draw";
                        winner_info = "ブロック閉じ込めにより";
                    }
                }
            }
        }
        if (winner) {
            io.in(room).emit(SOCKET_EVENTS.GAME_RESULT, {
                "winner": winner,
                "info": winner_info
            });
            
            //勝敗決定時に，ルームのCPU情報を削除
            //マップの削除判定関数を実施
            room_info[room] = {};
            deleteMap(room);

            if(room in server_store){
            	game_server_reset(room);
            }
        }
        else {
            server_store[room][effect_chara[chara]].turn = true;

            if (server_store[room].timeout) {
                server_store[room].timer = setTimeout(game_time_out, 1000 * server_store[room].timeout, room, chara);
            }
            else {
                server_store[room].timer = setTimeout(game_time_out, 10000, room, chara);
            }

            if (server_store[room].cpu && server_store[room][server_store[room].cpu.turn].turn) {
                cpu(room, server_store[room].cpu.level, server_store[room].cpu.turn);
            }
        }
    }
}

function game_server_reset(room) {
    for (var user_id in store) {
        if (store[user_id].room == room) {
            if (io.sockets.sockets[user_id]) {
                io.sockets.sockets[user_id].leave(room);
            }
            delete store[user_id];
        }
    }

    if (server_store[room] && server_store[room].timer) {
        clearTimeout(server_store[room].timer);
        delete server_store[room].timer;
    }
    if (game_server[room]) {
        server_store[room] = JSON.parse(JSON.stringify(game_server[room]));
    } else {
        console.error(`Error: game_server is undefined for room "${room ?? 'unknown'}"`);
        return;
    }

    if (!server_store[room].map_data.length) {
        create_map(room);
    } else {
        if (server_store[room].cool.x < 0 || server_store[room].cool.y < 0) {
            player_spon(room);
        }
    }
}


//player action
function get_ready(room, chara, id = false) {
    if(!server_store[room])
    {
        console.error(`Error in get_ready:: server_store is undefined for room "${room ?? 'unknown'}"`);
        return;
    }
    if (server_store[room][chara].turn && server_store[room][chara].getready) {
        var my_map_data = [];
        var tmp_map_data = Array.from(server_store[room].map_data);
        var now_x = server_store[room][chara].x;
        var now_y = server_store[room][chara].y;
        var load_map_size_x = server_store[room].map_size_x;
        var load_map_size_y = server_store[room].map_size_y;


        for (var y of [-1, 0, 1]) {
            if (0 > (now_y + y) || (load_map_size_y - 1) < (now_y + y)) {
                for (var x of [-1, 0, 1]) {
                    my_map_data.push(2);
                }
            }
            else {
                for (var x of [-1, 0, 1]) {
                    if (0 > (now_x + x) || (load_map_size_x - 1) < (now_x + x)) {
                        my_map_data.push(2);
                    }
                    else {
                        if (tmp_map_data[now_y][now_x] == 3) {
                            if (tmp_map_data[now_y + y][now_x + x] == 3) {
                                my_map_data.push(0);
                            }
                            else if (tmp_map_data[now_y + y][now_x + x] == 4) {
                                my_map_data.push(1);
                            }
                            else {
                                if (tmp_map_data[now_y + y][now_x + x] == 0) {
                                    my_map_data.push(tmp_map_data[now_y + y][now_x + x]);
                                }
                                else if (tmp_map_data[now_y + y][now_x + x] == 1) {
                                    my_map_data.push(2);
                                }
                                else {
                                    my_map_data.push(3);
                                }
                            }
                        }
                        else if (tmp_map_data[now_y][now_x] == 4) {
                            if (tmp_map_data[now_y + y][now_x + x] == 3) {
                                my_map_data.push(1);
                            }
                            else if (tmp_map_data[now_y + y][now_x + x] == 4) {
                                my_map_data.push(0);
                            }
                            else {
                                if (tmp_map_data[now_y + y][now_x + x] == 0) {
                                    my_map_data.push(tmp_map_data[now_y + y][now_x + x]);
                                }
                                else if (tmp_map_data[now_y + y][now_x + x] == 1) {
                                    my_map_data.push(2);
                                }
                                else {
                                    my_map_data.push(3);
                                }
                            }
                        }
                        else {
                            if (tmp_map_data[now_y + y][now_x + x] == 43 || tmp_map_data[now_y + y][now_x + x] == 34) {
                                my_map_data.push(1);
                            }
                            else {
                                if (tmp_map_data[now_y + y][now_x + x] == 0) {
                                    my_map_data.push(tmp_map_data[now_y + y][now_x + x]);
                                }
                                else if (tmp_map_data[now_y + y][now_x + x] == 1) {
                                    my_map_data.push(2);
                                }
                                else {
                                    my_map_data.push(3);
                                }
                            }
                        }
                    }
                }
            }
        }
        if (id) {
            io.to(id).emit(SOCKET_EVENTS.GET_READY_REC, {
                "rec_data": my_map_data
            });
            server_store[room][chara].getready = false;
        }
        else {
            server_store[room][chara].getready = false;
            return my_map_data;
        }
    }
    else {
        if (id) {
            io.to(id).emit(SOCKET_EVENTS.GET_READY_REC, {
                "rec_data": server_store[room][chara].true
            });
        }
        else {
            return false;
        }
    }
}

function move_player(room, chara, msg, id = false) {
    if(!server_store[room])
    {
        console.error(`Error in move_player:: server_store is undefined for room "${room ?? 'unknown'}"`);
        return;
    }
    if (server_store[room][chara].turn && server_store[room][chara].getready == false) {
        server_store[room][chara].turn = false;
        server_store[room][chara].getready = true;
        var x = server_store[room][chara].x;
        var y = server_store[room][chara].y;

        var xy_check = false;

        var move_map_data = [];

        if (server_store[room].map_data[y][x] == 34) {
            server_store[room].map_data[y][x] = CHARA_NUM_DIFF[chara];
        }
        else {
            server_store[room].map_data[y][x] = 0;
        }

        if (msg === "top") {
            if (0 <= y - 1) {
                server_store[room][chara].y = y - 1;
                y = y - 1;
                xy_check = true;
            }
        }
        else if (msg === "bottom") {
            if (server_store[room].map_size_y > y + 1) {
                server_store[room][chara].y = y + 1;
                y = y + 1;
                xy_check = true;
            }
        }
        else if (msg === "left") {
            if (0 <= x - 1) {
                server_store[room][chara].x = x - 1;
                x = x - 1;
                xy_check = true;
            }
        }
        else {
            if (server_store[room].map_size_x > x + 1) {
                server_store[room][chara].x = x + 1;
                x = x + 1;
                xy_check = true;
            }
        }

        if (xy_check) {
            if (server_store[room].map_data[y][x] == 0) {
                server_store[room].map_data[y][x] = CHARA_NUM[chara];
            }
            else if (server_store[room].map_data[y][x] == 2) {
                server_store[room].map_data[y][x] = CHARA_NUM[chara];
                server_store[room][chara].score += 1;

                if (msg === "top") {
                    server_store[room].map_data[y + 1][x] = 1;
                }
                else if (msg === "bottom") {
                    server_store[room].map_data[y - 1][x] = 1;
                }
                else if (msg === "left") {
                    server_store[room].map_data[y][x + 1] = 1;
                }
                else {
                    server_store[room].map_data[y][x - 1] = 1;
                }

            }
            else if (server_store[room].map_data[y][x] == CHARA_NUM_DIFF[chara]) {
                server_store[room].map_data[y][x] = 34;
            }

            var tmp_map_data = Array.from(server_store[room].map_data);
            var load_map_size_x = server_store[room].map_size_x;
            var load_map_size_y = server_store[room].map_size_y;

            move_map_data = scanCells(tmp_map_data, x, y, [-1, 0, 1], [-1, 0, 1], load_map_size_x, load_map_size_y, CHARA_NUM[chara], CHARA_NUM_DIFF[chara]);
            if (id) {
                io.to(id).emit(SOCKET_EVENTS.MOVE_REC, {
                    "rec_data": move_map_data
                });
            }
        }

        game_result_check(room, chara);

        if (!id) {
            return move_map_data;
        }
    }
}

function look(room, chara, msg, id = false) {
    if(!server_store[room]){
        console.error(`Error in look:: server_store is undefined for room "${room ?? 'unknown'}"`);
        return;
    }
    if (server_store[room][chara].turn && server_store[room][chara].getready == false) {
        server_store[room][chara].turn = false;
        server_store[room][chara].getready = true;
        var x_range = [];
        var y_range = [];

        var tmp_map_data = Array.from(server_store[room].map_data);
        var now_x = server_store[room][chara].x;
        var now_y = server_store[room][chara].y;
        var load_map_size_x = server_store[room].map_size_x;
        var load_map_size_y = server_store[room].map_size_y;

        if (msg == "top") {
            x_range = [-1, 0, 1];
            y_range = [-3, -2, -1];
        } else if (msg == "bottom") {
            x_range = [-1, 0, 1];
            y_range = [1, 2, 3];
        } else if (msg == "left") {
            x_range = [-3, -2, -1];
            y_range = [-1, 0, 1];
        } else {
            x_range = [1, 2, 3];
            y_range = [-1, 0, 1];
        }
        var look_map_data = scanCells(tmp_map_data, now_x, now_y, x_range, y_range, load_map_size_x, load_map_size_y, CHARA_NUM[chara], CHARA_NUM_DIFF[chara]);
        if (id) {
            io.to(id).emit(SOCKET_EVENTS.LOOK_REC, {
                "rec_data": look_map_data
            });
            game_result_check(room, chara, "l", msg);
        }
        else {
            game_result_check(room, chara, "l", msg);
            return look_map_data;
        }
    }
    else {
        if (id) {
            io.to(id).emit(SOCKET_EVENTS.LOOK_REC, {
                "rec_data": server_store[room][chara].true
            });
        }
        else {
            return false;
        }
    }
}

function search(room, chara, msg, id = false) {
    if(!server_store[room])
    {
        console.error(`Error in search:: server_store is undefined for room "${room ?? 'unknown'}"`);
        return;
    }
    if (server_store[room][chara].turn && server_store[room][chara].getready == false) {
        server_store[room][chara].turn = false;
        server_store[room][chara].getready = true;
        var x_range = [];
        var y_range = [];

        var tmp_map_data = Array.from(server_store[room].map_data);
        var now_x = server_store[room][chara].x;
        var now_y = server_store[room][chara].y;
        var load_map_size_x = server_store[room].map_size_x;
        var load_map_size_y = server_store[room].map_size_y;

        if (msg == "top") {
            x_range = [0];
            y_range = [-1, -2, -3, -4, -5, -6, -7, -8, -9];
        } else if (msg == "bottom") {
            x_range = [0];
            y_range = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        } else if (msg == "left") {
            x_range = [-1, -2, -3, -4, -5, -6, -7, -8, -9];
            y_range = [0];
        } else {
            x_range = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            y_range = [0];
        }

        var search_map_data = scanCells(tmp_map_data, now_x, now_y, x_range, y_range, load_map_size_x, load_map_size_y, CHARA_NUM[chara], CHARA_NUM_DIFF[chara]);
        if (id) {
            io.to(id).emit(SOCKET_EVENTS.SEARCH_REC, {
                "rec_data": search_map_data
            });
            game_result_check(room, chara, "s", msg);
        }
        else {
            game_result_check(room, chara, "s", msg);
            return search_map_data;
        }
    }
    else {
        if (id) {
            io.to(id).emit(SOCKET_EVENTS.SEARCH_REC, {
                "rec_data": server_store[room][chara].true
            });
        }
        else {
            return false;
        }
    }
}

function put_wall(room, chara, msg, id = false) {
    if(!server_store[room])
    {
        console.error(`Error in put_wall:: server_store is undefined for room "${room ?? 'unknown'}"`);
        return;
    }
    if (server_store[room][chara].turn && server_store[room][chara].getready == false) {
        server_store[room][chara].turn = false;
        server_store[room][chara].getready = true;
        var x = server_store[room][chara].x;
        var y = server_store[room][chara].y;

        var put_check = false;

        if (msg === "top") {
            if (0 <= y - 1) {
                y = y - 1;
                put_check = true;
            }
        }
        else if (msg === "bottom") {
            if (server_store[room].map_size_y > y + 1) {
                y = y + 1;
                put_check = true;
            }
        }
        else if (msg === "left") {
            if (0 <= x - 1) {
                x = x - 1;
                put_check = true;
            }
        }
        else {
            if (server_store[room].map_size_x > x + 1) {
                x = x + 1;
                put_check = true;
            }
        }

        var player_put_chara = false;

        if (put_check) {
            if (server_store[room].map_data[y][x] == CHARA_NUM_DIFF[chara]) {
                player_put_chara = true;
            }
            server_store[room].map_data[y][x] = 1;
        }

        var tmp_map_data = Array.from(server_store[room].map_data);
        var now_x = server_store[room][chara].x;
        var now_y = server_store[room][chara].y;
        var load_map_size_x = server_store[room].map_size_x;
        var load_map_size_y = server_store[room].map_size_y;

        var put_map_data = scanCells(tmp_map_data, now_x, now_y, [-1, 0, 1], [-1, 0, 1], load_map_size_x, load_map_size_y, CHARA_NUM[chara], CHARA_NUM_DIFF[chara]);

        if (id) {
            io.to(id).emit(SOCKET_EVENTS.PUT_REC, {
                "rec_data": put_map_data
            });
            if (player_put_chara) {
                game_result_check(room, chara, "r", false, false, "putより");
            }
            else {
                game_result_check(room, chara);
            }
        }
        else {
            if (player_put_chara) {
                game_result_check(room, chara, "r", false, false, "putより");
            }
            else {
                game_result_check(room, chara);
            }
            return put_map_data;
        }
    }
}


//socket.io_on
// ルームを作成する。作成できた場合は true、既存または上限超過の場合は false を返す
const createMap= async (json_data = null) => {
    if(server_store[json_data.room_id]){
        console.log("room already exist");
        return false;
    }

    const created = await server_data.create_new_map(JSON.stringify(json_data));//server_data_load.jsが発火
    if (!created) {
        return false;
    }
    game_server = JSON.parse(JSON.stringify(server_data.load()));
    server_store[json_data.room_id]=JSON.parse(JSON.stringify(game_server[json_data.room_id]));

    RoomTimeoutCheck();//ルームの削除判定関数を実施
    game_server_reset(json_data.room_id);//ルームの初期化（ランダムマップじゃなければ必須じゃなさそう）
    return true;
};

// HTTP経由でカスタムマップを追加した後、chaser側のgame_server/server_storeを同期する
const reloadRoom = async (room_id) => {
    if (server_store[room_id]) return false;
    game_server = JSON.parse(JSON.stringify(server_data.load()));
    if (!game_server[room_id]) return false;
    RoomTimeoutCheck();
    game_server_reset(room_id);
    return true;
};

// マップをコピーするための関数
const copyMapByID = async (id) =>{
    await server_data.copy_map_by_id(id);
    game_server = JSON.parse(JSON.stringify(server_data.load()));//サーバの更新処理
    server_store[id] = JSON.parse(JSON.stringify(game_server[id]));//server_storeは，他のデータを傷つけない形で更新
    game_server_reset(id);//ルームの初期化（ランダムマップの生成）
}


// マップを削除するための関数
//既存マップの判定をserver_data_load.jsで実施すると，server_storeのマップ初期化で問題が発生するため，ここで判定
const deleteMap = async (id) => {
    //JSON内にdelete_timeが存在するかどうかで判定(onetime_roomの判別)
    if (server_store[id].delete_time) {
        await server_data.delete_map(id);
        //更新処理
        game_server = JSON.parse(JSON.stringify(server_data.load()));
        
        delete server_store[id];  
    }
}

//現存するonetimeルームで制限時間を超えた場合に削除する関数
const RoomTimeoutCheck =async () => {
    console.log("now time",Date.now());
    for (const room in server_store) {
        if (server_store[room].delete_time) {
            //使用中ではなく　or 一度も使用されていないルーム
            if(!server_store[room].match || server_store[room].match == undefined){
                //タイマーが現在のLinux時間を超えている
                if (server_store[room].delete_time  < Date.now()) {
                    console.log("time out room",server_store[room].room_id);
                    deleteMap(room);
                }
            }
        }
    }
}


// Socket.io はイベントハンドラ内の例外を捕捉しないため、
// 想定外の入力による例外がそのままプロセス全体を停止させてしまう。
// すべてのハンドラをこのラッパ経由で登録し、例外は該当ソケットへのエラー通知に留める
function safeOn(socket, event, handler) {
    socket.on(event, function (...args) {
        const onError = function (e) {
            logger.error('socket handler error (' + event + '): ' + (e && e.message));
            console.error(e);
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "処理中にエラーが発生しました");
        };
        try {
            const result = handler.apply(this, args);
            if (result && typeof result.catch === 'function') {
                result.catch(onError);
            }
        }
        catch (e) {
            onError(e);
        }
    });
}

io.on('connection', function (socket) {

    safeOn(socket, SOCKET_EVENTS.CREATE_NEW_MAP, async function (json_data) {

        if (!json_data || json_data.key !== config.commonKey) {
            io.to(socket.id).emit(SOCKET_EVENTS.MAP_CREATED, { status: 'error' });
            return;
        }

        delete json_data.key;// JSONデータからkeyを削除

        // room_id は内部キーとしてそのまま使うため、文字列であることと形式を確認する
        if (typeof json_data.room_id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(json_data.room_id)) {
            io.to(socket.id).emit(SOCKET_EVENTS.MAP_CREATED, { status: 'error', errors: ['room_id の形式が正しくありません'] });
            return;
        }

        // 外部から来るルーム定義は経路によらず同じ検証を通す
        // (HTTP の /api/upload-map と条件をずらさないこと)
        const result = validate_room.validateRoom(json_data);
        if (!result.ok) {
            io.to(socket.id).emit(SOCKET_EVENTS.MAP_CREATED, { status: 'error', errors: result.errors });
            return;
        }

        const roomData = Object.assign({}, result.value, {
            room_id: json_data.room_id,
            cool: json_data.cool || { status: false, turn: false },
            hot:  json_data.hot  || { status: false, turn: false }
        });
        if (json_data.cpu) {
            roomData.cpu = json_data.cpu;
        }

        const created = await createMap(roomData);
        io.to(socket.id).emit(SOCKET_EVENTS.MAP_CREATED, { status: created ? 'success' : 'error' });
    });

    safeOn(socket, SOCKET_EVENTS.PLAYER_JOIN, async function (msg) {
        // room_id は以降で文字列として扱うため、型を先に確認する
        if (typeof msg?.room_id !== 'string') {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームIDが正しくありません");
            return;
        }

        if (!server_store[msg.room_id]) {
            var room_id_check = msg.room_id.split("?")[0];
            //コピーもとが存在するかチェック
            if(server_store[room_id_check]){
                await copyMapByID(msg.room_id);//?以降を削除
            }
            else{
                console.log("コピー元ルームが存在しません");
                io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームが存在しません");
                return;//以降の処理をスキップ
            }
        }

        if (server_store[msg.room_id] && (!server_store[msg.room_id].cool.status || !server_store[msg.room_id].hot.status) && !server_store[msg.room_id].match) {
            var room_chara;

            if (server_store[msg.room_id].cpu) {
                if (server_store[msg.room_id].cpu.turn == "cool") {
                    server_store[msg.room_id].cool.status = true;
                    server_store[msg.room_id].cool.turn = false;
                    server_store[msg.room_id].cool.getready = true;
                    server_store[msg.room_id].cool.score = 0;
                    server_store[msg.room_id].cool.name = "cpu";
                    server_store[msg.room_id].hot.status = true;
                    server_store[msg.room_id].hot.turn = false;
                    server_store[msg.room_id].hot.getready = true;
                    server_store[msg.room_id].hot.score = 0;
                    server_store[msg.room_id].hot.name = msg.name;
                    room_chara = "hot";
                }
                else {
                    server_store[msg.room_id].cool.status = true;
                    server_store[msg.room_id].cool.turn = false;
                    server_store[msg.room_id].cool.getready = true;
                    server_store[msg.room_id].cool.score = 0;
                    server_store[msg.room_id].cool.name = msg.name;
                    server_store[msg.room_id].hot.status = true;
                    server_store[msg.room_id].hot.turn = false;
                    server_store[msg.room_id].hot.getready = true;
                    server_store[msg.room_id].hot.score = 0;
                    server_store[msg.room_id].hot.name = "cpu";
                    room_chara = "cool";
                }
            }
            else {
                if (!server_store[msg.room_id].cool.status) {
                    server_store[msg.room_id].cool.name = "接続待機中";
                }
                if (!server_store[msg.room_id].hot.status) {
                    server_store[msg.room_id].hot.name = "接続待機中";
                }

                if (!server_store[msg.room_id].cool.status) {
                    server_store[msg.room_id].cool.status = true;
                    server_store[msg.room_id].cool.turn = false;
                    server_store[msg.room_id].cool.getready = true;
                    server_store[msg.room_id].cool.score = 0;
                    server_store[msg.room_id].cool.name = msg.name;
                    room_chara = "cool";
                }
                else if (!server_store[msg.room_id].hot.status) {
                    server_store[msg.room_id].hot.status = true;
                    server_store[msg.room_id].hot.turn = false;
                    server_store[msg.room_id].hot.getready = true;
                    server_store[msg.room_id].hot.score = 0;
                    server_store[msg.room_id].hot.name = msg.name;
                    room_chara = "hot";
                }
            }

            var usrobj = {
                "room": msg.room_id,
                "name": msg.name,
                "chara": room_chara
            };

            store[socket.id] = usrobj;
            socket.join(msg.room_id);

            io.in(store[socket.id].room).emit(SOCKET_EVENTS.JOINED_ROOM, {
                "x_size": server_store[msg.room_id].map_size_x,
                "y_size": server_store[msg.room_id].map_size_y,
                "cool_name": server_store[msg.room_id].cool.name,
                "hot_name": server_store[msg.room_id].hot.name
            });


            if (server_store[msg.room_id].hot.status) {
                var game_start_timer = function (room) {
                    //時間差でゲームが開始されるため，マップ削除した場合はエラーの原因になっていた
                    //正直この修正でも問題が発生する可能性がありそう
                    if(!server_store[room]){//既に削除済みの場合は処理を行わない
                        console.log("game_start_timer room not exist",room);
                        return;
                    }
                    io.in(room).emit(SOCKET_EVENTS.NEW_BOARD, {
                        "map_data": server_store[room].map_data,
                        "cool_score": server_store[room].cool.score,
                        "hot_score": server_store[room].hot.score,
                        "turn": server_store[room].turn
                    });

                    server_store[room].cool.turn = true;

                    if (server_store[room].timeout) {
                        server_store[room].timer = setTimeout(game_time_out, 1000 * server_store[room].timeout, room, "hot");
                    }
                    else {
                        server_store[room].timer = setTimeout(game_time_out, 10000, room, "hot");
                    }

                    if (server_store[room].cpu && server_store[room].cool.name == "cpu") {
                        cpu(room, server_store[room].cpu.level, server_store[room].cpu.turn);
                    }
                }
                setTimeout(game_start_timer, 500, store[socket.id].room);
            }
        }
        else if (!server_store[msg.room_id]) {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "サーバーIDが存在しません");
        }
        else if (server_store[msg.room_id].match) {
            var join_flag = false;
            if (server_store[msg.room_id].release) {
                if (!server_store[msg.room_id].cool.status) {
                    server_store[msg.room_id].cool.name = "接続待機中";
                }
                if (!server_store[msg.room_id].hot.status) {
                    server_store[msg.room_id].hot.name = "接続待機中";
                }
                if (server_store[msg.room_id].release.cool && !server_store[msg.room_id].cool.status) {
                    server_store[msg.room_id].cool.status = true;
                    server_store[msg.room_id].cool.turn = false;
                    server_store[msg.room_id].cool.getready = true;
                    server_store[msg.room_id].cool.score = 0;
                    server_store[msg.room_id].cool.name = msg.name;
                    room_chara = "cool";
                    join_flag = true;
                }
                else if (server_store[msg.room_id].release.hot && !server_store[msg.room_id].hot.status) {
                    server_store[msg.room_id].hot.status = true;
                    server_store[msg.room_id].hot.turn = false;
                    server_store[msg.room_id].hot.getready = true;
                    server_store[msg.room_id].hot.score = 0;
                    server_store[msg.room_id].hot.name = msg.name;
                    room_chara = "hot";
                    join_flag = true;
                }
            }
            else {
                io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "接続先サーバーは使用中です");
            }

            if (join_flag) {

                var usrobj = {
                    "room": msg.room_id,
                    "name": msg.name,
                    "chara": room_chara
                };

                store[socket.id] = usrobj;
                socket.join(msg.room_id);

                io.in(store[socket.id].room).emit(SOCKET_EVENTS.JOINED_ROOM, {
                    "x_size": server_store[msg.room_id].map_size_x,
                    "y_size": server_store[msg.room_id].map_size_y,
                    "cool_name": server_store[msg.room_id].cool.name,
                    "hot_name": server_store[msg.room_id].hot.name
                });
            }
        }
        else {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "接続先サーバーは満室です");
        }
    });

    safeOn(socket, SOCKET_EVENTS.MATCH_INIT, async function (msg) {
        // room_id は以降で文字列として扱うため、型を先に確認する
        if (typeof msg?.room_id !== 'string') {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームIDが正しくありません");
            return;
        }

        if (!server_store[msg.room_id]) {
            var room_id_check = msg.room_id.split("?")[0];
            //コピーもとが存在するかチェック
            if(server_store[room_id_check]){
                await copyMapByID(msg.room_id);//?以降を削除
            }
            else{
                console.log("コピー元ルームが存在しません");
                io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームが存在しません");
                return;//以降の処理をスキップ
            }
        }

        if (server_store[msg.room_id]) {
            if (!(server_store[msg.room_id].cool.status || server_store[msg.room_id].hot.status)) {
                if (!match_room_store[socket.id]) {
                    match_room_store[socket.id] = msg.room_id;
                    server_store[msg.room_id].match = true;
                    io.to(socket.id).emit(SOCKET_EVENTS.MATCH_INIT_REC, { "key": socket.id });

                    if (server_store[msg.room_id].cpu) {
                        var validCharas = ['cool', 'hot'];
                        var cpuChara = (msg.player_chara && validCharas.includes(msg.player_chara))
                            ? (msg.player_chara === 'cool' ? 'hot' : 'cool')
                            : server_store[msg.room_id].cpu.turn;
                        server_store[msg.room_id].cpu.turn = cpuChara;
                        server_store[msg.room_id][cpuChara].status = true;
                        server_store[msg.room_id][cpuChara].turn = false;
                        server_store[msg.room_id][cpuChara].getready = true;
                        server_store[msg.room_id][cpuChara].score = 0;
                        server_store[msg.room_id][cpuChara].name = "cpu";
                    }
                }
                else {
                    io.to(socket.id).emit(SOCKET_EVENTS.MATCH_INIT_REC, { "error": "他のサーバーでマッチ中です" });
                }
            }
            else {
                io.to(socket.id).emit(SOCKET_EVENTS.MATCH_INIT_REC, { "error": "接続先サーバーは使用中です" });
            }
        }
        else {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "サーバーIDが存在しません");
        }
    });

    safeOn(socket, SOCKET_EVENTS.MATCH_START_CHECK, function () {
        if (match_room_store[socket.id]) {
            if (!server_store[match_room_store[socket.id]]) {
                delete match_room_store[socket.id];
                return;
            }
            if (server_store[match_room_store[socket.id]].cool.status && server_store[match_room_store[socket.id]].hot.status) {
                io.to(socket.id).emit(SOCKET_EVENTS.MATCH_START_CHECK_REC, true);
            }
            else {
                io.to(socket.id).emit(SOCKET_EVENTS.MATCH_START_CHECK_REC, false);
            }
        }
        else {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "不正な操作です");
        }
    });

    safeOn(socket, SOCKET_EVENTS.MATCH_START, function (msg) {
        // 認証 → 存在確認 → 状態変更 の順を守る。
        // 順序を入れ替えると、認証前に未検証の room_id で状態を参照することになる
        if (!msg || msg.room_id != match_room_store[msg.key]) {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "不正な操作です");
            return;
        }
        if (!server_store[msg.room_id]) {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームが存在しません");
            return;
        }
        clearTimeout(server_store[msg.room_id].timer);

        if (server_store[msg.room_id].cool.status && server_store[msg.room_id].hot.status) {
            server_store[msg.room_id].match = false;

            var game_start_timer = function (room) {
                io.in(room).emit(SOCKET_EVENTS.NEW_BOARD, {
                    "map_data": server_store[room].map_data,
                    "cool_score": server_store[room].cool.score,
                    "hot_score": server_store[room].hot.score,
                    "turn": server_store[room].turn
                });

                server_store[room].cool.turn = true;

                if (server_store[room].timeout) {
                    server_store[room].timer = setTimeout(game_time_out, 1000 * server_store[room].timeout, room, "hot");
                }
                else {
                    server_store[room].timer = setTimeout(game_time_out, 10000, room, "hot");
                }

                if (server_store[room].cpu && server_store[room].cool.name == "cpu") {
                    cpu(room, server_store[room].cpu.level, server_store[room].cpu.turn);
                }
            }
            setTimeout(game_start_timer, 500, msg.room_id);
        }
    });

    safeOn(socket, SOCKET_EVENTS.PLAYER_JOIN_MATCH, async function (msg) {
        // room_id は以降で文字列として扱うため、型を先に確認する
        if (typeof msg?.room_id !== 'string') {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームIDが正しくありません");
            return;
        }

        if (!server_store[msg.room_id]) {
            var room_id_check = msg.room_id.split("?")[0];
            //コピーもとが存在するかチェック
            if(server_store[room_id_check]){
                await copyMapByID(msg.room_id);//?以降を削除
            }
            else{
                console.log("コピー元ルームが存在しません");
                io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームが存在しません");
                return;//以降の処理をスキップ
            }
        }

        if (msg.room_id == match_room_store[msg.key]) {
            if (!server_store[msg.room_id].cool.status) {
                server_store[msg.room_id].cool.name = "接続待機中";
            }
            if (!server_store[msg.room_id].hot.status) {
                server_store[msg.room_id].hot.name = "接続待機中";
            }

            var join_flag = false;
            // 宣言を省くと暗黙のグローバルとなり、同時接続時に他の対戦と値を共有してしまう
            var room_chara;

            if (msg.chara == "cool" && !server_store[msg.room_id].cool.status) {
                server_store[msg.room_id].cool.status = true;
                server_store[msg.room_id].cool.turn = false;
                server_store[msg.room_id].cool.getready = true;
                server_store[msg.room_id].cool.score = 0;
                server_store[msg.room_id].cool.name = msg.name;
                room_chara = "cool";
                join_flag = true;
            }
            else if (msg.chara == "hot" && !server_store[msg.room_id].hot.status) {
                server_store[msg.room_id].hot.status = true;
                server_store[msg.room_id].hot.turn = false;
                server_store[msg.room_id].hot.getready = true;
                server_store[msg.room_id].hot.score = 0;
                server_store[msg.room_id].hot.name = msg.name;
                room_chara = "hot";
                join_flag = true;
            }

            if (join_flag) {
                var usrobj = {
                    "room": msg.room_id,
                    "name": msg.name,
                    "chara": room_chara
                };

                store[socket.id] = usrobj;
                socket.join(msg.room_id);

                io.in(store[socket.id].room).emit(SOCKET_EVENTS.JOINED_ROOM, {
                    "x_size": server_store[msg.room_id].map_size_x,
                    "y_size": server_store[msg.room_id].map_size_y,
                    "cool_name": server_store[msg.room_id].cool.name,
                    "hot_name": server_store[msg.room_id].hot.name
                });
            }
            else {
                io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "接続先サーバーは使用中です");
            }
        }
        else {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "不正な操作です");
        }
    });

    safeOn(socket, SOCKET_EVENTS.RELEASE, function (msg) {
        try {
            if (msg.room_id == match_room_store[msg.key]) {
                if (!server_store[msg.room_id].release) {
                    server_store[msg.room_id].release = {};
                }

                if (msg.chara == "cool") {
                    server_store[msg.room_id].release.cool = true;
                }
                else if (msg.chara == "hot") {
                    server_store[msg.room_id].release.hot = true;
                }
            }
            else {
                io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "不正な操作です");
            }
        }
        catch (e) {
            console.log(e);
        }
    });

    safeOn(socket, SOCKET_EVENTS.MOVE_PLAYER, function (msg) {
        if (store[socket.id]) {
            move_player(store[socket.id].room, store[socket.id].chara, msg, socket.id);
        }
    });

    safeOn(socket, SOCKET_EVENTS.GET_READY, function () {
        if (store[socket.id]) {
            get_ready(store[socket.id].room, store[socket.id].chara, socket.id)
        }
    });

    safeOn(socket, SOCKET_EVENTS.LOOK, function (msg) {
        if (store[socket.id]) {
            look(store[socket.id].room, store[socket.id].chara, msg, socket.id);
        }
    });

    safeOn(socket, SOCKET_EVENTS.SEARCH, function (msg) {
        if (store[socket.id]) {
            search(store[socket.id].room, store[socket.id].chara, msg, socket.id);
        }
    });

    safeOn(socket, SOCKET_EVENTS.PUT_WALL, function (msg) {
        if (store[socket.id]) {
            put_wall(store[socket.id].room, store[socket.id].chara, msg, socket.id);
        }
    });

    safeOn(socket, SOCKET_EVENTS.LOOKER_JOIN, async function (msg) {
        // 観戦対象のルームIDは文字列で渡される想定のため、型を先に確認する
        if (typeof msg !== 'string') {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームIDが正しくありません");
            return;
        }

        if (!server_store[msg]) {
            var room_id_check = msg.split("?")[0];
            //コピーもとが存在するかチェック
            if(server_store[room_id_check]){
                await copyMapByID(msg);//?以降を削除
            }
            else{
                console.log("コピー元ルームが存在しません");
                io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "ルームが存在しません");
                return;//以降の処理をスキップ
            }
        }

        if (server_store[msg]) {
            var usrobj = {
                "room": msg,
            };

            var cool_name = "接続待機中";
            var hot_name = "接続待機中";
            if (server_store[msg].cool.status) {
                cool_name = server_store[msg].cool.name;
            }
            if (server_store[msg].hot.status) {
                hot_name = server_store[msg].hot.name;
            }

            io.to(socket.id).emit(SOCKET_EVENTS.JOINED_ROOM, {
                "x_size": server_store[msg].map_size_x,
                "y_size": server_store[msg].map_size_y,
                "cool_name": cool_name,
                "hot_name": hot_name
            });

            looker[socket.id] = usrobj;
            socket.join(msg);
        }
    });

    safeOn(socket, SOCKET_EVENTS.DISCONNECT, function () {
        if (store[socket.id] && server_store[store[socket.id].room]) {
            if (server_store[store[socket.id].room].cool.status && server_store[store[socket.id].room].hot.status && !server_store[store[socket.id].room].match) {
                if (store[socket.id].chara == "cool") {
                    game_result_check(store[socket.id].room, store[socket.id].chara, "r", false, "hot", "切断より");
                }
                else {
                    game_result_check(store[socket.id].room, store[socket.id].chara, "r", false, "cool", "切断より");
                }
            }
            else if (server_store[store[socket.id].room].match) {
                server_store[store[socket.id].room][store[socket.id].chara].status = false;
                delete store[socket.id];
            }
            else {
                game_server_reset(store[socket.id].room);
            }
        }
        else if (looker[socket.id]) {
            socket.leave(looker[socket.id].room);
            delete looker[socket.id];
        }
        if (match_room_store[socket.id]) {
            io.in(match_room_store[socket.id]).emit(SOCKET_EVENTS.ERROR, "サーバー側から切断されました");
            console.log("切断されたルーム", match_room_store[socket.id]);
            if (!server_store[match_room_store[socket.id]]) {
                delete match_room_store[socket.id];
                return;
            }
            if (server_store[match_room_store[socket.id]].cool.status && server_store[match_room_store[socket.id]].hot.status) {
                game_server_reset(match_room_store[socket.id]);
            }
            for (var s_user in match_room_store) {
                if (s_user != socket.id && match_room_store[s_user] == match_room_store[socket.id]) {
                    delete match_room_store[socket.id];
                    break;
                }
            }
            if (match_room_store[socket.id]) {
                server_store[match_room_store[socket.id]].match = false;
                delete match_room_store[socket.id];
            }
        }
    });

    safeOn(socket, SOCKET_EVENTS.LEAVE_ROOM, function () {
        if (store[socket.id] && server_store[store[socket.id].room]) {
            if (server_store[store[socket.id].room].cool.status && server_store[store[socket.id].room].hot.status && !server_store[store[socket.id].room].match) {
                if (store[socket.id].chara == "cool") {
                    game_result_check(store[socket.id].room, store[socket.id].chara, "r", false, "hot", "切断より");
                }
                else {
                    game_result_check(store[socket.id].room, store[socket.id].chara, "r", false, "cool", "切断より");
                }
            }
            else if (server_store[store[socket.id].room].match) {
                server_store[store[socket.id].room][store[socket.id].chara].status = false;
                delete store[socket.id];
            }
            else {
                game_server_reset(store[socket.id].room);
            }
        }
        else if (looker[socket.id]) {
            socket.leave(looker[socket.id].room);
            delete looker[socket.id];
        }
        if (match_room_store[socket.id]) {
            io.in(match_room_store[socket.id]).emit(SOCKET_EVENTS.ERROR, "サーバー側から切断されました");
            if (!server_store[match_room_store[socket.id]]) {
                delete match_room_store[socket.id];
                return;
            }
            if (server_store[match_room_store[socket.id]].cool.status && server_store[match_room_store[socket.id]].hot.status) {
                game_server_reset(match_room_store[socket.id]);
            }
            for (var s_user in match_room_store) {
                if (s_user != socket.id && match_room_store[s_user] == match_room_store[socket.id]) {
                    delete match_room_store[socket.id];
                    break;
                }
            }
            if (match_room_store[socket.id]) {
                server_store[match_room_store[socket.id]].match = false;
                delete match_room_store[socket.id];
            }
        }
    });

    safeOn(socket, SOCKET_EVENTS.MATCH_END, function (msg) {
        if (msg.room_id == match_room_store[msg.key]) {
            if (match_room_store[socket.id]) {
                delete match_room_store[socket.id];
            }
            if (looker[socket.id]) {
                socket.leave(looker[socket.id].room);
                delete looker[socket.id];
            }
        }
        else {
            io.to(socket.id).emit(SOCKET_EVENTS.ERROR, "不正な操作です");
        }
    });

});

exports.io = io;
exports.reloadRoom = reloadRoom;


//cpu
function cpu(room, level, chara) {

    var cpu_map_date = get_ready(room, chara);
    const delay_time = 100;

    if (cpu_map_date) {
        //levelの変数の型が文字列の場合は数値に変換
        if (typeof level == "string") {
            if (level[0] == "0") {
                level = 0;
            }
            else if (level[0] == "1") {
                level = 1;
            }
            else if (level[0] == "2") {
                level = 2;
            }
            else {
                level = 0;
            }
        }
        //ずっと上を確認する
        if (level == 0) {
            setTimeout(look, delay_time, room, chara, "top");
        }

        //壁じゃない方向にランダムに移動する
        else if (level == 1) {
            var random_list = [];
            if (cpu_map_date[1] != 2) {
                random_list.push('top');
            }
            if (cpu_map_date[3] != 2) {
                random_list.push('left');
            }
            if (cpu_map_date[5] != 2) {
                random_list.push('right');
            }
            if (cpu_map_date[7] != 2) {
                random_list.push('bottom');
            }

            if (random_list) {
                var random = Math.floor(Math.random() * random_list.length);
                setTimeout(move_player, delay_time, room, chara, random_list[random]);
            }

        }

        //別関数に移動，関数内でCPUの行動を決定
        else if (level == 2) {
            next_action = cpu_action(room, cpu_map_date);//CPU関数による行動決定
            //console.log(next_action);

            if (next_action[0] == "attack") {
                setTimeout(put_wall, delay_time, room, chara, next_action[1]);
            }
            else if (next_action[0] == "move") {
                setTimeout(move_player, delay_time, room, chara, next_action[1]);
            }
            else {
                setTimeout(look, delay_time, room, chara, next_action[1]);
            }

        }
        else {
            setTimeout(look, delay_time, room, chara, "top");
        }
    }
}

//与えられた周辺情報を元に、CPUの行動を決定する
function cpu_action(room, map_data) {
    //map_dataの中身は自分を中心とした周囲9マスの情報
    //map_data[4]が自分の情報, map_data[0]が左上の情報, map_data[8]が右下の情報

    //server_store[room]で部屋のcpu_levelを取得可能
    //=0:何もない， =2:壁，=3:アイテム，=1or2:自分または敵
    item_num = 3;
    wall_num = 2;

    //roomのaction_historyを取得
    //もしkeyとしてroomが存在する場合はその値を，存在しない場合は初期値を格納

    if (room in room_info && room_info[room]?.cpu?.action_history != undefined) {

        action_history = room_info[room].cpu.action_history;//過去の行動を取得

    } else {
        action_history = ["mode_direction", "mode_direction", "mode_direction", "mode_direction", "mode_direction"];
        cpu_info = {};
        cpu_level = server_store[room].cpu.level;

        if (typeof cpu_level == "string") {
            //後ろのパラメータを取得　ex/"2?item=10&holdAttack=3"
            //まずは?移行があるかどうかを確認
            if (cpu_level.indexOf("?") != -1) {
                //?以降を取得
                paramater = cpu_level.split("?")[1];
                //&で分割
                paramater_list = paramater.split("&");

                for (i = 0; i < paramater_list.length; i++) {
                    //=で分割
                    paramater_key = paramater_list[i].split("=")[0];
                    paramater_value = parseInt(paramater_list[i].split("=")[1], 10);
                    cpu_info[paramater_key] = paramater_value;
                }
            }
        }
        room_info[room] = { "cpu": cpu_info };
        room_info[room].cpu.now_item = 0;
        room_info[room].turn = 0;
        room_info[room].cpu.wall3 = 0;//前ターンに3面壁処理が行われたかどうか
    }

    //turnのカウント
    room_info[room].turn += 1;
    //アイテム獲得可能状態かどうか
    can_get_item = false;
    if (Math.floor(room_info[room].turn / room_info[room].cpu.item) + 1 > room_info[room].cpu.now_item ||room_info[room].cpu.item == undefined) {
        can_get_item = true;
    }

    //historyが6以上の場合は最初の行動を削除
    if (action_history.length >= 6) {
        action_history.shift();
    }

    //相手の数字を判別
    if (map_data[4] == 1) {
        enemy_num = 2;
    } else {
        enemy_num = 1;
    }

    //基本行動1：敵が上下左右にいる場合は攻撃
    if (map_data[1] == enemy_num || map_data[3] == enemy_num || map_data[5] == enemy_num || map_data[7] == enemy_num) {
        //アタック保留状態でない場合、攻撃
        if (cpu_info.holdAttack == undefined) {
            if (map_data[1] == enemy_num) {
                action_history.push("attack_top");
                return ["attack", "top"];
            } else if (map_data[3] == enemy_num) {
                action_history.push("attack_left");
                return ["attack", "left"];
            } else if (map_data[5] == enemy_num) {
                action_history.push("attack_right");
                return ["attack", "right"];
            } else if (map_data[7] == enemy_num) {
                action_history.push("attack_bottom");
                return ["attack", "bottom"];
            }
        }
        else {
            //アタック保留状態の場合は移動可能な方向に敵から逃げる形で移動
            cpu_info.holdAttack -= 1;
            if (cpu_info.holdAttack == 0) {
                cpu_info.holdAttack = undefined;
            }
            can_move_list = [];
            if (map_data[1] == enemy_num) {
                if (map_data[3] != wall_num) {
                    can_move_list.push("left");
                }
                if (map_data[5] != wall_num) {
                    can_move_list.push("right");
                }
                if (map_data[7] != wall_num) {
                    can_move_list.push("bottom");
                }

                //can_move_listの中からランダムで選択
                var random = Math.floor(Math.random() * can_move_list.length);
                action_history.push("move_" + can_move_list[random]);
                return ["move", can_move_list[random]];
            }
            else if (map_data[3] == enemy_num) {
                if (map_data[1] != wall_num) {
                    can_move_list.push("top");
                }
                if (map_data[5] != wall_num) {
                    can_move_list.push("right");
                }
                if (map_data[7] != wall_num) {
                    can_move_list.push("bottom");
                }

                //can_move_listの中からランダムで選択
                var random = Math.floor(Math.random() * can_move_list.length);
                action_history.push("move_" + can_move_list[random]);
                return ["move", can_move_list[random]];
            }
            else if (map_data[5] == enemy_num) {
                if (map_data[1] != wall_num) {
                    can_move_list.push("top");
                }
                if (map_data[3] != wall_num) {
                    can_move_list.push("left");
                }
                if (map_data[7] != wall_num) {
                    can_move_list.push("bottom");
                }

                //can_move_listの中からランダムで選択
                var random = Math.floor(Math.random() * can_move_list.length);
                action_history.push("move_" + can_move_list[random]);
                return ["move", can_move_list[random]];
            }
            else if (map_data[7] == enemy_num) {
                if (map_data[1] != wall_num) {
                    can_move_list.push("top");
                }
                if (map_data[3] != wall_num) {
                    can_move_list.push("left");
                }
                if (map_data[5] != wall_num) {
                    can_move_list.push("right");
                }

                //can_move_listの中からランダムで選択
                var random = Math.floor(Math.random() * can_move_list.length);
                action_history.push("move_" + can_move_list[random]);
                //room_infoに情報を格納
                if (room in room_info) {
                    room_info[room].cpu.action_history = action_history;
                }
                else {
                    room_info[room] = { "cpu": { "action_history": action_history } };
                }
                return ["move", can_move_list[random]];
            }
        }
    }


    //基本行動2：周辺情報から行動を決定
    //移動できる割合を格納する辞書
    can_move_dic = { "top": 100, "left": 100, "bottom": 100, "right": 100 };


    //敵が斜めにいる場合は索敵で1ターン稼ぐ
    if (map_data[0] == enemy_num || map_data[2] == enemy_num || map_data[6] == enemy_num || map_data[8] == enemy_num) {
        //直前の行動が索敵でない場合は索敵
        
        if (action_history[action_history.length - 1].split("_")[0] != "search") {
            action_history.push("search_randam");
            //room_infoに情報を格納
            if (room in room_info) {
                room_info[room].cpu.action_history = action_history;
            }
            else {
                room_info[room] = { "cpu": { "action_history": action_history } };
            }

            return ["search", "bottom"];
        }
        //直近の行動が索敵の場合はcan_move_listの更新
        //敵がいない方向に移動する
        else {
            if (map_data[0] == enemy_num) {
                can_move_dic["top"] -= 200;
                can_move_dic["left"] -= 200;
            }
            if (map_data[2] == enemy_num) {
                can_move_dic["top"] -= 200;
                can_move_dic["right"] -= 200;

            }
            if (map_data[6] == enemy_num) {
                can_move_dic["bottom"] -= 200;
                can_move_dic["left"] -= 200;
            }
            if (map_data[8] == enemy_num) {
                can_move_dic["bottom"] -= 200;
                can_move_dic["right"] -= 200;
            }
        }
    }

    //斜めにアイテムがある場合は優先度を上げる
    if (cpu_info.naname != 0) {
        if (map_data[0] == item_num) {
            can_move_dic["top"] += 50;
            can_move_dic["left"] += 50;
        }
        if (map_data[2] == item_num) {
            can_move_dic["top"] += 50;
            can_move_dic["right"] += 50;
        }
        if (map_data[6] == item_num) {
            can_move_dic["bottom"] += 50;
            can_move_dic["left"] += 50;
        }
        if (map_data[8] == item_num) {
            can_move_dic["bottom"] += 50;
            can_move_dic["right"] += 50;
        }
        
    }

    //アイテムがあり，進行可能な場合は優先
    //ただし，アイテムの前後に敵がいるor壁がある場合は除外
    if (map_data[1] == item_num) {
        //map_data[0]と[3] に敵がいない　かつ　map_data[0]とmap_data[3]の両方に壁がない(片方に壁がある場合はOK)
        if (map_data[0] != enemy_num && map_data[2] != enemy_num) {
            if (!(map_data[0] == wall_num && map_data[2] == wall_num)) {
                if (can_get_item) {
                    can_move_dic["top"] += 50;
                } else {
                    can_move_dic["top"] -= 50;
                }
            }
        }
    }
    if (map_data[3] == item_num) {
        if (map_data[0] != enemy_num && map_data[6] != enemy_num) {
            if (!(map_data[0] == wall_num && map_data[6] == wall_num)) {
                if (can_get_item) {
                    can_move_dic["left"] += 50;
                } else {
                    can_move_dic["left"] -= 50;
                }
            }
        }
    }
    if (map_data[5] == item_num) {
        if (map_data[2] != enemy_num && map_data[8] != enemy_num) {
            if (!(map_data[2] == wall_num && map_data[8] == wall_num)) {
                if (can_get_item) {
                    can_move_dic["right"] += 50;
                }
                else {
                    can_move_dic["right"] -= 50;
                }
            }
        }

    }
    if (map_data[7] == item_num) {
        if (map_data[6] != enemy_num && map_data[8] != enemy_num) {
            if (!(map_data[6] == wall_num && map_data[8] == wall_num)) {

                if (can_get_item) {
                    can_move_dic["bottom"] += 50;
                }
                else {
                    can_move_dic["bottom"] -= 50;
                }
            }
        }
    }

    if (room_info[room].cpu.wall3 == 1) {
        //3面壁処理が行われた場合は次のターンにリセット
        room_info[room].cpu.wall3 = 0;
        //1つ前の移動を参考に，その方向とは別の方向に移動する
        before_action = action_history[action_history.length - 1];
        before_action_name = before_action.split("_")[0];
        before_action_direction = before_action.split("_")[1];
        //console.log(before_action);
        if (before_action_name == "move") {
            if (before_action_direction == "top") {
                can_move_dic["left"] += 50;
                can_move_dic["right"] += 50;
            }
            else if (before_action_direction == "left") {
                can_move_dic["top"] += 50;
                can_move_dic["bottom"] += 50;
            }
            else if (before_action_direction == "right") {
                can_move_dic["top"] += 50;
                can_move_dic["bottom"] += 50;
            }
            else if (before_action_direction == "bottom") {
                can_move_dic["left"] += 50;
                can_move_dic["right"] += 50;
            }
        }
    }

    //斜め含めて直線状に壁がある場合は外周の可能性が高いので優先度を下げる
    if (map_data[0] == wall_num && map_data[1] == wall_num && map_data[2] == wall_num) {
        //上側が全て壁の場合
        can_move_dic["top"] -= 100;
        //左右にも移動したくない
        can_move_dic["left"] -= 50;
        can_move_dic["right"] -= 50;
        can_move_dic["bottom"] += 50;
        room_info[room].cpu.wall3 = 1;
    }
    else if (map_data[0] == wall_num && map_data[3] == wall_num && map_data[6] == wall_num) {
        //左側が全て壁の場合
        can_move_dic["left"] -= 100;
        //上下にも移動したくない
        can_move_dic["top"] -= 50;
        can_move_dic["bottom"] -= 50;
        can_move_dic["right"] += 50;
        room_info[room].cpu.wall3 = 1;
    }
    else if (map_data[2] == wall_num && map_data[5] == wall_num && map_data[8] == wall_num) {
        //右側が全て壁の場合
        can_move_dic["right"] -= 100;
        //上下にも移動したくない
        can_move_dic["top"] -= 50;
        can_move_dic["bottom"] -= 50;
        can_move_dic["left"] += 50;
        room_info[room].cpu.wall3 = 1;
    }
    else if (map_data[6] == wall_num && map_data[7] == wall_num && map_data[8] == wall_num) {
        //下側が全て壁の場合
        can_move_dic["bottom"] -= 100;
        //左右にも移動したくない
        can_move_dic["left"] -= 50;
        can_move_dic["right"] -= 50;
        can_move_dic["top"] += 50;
        room_info[room].cpu.wall3 = 1;
    }
    else {
        //can_move_dicとaction_historyを元に移動方向を決定
        //直前4回分の行動から評価を変化させる
        for (i = 1; i < 5; i++) {
            before_action = action_history[action_history.length - i];
            before_action_name = before_action.split("_")[0];
            before_action_direction = before_action.split("_")[1];
            if (before_action_name == "move") {
                can_move_dic[before_action_direction] += 20 / (i * i);
            }
            if (before_action_direction == "top") {
                can_move_dic["bottom"] -= 20 / (i * i);
            }
            if (before_action_direction == "left") {
                can_move_dic["right"] -= 20 / (i * i);
            }
            if (before_action_direction == "right") {
                can_move_dic["left"] -= 20 / (i * i);
            }
            if (before_action_direction == "bottom") {
                can_move_dic["top"] -= 20 / (i * i);
            }
        }
    }
    //周囲にブロックがある場合は移動方向を除外
    if (map_data[1] == wall_num) {
        if(can_move_dic["top"] > 0){
        can_move_dic["top"] = 0;
        }
    }
    if (map_data[3] == wall_num) {
        if(can_move_dic["left"] > 0){
        can_move_dic["left"] = 0;
        }
    }
    if (map_data[5] == wall_num) {
        if(can_move_dic["right"] > 0){
        can_move_dic["right"] = 0;
        }
    }
    if (map_data[7] == wall_num) {
        if(can_move_dic["bottom"] > 0){
        can_move_dic["bottom"] = 0;
        }
    }
    //console.log("last:",can_move_dic);
    //dicの評価値が最大のものを取得
    var max_key = Object.keys(can_move_dic).reduce((a, b) => can_move_dic[a] > can_move_dic[b] ? a : b);
    //最大のものが複数ある場合はランダムで選択
    var max_list = [];
    for (key in can_move_dic) {
        if (can_move_dic[key] == can_move_dic[max_key]) {
            max_list.push(key);
        }
    }
    var max_key = max_list[Math.floor(Math.random() * max_list.length)];
    //評価値が30以上の場合はその行動を実施
    if (can_move_dic[max_key] >= 30) {
        action_history.push("move_" + max_key);
        //room_infoに情報を格納
        if (room in room_info) {
            room_info[room].cpu.action_history = action_history;
        }
        else {
            room_info[room] = { "cpu": { "action_history": action_history } };
        }

        //移動が決定した先にアイテムがある場合はカウントを増やす
        if (map_data[1] == item_num && max_key == "top") {
            room_info[room].cpu.now_item += 1;
        }
        else if (map_data[3] == item_num && max_key == "left") {
            room_info[room].cpu.now_item += 1;
        }
        else if (map_data[5] == item_num && max_key == "right") {
            room_info[room].cpu.now_item += 1;
        }
        else if (map_data[7] == item_num && max_key == "bottom") {
            room_info[room].cpu.now_item += 1;
        }


        return ["move", max_key];
    }


    //ここまで来た場合は移動できない場合
    //索敵を行う
    action_history.push("search_randam");
    //room_infoに情報を格納
    if (room in room_info) {
        room_info[room].cpu.action_history = action_history;
    }
    else {
        room_info[room] = { "cpu": { "action_history": action_history } };
    }
    return ["search", "top"];
}
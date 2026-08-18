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
    ready_player.setAttribute("id", "ready_player_div");

    c = document.getElementById("ready_player_div");
    if (c) {
        c.parentNode.removeChild(c);
    }

    var ready_server = document.createElement("div");
    ready_server.setAttribute("id", "ready_server");
    var newContent = document.createTextNode("接続中・・・");
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

    document.getElementById("ready_player").appendChild(ready_player);

}

var game_bgm_flag = true;

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



function makeTable(msg, x, y, effect, tableId) {
    if (game_bgm_flag) {
        game_bgm_flag = false;
        if (localStorage["SOUND_STATUS"]) {
            if (localStorage["SOUND_STATUS"] == "on") {
                gameBgm.play();
            }
        }
        else {
            gameBgm.play();
        }
    }

    var data = msg.map_data;
    var item_num = 0;
    var c = document.getElementById("ready_player_div");
    if (c) {
        c.parentNode.removeChild(c);
    }
    c = document.getElementById("game_result");
    if (c) {
        c.parentNode.removeChild(c);
    }

    var rows = [];
    var table = document.createElement("table");
    table.setAttribute("id", "game_board_table");

    c = document.getElementById("game_board_table");
    if (c) {
        c.parentNode.removeChild(c);
    }

    var h = document.getElementById(tableId).clientHeight;
    var w = document.getElementById("game_area").clientWidth;
    var _x = (h / y) * x;


    if (w > _x) {
        _x = _x.toString();
    }
    else {
        _x = w.toString();
    }
    table.style.width = _x + "px";

    var cx = false;
    var cy = false;
    var hx = false;
    var hy = false;

    for (i = 0; i < data.length; i++) {
        for (j = 0; j < data[0].length; j++) {
            if (data[i][j] == 3) {
                item_num += 1;
            }
            else if (data[i][j] == 4) {
                cx = j;
                cy = i;
            }
            else if (data[i][j] == 5) {
                hx = j;
                hy = i;
            }
            else if ((data[i][j] == 45) || (data[i][j] == 54)) {
                cx = j;
                cy = i;
                hx = j;
                hy = i;
            }
        }
    }

    for (i = 0; i < data.length; i++) {
        rows.push(table.insertRow(-1));
        for (j = 0; j < data[0].length; j++) {
            cell = rows[i].insertCell(-1);

            if (((cx !== false) && ((cy - 1 <= i) && (i <= cy + 1)) && ((cx - 1 <= j) && (j <= cx + 1))) ||
                ((hx !== false) && ((hy - 1 <= i) && (i <= hy + 1)) && ((hx - 1 <= j) && (j <= hx + 1)))) {
                if (data[i][j] == 0) {
                    cell.classList.add("field_img");
                }
                else if (data[i][j] == 2) {
                    cell.classList.add("wall_img");
                }
                else if (data[i][j] == 3) {
                    cell.classList.add("hart_img");
                }
                else if (data[i][j] == 4) {
                    cell.classList.add("cool_img");
                }
                else if (data[i][j] == 5) {
                    cell.classList.add("hot_img");
                }
                else if (data[i][j] == 45) {
                    cell.classList.add("ch_img");
                }
                else if (data[i][j] == 54) {
                    cell.classList.add("hc_img");
                }
            }
            else {
                if (data[i][j] == 0) {
                    cell.classList.add("field_dark_img");
                }
                else if (data[i][j] == 2) {
                    cell.classList.add("wall_dark_img");
                }
                else if (data[i][j] == 3) {
                    cell.classList.add("hart_dark_img");
                }
                else if (data[i][j] == 4) {
                    cell.classList.add("cool_dark_img");
                }
                else if (data[i][j] == 5) {
                    cell.classList.add("hot_dark_img");
                }
                else if (data[i][j] == 45) {
                    cell.classList.add("ch_dark_img");
                }
                else if (data[i][j] == 54) {
                    cell.classList.add("hc_dark_img");
                }
            }
        }
    }

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
                vx = -1;
                vy = -1;
                if (msg.effect.p == "cool" && !(cx === false)) {
                    vx = cx + x;
                    vy = cy + y;
                }
                else if (msg.effect.p == "hot" && !(hx === false)) {
                    vx = hx + x;
                    vy = hy + y;
                }
   
                if (!(0 > vx || data[0].length - 1 < vx || 0 > vy || data.length - 1 < vy)) {
                    table.rows[vy].cells[vx].style.border = "2px solid rgba(244, 3, 3, 1.3)";
                    if (data[vy][vx] == 0) {
                        table.rows[vy].cells[vx].setAttribute("class", "field_img");
                    }
                    else if (data[vy][vx] == 2) {
                        table.rows[vy].cells[vx].setAttribute("class", "wall_img");
                    }
                    else if (data[vy][vx] == 3) {
                        table.rows[vy].cells[vx].setAttribute("class", "hart_img");
                    }
                    else if (data[vy][vx] == 4) {
                        table.rows[vy].cells[vx].setAttribute("class", "cool_img");
                    }
                    else if (data[vy][vx] == 5) {
                        table.rows[vy].cells[vx].setAttribute("class", "hot_img");
                    }
                }
            }
        }
    }

    var odiv = document.createElement("div");
    odiv.setAttribute("id", "game_info_div");

    c = document.getElementById("game_info_div");
    if (c) {
        c.parentNode.removeChild(c);
    }


    var cdiv = document.createElement("div");
    cdiv.setAttribute("id", "cool_info_div");

    var cndiv = document.createElement("div");
    cndiv.setAttribute("id", "cool_name");
    var newContent = document.createTextNode(c_name);
    cndiv.appendChild(newContent);

    var csdiv = document.createElement("div");
    csdiv.setAttribute("id", "cool_score");
    newContent = document.createTextNode(msg.cool_score);
    csdiv.appendChild(newContent);

    cdiv.appendChild(cndiv);
    cdiv.appendChild(csdiv);


    var turndiv = document.createElement("div");
    turndiv.setAttribute("id", "turn_div");

    var tturn = document.createElement("div");
    tturn.setAttribute("id", "turn_title");
    newContent = document.createTextNode("残りターン数");
    tturn.appendChild(newContent);

    var nturn = document.createElement("div");
    nturn.setAttribute("id", "turn_n");
    newContent = document.createTextNode(msg.turn);
    nturn.appendChild(newContent);

    turndiv.appendChild(tturn);
    turndiv.appendChild(nturn);


    var hdiv = document.createElement("div");
    hdiv.setAttribute("id", "hot_info_div");

    var hndiv = document.createElement("div");
    hndiv.setAttribute("id", "hot_name");
    var newContent = document.createTextNode(h_name);
    hndiv.appendChild(newContent);

    var hsdiv = document.createElement("div");
    hsdiv.setAttribute("id", "hot_score");
    newContent = document.createTextNode(msg.hot_score);
    hsdiv.appendChild(newContent);


    var hartdiv = document.createElement("div");
    hartdiv.setAttribute("id", "hart_div");

    var thart = document.createElement("div");
    thart.setAttribute("id", "hart_title");
    newContent = document.createTextNode("残りアイテム数");
    thart.appendChild(newContent);

    var nhart = document.createElement("div");
    nhart.setAttribute("id", "hart_n");
    newContent = document.createTextNode(item_num);
    nhart.appendChild(newContent);

    hartdiv.appendChild(thart);
    hartdiv.appendChild(nhart);


    hdiv.appendChild(hndiv);
    hdiv.appendChild(hsdiv);


    odiv.appendChild(turndiv);
    odiv.appendChild(cdiv);
    odiv.appendChild(hdiv);
    odiv.appendChild(hartdiv);


    document.getElementById(tableId).appendChild(table);
    document.getElementById("game_info").appendChild(odiv);
}



function reqFullscreen(target_id = false) {
    var target = document.getElementById("game_area");
    if (target_id) {
        try {
            target = document.getElementById(target_id);
        }
        catch (e) {
            target = document.getElementById("game_area");
        }
    }
    if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
    } else if (target.mozRequestFullScreen) {
        target.mozRequestFullScreen();
    } else if (target.msRequestFullscreen) {
        target.msRequestFullscreen();
    } else if (target.requestFullscreen) {
        target.requestFullscreen();
    } else {
        alert('ご利用のブラウザはフルスクリーン操作に対応していません');
        return;
    }
}

function exitFullscreen() {
    if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    } else if (document.cancelFullScreen) {
        document.cancelFullScreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

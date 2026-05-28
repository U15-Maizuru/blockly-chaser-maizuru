function createserverList(get_list) {
  // グループ分け: 対戦/自動
  const groupMap = {
    "対戦": [],
    "自動": []
  };

  for (var key in get_list) {
    const server = get_list[key];
    if (server.name.includes('room_onetime')) continue;
    if (!server.cpu) {
      groupMap["対戦"].push(server);
    } else {
      groupMap["自動"].push(server);
    }
  }

  const watchingListElem = document.getElementById('watching_list');
  watchingListElem.innerHTML = '';

  Object.keys(groupMap).forEach(groupName => {
    const groupDiv = document.createElement('div');
    groupDiv.classList.add('server_group');

    const groupTitle = document.createElement('div');
    groupTitle.classList.add('server_group_title');
    groupTitle.textContent = groupName;
    groupDiv.appendChild(groupTitle);

    const rowDiv = document.createElement('div');
    rowDiv.classList.add('server_row');

    groupMap[groupName].forEach(server => {
      const one_server_div = document.createElement('div');
      one_server_div.classList.add("one_watching_server");
      one_server_div.setAttribute("id", "link_id_" + server.room_id);

      const vs = !server.cpu ? "VS" : "AUTO";

      const server_div = document.createElement('div');
      server_div.classList.add(server.room_id);
      server_div.classList.add("watching_server_div");

      const server_vs = document.createElement('div');
      if (vs == "VS") {
        server_vs.classList.add("server_vs_player");
      } else {
        server_vs.classList.add("server_vs_auto");
      }
      let newContent = document.createTextNode(vs);
      server_vs.appendChild(newContent);

      const server_name = document.createElement('div');
      server_name.classList.add("server_name");
      const serverName = server.name.replace("room_onetime_", "");
      newContent = document.createTextNode(serverName);
      server_name.appendChild(newContent);

      const server_id = document.createElement('div');
      server_id.classList.add("server_id");
      newContent = document.createTextNode(server.room_id);
      server_id.appendChild(newContent);

      server_div.appendChild(server_vs);
      server_div.appendChild(server_name);
      server_div.appendChild(server_id);

      server_div.onclick = function (e) {
        var serverId = this.classList[0];
        document.querySelectorAll('.watching_server_div').forEach(div => {
          div.classList.remove("server_select_on");
        });
        this.classList.add("server_select_on");
        server_info(serverId, get_list);
        e.stopPropagation();
      };

      one_server_div.appendChild(server_div);
      rowDiv.appendChild(one_server_div);
    });

    groupDiv.appendChild(rowDiv);
    watchingListElem.appendChild(groupDiv);
  });
}

function server_info(id, get_list) {

  var data = get_list[id].map_data;
  var c = document.getElementById("map_table");
  if (c) {
    c.parentNode.removeChild(c);
  }
  var rows = [];
  var table = document.createElement("table");
  table.setAttribute("id", "map_table");

  for (i = 0; i < data.length; i++) {
    rows.push(table.insertRow(-1));
    for (j = 0; j < data[0].length; j++) {
      cell = rows[i].insertCell(-1);
      if (data[i][j] == 0) {
        cell.classList.add("field_img");
      }
      else if (data[i][j] == 1) {
        cell.classList.add("wall_img");
      }
      else if (data[i][j] == 2) {
        cell.classList.add("hart_img");
      }
      else if (data[i][j] == 3) {
        cell.classList.add("cool_img");
      }
      else if (data[i][j] == 4) {
        cell.classList.add("hot_img");
      }
      else if (data[i][j] == 34) {
        cell.classList.add("ch_img");
      }
      else if (data[i][j] == 43) {
        cell.classList.add("hc_img");
      }
    }
  }


  c = document.getElementById("server_info_div");
  if (c) {
    c.parentNode.removeChild(c);
  }

  c = document.getElementById("server_join_div");
  if (c) {
    c.parentNode.removeChild(c);
  }

  c = document.getElementById("server_watch_div");
  if (c) {
    c.parentNode.removeChild(c);
  }

  c = document.getElementById("server_info_name");
  if (c) {
    c.parentNode.removeChild(c);
  }

  c = document.getElementById("server_access_div");
  if (c) {
    c.parentNode.removeChild(c);
  }

  var server_info_name = document.createElement('div');
  server_info_name.setAttribute("id", "server_info_name");
  var newContent = document.createTextNode(get_list[id].name);
  server_info_name.appendChild(newContent);


  var server_info_div = document.createElement('div');
  server_info_div.setAttribute("id", "server_info_div");

  var server_info_title = document.createElement('span');
  newContent = document.createTextNode(lng_list["SERVER_INFO"]);
  server_info_title.appendChild(newContent);

  var server_info_id = document.createElement('div');
  server_info_id.setAttribute("id", "server_info_id");
  newContent = document.createTextNode(get_list[id].room_id);
  server_info_id.appendChild(newContent);

  var server_info_map = document.createElement('div');
  server_info_map.setAttribute("id", "server_info_map");
  var map_status = lng_list["FIXITY"];
  if (!get_list[id].map_data.length) {
    table.classList.add("auto_create_map");
    map_status = lng_list["AUTOMATIC_GENERATION"];
    if (get_list[id].auto_symmetry) {
      map_status += lng_list["SYMMETRY"];
    }
    else {
      map_status += lng_list["RANDOM"];
    }
  }
  newContent = document.createTextNode(map_status);
  server_info_map.appendChild(newContent);

  var server_info_turn = document.createElement('div');
  server_info_turn.setAttribute("id", "server_info_turn");
  var turn_status = lng_list["CONNECTION_ORDER"];
  if (get_list[id].cpu) {
    turn_status = lng_list["FIXITY"];
    if (get_list[id].cpu.turn == "cool") {
      turn_status += lng_list["TURN_H"];
    }
    else {
      turn_status += lng_list["TURN_C"];
    }
  }
  newContent = document.createTextNode(turn_status);
  server_info_turn.appendChild(newContent);

  server_info_div.appendChild(server_info_title);
  server_info_div.appendChild(server_info_id);
  server_info_div.appendChild(server_info_map);
  server_info_div.appendChild(server_info_turn);


  var server_access_div = document.createElement('div');
  server_access_div.setAttribute("id", "server_access_div");

  var server_match_button = document.createElement('button');
  server_match_button.setAttribute("id", "server_match_button");
  server_match_button.classList.add("server_match_button");
  server_match_button.innerText = lng_list["MATCH"];
  server_match_button.addEventListener('click', function() {
      var additionalText = encodeURIComponent(server_token_input.value);
      if (additionalText == "") {
          additionalText = "no_token";
      }
      window.location.href = '/match?room_id=' + id + '&room_token=' + additionalText;
  });

  var server_watch_button = document.createElement('button');
  server_watch_button.setAttribute("id", "server_watch_button");
  server_watch_button.classList.add("server_watch_button");
  server_watch_button.innerText = lng_list["WATCHING"];
  server_watch_button.addEventListener('click', function() {
      var additionalText = encodeURIComponent(server_token_input.value);
      if (additionalText == "") {
          additionalText = "no_token";
      }
      window.location.href = '/watching?room_id=' + id + '&room_token=' + additionalText;
  });

  var server_token_input = document.createElement('input');
  server_token_input.setAttribute("id", "server_token_input");
  server_token_input.classList.add("server_token_input");
  server_token_input.type = 'text';
  server_token_input.placeholder = '合言葉を入力';
  server_token_input.addEventListener('input', function() {
    this.value = this.value.replace(/[^\x00-\x7F]/g, '');
  });

  server_access_div.appendChild(server_match_button);
  server_access_div.appendChild(server_watch_button);
  server_access_div.appendChild(server_token_input);

  document.getElementById("watching_info").appendChild(server_info_name);
  document.getElementById("watching_info").appendChild(table);
  document.getElementById("watching_info").appendChild(server_info_div);
  document.getElementById("watching_info").appendChild(server_access_div);
  document.getElementById("menu_area").classList.add("select_back");
}


window.addEventListener('load', function () {
  getserverList();
})

function getserverList() {
  var url = './../api/game';
  fetch(url)
    .then(function (data) {
      return data.json();
    })
    .then(function (json) {
      createserverList(json);
    });
}


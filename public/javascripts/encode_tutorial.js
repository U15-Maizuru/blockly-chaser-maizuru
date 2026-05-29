Blockly.JavaScript.addReservedWords('exit');


var outputArea = document.getElementById('output');
var runButton = document.getElementById('runButton');
var reloadButton = document.getElementById('reloadButton');
var myInterpreter = null;
var runner;
var map_info = [0, 0, 0, 0, 0, 0, 0, 0, 0];
var look_info = [0, 0, 0, 0, 0, 0, 0, 0, 0];
var search_info = [0, 0, 0, 0, 0, 0, 0, 0, 0];


class ObjInterpreter extends Interpreter {
  constructor(code, initAlert) {
    super(code, initAlert);

    this._obj = {}; //store last valid scope
    this._result = null; // store last result from external function
  }

  getProperty(obj, name) {
    if ((obj == null) || !obj.isReal) {
      this._obj = obj;
      return super.getProperty(obj, name);
    }
    else {
      var member;
      member = obj.connectedObject[name.toString()];
      if ((member != null) && typeof member === "object") {
        return this._createConnectedObject(member); // return object
      }
      else if ((member != null) && typeof member === "function") {
        this._result = obj.connectedObject[name.toString()](); //run function (without attr)
        return super.getProperty(this._obj, 'proxy'); //return dummy function
      }
      else {
        return this.createPrimitive(member); // return primitve typ
      }
    }
  }

  setProperty(obj, name, value, opt_fixed, opt_nonenum) {
    if ((obj == null) || !obj.isReal) {
      return super.setProperty(obj, name, value, opt_fixed, opt_nonenum);
    }
    else {
      obj.connectedObject[name.toString()] = value;
    }
  }

  _createConnectedObject(obj) {
    var cobj;
    cobj = this.createObject(this.OBJECT);
    cobj.isReal = true;
    cobj.connectedObject = obj;
    return cobj;
  }

  connectObject(scope, name, obj) {
    this.setProperty(scope, name, this._createConnectedObject(obj, name));
  }
}

function initApi(interpreter, scope) {
  // Add an API function for the alert() block, generated for "text_print" blocks.

  interpreter.connectObject(scope, "map_info", map_info);
  interpreter.connectObject(scope, "look_info", look_info);
  interpreter.connectObject(scope, "search_info", search_info);

  var wrapper = function (text) {
    text.toString();
    outputArea.value = outputArea.value + '\n' + text;
  };
  interpreter.setProperty(scope, 'alert',
    interpreter.createNativeFunction(wrapper));

  // Add an API function for the prompt() block.
  var wrapper = function (text, callback) {
    text = text ? text.toString() : '';
    self_prompt_b(text, callback);
  };
  interpreter.setProperty(scope, 'prompt',
    interpreter.createAsyncFunction(wrapper));

  // Add an API function for highlighting blocks.
  var wrapper = function (id) {
    id = id ? id.toString() : '';
    return interpreter.createPrimitive(highlightBlock(id));
  };
  interpreter.setProperty(scope, 'highlightBlock',
    interpreter.createNativeFunction(wrapper));


  var wrapper = function (direction, callback) {
    my_map_data = false;

    var getDate = function () {
      my_map_data = get_ready();
      if (my_map_data) {
        my_turn = true;
        callback(my_map_data.join(''));
      }
      else {
        setTimeout(getDate, 100);
      }
    };
    setTimeout(getDate, 200);
  };
  interpreter.setProperty(scope, 'get_ready',
    interpreter.createAsyncFunction(wrapper));


  var wrapper = function (direction, callback) {
    if (my_turn) {
      my_map_data = false;
      my_turn = false;
      my_map_data = move_player(direction);

      var getDate = function () {
        if (my_map_data) {
          callback(my_map_data.join(''));
        }
        else {
          setTimeout(getDate, 100);
        }
      };
      setTimeout(getDate, 200);
    }
    else {
      if (stage_data["cpu"]) {
        Code.stopJS();
        return
      }
      callback(my_map_data.join(''));
    }
  };
  interpreter.setProperty(scope, 'move_player',
    interpreter.createAsyncFunction(wrapper));

  var wrapper = function (direction, callback) {
    if (my_turn) {
      my_map_data = false;
      my_turn = false;
      my_map_data = put_wall(direction);

      var getDate = function () {
        if (my_map_data) {
          callback(my_map_data.join(''));
        }
        else {
          setTimeout(getDate, 100);
        }
      };
      setTimeout(getDate, 200);
    }
    else {
      if (stage_data["cpu"]) {
        Code.stopJS();
        return
      }
      callback(my_map_data.join(''));
    }
  };
  interpreter.setProperty(scope, 'put_wall',
    interpreter.createAsyncFunction(wrapper));


  var wrapper = function (direction, callback) {
    if (my_turn) {
      my_map_data = false;
      my_turn = false;
      my_map_data = look(direction);

      var getDate = function () {
        if (my_map_data) {
          callback(my_map_data.join(''));
        }
        else {
          setTimeout(getDate, 100);
        }
      };
      setTimeout(getDate, 200);
    }
    else {
      if (stage_data["cpu"]) {
        Code.stopJS();
        return
      }
      callback(my_map_data.join(''));
    }
  };
  interpreter.setProperty(scope, 'look',
    interpreter.createAsyncFunction(wrapper));


  var wrapper = function (direction, callback) {
    if (my_turn) {
      my_map_data = false;
      my_turn = false;
      my_map_data = search(direction);

      var getDate = function () {
        if (my_map_data) {
          callback(my_map_data.join(''));
        }
        else {
          setTimeout(getDate, 100);
        }
      };
      setTimeout(getDate, 200);
    }
    else {
      if (stage_data["cpu"]) {
        Code.stopJS();
        return
      }
      callback(my_map_data.join(''));
    }
  };
  interpreter.setProperty(scope, 'search',
    interpreter.createAsyncFunction(wrapper));

  var wrapper = function (text) {
    text = text ? text.toString() : '';
    return +text;
  };
  interpreter.setProperty(scope, 'valueNum',
    interpreter.createNativeFunction(wrapper));


}


var highlightPause = false;
var latestCode = '';

function highlightBlock(id) {
  Code.workspace.highlightBlock(id);
  highlightPause = true;
}

function resetStepUi(clearOutput) {
  Code.workspace.highlightBlock(null);
  highlightPause = false;
  runButton.disabled = '';

  if (clearOutput) {
    outputArea.value = 'Program output:\n=================';
  }

  generateUiCodeAndLoadIntoInterpreter();
}

function generateUiCodeAndLoadIntoInterpreter() {
  Blockly.JavaScript.STATEMENT_PREFIX = '';
  Blockly.JavaScript.INFINITE_LOOP_TRAP = '';

  latestCode = javascript.javascriptGenerator.workspaceToCode(Code.workspace);
}

function generateCodeAndLoadIntoInterpreter() {
  // Generate JavaScript code and parse it.
  Blockly.JavaScript.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
  Blockly.JavaScript.addReservedWords('highlightBlock');

  if (localStorage["LOOP_STATUS"]) {
    if (localStorage["LOOP_STATUS"] == "on") {
      var LoopTrap = 1000;
      Blockly.JavaScript.INFINITE_LOOP_TRAP = 'if(--LoopTrap == 0) throw "Infinite loop.";\n';
      latestCode = javascript.javascriptGenerator.workspaceToCode(Code.workspace);
      latestCode = "var LoopTrap = " + LoopTrap + ";\n" + latestCode;
    }
  }
}

function resetInterpreter() {
  myInterpreter = null;
  if (runner) {
    clearTimeout(runner);
    runner = null;
  }
  if (runner) {
    clearTimeout(runner);
    runner = null;
  }
}

function resetVar() {
  my_turn = false;
  map_info = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  look_info = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  search_info = [0, 0, 0, 0, 0, 0, 0, 0, 0];
}

var step_flag = false;
if (localStorage["LOWSPEED_MODE"]) {
  if (localStorage["LOWSPEED_MODE"] == "on") {
    step_flag = true;
  }
  else {
    step_flag = false;
  }
}
else {
  localStorage["LOWSPEED_MODE"] == "off";
}

Code.runJS = function () {
  if (!myInterpreter) {

    resetStepUi(true);
    runButton.classList.toggle("Button_hidden");
    reloadButton.classList.toggle("Button_hidden");

    my_turn = true;

    setTimeout(function () {
      highlightPause = false;
      generateCodeAndLoadIntoInterpreter();
      if (!stage_data["cpu"]) {
        latestCode = 'map_info = [' + get_map_data("cool", "get_ready") + ']\n' + latestCode;
      }
      myInterpreter = new ObjInterpreter(latestCode, initApi);
      runner = function () {
        var hasMore;
        if (myInterpreter) {
          try {
            if (step_flag) {
              hasMore = myInterpreter.step();
            }
            else {
              hasMore = myInterpreter.run();
            }

            if (hasMore) {
              setTimeout(runner, 10);
            }
            else {
              outputArea.value += '\n\n<< Program complete >>';
              resetInterpreter();
              resetVar();
              resetStepUi(false);
            }
          }
          catch (e) {
            outputArea.value += '\n\n<< Error ' + e + '>>';
            resetInterpreter();
            resetVar();
            resetStepUi(false);
          }
        }
      };
      runner();
    }, 100);
    return;
  }
};

Code.reloadJS = function () {
  Code.stopJS();
  endCode();
  makeTable("game_board");
  runButton.classList.toggle("Button_hidden");
  reloadButton.classList.toggle("Button_hidden");
}
Code.bindClick('reloadButton', Code.reloadJS);
Code.bindClick('resetButton', Code.reloadJS);

Code.stopJS = function () {
  if (myInterpreter) {
    clearTimeout();
    resetVar();
    runButton.disabled = 'disabled';
    outputArea.value += '\n\n<< Stop Program >>';
    resetInterpreter();
    resetStepUi(false);
  }
  var c = document.getElementById("ready_player");
  if (c) {
    c.parentNode.removeChild(c);
  }
};

Code.download = function () {
  var state = Blockly.serialization.workspaces.save(Code.workspace);
  var jsonText = JSON.stringify(state, null, 2);

  var userAgent = window.navigator.userAgent.toLowerCase();
  var webbrowser_check = 0;

  if (userAgent.indexOf('msie') != -1 || userAgent.indexOf('trident') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('edge') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('chrome') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('safari') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('firefox') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('opera') != -1) {
    webbrowser_check = 1;
  }

  if (webbrowser_check == 0) {
    window.alert("ご利用のブラウザは本機能を使用できません");
  }
  else {
    const version = "2.1.1+MZ"; // リリース時に更新
    
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    const timestamp = `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;

    // info.json に格納するオブジェクト
    const info = {
      savedAt: timestamp,
      version: version
    };

    // JSON バイト列に変換
    const infoJsonBytes = new TextEncoder().encode(JSON.stringify(info, null, 2));

    // JSON テキストをバイト列に変換
    const jsonBytes = new TextEncoder().encode(jsonText);

    // ZIP形式でアーカイブ
    const zipped = fflate.zipSync({
      "program.json": jsonBytes,
      "info.json": infoJsonBytes
    });

    // Blobとして保存
    const blob = new Blob([zipped], { type: "application/zip" });

    self_prompt("ファイル名を入力してください", function (file_name) {
      if (file_name) {
        file_name += ".blch";

        if (window.navigator.msSaveBlob) {
          window.navigator.msSaveBlob(blob, file_name);
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = file_name;
          a.click();
        }
      }
    });
  }
}


Code.downloadPython = function () {
  var pythonTextarea = document.getElementById('content_python');
  var pythonText = python.pythonGenerator.workspaceToCode(Code.workspace);

  var userAgent = window.navigator.userAgent.toLowerCase();
  var webbrowser_check = 0;

  if (userAgent.indexOf('msie') != -1 || userAgent.indexOf('trident') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('edge') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('chrome') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('safari') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('firefox') != -1) {
    webbrowser_check = 1;
  }
  else if (userAgent.indexOf('opera') != -1) {
    webbrowser_check = 1;
 }

  if (webbrowser_check == 0) {
    window.alert("ご利用のブラウザは本機能を使用できません");
  }
  else {
    var blob = new Blob([pythonText], { type: "application/octet-stream" });

    self_prompt("ファイル名を入力してください", function (file_name) {
      if (file_name) {
        file_name += ".py";
        if (window.navigator.msSaveBlob) {
          // IE
          window.navigator.msSaveBlob(blob, file_name);
        } else {
          // another
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.target = '_blank';
          a.download = file_name;
          a.click();
        }
      }
    });
  }
}


function readSingleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  // XMLファイルとして読み込む場合
  if (fileName.endsWith(".xml")) {
    reader.onload = function (e) {
      const xmlText = e.target.result.toString();
      let xmlDom;

      try {
        xmlDom = Blockly.utils.xml.textToDom(xmlText);
      } catch (err) {
        alert("XMLファイルの読み込みに失敗しました");
        return;
      }

      if (xmlDom) {
        Code.workspace.clear();
        Blockly.Xml.domToWorkspace(xmlDom, Code.workspace);
      }
    };
    reader.readAsText(file);
  }

  // ── 非圧縮JSONファイルの処理 ──
  else if (fileName.endsWith(".json")) {
    reader.onload = function (e) {
      try {
        const jsonText = e.target.result.toString();
        const workspaceData = JSON.parse(jsonText);
        Code.workspace.clear();
        Blockly.serialization.workspaces.load(workspaceData, Code.workspace);
      } catch (err) {
        alert("JSONファイルの読み込みまたは解析に失敗しました");
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  // ZIP圧縮JSONとして読み込む場合（.blch や .zip）
  else {
    reader.onload = function (e) {
      try {
        const arrayBuffer = e.target.result;
        const uint8 = new Uint8Array(arrayBuffer);
        const unzipped = fflate.unzipSync(uint8);

        if (!unzipped["program.json"]) {
          alert("program.json が ZIP 内に見つかりませんでした");
          return;
        }

        const jsonText = new TextDecoder("utf-8").decode(unzipped["program.json"]);
        const workspaceData = JSON.parse(jsonText);

        Code.workspace.clear();
        Blockly.serialization.workspaces.load(workspaceData, Code.workspace);
      } catch (err) {
        console.error(err);
        alert("ZIPファイルの展開または読み込みに失敗しました");
      }
    };
    reader.readAsArrayBuffer(file);
  }
}


document.getElementById('file_load').addEventListener('change', readSingleFile, false);

window.addEventListener('load', function () {
  initDataLoad();
})


function initDataLoad() {

  var queryStr = window.location.search.slice(1);
  queries = {};

  if (!queryStr) {
    return queries;
  }

  queryStr.split('&').forEach(function (queryStr) {
    var queryArr = queryStr.split('=');
    queries[queryArr[0]] = queryArr[1];
  });
  if (localStorage[queries.stage]) {
    const jsonText = localStorage.getItem(queries.stage).toString();
    var workspaceData;
    try {
      workspaceData = JSON.parse(jsonText);
    } catch (err) {
      window.alert("JSONの解析に失敗しました");
      return;
    }
    try {
      Code.workspace.clear();
      Blockly.serialization.workspaces.load(workspaceData, Code.workspace);
    } catch (e) {
      window.alert("ワークスペースの復元に失敗しました");
    }      
  }
}

if (localStorage["DEBUG_MODE"]) {
  if (localStorage["DEBUG_MODE"] == "off") {
    document.getElementById("tab_blocks").style.width = "100%";
    document.getElementById("tab_javascript").style.display = "none";
    document.getElementById("tab_json").style.display = "none";
    document.getElementById("tab_xml").style.display = "none";
  }
}
else {
  localStorage["DEBUG_MODE"] == "off"
}

function self_prompt(message, callback) {
  var input_text = "";
  var pdiv = document.createElement("div");
  pdiv.setAttribute("id", "input_text_area");

  var pmdiv = document.createElement("div");
  pmdiv.setAttribute("id", "input_text_message");
  var newContent = document.createTextNode(message);
  pmdiv.appendChild(newContent);
  pdiv.appendChild(pmdiv);

  var pidiv = document.createElement("input");
  pidiv.setAttribute("type", "text");
  pidiv.setAttribute("maxlength", "25");
  pidiv.setAttribute("id", "input_text_form");
  pdiv.appendChild(pidiv);

  var pddiv = document.createElement("div");
  pddiv.setAttribute("id", "input_text_button");

  var podiv = document.createElement("div");
  podiv.setAttribute("id", "input_text_ok");
  var newContent = document.createTextNode("OK");
  podiv.appendChild(newContent);

  var input_text_ok = function () {
    input_text = "" + document.getElementById("input_text_form").value;
    var c = document.getElementById("input_text_area");
    if (c) {
      c.parentNode.removeChild(c);
    }
    callback(input_text);
  }
  podiv.addEventListener('click', input_text_ok, true);
  podiv.addEventListener('touchend', input_text_ok, true);

  var pcdiv = document.createElement("div");
  pcdiv.setAttribute("id", "input_text_cancel");
  var newContent = document.createTextNode("キャンセル");
  pcdiv.appendChild(newContent);

  var input_text_cancel = function () {
    var c = document.getElementById("input_text_area");
    if (c) {
      c.parentNode.removeChild(c);
    }
    callback(false);
  }
  pcdiv.addEventListener('click', input_text_cancel, true);
  pcdiv.addEventListener('touchend', input_text_cancel, true);

  pddiv.appendChild(podiv);
  pddiv.appendChild(pcdiv);
  pdiv.appendChild(pddiv);

  document.body.appendChild(pdiv);

};

function self_prompt_b(message, callback) {
  var input_text = "";
  var pdiv = document.createElement("div");
  pdiv.setAttribute("id", "input_text_area");

  var pmdiv = document.createElement("div");
  pmdiv.setAttribute("id", "input_text_message");
  var newContent = document.createTextNode(message);
  pmdiv.appendChild(newContent);
  pdiv.appendChild(pmdiv);

  var pidiv = document.createElement("input");
  pidiv.setAttribute("type", "text");
  pidiv.setAttribute("maxlength", "25");
  pidiv.setAttribute("id", "input_text_form");
  pdiv.appendChild(pidiv);

  var pddiv = document.createElement("div");
  pddiv.setAttribute("id", "input_text_button");

  var podiv = document.createElement("div");
  podiv.setAttribute("id", "input_text_ok");
  var newContent = document.createTextNode("OK");
  podiv.appendChild(newContent);

  var input_text_ok = function () {
    input_text = "" + document.getElementById("input_text_form").value;
    var c = document.getElementById("input_text_area");
    if (c) {
      c.parentNode.removeChild(c);
    }
    callback(input_text);
  }
  podiv.addEventListener('click', input_text_ok, true);
  podiv.addEventListener('touchend', input_text_ok, true);

  var pcdiv = document.createElement("div");
  pcdiv.setAttribute("id", "input_text_cancel");
  var newContent = document.createTextNode("キャンセル");
  pcdiv.appendChild(newContent);

  var input_text_cancel = function () {
    var c = document.getElementById("input_text_area");
    if (c) {
      c.parentNode.removeChild(c);
    }
    callback('');
  }
  pcdiv.addEventListener('click', input_text_cancel, true);
  pcdiv.addEventListener('touchend', input_text_cancel, true);

  pddiv.appendChild(podiv);
  pddiv.appendChild(pcdiv);
  pdiv.appendChild(pddiv);

  document.body.appendChild(pdiv);

};

Blockly.dialog.setPrompt(function(msg, defaultValue, callback)
{
  self_prompt_b(msg, callback);
}
);
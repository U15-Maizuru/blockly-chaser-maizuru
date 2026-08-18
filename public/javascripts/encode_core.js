// encode.js / encode_match.js の共通コア。
// 画面ごとに異なる部分（出力欄の有無・参加イベント名・ファイルIOの可否等）は options 経由で注入する。
function initEncodeRuntime(options) {
  Blockly.JavaScript.addReservedWords('exit');

  var outputArea = options.outputArea || null;
  var runButton = options.runButton || null;
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


  Blockly.JavaScript.addLoopTrap("infinite_loop");


  function initApi(interpreter, scope) {
    // Add an API function for the alert() block, generated for "text_print" blocks.

    interpreter.connectObject(scope, "map_info", map_info);
    interpreter.connectObject(scope, "look_info", look_info);
    interpreter.connectObject(scope, "search_info", search_info);

    var wrapper = function (text) {
      text.toString();
      if (outputArea) {
        outputArea.value = outputArea.value + '\n' + text;
      }
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

    var wrapper = function () {
      var socket = io();
    };
    interpreter.setProperty(scope, 'io',
      interpreter.createNativeFunction(wrapper));

    var wrapper = function (id, name) {
      id = id ? id.toString() : '';
      name = name ? name.toString() : '';

      var user = options.buildUser(id, name);
      socket.emit(options.joinEvent, user);

      server_connect_status = true;
    };
    interpreter.setProperty(scope, 'join',
      interpreter.createNativeFunction(wrapper));

    var wrapper = function (direction, callback) {
      if (my_turn) {
        direction = direction ? direction.toString() : '';
        look_search_data = false;
        var getDate = function () {
          if (look_search_data) {
            map_info = look_search_data;
            callback(look_search_data.join(''));
          }
          else if (myInterpreter) {
            socket.emit(SOCKET_EVENTS.MOVE_PLAYER, direction);
            setTimeout(getDate, 100);
          }
        };
        getDate();
      }
      else {
        if (stage_data["cpu"]) {
          Code.stopJS();
          return
        }
        callback(map_info.join(''));
      }
    };
    interpreter.setProperty(scope, 'move_player',
      interpreter.createAsyncFunction(wrapper));


    var wrapper = function (direction, callback) {
      if (my_turn) {
        direction = direction ? direction.toString() : '';
        look_search_data = false;
        var getDate = function () {
          if (look_search_data) {
            map_info = look_search_data;
            callback(look_search_data.join(''));
          }
          else if (myInterpreter) {
            socket.emit(SOCKET_EVENTS.PUT_WALL, direction);
            setTimeout(getDate, 100);
          }
        };
        getDate();
      }
      else {
        if (stage_data["cpu"]) {
          Code.stopJS();
          return
        }
        callback(map_info.join(''));
      }
    };
    interpreter.setProperty(scope, 'put_wall',
      interpreter.createAsyncFunction(wrapper));


    var wrapper = function (text) {
      text = text ? text.toString() : '';
      return +text;
    };
    interpreter.setProperty(scope, 'valueNum',
      interpreter.createNativeFunction(wrapper));

    var wrapper = function (callback) {
      my_turn = false;
      var getDate = function () {
        if (my_turn) {
          map_info = my_turn;
          callback(my_turn.join(''));
        }
        else if (myInterpreter) {
          socket.emit(SOCKET_EVENTS.GET_READY);
          setTimeout(getDate, options.getReadyPollMs);
        }
      };
      getDate();
    };
    interpreter.setProperty(scope, 'get_ready',
      interpreter.createAsyncFunction(wrapper));

    var wrapper = function (direction, callback) {
      if (my_turn) {
        look_search_data = false;
        var getDate = function () {
          if (look_search_data) {
            look_info = look_search_data;
            callback(look_search_data.join(''));
          }
          else if (myInterpreter) {
            socket.emit(SOCKET_EVENTS.LOOK, direction);
            setTimeout(getDate, 100);
          }
        };
        getDate();
      }
      else {
        if (stage_data["cpu"]) {
          Code.stopJS();
          return
        }
        callback(look_info.join(''));
      }
    };
    interpreter.setProperty(scope, 'look',
      interpreter.createAsyncFunction(wrapper));

    var wrapper = function (direction, callback) {
      if (my_turn) {
        look_search_data = false;
        var getDate = function () {
          if (look_search_data) {
            search_info = look_search_data;
            callback(look_search_data.join(''));
          }
          else if (myInterpreter) {
            socket.emit(SOCKET_EVENTS.SEARCH, direction);
            setTimeout(getDate, 100);
          }
        };
        getDate();
      }
      else {
        if (stage_data["cpu"]) {
          Code.stopJS();
          return
        }
        callback(search_info.join(''));
      }
    };
    interpreter.setProperty(scope, 'search',
      interpreter.createAsyncFunction(wrapper));
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
    if (runButton) {
      runButton.disabled = '';
    }

    if (clearOutput && outputArea) {
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
    if (options.enableHighlightPrefix) {
      Blockly.JavaScript.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
      Blockly.JavaScript.addReservedWords('highlightBlock');
    }

    if (localStorage["LOOP_STATUS"]) {
      if (localStorage["LOOP_STATUS"] == "on") {
        var LoopTrap = 1000;
        Blockly.JavaScript.INFINITE_LOOP_TRAP = 'if(--LoopTrap == 0) throw "Infinite loop.";\n';
        latestCode = javascript.javascriptGenerator.workspaceToCode(Code.workspace);
        latestCode = "var LoopTrap = " + LoopTrap + ";\n" + latestCode;
      }
    }
  }

  function saveCodelocalStorage() {
    var state = Blockly.serialization.workspaces.save(Code.workspace);
    var jsonText = JSON.stringify(state, null, 2);

    if (localStorage["AUTO_SAVE"]) {
      if (localStorage["AUTO_SAVE"] == "on") {
        localStorage.setItem("LastRun", jsonText);
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
    if (server_connect_status) {
      socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
    }
    my_turn = false;
    server_connect_status = false;
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

  Code.runJS = function (t_code) {
    if (!myInterpreter) {

      resetStepUi(true);
      if (runButton) {
        runButton.disabled = 'disabled';
      }

      setTimeout(function () {
        highlightPause = false;
        if (typeof t_code === 'string' && t_code) {
          latestCode = t_code;
        }
        else {
          generateCodeAndLoadIntoInterpreter();
          saveCodelocalStorage();
          if (options.logGeneratedCode) {
            console.log(latestCode);
          }
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
                if (outputArea) {
                  outputArea.value += '\n\n<< Program complete >>';
                }
                resetInterpreter();
                resetVar();
                resetStepUi(false);
              }
            }
            catch (e) {
              console.error(e);
              console.log(latestCode);
              if (outputArea) {
                outputArea.value += '\n\n<< Error ' + e + '>>';
              }
              if (options.onError) {
                options.onError(e);
              }
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

  Code.stopJS = function () {
    if (myInterpreter) {
      clearTimeout();
      resetVar();
      if (runButton) {
        runButton.disabled = 'disabled';
      }
      if (outputArea) {
        outputArea.value += '\n\n<< Stop Program >>';
      }
      resetInterpreter();
      resetStepUi(false);
    }
    if (options.removeReadyPlayerOnStop) {
      var c = document.getElementById("ready_player");
      if (c) {
        c.parentNode.removeChild(c);
      }
    }
  };

  if (options.enableFileIO) {
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
        const version = APP_VERSION;

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


    Code.downloadPython = async function () {
      var pythonTextarea = document.getElementById('content_python');
      await ChaserTransliterator.warmCache(Code.workspace);
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

    // 現在のBlocklyワークスペースをPythonコードに変換し、Python練習ページ(/python-practice)に
    // 引き継ぐ。ワークスペースが未完成(ブロックが無い/Python未対応ブロックを含む/どのブロックも
    // 実行文につながっていない)で変換できない場合は警告を表示して遷移を中止する。
    Code.convertToPythonPractice = async function () {
      Code.stopJS();

      if (Code.workspace.getAllBlocks(false).length === 0) {
        Blockly.dialog.alert("ブロックが1つもありません。プログラムを作成してから変換してください。");
        return;
      }

      if (!Code.checkAllGeneratorFunctionsDefined(python.pythonGenerator)) {
        // checkAllGeneratorFunctionsDefined側で警告済み
        return;
      }

      await ChaserTransliterator.warmCache(Code.workspace);
      var pythonCode = python.pythonGenerator.workspaceToCode(Code.workspace);
      if (!pythonCode || !pythonCode.trim()) {
        Blockly.dialog.alert("実行可能なプログラムが見つかりません。ブロックが正しくつながっているか確認してください。");
        return;
      }

      // ワークスペースにserver_joinブロックが複数存在する場合(過去に試行錯誤して
      // 使われなくなったブロックが残っている等)、[0]は生成順で不定なものを拾ってしまう。
      // main_loop_content(本体)が実際に繋がっているブロックを優先して選ぶ。
      var serverJoinBlocks = Code.workspace.getBlocksByType('server_join', false);
      var serverJoinBlock = serverJoinBlocks.find(function (b) {
        return b.getInputTargetBlock('main_loop_content') !== null;
      }) || serverJoinBlocks[0];
      var roomId = serverJoinBlock ? serverJoinBlock.getFieldValue('map_id') : null;
      var mapPromise = roomId
        ? fetch('./../api/game?room_id=' + encodeURIComponent(roomId))
            .then(function (res) { return res.json(); })
            .then(function (json) {
              if (!json) return null;
              if (json.map) return json.map;
              // 固定マップを持たない手続き生成ルーム(ランダム/対称マップ)は、そのルームの
              // 生成パラメータ(auto_block/auto_point/auto_symmetry)から同等のマップをその場で
              // 生成して渡す。MAP_RANDOM_GENはpython-practice.ejsの「ランダム生成」ボタンと
              // 同じ実装を共有する。
              if (typeof MAP_RANDOM_GEN === 'undefined' || typeof MAP_FORMAT === 'undefined') return null;
              if (!Number.isInteger(json.map_size_x) || !Number.isInteger(json.map_size_y)) return null;
              var generated = MAP_RANDOM_GEN.generateRandomMap({
                sizeX: json.map_size_x,
                sizeY: json.map_size_y,
                blockNum: json.auto_block,
                itemNum: json.auto_point,
                turnMax: json.turn,
                mirror: !!json.auto_symmetry
              });
              generated.name = json.name;
              return MAP_FORMAT.serializeMap(generated);
            })
            .catch(function () { return null; })
        : Promise.resolve(null);

      mapPromise.then(function (map) {
        localStorage.setItem('pending_python_practice_code', pythonCode);
        if (map) {
          // localStorageは文字列しか保存できないため、mapオブジェクトはJSON文字列にする
          // (受け取り側のpython-map-editor.jsのsetValue()もJSON文字列を受け取る契約なので
          // そのまま渡せる)。
          localStorage.setItem('pending_python_practice_map', JSON.stringify(map));
        } else {
          localStorage.removeItem('pending_python_practice_map');
        }
        window.location.href = '/python-practice';
      });
    };


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
  }

  if (options.enableDataLoad) {
    window.initDataLoad = function initDataLoad() {
      const queryStr = window.location.search.slice(1);
      const queries = {};

      if (!queryStr) return queries;

      queryStr.split('&').forEach(q => {
        const [key, val] = q.split('=');
        queries[key] = val;
      });

      const fileKey = queries.loaddata;
      if (!fileKey || !localStorage[fileKey]) return;

      // データ本体をチェックして自動識別
      const data = localStorage.getItem(fileKey).toString();
      const isXML = data.trim().startsWith("<");

      if (isXML) {
        // XML処理
        var xmlDom;
        try {
          xmlDom = Blockly.utils.xml.textToDom(data);
        }
        catch (e) {
          window.alert("ファイルの読み込みに失敗しました");
        }
        if (xmlDom) {
          Code.workspace.clear();
          Blockly.Xml.domToWorkspace(xmlDom, Code.workspace);
        }
      } else {
        // JSON処理
        var workspaceData;
        try {
          workspaceData = JSON.parse(data);
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
    };
  }

  if (options.enableDebugTabToggle) {
    if (localStorage["DEBUG_MODE"]) {
      if (localStorage["DEBUG_MODE"] == "off") {
        // document.getElementById("tab_blocks").style.width = "100%";
        // document.getElementById("tab_python").style.display = "none";
        document.getElementById("tab_javascript").style.display = "none";
        document.getElementById("tab_json").style.display = "none";
        document.getElementById("tab_xml").style.display = "none";
      }
    }
    else {
      localStorage["DEBUG_MODE"] == "off"
    }
  }

  // キーボード操作向け：Enter/Spaceでクリックと同じ挙動にする
  function makeA11yButton(div) {
    div.tabIndex = 0;
    div.setAttribute('role', 'button');
    div.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        div.click();
      }
    });
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
    makeA11yButton(podiv);

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
    makeA11yButton(pcdiv);

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
    makeA11yButton(podiv);

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
    makeA11yButton(pcdiv);

    pddiv.appendChild(podiv);
    pddiv.appendChild(pcdiv);
    pdiv.appendChild(pddiv);

    document.body.appendChild(pdiv);

  };

  Blockly.dialog.setPrompt(function (msg, defaultValue, callback) {
    self_prompt_b(msg, callback);
  }
  );
}

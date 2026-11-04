// チュートリアル(Pythonで解く)用のランナー。
// Pyodide は Web Worker (pyodide-worker.js) の中で動かし、py-worker-host.js 経由で操作する。
// 生徒のコードは transformer.py の transform_tutorial_tree でジェネレータに変換され、
// ここがそれを1歩ずつ進める(net-runner.js と同じ「ホスト駆動」の方式)。
// yield された命令コードは tutorial-bridge.js が tutorial_board.js の盤面エンジンで実行する。
//
// tutorial_board.js が呼ぶ Code.stopJS / Code.reloadJS などのフックも、ここで提供する
// (Blockly 版では code.js / encode_tutorial.js が提供している)。
(function (root) {

    // 1回の呼び出し(コードの読み込み・1ステップの実行)に許す時間。超えると Worker ごと停止する。
    var CALL_TIMEOUT_MS = 10000;

    // 生徒のコードの大きさの上限(Worker 側の上限と同じ)
    var MAX_CODE_LENGTH = 100000;

    // Worker からの出力の上限(暴走した print で画面が固まらないようにする)
    var MAX_CONSOLE_LINES = 300;
    var MAX_CONSOLE_CHARS = 20000;
    var MAX_LINE_CHARS = 1000;

    // クリア済みのコードを保存する localStorage のキーの接頭辞。
    // Blockly 版は localStorage[stage_id] にワークスペースを保存しているため、区別する。
    var STORAGE_PREFIX = 'py_';

    var STARTER_CODE = '# ここに Python のプログラムを書こう\n' +
        '# れい: walk(Up)   # 上に1マス進む\n' +
        '#   (Up / Down / Left / Right で方向を指定するよ)\n\n';

    function errorText(err) {
        if (err && err.code === 'timeout') {
            return '10秒たっても次の行動(walk など)が出てこなかったので、停止しました';
        }
        return (err && err.message) || String(err);
    }

    function createTutorialRunner(editorCore) {
        var chaserCodePromise = RUNNER_SHARED.fetchText('/javascripts/python/lib/pyCHaser.tutorial.py');
        var transformerCodePromise = RUNNER_SHARED.fetchText('/javascripts/python/transformer.py');

        var host = null;
        var hostReady = null;
        var running = false;
        var runSeq = 0;

        var consoleLines = 0;
        var consoleChars = 0;
        var consoleFull = false;

        var runButton = document.getElementById('runButton');
        var reloadButton = document.getElementById('reloadButton');

        // 盤面エンジン(tutorial_board.js のグローバル関数)を包む
        var engine = {
            getReady: function () { return get_ready(); },
            move: function (dir) { return move_player(dir); },
            look: function (dir) { return look(dir); },
            search: function (dir) { return search(dir); },
            put: function (dir) { return put_wall(dir); },
            isMyTurn: function () { return my_turn; },
            setMyTurn: function (value) { my_turn = value; },
            hasCpu: function () { return !!stage_data['cpu']; },
            stopGame: function () { Code.stopJS(); }
        };
        var bridge = TUTORIAL_BRIDGE.createBridge(engine);

        // 実行/リセットボタンの排他表示。mode: 'run' = 実行を表示 / 'reset' = リセットを表示
        function setRunUi(mode) {
            if (!runButton || !reloadButton) return;
            var isRunning = (mode === 'reset');
            runButton.classList.toggle('Button_hidden', isRunning);
            reloadButton.classList.toggle('Button_hidden', !isRunning);
        }

        function resetConsoleLimit() {
            consoleLines = 0;
            consoleChars = 0;
            consoleFull = false;
        }

        // Worker からの出力。行数・文字数に上限を設ける
        function writeLimited(text) {
            if (consoleFull) return;
            text = String(text);
            if (text.length > MAX_LINE_CHARS) text = text.slice(0, MAX_LINE_CHARS) + '…';
            consoleLines += 1;
            consoleChars += text.length + 1;
            if (consoleLines > MAX_CONSOLE_LINES || consoleChars > MAX_CONSOLE_CHARS) {
                consoleFull = true;
                editorCore.writeToConsole('… 出力が多すぎるため、ここで打ち切りました');
                return;
            }
            editorCore.writeToConsole(text);
        }

        function startHost(showReadyMessage) {
            host = PY_WORKER_HOST.createHost({ onConsole: writeLimited });
            var current = host;
            hostReady = current.call('init').then(function () {
                if (showReadyMessage) editorCore.writeToConsole('読み込みが完了しました');
            });
            hostReady.catch(function (err) {
                if (current === host) editorCore.writeToConsole('Python の読み込みに失敗しました: ' + errorText(err));
            });
            return hostReady;
        }
        editorCore.writeToConsole('Python を準備しています…');
        startHost(true);

        function isCurrent(myRun) {
            return running && myRun === runSeq;
        }

        // Blockly 版の Code.stopJS と同じ役割。停止ボタンと、盤面エンジンの終了(クリア・失敗)から呼ばれる
        function stopJS() {
            var wasRunning = running;
            running = false;
            runSeq += 1;
            if (host && host.isBusy()) host.terminate();
            var ready = document.getElementById('ready_player');
            if (ready && ready.parentNode) ready.parentNode.removeChild(ready);
            if (wasRunning) {
                setRunUi('reset');
                editorCore.writeToConsole('\n<< 停止しました >>');
            }
        }

        // Blockly 版の Code.reloadJS と同じ役割(リセット)
        function reloadJS() {
            stopJS();
            endCode();
            makeTable('game_board');
            var overlay = document.getElementById('overlay');
            if (overlay) overlay.classList.remove('overlay_on');
            setRunUi('run');
        }

        function reportRunError(err) {
            stopJS();
            editorCore.writeToConsole(errorText(err));
        }

        function onProgramEnd(value, myRun) {
            if (!isCurrent(myRun)) return;
            running = false;
            setRunUi('reset');
            if (value && typeof value.error === 'string') {
                editorCore.writeToConsole(value.error);
            }
            editorCore.writeToConsole('\n<< 終了しました >>');
        }

        // 生徒のコードを1歩ずつ進める。1歩ごとに Worker の制限時間(CALL_TIMEOUT_MS)が付く
        function drive(currentHost, myRun) {
            var sendValue = null;
            function next() {
                if (!isCurrent(myRun)) return;
                currentHost.call('step', { value: sendValue }, CALL_TIMEOUT_MS).then(function (res) {
                    if (!isCurrent(myRun)) return undefined;
                    if (res.done) {
                        onProgramEnd(res.value, myRun);
                        return undefined;
                    }
                    return bridge.perform(res.value, function () { return isCurrent(myRun); }).then(function (result) {
                        if (result.stale || !isCurrent(myRun)) return;
                        if (result.ended) {
                            // 盤面エンジンが終了した(クリア・失敗など)。念のため停止を確定させる
                            Code.stopJS();
                            return;
                        }
                        sendValue = result.data;
                        next();
                    });
                }).catch(function (err) {
                    if (!isCurrent(myRun)) return;
                    reportRunError(err);
                });
            }
            next();
        }

        async function run() {
            if (running) return;
            var playerCode = editorCore.playerEditor.getValue();
            if (playerCode.length > MAX_CODE_LENGTH) {
                editorCore.writeToConsole('プログラムが長すぎます');
                return;
            }

            running = true;
            runSeq += 1;
            var myRun = runSeq;
            setRunUi('reset');
            editorCore.clearConsole();
            resetConsoleLimit();

            if (!host.isAlive()) startHost(false);
            var currentHost = host;
            var readyPromise = hostReady;

            try {
                await readyPromise;
                if (!isCurrent(myRun)) return;

                var chaserCode = await chaserCodePromise;
                var transformerCode = await transformerCodePromise;
                // Blockly 版と同じく、CPU のいないステージでは開始時点の周辺9マスを map_info に入れる
                var initialMapInfo = stage_data['cpu'] ? null : get_map_data('cool', 'get_ready');

                var loaded = await currentHost.call('loadTutorial', {
                    chaserCode: chaserCode,
                    transformerCode: transformerCode,
                    playerCode: playerCode,
                    initialMapInfo: initialMapInfo
                }, CALL_TIMEOUT_MS);
                if (!isCurrent(myRun)) return;

                if (!loaded || !loaded.ok) {
                    // 構文エラーなど。盤面は動いていないので、そのまま直して再実行できるようにする
                    running = false;
                    setRunUi('run');
                    editorCore.writeToConsole((loaded && loaded.message) || 'プログラムを読み込めませんでした');
                    return;
                }

                my_turn = true;
                await currentHost.call('newTurn', {}, CALL_TIMEOUT_MS);
                if (!isCurrent(myRun)) return;
                drive(currentHost, myRun);
            } catch (err) {
                if (!isCurrent(myRun)) return;
                reportRunError(err);
            }
        }

        // 盤面エンジン(tutorial_board.js)が呼ぶフック
        Code.stopJS = stopJS;
        Code.reloadJS = reloadJS;
        // ブロック数の制限は Python では評価しない
        Code.isOverBlockLimit = function () { return false; };
        // 行数の目標を超えているときだけ、クリア後に小さなヒントを出す(クリア状態には影響しない)
        Code.getClearHint = function () {
            var goal = stage_data['python_line_goal'];
            if (typeof goal !== 'number') return '';
            var lines = TUTORIAL_BRIDGE.countCodeLines(editorCore.playerEditor.getValue());
            return lines > goal ? 'くり返し(for)や関数(def)を使うと、もっと短く書けるよ！' : '';
        };
        // クリア時にコードを保存する(Blockly 版と同じく、自動保存がオンのときだけ)。
        // 保存されていること = クリア済み(メニューの表示に使う)
        Code.saveClearState = function (blockLimitFlag) {
            if (!blockLimitFlag) return;
            if (localStorage['AUTO_SAVE'] !== 'on') return;
            try {
                var code = editorCore.playerEditor.getValue();
                if (code.length <= MAX_CODE_LENGTH) {
                    localStorage.setItem(STORAGE_PREFIX + stage_data['stage_id'], code);
                }
            } catch (e) { /* 保存できなくても続行する */ }
        };

        function bind(id, handler) {
            var element = document.getElementById(id);
            if (element) element.addEventListener('click', handler);
        }
        bind('runButton', run);
        bind('stopButton', stopJS);
        bind('reloadButton', reloadJS);
        bind('resetButton', reloadJS);

        // 前回クリアしたときのコードがあれば、エディタに戻す
        try {
            var saved = localStorage.getItem(STORAGE_PREFIX + stage_data['stage_id']);
            if (typeof saved === 'string' && saved.length <= MAX_CODE_LENGTH) {
                editorCore.playerEditor.setValue(saved);
            }
        } catch (e) { /* 復元できなくても続行する */ }

        return { run: run, stop: stopJS, reload: reloadJS, isRunning: function () { return running; } };
    }

    root.TUTORIAL_RUNNER = {
        createTutorialRunner: createTutorialRunner,
        STARTER_CODE: STARTER_CODE,
        STORAGE_PREFIX: STORAGE_PREFIX
    };
})(typeof window !== 'undefined' ? window : this);

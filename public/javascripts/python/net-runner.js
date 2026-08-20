// モード①（オンライン対戦）専用のPyodideブートストラップ。
// lib/pyCHaser.py には public/javascripts/python/lib/pyCHaser.net.py の内容を書き込み、
// transformer.py の transform_code_net でASTを変換してから実行する。
// 実際のSocket.IO通信は py-bridge.js が担当する。
(function (root) {

    var DEFAULT_PLAYER_CODE = RUNNER_SHARED.DEFAULT_PLAYER_CODE;

    function createNetRunner(editorCore, bridgeOptions) {
        var pyodideReadyPromise = loadPyodide({ indexURL: '/javascripts/vendor/pyodide/' });
        var chaserCodePromise = RUNNER_SHARED.fetchText('/javascripts/python/lib/pyCHaser.net.py');
        var transformerCodePromise = RUNNER_SHARED.fetchText('/javascripts/python/transformer.py');

        var pyodide = null;
        var bridge = null;
        var running = false;
        var coolName = null;
        var hotName = null;

        function updateGameDisplay(gameState, turn, scores, coolName, hotName) {
            if (scores && scores.toJs) scores = scores.toJs();
            var built = GAME_DISPLAY.renderBoard('game_board', gameState, {});
            GAME_DISPLAY.renderInfoPanel('game_info', {
                turn: turn,
                coolName: coolName || 'プレイヤー',
                coolScore: scores ? scores[0] : 0,
                hotName: hotName || '対戦相手',
                hotScore: scores ? scores[1] : 0,
                itemCount: built.itemCount
            });
        }
        root.updateGameDisplayNet = updateGameDisplay;

        async function ready() {
            pyodide = await pyodideReadyPromise;
            var chaserCode = await chaserCodePromise;
            var transformerCode = await transformerCodePromise;

            editorCore.writeToConsole('読み込みが完了しました');

            root.writeToConsole = editorCore.writeToConsole;
            RUNNER_SHARED.installConsoleBridge(pyodide);

            if (!pyodide.FS.analyzePath('lib').exists) pyodide.FS.mkdir('lib');
            pyodide.FS.writeFile('lib/pyCHaser.py', chaserCode);
            await pyodide.runPythonAsync(transformerCode);
        }
        var readyPromise = ready();

        function stop() {
            running = false;
            if (bridge) bridge.leaveRoom();
        }

        async function run() {
            await readyPromise;
            editorCore.clearConsole();
            stop();
            running = true;

            var playerCode = editorCore.playerEditor.getValue();

            try {
                await pyodide.runPythonAsync(
                    'import sys\n' +
                    "sys.modules.pop('lib.pyCHaser', None)\n" +
                    "sys.modules.pop('lib', None)\n"
                );

                pyodide.globals.set('player_code', playerCode);
                await pyodide.runPythonAsync(
                    "player_transformed = transform_code_net(player_code)\n"
                );

                await pyodide.runPythonAsync(
                    "player_ns = {'__name__': '__chaser_player__'}\n" +
                    'exec(player_transformed, player_ns)\n' +
                    "do_turn_player = player_ns['main']()\n"
                );

                bridge = PY_BRIDGE.createBridge(Object.assign({}, bridgeOptions, {
                    onBoardUpdate: function (msg) {
                        updateGameDisplay(msg.map_data, msg.turn, [msg.cool_score, msg.hot_score], coolName, hotName);
                        bridgeOptions.onBoardUpdate && bridgeOptions.onBoardUpdate(msg);
                    },
                    onGameOver: function (info) {
                        running = false;
                        editorCore.writeToConsole('\nゲーム終了: ' + JSON.stringify(info));
                        bridgeOptions.onGameOver && bridgeOptions.onGameOver(info);
                    },
                    onJoinedRoom: function (msg) {
                        coolName = msg.cool_name || null;
                        hotName = msg.hot_name || null;
                        editorCore.writeToConsole('部屋に参加しました');
                        bridgeOptions.onJoinedRoom && bridgeOptions.onJoinedRoom(msg);
                    }
                }));

                var doTurnPlayer = pyodide.globals.get('do_turn_player');
                bridge.runProgram(doTurnPlayer);
            } catch (err) {
                editorCore.writeToConsole(err.message || String(err));
                bridgeOptions.onRunError && bridgeOptions.onRunError(err);
                running = false;
            }
        }

        return {
            run: run,
            stop: stop,
            isRunning: function () { return running; }
        };
    }

    var NET_RUNNER = { createNetRunner: createNetRunner, DEFAULT_PLAYER_CODE: DEFAULT_PLAYER_CODE };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NET_RUNNER;
    } else {
        root.NET_RUNNER = NET_RUNNER;
    }
})(typeof window !== 'undefined' ? window : this);

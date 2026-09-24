// モード①（オンライン対戦）専用のPyodideブートストラップ。
// Pyodide は Web Worker (pyodide-worker.js) の中で動かし、py-worker-host.js 経由で操作する。
// lib/pyCHaser.py には public/javascripts/python/lib/pyCHaser.net.py の内容を書き込み、
// transformer.py の transform_code_net でASTを変換してから実行する。
// 実際のSocket.IO通信は py-bridge.js が担当する。
(function (root) {

    var DEFAULT_PLAYER_CODE = RUNNER_SHARED.DEFAULT_PLAYER_CODE;

    // 1回の呼び出し(コードの読み込み・1ステップの実行)に許す時間。
    // サーバーの1手番の既定タイムアウトに合わせる。
    var CALL_TIMEOUT_MS = 10000;

    function createNetRunner(editorCore, bridgeOptions) {
        var chaserCodePromise = RUNNER_SHARED.fetchText('/javascripts/python/lib/pyCHaser.net.py');
        var transformerCodePromise = RUNNER_SHARED.fetchText('/javascripts/python/transformer.py');

        var host = null;
        var hostReady = null;
        var bridge = null;
        var running = false;
        var runSeq = 0;
        var coolName = null;
        var hotName = null;

        function updateGameDisplay(gameState, turn, scores, coolName, hotName) {
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

        root.writeToConsole = editorCore.writeToConsole;

        function startHost(showReadyMessage) {
            host = PY_WORKER_HOST.createHost({ onConsole: editorCore.writeToConsole });
            hostReady = host.call('init').then(function () {
                if (showReadyMessage) editorCore.writeToConsole('読み込みが完了しました');
            });
            return hostReady;
        }
        startHost(true);

        function stop() {
            running = false;
            runSeq++;
            if (host && host.isBusy()) host.terminate();
            if (bridge) bridge.leaveRoom();
        }

        async function run() {
            stop();
            var myRun = runSeq;
            if (!host.isAlive()) startHost(false);
            var currentHost = host;

            function isCurrent() {
                return running && myRun === runSeq;
            }

            // この実行専用のドライバ。停止・再実行された後は呼び出しを受け付けない。
            var driver = {
                newTurn: function () {
                    if (!isCurrent()) return Promise.reject(createStoppedError());
                    return currentHost.call('newTurn', {}, CALL_TIMEOUT_MS);
                },
                step: function (recData) {
                    if (!isCurrent()) return Promise.reject(createStoppedError());
                    return currentHost.call('step', { value: recData }, CALL_TIMEOUT_MS);
                }
            };

            try {
                await hostReady;
                if (myRun !== runSeq) return;
                editorCore.clearConsole();
                running = true;

                var playerCode = editorCore.playerEditor.getValue();
                var chaserCode = await chaserCodePromise;
                var transformerCode = await transformerCodePromise;
                await currentHost.call('loadNet', {
                    chaserCode: chaserCode,
                    transformerCode: transformerCode,
                    playerCode: playerCode
                }, CALL_TIMEOUT_MS);

                if (!isCurrent()) return;

                bridge = PY_BRIDGE.createBridge(Object.assign({}, bridgeOptions, {
                    onBoardUpdate: function (msg) {
                        updateGameDisplay(msg.map_data, msg.turn, [msg.cool_score, msg.hot_score], coolName, hotName);
                        bridgeOptions.onBoardUpdate && bridgeOptions.onBoardUpdate(msg);
                    },
                    onGameOver: function (info) {
                        running = false;
                        if (currentHost.isBusy()) currentHost.terminate();
                        editorCore.writeToConsole('\nゲーム終了: ' + JSON.stringify(info));
                        bridgeOptions.onGameOver && bridgeOptions.onGameOver(info);
                    },
                    onJoinedRoom: function (msg) {
                        coolName = msg.cool_name || null;
                        hotName = msg.hot_name || null;
                        editorCore.writeToConsole('部屋に参加しました');
                        bridgeOptions.onJoinedRoom && bridgeOptions.onJoinedRoom(msg);
                    },
                    onTurnError: function (err) {
                        if (!isCurrent()) return;
                        reportRunError(err);
                        if (err && err.code === 'timeout' && bridge) bridge.leaveRoom();
                    }
                }));

                bridge.runProgram(driver);
            } catch (err) {
                if (myRun !== runSeq) return;
                reportRunError(err);
            }
        }

        function createStoppedError() {
            var err = new Error('stopped');
            err.code = 'stopped';
            return err;
        }

        function reportRunError(err) {
            var message = err && err.code === 'timeout'
                ? '実行に時間がかかりすぎたため停止しました'
                : ((err && err.message) || String(err));
            editorCore.writeToConsole(message);
            bridgeOptions.onRunError && bridgeOptions.onRunError(new Error(message));
            running = false;
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

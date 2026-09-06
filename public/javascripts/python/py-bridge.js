// socket.io ⇔ Pythonジェネレータ の橋渡しアダプタ (モード①専用)。
// lib/pyCHaser.net.py の Client が yield する2文字命令コード
// (gr/wr/wu/wl/wd/lr/lu/ll/ld/sr/su/sl/sd/pr/pu/pl/pd) を実際の
// socket.emit(SOCKET_EVENTS.xxx, ...) にマッピングし、対応する *_REC の
// rec_data を次の gen.next() に渡すことで、do_turn ジェネレータを駆動する。
//
// 使い方:
//   var bridge = PY_BRIDGE.createBridge({
//     socket: socket,
//     joinEvent: SOCKET_EVENTS.PLAYER_JOIN_MATCH,
//     buildJoinPayload: function () { return {room_id, name, chara, key}; }
//   });
//   bridge.runProgram(doTurnPyProxy, { onGameOver: function(info) {...} });
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../socket_events.js'));
    } else {
        root.PY_BRIDGE = factory(root.SOCKET_EVENTS);
    }
})(typeof window !== 'undefined' ? window : this, function (SOCKET_EVENTS) {

    var ACTION_MAP = {
        gr: { event: 'GET_READY', recEvent: 'GET_READY_REC' },
        wr: { event: 'MOVE_PLAYER', recEvent: 'MOVE_REC', dir: 'right' },
        wu: { event: 'MOVE_PLAYER', recEvent: 'MOVE_REC', dir: 'top' },
        wl: { event: 'MOVE_PLAYER', recEvent: 'MOVE_REC', dir: 'left' },
        wd: { event: 'MOVE_PLAYER', recEvent: 'MOVE_REC', dir: 'bottom' },
        lr: { event: 'LOOK', recEvent: 'LOOK_REC', dir: 'right' },
        lu: { event: 'LOOK', recEvent: 'LOOK_REC', dir: 'top' },
        ll: { event: 'LOOK', recEvent: 'LOOK_REC', dir: 'left' },
        ld: { event: 'LOOK', recEvent: 'LOOK_REC', dir: 'bottom' },
        sr: { event: 'SEARCH', recEvent: 'SEARCH_REC', dir: 'right' },
        su: { event: 'SEARCH', recEvent: 'SEARCH_REC', dir: 'top' },
        sl: { event: 'SEARCH', recEvent: 'SEARCH_REC', dir: 'left' },
        sd: { event: 'SEARCH', recEvent: 'SEARCH_REC', dir: 'bottom' },
        pr: { event: 'PUT_WALL', recEvent: 'PUT_REC', dir: 'right' },
        pu: { event: 'PUT_WALL', recEvent: 'PUT_REC', dir: 'top' },
        pl: { event: 'PUT_WALL', recEvent: 'PUT_REC', dir: 'left' },
        pd: { event: 'PUT_WALL', recEvent: 'PUT_REC', dir: 'bottom' }
    };

    function createBridge(options) {
        var socket = options.socket;
        var SE = SOCKET_EVENTS;
        var joined = false;
        var joinPromise = null;
        var gameOver = false;
        var gameResult = null;

        socket.on(SE.JOINED_ROOM, function (msg) {
            options.onJoinedRoom && options.onJoinedRoom(msg);
        });
        socket.on(SE.NEW_BOARD, function (msg) {
            options.onBoardUpdate && options.onBoardUpdate(msg);
        });
        socket.on(SE.UPDATE_BOARD, function (msg) {
            options.onBoardUpdate && options.onBoardUpdate(msg);
        });
        socket.on(SE.GAME_RESULT, function (msg) {
            gameOver = true;
            gameResult = msg;
            options.onGameOver && options.onGameOver(msg);
        });
        socket.on(SE.ERROR, function (msg) {
            gameOver = true;
            gameResult = { error: msg };
            options.onGameOver && options.onGameOver(gameResult);
        });

        function ensureJoined() {
            if (joined) return Promise.resolve();
            if (joinPromise) return joinPromise;
            joinPromise = new Promise(function (resolve) {
                socket.once(SE.JOINED_ROOM, function () {
                    joined = true;
                    resolve();
                });
                socket.emit(options.joinEvent, options.buildJoinPayload());
            });
            return joinPromise;
        }

        // chaser/server.js は「まだ自分の手番でない」場合、GET_READY等に対して
        // 無効な rec_data (未初期化の .true プロパティ、実質undefined) を返す。
        // これはBlocklyの参照実装(encode_core.js)がポーリングで対処している既存仕様であり、
        // 本ブリッジも同様に「有効な9要素配列が届くまで再送信する」ことで手番を待つ。
        var RETRY_MS = 150;

        function sendAction(code) {
            var spec = ACTION_MAP[code];
            if (!spec) return Promise.reject(new Error('unknown pyCHaser action code: ' + code));
            return ensureJoined().then(function () {
                return new Promise(function (resolve) {
                    function attempt() {
                        if (gameOver) { resolve(null); return; }
                        socket.once(SE[spec.recEvent], function (msg) {
                            if (Array.isArray(msg && msg.rec_data) && msg.rec_data.length === 9) {
                                resolve(msg.rec_data);
                            } else if (!gameOver) {
                                setTimeout(attempt, RETRY_MS);
                            } else {
                                resolve(null);
                            }
                        });
                        if (spec.dir) {
                            socket.emit(SE[spec.event], spec.dir);
                        } else {
                            socket.emit(SE[spec.event]);
                        }
                    }
                    attempt();
                });
            });
        }

        // do_turn ジェネレータ(1ターン分)を最後まで駆動する。
        // 戻り値: { stopped: true } (ゲーム終了により打ち切り) または
        //         { stopped: false, continueLoop: true/false } (do_turnが正常終了)
        function driveTurn(gen) {
            var sendValue;
            var yieldedAny = false;
            function step() {
                if (gameOver) return Promise.resolve({ stopped: true });
                var result = gen.next(sendValue);
                if (result.done) {
                    // 正常なターンは必ずget_ready()由来で最低1回yieldする。
                    // 0回のまま終了するのは、ネストした関数内の行動呼び出しが
                    // transformer.pyで検出できないパターン(辞書経由の呼び出し等)で
                    // yield from化されず、サーバーに何も送信されなかった異常系。
                    // 何もフィードバックせず10秒タイムアウトを待つよりはましなので警告する。
                    if (!yieldedAny && typeof writeToConsole === 'function') {
                        writeToConsole('警告: このターンで行動がサーバーに送信されませんでした。ネストした関数の中でwalk/put等を呼んでいる場合、対戦モードでは正しく動かないことがあります。');
                    }
                    return Promise.resolve({ stopped: false, continueLoop: !!result.value });
                }
                yieldedAny = true;
                var code = result.value;
                return sendAction(code).then(function (recData) {
                    sendValue = recData;
                    return step();
                });
            }
            return step();
        }

        // doTurnFn: main() が返した do_turn 関数の PyProxy (呼び出すたびに新しい
        // ジェネレータを生成する)。ゲーム終了 or do_turn が False を返すまで
        // ターンを繰り返す。
        function runProgram(doTurnFn) {
            function playTurn() {
                if (gameOver) return;
                var gen = doTurnFn();
                Promise.resolve().then(function () {
                    return driveTurn(gen);
                }).then(function (res) {
                    try { if (gen.destroy) gen.destroy(); } catch (e) { /* noop */ }
                    if (res.stopped || !res.continueLoop) return;
                    playTurn();
                }).catch(function (e) {
                    try { if (gen.destroy) gen.destroy(); } catch (e2) { /* noop */ }
                    console.error('[py-bridge] turn error:', e);
                });
            }
            playTurn();
        }

        function leaveRoom() {
            if (joined) socket.emit(SE.LEAVE_ROOM);
        }

        return {
            runProgram: runProgram,
            leaveRoom: leaveRoom,
            isGameOver: function () { return gameOver; },
            getResult: function () { return gameResult; }
        };
    }

    return { createBridge: createBridge, ACTION_MAP: ACTION_MAP };
});

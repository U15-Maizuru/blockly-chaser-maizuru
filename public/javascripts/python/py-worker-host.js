// pyodide-worker.js を起動し、要求と応答を Promise で扱うためのホスト(メインスレッド側)。
// call() に制限時間を渡すと、超過した時点で Worker ごと停止して reject する。
// 停止した Worker は再利用できないため、呼び出し側は createHost() を作り直す。
(function (root) {

    var WORKER_URL = '/javascripts/python/pyodide-worker.js';

    // 表示する盤面の一辺の上限
    var MAX_BOARD_SIDE = 100;

    function sanitizeDisplay(data) {
        var state = data.gameState;
        if (!Array.isArray(state) || state.length === 0 || state.length > MAX_BOARD_SIDE) return null;
        var board = [];
        for (var i = 0; i < state.length; i++) {
            var row = state[i];
            if (!Array.isArray(row) || row.length > MAX_BOARD_SIDE) return null;
            board.push(row.map(Number));
        }
        var scores = Array.isArray(data.scores) ? data.scores.slice(0, 2).map(Number) : [0, 0];
        return { gameState: board, turn: Number(data.turn) || 0, scores: scores };
    }

    function createError(code, message) {
        var err = new Error(message);
        err.code = code;
        return err;
    }

    // handlers: { onConsole(text), onDisplay({ gameState, turn, scores }) }
    function createHost(handlers) {
        handlers = handlers || {};
        var worker = new Worker(WORKER_URL);
        var alive = true;
        var seq = 0;
        var pending = {};

        function pendingCount() {
            return Object.keys(pending).length;
        }

        function settle(id, fn) {
            var entry = pending[id];
            if (!entry) return;
            delete pending[id];
            if (entry.timer) clearTimeout(entry.timer);
            fn(entry);
        }

        function terminate(code) {
            if (!alive) return;
            alive = false;
            worker.terminate();
            Object.keys(pending).forEach(function (id) {
                settle(id, function (entry) {
                    entry.reject(createError(code || 'terminated', 'worker terminated'));
                });
            });
        }

        worker.onmessage = function (event) {
            var data = event.data;
            if (!data || typeof data !== 'object') return;

            if (data.type === 'console') {
                if (handlers.onConsole) handlers.onConsole(String(data.text));
                return;
            }
            if (data.type === 'display') {
                var display = sanitizeDisplay(data);
                if (display && handlers.onDisplay) handlers.onDisplay(display);
                return;
            }
            if (typeof data.id === 'number') {
                settle(data.id, function (entry) {
                    if (data.ok) entry.resolve(data.result);
                    else entry.reject(createError('python', String(data.error)));
                });
            }
        };

        worker.onerror = function () {
            terminate('worker-error');
        };

        // cmd: Workerのコマンド名 / timeoutMs: 省略すると制限なし
        function call(cmd, payload, timeoutMs) {
            if (!alive) return Promise.reject(createError('terminated', 'worker terminated'));
            return new Promise(function (resolve, reject) {
                var id = ++seq;
                var entry = { resolve: resolve, reject: reject, timer: null };
                if (timeoutMs) {
                    entry.timer = setTimeout(function () { terminate('timeout'); }, timeoutMs);
                }
                pending[id] = entry;
                worker.postMessage({ id: id, cmd: cmd, payload: payload || {} });
            });
        }

        return {
            call: call,
            terminate: function () { terminate('terminated'); },
            isAlive: function () { return alive; },
            isBusy: function () { return pendingCount() > 0; }
        };
    }

    var PY_WORKER_HOST = { createHost: createHost };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PY_WORKER_HOST;
    } else {
        root.PY_WORKER_HOST = PY_WORKER_HOST;
    }
})(typeof window !== 'undefined' ? window : this);

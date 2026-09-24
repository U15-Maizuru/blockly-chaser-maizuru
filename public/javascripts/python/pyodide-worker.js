// Pyodide を実行する Web Worker。
// プレイヤーのPythonコードはこのWorkerの中だけで動く。
// メインスレッド(py-worker-host.js)とは postMessage で
//   要求  : { id, cmd, payload }
//   応答  : { id, ok, result } または { id, ok: false, error }
//   通知  : { type: 'console', text } / { type: 'display', gameState, turn, scores }
// をやり取りする。
importScripts('/javascripts/vendor/pyodide/pyodide.js', '/javascripts/python/runner-shared.js');

(function () {
    var pyodide = null;

    function post(message) {
        self.postMessage(message);
    }

    // Python側の `from js import ...` から呼ばれる出力関数
    self.writeToConsole = function (text) {
        post({ type: 'console', text: String(text) });
    };

    self.updateGameDisplay = function (gameState, turn, scores) {
        post({
            type: 'display',
            gameState: toPlain(gameState),
            turn: turn,
            scores: toPlain(scores)
        });
    };

    function toPlain(value) {
        return value && typeof value.toJs === 'function' ? value.toJs() : value;
    }

    // Pyodide の初期化が済んだ後に、Worker内で使わない機能を無効化する
    function disableUnusedFeatures() {
        [
            'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport',
            'importScripts', 'Worker', 'SharedWorker', 'BroadcastChannel',
            'indexedDB', 'caches'
        ].forEach(function (name) {
            try {
                Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false });
            } catch (e) {
                try { self[name] = undefined; } catch (e2) { /* noop */ }
            }
        });
    }

    function writeChaserLib(chaserCode) {
        if (!pyodide.FS.analyzePath('lib').exists) pyodide.FS.mkdir('lib');
        pyodide.FS.writeFile('lib/pyCHaser.py', chaserCode);
    }

    var RESET_CHASER_MODULE =
        'import sys\n' +
        "sys.modules.pop('lib.pyCHaser', None)\n" +
        "sys.modules.pop('lib', None)\n";

    // オンライン対戦: do_turn ジェネレータを1ステップずつ進めるための補助
    var NET_HELPERS =
        'import json as _json\n' +
        '_turn_gen = None\n' +
        'def _chaser_new_turn():\n' +
        '    global _turn_gen\n' +
        '    _turn_gen = do_turn_player()\n' +
        'def _chaser_step(value):\n' +
        '    global _turn_gen\n' +
        '    try:\n' +
        '        code = _turn_gen.send(value)\n' +
        '    except StopIteration as stop:\n' +
        '        _turn_gen = None\n' +
        '        return _json.dumps([True, bool(stop.value)])\n' +
        '    return _json.dumps([False, code])\n';

    var handlers = {
        init: async function () {
            pyodide = await loadPyodide({ indexURL: '/javascripts/vendor/pyodide/' });
            RUNNER_SHARED.installConsoleBridge(pyodide);
            disableUnusedFeatures();
            return true;
        },

        // オンライン対戦: プレイヤーのコードを変換して読み込む
        loadNet: async function (payload) {
            writeChaserLib(payload.chaserCode);
            await pyodide.runPythonAsync(payload.transformerCode);
            await pyodide.runPythonAsync(RESET_CHASER_MODULE);

            pyodide.globals.set('player_code', payload.playerCode);
            await pyodide.runPythonAsync(
                'player_transformed = transform_code_net(player_code)\n'
            );
            await pyodide.runPythonAsync(
                "player_ns = {'__name__': '__chaser_player__'}\n" +
                'exec(player_transformed, player_ns)\n' +
                "do_turn_player = player_ns['main']()\n"
            );
            await pyodide.runPythonAsync(NET_HELPERS);
            return true;
        },

        newTurn: async function () {
            pyodide.runPython('_chaser_new_turn()');
            return true;
        },

        // ジェネレータを1歩進める。戻り値: { done, value }
        step: async function (payload) {
            var stepFn = pyodide.globals.get('_chaser_step');
            var arg = null;
            try {
                if (payload.value !== null && payload.value !== undefined) {
                    arg = pyodide.toPy(payload.value);
                }
                var json = stepFn(arg);
                var parsed = JSON.parse(json);
                return { done: parsed[0], value: parsed[1] };
            } finally {
                if (arg && arg.destroy) arg.destroy();
                stepFn.destroy();
            }
        },

        // オフライン練習: プレイヤーと対戦AIのコードを変換して読み込む
        loadLocal: async function (payload) {
            pyodide.globals.clear();
            await pyodide.runPythonAsync(payload.transformerCode);
            writeChaserLib(payload.chaserCode);
            await pyodide.runPythonAsync(RESET_CHASER_MODULE);

            pyodide.globals.set('player_code', payload.playerCode);
            pyodide.globals.set('opponent_code', payload.opponentCode);
            await pyodide.runPythonAsync(
                "player_transformed = transform_code_local(player_code, player_id=0, client_name='player')\n" +
                "opponent_transformed = transform_code_local(opponent_code, player_id=1, client_name='opponent')\n"
            );

            pyodide.globals.set('map_data', payload.mapData || null);
            await pyodide.runPythonAsync(
                "player_ns = {'__name__': '__chaser_player__'}\n" +
                "opponent_ns = {'__name__': '__chaser_opponent__'}\n" +
                'exec(player_transformed, player_ns)\n' +
                'exec(opponent_transformed, opponent_ns)\n\n' +
                'import lib.pyCHaser as _chaser_mod\n' +
                '_chaser_mod.set_custom_map(map_data)\n\n' +
                "do_turn_player = player_ns['main']()\n" +
                "do_turn_opponent = opponent_ns['main']()\n"
            );
            return true;
        },

        // オフライン練習: 1ターン分（対戦AI→プレイヤー）を実行する
        localTurn: async function () {
            var doTurnOpponent = pyodide.globals.get('do_turn_opponent');
            var doTurnPlayer = pyodide.globals.get('do_turn_player');
            try {
                var continueOpponent = doTurnOpponent();
                var continuePlayer = doTurnPlayer();
                var isOver = pyodide.runPython('_chaser_mod.get_shared_game().is_game_over()');
                return {
                    continueOpponent: !!continueOpponent,
                    continuePlayer: !!continuePlayer,
                    isOver: !!isOver
                };
            } finally {
                doTurnOpponent.destroy();
                doTurnPlayer.destroy();
            }
        }
    };

    self.onmessage = async function (event) {
        var data = event.data;
        if (!data || typeof data.id !== 'number') return;
        var handler = Object.prototype.hasOwnProperty.call(handlers, data.cmd) ? handlers[data.cmd] : null;
        if (!handler) {
            post({ id: data.id, ok: false, error: 'unknown command' });
            return;
        }
        try {
            var result = await handler(data.payload || {});
            post({ id: data.id, ok: true, result: result });
        } catch (err) {
            post({ id: data.id, ok: false, error: (err && err.message) || String(err) });
        }
    };
})();

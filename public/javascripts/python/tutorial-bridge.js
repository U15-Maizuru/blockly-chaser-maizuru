// チュートリアル(Pythonで解く)用の橋渡し。
// Worker 内の生徒コードが yield する2文字の命令コード(py-bridge.js と同じ語彙)を、
// tutorial_board.js の盤面エンジンの操作に対応付けて実行し、結果(周辺9マス)を返す。
//
// Worker から受け取るのは命令コードだけで、実行できる操作は下の表にあるものに限る
// (表は自身のプロパティだけを引く。未知のコード・不正な形式は実行しない)。
// Blockly 版の非同期ラッパー(encode_tutorial.js)と同じ手番・ペース配分にしている。
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.TUTORIAL_BRIDGE = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {

    // fn: 盤面エンジンの操作 / dir: 方向(tutorial_board.js の表記)
    var ACTIONS = {
        gr: { fn: 'getReady' },
        wr: { fn: 'move', dir: 'right' },
        wu: { fn: 'move', dir: 'top' },
        wl: { fn: 'move', dir: 'left' },
        wd: { fn: 'move', dir: 'bottom' },
        lr: { fn: 'look', dir: 'right' },
        lu: { fn: 'look', dir: 'top' },
        ll: { fn: 'look', dir: 'left' },
        ld: { fn: 'look', dir: 'bottom' },
        sr: { fn: 'search', dir: 'right' },
        su: { fn: 'search', dir: 'top' },
        sl: { fn: 'search', dir: 'left' },
        sd: { fn: 'search', dir: 'bottom' },
        pr: { fn: 'put', dir: 'right' },
        pu: { fn: 'put', dir: 'top' },
        pl: { fn: 'put', dir: 'left' },
        pd: { fn: 'put', dir: 'bottom' }
    };

    // Blockly 版ラッパーと同じ待ち時間(ミリ秒)
    var ACTION_DELAY_MS = 200;
    var POLL_MS = 100;

    function resolveAction(code) {
        if (typeof code !== 'string') return null;
        return Object.prototype.hasOwnProperty.call(ACTIONS, code) ? ACTIONS[code] : null;
    }

    // 周辺9マス(0〜3の整数が9個)か。エンジンが終了・失敗したときは undefined などが返る
    function isNineCells(value) {
        if (!Array.isArray(value) || value.length !== 9) return false;
        for (var i = 0; i < 9; i++) {
            if (typeof value[i] !== 'number' || value[i] < 0 || value[i] > 3 || value[i] % 1 !== 0) return false;
        }
        return true;
    }

    // コードの行数(空行とコメントだけの行は数えない)。行数の目標との比較に使う
    function countCodeLines(code) {
        if (typeof code !== 'string') return 0;
        return code.split('\n').filter(function (line) {
            var trimmed = line.trim();
            return trimmed !== '' && trimmed.charAt(0) !== '#';
        }).length;
    }

    // engine: 盤面エンジンの操作(tutorial_board.js の関数を包んだもの)
    //   getReady() / move(dir) / look(dir) / search(dir) / put(dir) : 周辺9マス、または終了時に false/undefined
    //   isMyTurn() / setMyTurn(bool) / hasCpu() / stopGame()
    // options.timers: { setTimeout } (テスト用に差し替え可)
    function createBridge(engine, options) {
        options = options || {};
        var timers = options.timers || { setTimeout: function (fn, ms) { return setTimeout(fn, ms); } };
        var actionDelay = options.actionDelayMs !== undefined ? options.actionDelayMs : ACTION_DELAY_MS;
        var pollMs = options.pollMs !== undefined ? options.pollMs : POLL_MS;
        var lastData = null;

        // code: 2文字の命令コード / isCurrent: この実行がまだ有効か
        // 戻り値: Promise<{ stale: true } | { ended: true } | { ended: false, data: [9マス] }>
        //   stale: 実行が停止・再実行された / ended: エンジンが終了した(クリア・失敗など)
        function perform(code, isCurrent) {
            var spec = resolveAction(code);
            if (!spec) return Promise.reject(new Error('invalid action'));

            return new Promise(function (resolve) {
                if (spec.fn === 'getReady') {
                    var poll = function () {
                        if (!isCurrent()) { resolve({ stale: true }); return; }
                        var data = engine.getReady();
                        if (isNineCells(data)) {
                            lastData = data.slice();
                            resolve({ ended: false, data: lastData.slice() });
                        } else {
                            timers.setTimeout(poll, pollMs);
                        }
                    };
                    timers.setTimeout(poll, actionDelay);
                    return;
                }

                if (!engine.isMyTurn()) {
                    // CPU 対戦では、get_ready を待たずに続けて行動すると停止する(Blockly 版と同じ)
                    if (engine.hasCpu()) {
                        engine.stopGame();
                        resolve({ ended: true });
                    } else if (lastData) {
                        resolve({ ended: false, data: lastData.slice() });
                    } else {
                        resolve({ ended: true });
                    }
                    return;
                }

                engine.setMyTurn(false);
                var result = engine[spec.fn](spec.dir);
                timers.setTimeout(function () {
                    if (!isCurrent()) { resolve({ stale: true }); return; }
                    if (!isNineCells(result)) { resolve({ ended: true }); return; }
                    lastData = result.slice();
                    resolve({ ended: false, data: lastData.slice() });
                }, actionDelay);
            });
        }

        return { perform: perform };
    }

    return {
        createBridge: createBridge,
        resolveAction: resolveAction,
        isNineCells: isNineCells,
        countCodeLines: countCodeLines,
        ACTIONS: ACTIONS
    };
});

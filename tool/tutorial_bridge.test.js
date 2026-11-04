// チュートリアル(Pythonで解く)の橋渡し (public/javascripts/python/tutorial-bridge.js) のテスト。
const test = require('node:test');
const assert = require('node:assert');
const bridgeModule = require('../public/javascripts/python/tutorial-bridge.js');

const { createBridge, resolveAction, isNineCells, countCodeLines, ACTIONS } = bridgeModule;

test('resolveAction: 表にある命令コードだけを引く', () => {
    assert.deepStrictEqual(resolveAction('wu'), { fn: 'move', dir: 'top' });
    assert.deepStrictEqual(resolveAction('gr'), { fn: 'getReady' });
    assert.deepStrictEqual(resolveAction('pl'), { fn: 'put', dir: 'left' });
});

test('resolveAction: 表に無いもの・文字列でないものは引かない(プロトタイプのキーも含む)', () => {
    for (const code of ['', 'ww', 'WU', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf',
        null, undefined, 42, {}, ['wu'], true]) {
        assert.strictEqual(resolveAction(code), null, String(code));
    }
});

test('命令コードは対戦モード(py-bridge.js)と同じ語彙・同じ方向', () => {
    const pyBridge = require('../public/javascripts/python/py-bridge.js');
    const codes = Object.keys(pyBridge.ACTION_MAP).sort();
    assert.deepStrictEqual(Object.keys(ACTIONS).sort(), codes);
    const fnByEvent = { GET_READY: 'getReady', MOVE_PLAYER: 'move', LOOK: 'look', SEARCH: 'search', PUT_WALL: 'put' };
    for (const code of codes) {
        const spec = pyBridge.ACTION_MAP[code];
        assert.strictEqual(ACTIONS[code].fn, fnByEvent[spec.event], code);
        assert.strictEqual(ACTIONS[code].dir, spec.dir, code);
    }
});

test('isNineCells: 0〜3 の整数が9個のときだけ true', () => {
    assert.strictEqual(isNineCells([0, 1, 2, 3, 0, 1, 2, 3, 0]), true);
    for (const v of [undefined, false, null, 'x', [], [0, 1], new Array(9).fill(4), new Array(9).fill(-1),
        new Array(9).fill(1.5), new Array(9).fill('1'), new Array(10).fill(0)]) {
        assert.strictEqual(isNineCells(v), false);
    }
});

test('countCodeLines: 空行とコメントだけの行は数えない', () => {
    assert.strictEqual(countCodeLines('# メモ\n\nfor i in range(4):\n    walk(Right)  # 右\n   \n'), 2);
    assert.strictEqual(countCodeLines(''), 0);
    assert.strictEqual(countCodeLines(null), 0);
});

// テスト用: 待ち時間なしで即座に動くタイマー
const immediateTimers = { setTimeout: (fn) => { fn(); return 0; } };

function createFakeEngine(overrides) {
    const calls = [];
    const state = { myTurn: true, cpu: false, stopped: 0 };
    const cells = [0, 0, 0, 0, 4, 0, 0, 0, 0].map((v) => (v === 4 ? 0 : v));
    const engine = Object.assign({
        getReady: () => cells.slice(),
        move: (dir) => { calls.push(['move', dir]); return cells.slice(); },
        look: (dir) => { calls.push(['look', dir]); return cells.slice(); },
        search: (dir) => { calls.push(['search', dir]); return cells.slice(); },
        put: (dir) => { calls.push(['put', dir]); return cells.slice(); },
        isMyTurn: () => state.myTurn,
        setMyTurn: (v) => { calls.push(['setMyTurn', v]); state.myTurn = v; },
        hasCpu: () => state.cpu,
        stopGame: () => { state.stopped += 1; }
    }, overrides || {});
    return { engine, calls, state };
}

const always = () => true;

test('perform: 行動を実行し、手番を消費して、結果の9マスを返す', async () => {
    const { engine, calls } = createFakeEngine();
    const bridge = createBridge(engine, { timers: immediateTimers });
    const result = await bridge.perform('wr', always);
    assert.deepStrictEqual(result, { ended: false, data: [0, 0, 0, 0, 0, 0, 0, 0, 0] });
    assert.deepStrictEqual(calls, [['setMyTurn', false], ['move', 'right']]);
});

test('perform: 各命令コードが対応する操作と方向で呼ばれる', async () => {
    const { engine, calls, state } = createFakeEngine();
    const bridge = createBridge(engine, { timers: immediateTimers });
    for (const [code, expected] of [['lu', ['look', 'top']], ['sd', ['search', 'bottom']], ['pl', ['put', 'left']], ['wd', ['move', 'bottom']]]) {
        state.myTurn = true;
        calls.length = 0;
        await bridge.perform(code, always);
        assert.deepStrictEqual(calls[1], expected, code);
    }
});

test('perform: 未知の命令コードは実行せずに拒否する', async () => {
    const { engine, calls } = createFakeEngine();
    const bridge = createBridge(engine, { timers: immediateTimers });
    for (const code of ['xx', '__proto__', 'constructor', null, 7]) {
        await assert.rejects(() => bridge.perform(code, always), /invalid action/);
    }
    assert.deepStrictEqual(calls, []);
});

test('perform: エンジンが終了(クリア・失敗)して結果が無いときは ended', async () => {
    for (const value of [undefined, false, null]) {
        const { engine } = createFakeEngine({ move: () => value });
        const bridge = createBridge(engine, { timers: immediateTimers });
        assert.deepStrictEqual(await bridge.perform('wu', always), { ended: true });
    }
});

test('perform: 実行が停止・再実行されていたら stale', async () => {
    const { engine } = createFakeEngine();
    const bridge = createBridge(engine, { timers: immediateTimers });
    assert.deepStrictEqual(await bridge.perform('wu', () => false), { stale: true });
});

test('perform: get_ready は自分の手番になるまで待つ', async () => {
    let attempts = 0;
    const { engine } = createFakeEngine({
        getReady: () => { attempts += 1; return attempts < 3 ? false : [3, 3, 3, 3, 3, 3, 3, 3, 3]; }
    });
    const bridge = createBridge(engine, { timers: immediateTimers });
    assert.deepStrictEqual(await bridge.perform('gr', always), { ended: false, data: [3, 3, 3, 3, 3, 3, 3, 3, 3] });
    assert.strictEqual(attempts, 3);
});

test('perform: get_ready の待ち中に停止されたら、待つのをやめる', async () => {
    let checks = 0;
    const { engine } = createFakeEngine({ getReady: () => false });
    const bridge = createBridge(engine, { timers: immediateTimers });
    const result = await bridge.perform('gr', () => { checks += 1; return checks < 4; });
    assert.deepStrictEqual(result, { stale: true });
});

test('perform: CPU ステージで手番でないときの行動は停止(Blockly 版と同じ)', async () => {
    const { engine, state, calls } = createFakeEngine();
    state.myTurn = false;
    state.cpu = true;
    const bridge = createBridge(engine, { timers: immediateTimers });
    assert.deepStrictEqual(await bridge.perform('wr', always), { ended: true });
    assert.strictEqual(state.stopped, 1);
    assert.deepStrictEqual(calls, []);
});

test('perform: CPU がいないステージで手番でないときは、直前の結果を返す', async () => {
    const { engine, state } = createFakeEngine();
    const bridge = createBridge(engine, { timers: immediateTimers });
    await bridge.perform('gr', always);
    state.myTurn = false;
    assert.deepStrictEqual(await bridge.perform('wr', always), { ended: false, data: [0, 0, 0, 0, 0, 0, 0, 0, 0] });
});

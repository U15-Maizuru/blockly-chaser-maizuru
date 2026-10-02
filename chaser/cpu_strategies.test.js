const { test } = require('node:test');
const assert = require('node:assert');
const { createStrategy, PROFILE_NAMES } = require('./cpu_strategies.js');
const { scanCells } = require('./board_scan.js');

const COOL = 4;
const HOT = 5;
const SIZE_X = 17;
const SIZE_Y = 15;
const MAX_TURN = 100;

// 決まった乱数列を返す (マップ生成の再現用)
function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function makeMap(rand) {
    const map = [];
    for (let y = 0; y < SIZE_Y; y++) {
        const row = [];
        for (let x = 0; x < SIZE_X; x++) {
            const r = rand();
            row.push(r < 0.12 ? 2 : r < 0.3 ? 3 : 0);
        }
        map.push(row);
    }
    const cool = { x: 1, y: 1, score: 0 };
    const hot = { x: SIZE_X - 2, y: SIZE_Y - 2, score: 0 };
    for (const p of [cool, hot]) {
        map[p.y][p.x] = p === cool ? COOL : HOT;
    }
    return { map, cool, hot };
}

const DELTA = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

function scan(game, who, xs, ys) {
    const me = game[who];
    return scanCells(game.map, me.x, me.y, xs, ys, SIZE_X, SIZE_Y, who === 'cool' ? COOL : HOT, who === 'cool' ? HOT : COOL);
}

function lookRange(dir) {
    const near = [-1, 0, 1];
    if (dir === 'top') return [near, [-3, -2, -1]];
    if (dir === 'bottom') return [near, [1, 2, 3]];
    if (dir === 'left') return [[-3, -2, -1], near];
    return [[1, 2, 3], near];
}

// サーバと同じ規則で1手進める。決着したら勝者('cool'|'hot'|'draw')と理由を返す
function step(game, who, act) {
    const me = game[who];
    const foe = game[who === 'cool' ? 'hot' : 'cool'];
    const ownNum = who === 'cool' ? COOL : HOT;
    const [dx, dy] = DELTA[act.dir];
    if (act.type === 'move') {
        game.map[me.y][me.x] = game.map[me.y][me.x] === 45 ? (ownNum === COOL ? HOT : COOL) : 0;
        const nx = me.x + dx;
        const ny = me.y + dy;
        if (nx >= 0 && nx < SIZE_X && ny >= 0 && ny < SIZE_Y) {
            const fromX = me.x;
            const fromY = me.y;
            me.x = nx;
            me.y = ny;
            const cell = game.map[ny][nx];
            if (cell === 0) {
                game.map[ny][nx] = ownNum;
            } else if (cell === 3) {
                game.map[ny][nx] = ownNum;
                me.score += 1;
                game.map[fromY][fromX] = 2;
            } else if (cell === (ownNum === COOL ? HOT : COOL)) {
                game.map[ny][nx] = 45;
            }
        } else {
            game.map[me.y][me.x] = ownNum;
        }
    } else if (act.type === 'attack') {
        const nx = me.x + dx;
        const ny = me.y + dy;
        if (nx >= 0 && nx < SIZE_X && ny >= 0 && ny < SIZE_Y) {
            if (nx === foe.x && ny === foe.y) {
                game.map[ny][nx] = 2;
                return { winner: who, reason: 'attack' };
            }
            game.map[ny][nx] = 2;
        }
    }
    const cellNow = game.map[me.y][me.x];
    if (cellNow !== 45 && cellNow !== ownNum) {
        return { winner: who === 'cool' ? 'hot' : 'cool', reason: 'collision' };
    }
    const enclosed = (p) => [[0, -1], [0, 1], [-1, 0], [1, 0]].every(([ex, ey]) => {
        const x = p.x + ex;
        const y = p.y + ey;
        return x < 0 || x >= SIZE_X || y < 0 || y >= SIZE_Y || game.map[y][x] === 2;
    });
    if (enclosed(me)) {
        return { winner: who === 'cool' ? 'hot' : 'cool', reason: 'enclosed' };
    }
    return null;
}

function playGame(profiles, seed) {
    const rand = seeded(seed);
    const game = makeMap(rand);
    const make = (p) => (typeof p === 'string' ? createStrategy(p) : p.create());
    const bots = { cool: make(profiles[0]), hot: make(profiles[1]) };
    for (let turn = 0; turn < MAX_TURN; turn++) {
        for (const who of ['cool', 'hot']) {
            const view = scan(game, who, [-1, 0, 1], [-1, 0, 1]);
            const act = bots[who].decide(view);
            if (act.type === 'look') {
                const [xs, ys] = lookRange(act.dir);
                if (act.onResult) {
                    act.onResult(scan(game, who, xs, ys));
                }
            } else {
                const result = step(game, who, act);
                if (result) {
                    return result;
                }
            }
        }
    }
    if (game.cool.score === game.hot.score) {
        return { winner: 'draw', reason: 'score' };
    }
    return { winner: game.cool.score > game.hot.score ? 'cool' : 'hot', reason: 'score' };
}

test('設定名は p1〜p3、未知の名前は作成時にエラー', () => {
    assert.deepStrictEqual(PROFILE_NAMES, ['p1', 'p2', 'p3']);
    assert.throws(() => createStrategy('none'));
});

for (const name of ['p1', 'p2', 'p3']) {
    test(name + ': 隣接する敵には必ずアタックする', () => {
        const strategy = createStrategy(name);
        const act = strategy.decide([0, 0, 0, 0, 0, 1, 0, 0, 0]);
        assert.deepStrictEqual({ type: act.type, dir: act.dir }, { type: 'attack', dir: 'right' });
    });

    test(name + ': 斜めの敵からは壁でない方向へ逃げる', () => {
        const strategy = createStrategy(name);
        const act = strategy.decide([1, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert.strictEqual(act.type, 'move');
        assert.ok(['bottom', 'right'].includes(act.dir));
    });

    test(name + ': 見えているアイテムを取りに行く', () => {
        const strategy = createStrategy(name);
        const act = strategy.decide([0, 0, 0, 0, 0, 0, 0, 3, 0]);
        assert.deepStrictEqual({ type: act.type, dir: act.dir }, { type: 'move', dir: 'bottom' });
    });
}

test('取得ゲート: 両隣が壁で先が不明なアイテムは、先を look で確かめてから取る', () => {
    for (const name of ['p2', 'p3']) {
        const act = createStrategy(name).decide([2, 0, 2, 0, 0, 0, 2, 3, 2]);
        assert.strictEqual(act.type, 'look');
        assert.strictEqual(act.dir, 'bottom');
    }
});

test('取得ゲート: 反対側の袋小路を look した直後でも、別方向のアイテムは確かめ直す', () => {
    const strategy = createStrategy('p2');
    const view = [2, 3, 2, 2, 0, 0, 2, 3, 2];
    const first = strategy.decide(view);
    assert.deepStrictEqual({ type: first.type, dir: first.dir }, { type: 'look', dir: 'top' });
    first.onResult([2, 2, 2, 2, 2, 2, 2, 2, 2]);
    const second = strategy.decide(view);
    assert.deepStrictEqual({ type: second.type, dir: second.dir }, { type: 'look', dir: 'bottom' });
});

test('取得ゲート: 先が壁と分かっている袋小路のアイテムは見送る', () => {
    for (const name of ['p2', 'p3']) {
        const strategy = createStrategy(name);
        const dead = [2, 0, 2, 0, 0, 0, 2, 3, 2];
        const first = strategy.decide(dead);
        assert.strictEqual(first.type, 'look');
        first.onResult([2, 2, 2, 2, 2, 2, 2, 2, 2]);
        const second = strategy.decide(dead);
        assert.notDeepStrictEqual({ type: second.type, dir: second.dir }, { type: 'move', dir: 'bottom' });
    }
});

test('自己対戦: 例外なく終了し、gate 付き戦略は壁への自滅・自縛をしない', () => {
    const profiles = ['p1', 'p2', 'p3'];
    for (const a of profiles) {
        for (const b of profiles) {
            for (let seed = 1; seed <= 40; seed++) {
                const result = playGame([a, b], seed);
                assert.ok(['cool', 'hot', 'draw'].includes(result.winner));
                if (result.reason === 'collision' || result.reason === 'enclosed') {
                    const loser = result.winner === 'cool' ? b : a;
                    assert.strictEqual(loser, 'p1', a + ' vs ' + b + ' seed=' + seed + ' ' + result.reason);
                }
            }
        }
    }
});

exports.playGame = playGame;

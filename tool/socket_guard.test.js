const test = require('node:test');
const assert = require('node:assert');
const guard = require('./socket_guard.js');

test('isDirection: 4方向のみ許可する', () => {
    for (const d of ['top', 'bottom', 'left', 'right']) assert.strictEqual(guard.isDirection(d), true);
    for (const d of ['up', '', null, undefined, 1, {}, ['top']]) assert.strictEqual(guard.isDirection(d), false);
});

test('isChara: cool / hot のみ許可する', () => {
    assert.strictEqual(guard.isChara('cool'), true);
    assert.strictEqual(guard.isChara('hot'), true);
    for (const c of ['', 'Cool', null, undefined, 0, {}]) assert.strictEqual(guard.isChara(c), false);
});

test('sanitizeName: 文字列以外は fallback、制御文字除去と長さ制限', () => {
    assert.strictEqual(guard.sanitizeName(undefined, 'Python'), 'Python');
    assert.strictEqual(guard.sanitizeName({ a: 1 }, 'Python'), 'Python');
    assert.strictEqual(guard.sanitizeName('  \n\t ', 'Python'), 'Python');
    assert.strictEqual(guard.sanitizeName('ab\u0000c\n', 'x'), 'abc');
    assert.strictEqual(guard.sanitizeName('あ'.repeat(100), 'x').length, guard.MAX_NAME_LENGTH);
});

test('ownValue: 自身のプロパティだけを返す', () => {
    const store = { abc: 'room1' };
    assert.strictEqual(guard.ownValue(store, 'abc'), 'room1');
    for (const k of ['missing', 'toString', undefined, null, 1, {}]) {
        assert.strictEqual(guard.ownValue(store, k), undefined);
    }
});

test('ownsMatchRoom: room_id が文字列で key の登録先と一致するときだけ true', () => {
    const store = { k1: 'room1' };
    assert.strictEqual(guard.ownsMatchRoom(store, { room_id: 'room1', key: 'k1' }), true);
    assert.strictEqual(guard.ownsMatchRoom(store, { room_id: 'room2', key: 'k1' }), false);
    for (const m of [undefined, null, 0, 'x', {}, { key: 'k1' }, { room_id: 'room1' }, { room_id: 1, key: 'k1' },
        { room_id: 'room1', key: 'toString' }]) {
        assert.strictEqual(guard.ownsMatchRoom(store, m), false);
    }
});

test('createRateLimiter: 上限を超えると拒否し、時間経過で回復する', () => {
    let t = 0;
    const limiter = guard.createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
    assert.deepStrictEqual([1, 2, 3, 4].map(() => limiter.allow('a')), [true, true, true, false]);
    assert.strictEqual(limiter.allow('b'), true);
    t = 1000;
    assert.strictEqual(limiter.allow('a'), true);
    limiter.forget('a');
    assert.strictEqual(limiter.allow('a'), true);
});

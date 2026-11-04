const { test } = require('node:test');
const assert = require('node:assert');
const { pickCpuSpec, isValidCpuLevel, LEVELS, MIN_LEVEL, MAX_LEVEL } = require('./cpu_level_table.js');
const { PROFILE_NAMES } = require('./cpu_strategies.js');

test('段階は1〜5の5つ', () => {
  assert.strictEqual(MIN_LEVEL, 1);
  assert.strictEqual(MAX_LEVEL, 5);
  assert.deepStrictEqual(Object.keys(LEVELS).map(Number), [1, 2, 3, 4, 5]);
});

test('1段階目はランダム移動', () => {
  assert.deepStrictEqual(pickCpuSpec(1), { kind: 'random' });
});

test('2・3段階目はcpu_action()に制限を掛け、段階が上がるほど制限が緩い', () => {
  const low = pickCpuSpec(2);
  const mid = pickCpuSpec(3);
  assert.strictEqual(low.kind, 'action');
  assert.strictEqual(mid.kind, 'action');
  assert.ok(mid.params.item <= low.params.item);
  assert.ok(mid.params.holdAttack <= low.params.holdAttack);
});

test('候補が複数ある段階は、乱数に応じてそれぞれが選ばれる', () => {
  for (const level of [4, 5]) {
    const candidates = LEVELS[level];
    assert.ok(candidates.length > 1);
    candidates.forEach((candidate, index) => {
      const random = () => (index + 0.5) / candidates.length;
      assert.deepStrictEqual(pickCpuSpec(level, random), candidate);
    });
  }
});

test('4段階目は標準のcpu_action()を含み、5段階目は戦略だけ', () => {
  assert.ok(LEVELS[4].some((spec) => spec.kind === 'action' && Object.keys(spec.params).length === 0));
  assert.ok(LEVELS[5].every((spec) => spec.kind === 'strategy'));
});

test('戦略の指定は、実在する戦略の設定名を指している', () => {
  for (const candidates of Object.values(LEVELS)) {
    for (const spec of candidates) {
      if (spec.kind === 'strategy') {
        assert.ok(PROFILE_NAMES.includes(spec.profile), spec.profile);
      }
    }
  }
});

test('返したspecを書き換えても、次に返すspecや定義は変わらない', () => {
  const first = pickCpuSpec(2);
  first.params.holdAttack = 0;
  assert.strictEqual(pickCpuSpec(2).params.holdAttack, LEVELS[2][0].params.holdAttack);
  assert.strictEqual(LEVELS[2][0].params.holdAttack, 4);
});

test('範囲外・非整数・未指定のレベルはidleになる', () => {
  for (const level of [0, 6, -1, 2.5, NaN, undefined, null, {}]) {
    assert.deepStrictEqual(pickCpuSpec(level), { kind: 'idle' });
  }
});

test('旧形式のカスタム指定: 先頭の数字は段階ではなく種類を表す', () => {
  assert.deepStrictEqual(pickCpuSpec('0'), { kind: 'idle' });
  assert.deepStrictEqual(pickCpuSpec('1'), { kind: 'random' });
  assert.deepStrictEqual(pickCpuSpec('2'), { kind: 'action', params: {} });
  assert.deepStrictEqual(pickCpuSpec('2?item=10&holdAttack=3'), { kind: 'action', params: { item: 10, holdAttack: 3 } });
  assert.deepStrictEqual(pickCpuSpec('9'), { kind: 'idle' });
});

test('isValidCpuLevel: 1〜5の整数のみ有効', () => {
  for (const level of [1, 2, 3, 4, 5]) {
    assert.strictEqual(isValidCpuLevel(level), true);
  }
  for (const level of [0, 6, 14, -1, 2.5, '3', undefined, null, NaN]) {
    assert.strictEqual(isValidCpuLevel(level), false);
  }
});

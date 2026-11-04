const { test } = require('node:test');
const assert = require('node:assert');
const { filterPlayerName, FALLBACK_NAME, NAME_MAX_LENGTH } = require('./name_filter.js');

test('正常な名前はそのまま返す', () => {
  assert.strictEqual(filterPlayerName('たろう'), 'たろう');
  assert.strictEqual(filterPlayerName('Taro123'), 'Taro123');
});

test('前後の空白と制御文字は除去する', () => {
  assert.strictEqual(filterPlayerName('  たろう  '), 'たろう');
  assert.strictEqual(filterPlayerName('た\x00ろう'), 'たろう');
});

test('空文字・文字列以外は代替名にフォールバックする', () => {
  assert.strictEqual(filterPlayerName(''), FALLBACK_NAME);
  assert.strictEqual(filterPlayerName('   '), FALLBACK_NAME);
  assert.strictEqual(filterPlayerName(null), FALLBACK_NAME);
  assert.strictEqual(filterPlayerName(undefined), FALLBACK_NAME);
  assert.strictEqual(filterPlayerName(123), FALLBACK_NAME);
});

test('NGワードを含む名前は代替名にフォールバックする', () => {
  assert.strictEqual(filterPlayerName('しね'), FALLBACK_NAME);
  assert.strictEqual(filterPlayerName('あほたろう'), FALLBACK_NAME);
});

test('カタカナ表記のNGワードもひらがな正規化で検出する', () => {
  assert.strictEqual(filterPlayerName('シネ'), FALLBACK_NAME);
  assert.strictEqual(filterPlayerName('ｼﾈ'), FALLBACK_NAME); // 半角カタカナ
});

test('記号を挟んだ表記ゆれも検出する', () => {
  assert.strictEqual(filterPlayerName('し・ね'), FALLBACK_NAME);
  assert.strictEqual(filterPlayerName('し ね'), FALLBACK_NAME);
});

test('最大文字数を超える名前は切り詰める', () => {
  const longName = 'あ'.repeat(NAME_MAX_LENGTH + 10);
  const result = filterPlayerName(longName);
  assert.strictEqual(result.length, NAME_MAX_LENGTH);
});

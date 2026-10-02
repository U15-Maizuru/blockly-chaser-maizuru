const { test } = require('node:test');
const assert = require('node:assert');
const { workerCspHeader, workerCspHeaderForRequest, PYODIDE_PATH } = require('./worker_csp.js');

test('オリジンとPyodideのパスだけを許可する', () => {
  assert.strictEqual(
    workerCspHeader('http', '127.0.0.1:3000'),
    'connect-src http://127.0.0.1:3000/javascripts/vendor/pyodide/'
  );
  assert.strictEqual(
    workerCspHeader('https', 'example.onrender.com'),
    'connect-src https://example.onrender.com' + PYODIDE_PATH
  );
});

test('IPv6のホストも扱える', () => {
  assert.strictEqual(workerCspHeader('http', '[::1]:3000'), 'connect-src http://[::1]:3000' + PYODIDE_PATH);
});

test('許可するのは1つのパスだけで、同一オリジン全体は許可しない', () => {
  const value = workerCspHeader('http', 'localhost:3000');
  assert.ok(!value.includes("'self'"));
  assert.ok(value.endsWith(PYODIDE_PATH));
});

test('想定外のHostやプロトコルは従来の同一オリジンの値に戻す', () => {
  const fallback = "connect-src 'self'";
  for (const host of [undefined, '', 'a b', 'a;b', "a'b", 'a,b', 'a/b', 'a\r\nb', 'host:99999x']) {
    assert.strictEqual(workerCspHeader('http', host), fallback, JSON.stringify(host));
  }
  assert.strictEqual(workerCspHeader('ftp', 'localhost'), fallback);
  assert.strictEqual(workerCspHeader(undefined, 'localhost'), fallback);
});

function fakeRequest(headers, trustProxy, protocol) {
  return {
    protocol: protocol || 'http',
    app: { get: (name) => (name === 'trust proxy' ? trustProxy : undefined) },
    get: (name) => headers[name.toLowerCase()]
  };
}

test('プロキシ背後では、転送された公開ホスト名を使う', () => {
  const req = fakeRequest({ host: 'internal:10000', 'x-forwarded-host': 'game.example.com' }, 1, 'https');
  assert.strictEqual(workerCspHeaderForRequest(req), 'connect-src https://game.example.com' + PYODIDE_PATH);
});

test('転送ホストが複数あるときは先頭を使う', () => {
  const req = fakeRequest({ host: 'internal', 'x-forwarded-host': 'a.example.com, b.example.com' }, 1, 'https');
  assert.strictEqual(workerCspHeaderForRequest(req), 'connect-src https://a.example.com' + PYODIDE_PATH);
});

test('プロキシを信頼しない設定のときは、転送ホストを無視する', () => {
  const req = fakeRequest({ host: '127.0.0.1:3000', 'x-forwarded-host': 'evil.example.com' }, false);
  assert.strictEqual(workerCspHeaderForRequest(req), 'connect-src http://127.0.0.1:3000' + PYODIDE_PATH);
});

test('転送ホストがない場合はHostを使う', () => {
  const req = fakeRequest({ host: 'localhost:3000' }, 1);
  assert.strictEqual(workerCspHeaderForRequest(req), 'connect-src http://localhost:3000' + PYODIDE_PATH);
});

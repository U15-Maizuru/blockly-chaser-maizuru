// チュートリアル(Pythonで解く)用の変換器 (public/javascripts/python/transformer.py) のテスト。
// CPython を呼んで確認する。python が見つからない環境ではスキップする。
// ローカルの CPython と Pyodide (Python 3.12) は AST の細かい点が異なりうるため、
// 最終確認は Electron 上でも行うこと。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const PYTHON_DIR = path.join(__dirname, '..', 'public', 'javascripts', 'python');

function findPython() {
    for (const cmd of ['python', 'python3', 'py']) {
        const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
        if (!r.error && r.status === 0) return cmd;
    }
    return null;
}
const PYTHON = findPython();
const skip = PYTHON ? false : 'python が見つからないためスキップ';

const DRIVER = `
import sys, json
sys.path.insert(0, ${JSON.stringify(PYTHON_DIR)})
import transformer as t
lib = open(${JSON.stringify(path.join(PYTHON_DIR, 'lib', 'pyCHaser.tutorial.py'))}, encoding='utf-8').read()
req = json.loads(sys.stdin.read())

def respond(code):
    return req.get('response') or [0, 2, 0, 0, 4, 0, 0, 0, 0]

loaded = json.loads(t.tutorial_load(req['source'], lib, json.dumps(req['init']) if req.get('init') else None))
out = {'loaded': loaded, 'codes': [], 'end': None}
if loaded['ok']:
    t.tutorial_new_turn()
    value = None
    for _ in range(req.get('limit', 100)):
        done, v = json.loads(t.tutorial_step(value))
        if done:
            out['end'] = v
            break
        out['codes'].append(v)
        value = respond(v)
    ns = t._tutorial_state['main'].__globals__
    out['globals'] = {k: ns.get(k) for k in req.get('watch', [])}
print(json.dumps(out, ensure_ascii=False))
`;

function run(source, extra) {
    const r = spawnSync(PYTHON, ['-c', DRIVER], {
        input: JSON.stringify(Object.assign({ source }, extra || {})),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' })
    });
    assert.strictEqual(r.status, 0, r.stderr);
    // 生徒コードの print() は標準出力に出るため、最後の1行(結果のJSON)だけを読む
    const lines = r.stdout.trim().split('\n');
    return JSON.parse(lines[lines.length - 1]);
}

test('行動呼び出しが順番に命令コードになる', { skip }, () => {
    const r = run('walk(Up)\nwalk(Right)\nlook(Left)\nsearch(Down)\nput(Up)\nget_ready()\n');
    assert.deepStrictEqual(r.codes, ['wu', 'wr', 'll', 'sd', 'pu', 'gr']);
    assert.deepStrictEqual(r.end, { finished: true });
});

test('for / while の中の行動', { skip }, () => {
    const r = run('for i in range(3):\n    walk(Right)\nn = 0\nwhile n < 2:\n    walk(Down)\n    n += 1\n');
    assert.deepStrictEqual(r.codes, ['wr', 'wr', 'wr', 'wd', 'wd']);
});

test('行動を含まないプログラムも正常に終わる', { skip }, () => {
    const r = run('x = 5\ny = x + 1\n');
    assert.deepStrictEqual(r.codes, []);
    assert.deepStrictEqual(r.end, { finished: true });
});

test('空のプログラムも正常に終わる', { skip }, () => {
    const r = run('');
    assert.deepStrictEqual(r.end, { finished: true });
});

test('def の中の行動と global 変数(トップレベルの変数を関数から更新できる)', { skip }, () => {
    const src = [
        'count = 0',
        'def go(d):',
        '    global count',
        '    count += 1',
        '    return walk(d)',
        'i = 0',
        'while i < 2:',
        '    go(Down)',
        '    i += 1',
        ''
    ].join('\n');
    const r = run(src, { watch: ['count', 'i'] });
    assert.deepStrictEqual(r.codes, ['wd', 'wd']);
    assert.deepStrictEqual(r.globals, { count: 2, i: 2 });
});

test('関数の入れ子: 行動を間接的に呼ぶ関数も進められる', { skip }, () => {
    const src = 'def a():\n    walk(Up)\ndef b():\n    a()\n    a()\nb()\n';
    const r = run(src);
    assert.deepStrictEqual(r.codes, ['wu', 'wu']);
});

test('結果が map_info / look_info / search_info に自動で入る', { skip }, () => {
    const src = 'get_ready()\nlook(Left)\nsearch(Down)\n';
    const r = run(src, { response: [1, 2, 3, 4, 5, 6, 7, 8, 9], watch: ['map_info', 'look_info', 'search_info'] });
    assert.deepStrictEqual(r.globals.map_info, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepStrictEqual(r.globals.look_info, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepStrictEqual(r.globals.search_info, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('初期の map_info を渡せる。無ければ 0 が9個', { skip }, () => {
    const a = run('x = 1\n', { init: [3, 3, 3, 3, 3, 3, 3, 3, 3], watch: ['map_info'] });
    assert.deepStrictEqual(a.globals.map_info, [3, 3, 3, 3, 3, 3, 3, 3, 3]);
    const b = run('x = 1\n', { watch: ['map_info'] });
    assert.deepStrictEqual(b.globals.map_info, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('戻り値でも受け取れる', { skip }, () => {
    const r = run('r = walk(Up)\n', { response: [9, 9, 9, 9, 9, 9, 9, 9, 9], watch: ['r'] });
    assert.deepStrictEqual(r.globals.r, [9, 9, 9, 9, 9, 9, 9, 9, 9]);
});

test('生徒が walk などと同じ名前の関数を作った場合は行動として扱わない', { skip }, () => {
    const r = run('def look(x):\n    return x\nv = look(7)\nwalk(Up)\n', { watch: ['v'] });
    assert.deepStrictEqual(r.codes, ['wu']);
    assert.strictEqual(r.globals.v, 7);
});

test('実行時エラーは日本語で、行番号は生徒のコードと一致する', { skip }, () => {
    const r = run('walk(Up)\nprint(nothing)\n');
    assert.deepStrictEqual(r.codes, ['wu']);
    assert.match(r.end.error, /^2行目: nothing という名前はまだ決まっていません/);
    assert.match(r.end.error, /NameError/);
});

test('方向の指定ミスは日本語のエラーになる', { skip }, () => {
    const r = run('walk(Up)\nwalk(99)\n');
    assert.deepStrictEqual(r.codes, ['wu']);
    assert.match(r.end.error, /^2行目: walk \/ look \/ search \/ put には/);
});

test('構文エラー: 字下げ・コロン・カッコ・全角', { skip }, () => {
    assert.match(run('  walk(Up)\n').loaded.message, /^1行目: 余分な字下げ/);
    assert.match(run('for i in range(3)\n    walk(Up)\n').loaded.message, /^1行目: 行の終わりに : が必要/);
    assert.match(run('walk(Up\n').loaded.message, /^1行目: カッコが閉じられていません/);
    assert.match(run('walk(Up)\nx = 1　\n').loaded.message, /^2行目: 全角/);
});

test('yield / await / async / トップレベルの return は受け付けない', { skip }, () => {
    assert.match(run('yield 1\n').loaded.message, /yield は使えません/);
    assert.match(run('await x\n').loaded.message, /await は使えません/);
    assert.match(run('async def f():\n    pass\n').loaded.message, /async は使えません/);
    assert.match(run('return 3\n').loaded.message, /return は def/);
});

test('def の中の return は使える', { skip }, () => {
    const r = run('def f(x):\n    return x + 1\nv = f(1)\n', { watch: ['v'] });
    assert.strictEqual(r.globals.v, 2);
});

test('内包表記・lambda の中の行動は分かりやすいエラーになる', { skip }, () => {
    assert.match(run('x = [walk(d) for d in [1, 3]]\n').loaded.message, /for 文で書いてみましょう/);
    assert.match(run('f = lambda: walk(Up)\nf()\n').loaded.message, /ラムダ/);
});

test('walk を呼び出さずに値として使うとエラーになる', { skip }, () => {
    const r = run('f = walk\nf(Up)\n');
    assert.match(r.loaded.message, /^1行目: walk は walk\(\.\.\.\) のように/);
});

test('break を for/while の外で使うとエラーになる(行番号は元のまま)', { skip }, () => {
    assert.match(run('walk(Up)\nbreak\n').loaded.message, /^2行目: break や continue/);
});

test('既存モード(対戦用)の変換は変わらない', { skip }, () => {
    const src = [
        'def main(port, name, host):',
        '    player = Client(port=port, name=name, host=host)',
        '    while True:',
        '        info = player.get_ready()',
        '        player.walk(Up)',
        ''
    ].join('\n');
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(PYTHON_DIR)})
import transformer as t
print(t.transform_code_net(${JSON.stringify(src)}))
`;
    const r = spawnSync(PYTHON, ['-c', script], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /yield from player\.get_ready\(\)/);
    assert.match(r.stdout, /yield from player\.walk\(Up\)/);
});

test('ライブラリのファイルが存在する', () => {
    assert.ok(fs.existsSync(path.join(PYTHON_DIR, 'lib', 'pyCHaser.tutorial.py')));
});

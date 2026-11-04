// CPU対戦の強さは 1〜5 の5段階。段階ごとに、実際に動かすCPU (spec) の候補を持つ。
// 候補が複数ある段階は、対戦ごとに1つを選ぶ (強さは同程度で、動き方が違うものを混ぜる)。
//
// spec の種類
//   random   壁でない方向へランダムに動く
//   action   cpu_action() で動く。params でアイテム取得の間隔などに制限を掛ける (空なら標準)
//   strategy cpu_strategies.js の戦略で動く。profile で種類を指定する
//   idle     上を見続けるだけ。不正なレベルが指定されたときの安全側の動き

const IDLE = { kind: 'idle' };

const LEVELS = {
    1: [{ kind: 'random' }],
    2: [{ kind: 'action', params: { item: 12, holdAttack: 4, naname: 0 } }],
    3: [{ kind: 'action', params: { item: 10, holdAttack: 3, naname: 0 } }],
    4: [{ kind: 'action', params: {} }, { kind: 'strategy', profile: 'p1' }],
    5: [{ kind: 'strategy', profile: 'p2' }, { kind: 'strategy', profile: 'p3' }]
};

const MIN_LEVEL = 1;
const MAX_LEVEL = 5;

// プレイヤー入力 (MATCH_INIT の cpu_level) として妥当な値かどうかを判定する。
// 整数以外・範囲外はすべて不正値として扱う
function isValidCpuLevel(value) {
    return Number.isInteger(value) && value >= MIN_LEVEL && value <= MAX_LEVEL;
}

function copySpec(spec) {
    const copy = Object.assign({}, spec);
    if (spec.params) {
        copy.params = Object.assign({}, spec.params);
    }
    return copy;
}

// マップ定義に直接書ける旧形式のカスタム指定 (例: "2?item=10&holdAttack=3")。
// 先頭の数字は段階ではなく種類を表す (0=idle、1=random、2=action)。? 以降は action の params
function parseCustomLevel(text) {
    const kinds = { '0': 'idle', '1': 'random', '2': 'action' };
    const kind = kinds[text[0]] || 'idle';
    if (kind !== 'action') {
        return { kind: kind };
    }
    const params = {};
    const query = text.split('?')[1];
    if (query) {
        for (const pair of query.split('&')) {
            const parts = pair.split('=');
            params[parts[0]] = parseInt(parts[1], 10);
        }
    }
    return { kind: 'action', params: params };
}

// レベルから、動かすCPUの spec を1つ決める。候補が複数あれば random() で選ぶ。
// 返す spec は呼び出し側が書き換えてよい (params は複製する)
function pickCpuSpec(level, random) {
    if (typeof level === 'string') {
        return parseCustomLevel(level);
    }
    const candidates = LEVELS[level];
    if (!candidates) {
        return copySpec(IDLE);
    }
    const rand = random || Math.random;
    return copySpec(candidates[Math.floor(rand() * candidates.length)]);
}

module.exports = {
    pickCpuSpec: pickCpuSpec,
    isValidCpuLevel: isValidCpuLevel,
    LEVELS: LEVELS,
    MIN_LEVEL: MIN_LEVEL,
    MAX_LEVEL: MAX_LEVEL
};

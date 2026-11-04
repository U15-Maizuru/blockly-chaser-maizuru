// Socket.io イベントの入力確認とレート制限に使う共通関数。
// chaser/server.js から利用する。

const DIRECTIONS = ['top', 'bottom', 'left', 'right'];
const CHARAS = ['cool', 'hot'];
const MAX_NAME_LENGTH = 32;

// 1ソケットあたりの受付上限 (1つの window 内)
const RATE_LIMIT_COUNT = 50;
const RATE_LIMIT_WINDOW_MS = 1000;

function isDirection(value) {
    return DIRECTIONS.includes(value);
}

function isChara(value) {
    return CHARAS.includes(value);
}

// 表示名を文字列に揃え、制御文字を除いて長さを制限する。文字列でなければ fallback を返す。
function sanitizeName(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
    return cleaned === '' ? fallback : cleaned;
}

// obj が自身のプロパティとして持つ key の値を返す。key が文字列でない・存在しない場合は undefined。
function ownValue(obj, key) {
    if (typeof key !== 'string') return undefined;
    return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

// msg の key が示すマッチの room_id と、msg.room_id が一致するか。
// room_id が文字列でない場合は一致とみなさない。
function ownsMatchRoom(matchRoomStore, msg) {
    return !!msg && typeof msg.room_id === 'string' && msg.room_id === ownValue(matchRoomStore, msg.key);
}

// キーごとに、一定時間内の受付回数を数える。上限を超えたら allow() が false を返す。
function createRateLimiter(options) {
    const limit = (options && options.limit) || RATE_LIMIT_COUNT;
    const windowMs = (options && options.windowMs) || RATE_LIMIT_WINDOW_MS;
    const now = (options && options.now) || Date.now;
    const counters = new Map();

    return {
        allow(key) {
            const current = now();
            let entry = counters.get(key);
            if (!entry || current - entry.start >= windowMs) {
                entry = { start: current, count: 0 };
                counters.set(key, entry);
            }
            entry.count += 1;
            return entry.count <= limit;
        },
        forget(key) {
            counters.delete(key);
        }
    };
}

module.exports = {
    DIRECTIONS,
    CHARAS,
    MAX_NAME_LENGTH,
    isDirection,
    isChara,
    sanitizeName,
    ownValue,
    ownsMatchRoom,
    createRateLimiter
};

// プレイヤー名 (対戦・観戦画面に表示される表示名) のフィルタリング。
// 全プレイヤーに公開される値のため、クライアントから届いた生の文字列は
// 必ずこの関数を通してから server_store / usrobj に格納すること。
//
// tool/validate_room.js の sanitizeName() はルーム名向け(制御文字除去のみ)であり
// NGワード検査は行わない。名称衝突を避けるため本モジュールは filterPlayerName という
// 別名で公開する。

const ng_words = require('./ng_words.json');

// 表示名の最大文字数 (tool/validate_room.js の NAME_MAX_LENGTH と揃える)
const NAME_MAX_LENGTH = 32;

// NGワードに引っかかった場合の代替表示名
const FALLBACK_NAME = 'プレイヤー';

// 半角カタカナ -> 全角カタカナの対応表 (表記ゆれ対策の正規化に使用)
const HALFWIDTH_KATAKANA_MAP = {
    'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー', 'ｱ': 'ア',
    'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ', 'ｶ': 'カ', 'ｷ': 'キ',
    'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ', 'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス',
    'ｾ': 'セ', 'ｿ': 'ソ', 'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ',
    'ﾄ': 'ト', 'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ', 'ﾏ': 'マ',
    'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ', 'ﾔ': 'ヤ', 'ﾕ': 'ユ',
    'ﾖ': 'ヨ', 'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ﾝ': 'ン'
};

// 制御文字 (改行・タブ含む) を除去する
function stripControlChars(value) {
    return value.replace(/[\x00-\x1F\x7F]/g, '');
}

// NGワード検査・比較用に正規化する。表示名そのものの変形ではなく判定専用
function normalizeForMatch(value) {
    return value
        // 全角英数記号 -> 半角
        .replace(/[！-～]/g, function (ch) {
            return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
        })
        // 半角カタカナ -> 全角カタカナ
        .replace(/[ｦ-ﾝ]/g, function (ch) {
            return HALFWIDTH_KATAKANA_MAP[ch] || ch;
        })
        // カタカナ -> ひらがな
        .replace(/[ァ-ヶ]/g, function (ch) {
            return String.fromCharCode(ch.charCodeAt(0) - 0x60);
        })
        // 記号・空白・区切り文字を除去 (表記ゆれによる検出回避を防ぐ)
        .replace(/[\s　_\-.!?！？・･〜~,、。]/g, '')
        .toLowerCase();
}

// NGワードのいずれかを部分一致で含むかを判定する
function containsNgWord(normalized) {
    for (let i = 0; i < ng_words.length; i++) {
        if (normalized.indexOf(ng_words[i]) !== -1) {
            return true;
        }
    }
    return false;
}

// クライアントから届いたプレイヤー名を検証し、表示に使ってよい文字列を返す。
// 文字列以外・空文字・NGワード該当時は FALLBACK_NAME を返す。
function filterPlayerName(name) {
    if (typeof name !== 'string') {
        return FALLBACK_NAME;
    }

    const stripped = stripControlChars(name).trim();
    if (stripped.length < 1) {
        return FALLBACK_NAME;
    }

    if (containsNgWord(normalizeForMatch(stripped))) {
        return FALLBACK_NAME;
    }

    return stripped.length > NAME_MAX_LENGTH ? stripped.slice(0, NAME_MAX_LENGTH) : stripped;
}

module.exports = {
    filterPlayerName: filterPlayerName,
    FALLBACK_NAME: FALLBACK_NAME,
    NAME_MAX_LENGTH: NAME_MAX_LENGTH
};

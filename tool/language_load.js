var fs = require('fs');
var path = require('path');

// language/ja/<fileName> と language/ja-k/<fileName> をまとめて読み込む
// ja-k 側が存在しない/壊れている場合は ja にフォールバックする
function loadLangJson(fileName) {
    var ja = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'language', 'ja', fileName), 'utf-8'));
    var jak;
    try {
        jak = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'language', 'ja-k', fileName), 'utf-8'));
    }
    catch (e) {
        jak = ja;
    }
    return { ja: ja, 'ja-k': jak };
}

// req.cookies.lng が 'ja-k' のときだけ ja-k 版を返し、それ以外（未指定・'ja'・不正値）は ja 版を返す
function pickByCookie(req, variants) {
    var lng = req.cookies && req.cookies.lng;
    return (lng === 'ja-k') ? variants['ja-k'] : variants.ja;
}

module.exports = { loadLangJson: loadLangJson, pickByCookie: pickByCookie };

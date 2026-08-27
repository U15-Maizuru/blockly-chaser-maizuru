var express = require('express');
var router = express.Router();
var languageLoad = require('../tool/language_load.js');

var CONFIG_LNG = languageLoad.loadLangJson('config.json');

/* GET Pythonオフライン練習ページ (モード③)。room_id等のクエリ不要、サーバー接続なし。 */
router.get('/', function (req, res, next) {
    res.render('python-programming', { C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG) });
});

module.exports = router;

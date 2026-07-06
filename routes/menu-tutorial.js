var express = require('express');
var router = express.Router();
var languageLoad = require('../tool/language_load.js');

var LNG = languageLoad.loadLangJson('menu-tutorial.json');
var CONFIG_LNG = languageLoad.loadLangJson('config.json');
var TITLE = { ja: 'ステージ選択', 'ja-k': 'ステージせんたく' };

/* GET home page. */
router.get('/', function (req, res, next) {
    try {
        res.render('menu-tutorial', {
            title: languageLoad.pickByCookie(req, TITLE),
            LNG: languageLoad.pickByCookie(req, LNG),
            C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG)
        });
    }
    catch (e) {
        res.render('menu-tutorial', { title: TITLE.ja, LNG: LNG.ja, C_LNG: CONFIG_LNG.ja });
    }
});

module.exports = router;

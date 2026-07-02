var express = require('express');
var router = express.Router();
var languageLoad = require('../tool/language_load.js');

var LNG = languageLoad.loadLangJson('menu-programming.json');
var CONFIG_LNG = languageLoad.loadLangJson('config.json');
var TITLE = { ja: 'データ選択', 'ja-k': 'データせんたく' };

/* GET home page. */
router.get('/', function (req, res, next) {
    try {
        res.render('menu-programming-exp', {
            title: languageLoad.pickByCookie(req, TITLE),
            LNG: languageLoad.pickByCookie(req, LNG),
            C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG)
        });
    }
    catch (e) {
        res.render('menu-programming-exp', { title: TITLE.ja, LNG: LNG.ja, C_LNG: CONFIG_LNG.ja });
    }
});

module.exports = router;

var express = require('express');
var router = express.Router();
var languageLoad = require('../tool/language_load.js');

var LNG = languageLoad.loadLangJson('index.json');
var CONFIG_LNG = languageLoad.loadLangJson('config.json');

/* GET home page. */
router.get('/', function (req, res, next) {
    try {
        res.render('index', {
            title: 'メニュー',
            LNG: languageLoad.pickByCookie(req, LNG),
            C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG)
        });
    }
    catch (e) {
        res.render('index', { title: 'メニュー', LNG: LNG.ja, C_LNG: CONFIG_LNG.ja });
    }
});

module.exports = router;

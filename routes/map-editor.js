var express = require('express');
var router = express.Router();
var languageLoad = require('../tool/language_load.js');

var CONFIG_LNG = languageLoad.loadLangJson('config.json');

router.get('/', function (req, res, next) {
    try {
        res.render('map-editor', { title: 'マップエディタ', C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG) });
    } catch (e) {
        res.render('map-editor', { title: 'マップエディタ', C_LNG: CONFIG_LNG.ja });
    }
});

module.exports = router;

var express = require('express');
var router = express.Router();

var fs = require('fs');
var path = require('path');
var languageLoad = require('../tool/language_load.js');

var CONFIG_LNG = languageLoad.loadLangJson('config.json');

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('watching', { C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG) });
});


module.exports = router;
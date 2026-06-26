var express = require('express');
var router = express.Router();

var fs = require('fs');
var path = require('path');

var CONFIG_LNG_JA  = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'language', 'ja',   'config.json'), 'utf-8'));
var CONFIG_LNG_JAK = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'language', 'ja-k', 'config.json'), 'utf-8'));

router.get('/', function (req, res, next) {
    try {
        var C_LNG = (req.cookies.lng === 'ja-k') ? CONFIG_LNG_JAK : CONFIG_LNG_JA;
        res.render('map-editor', { title: 'マップエディタ', C_LNG });
    } catch (e) {
        res.render('map-editor', { title: 'マップエディタ', C_LNG: CONFIG_LNG_JA });
    }
});

module.exports = router;

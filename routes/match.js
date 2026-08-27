var express = require('express');
var router = express.Router();
var languageLoad = require('../tool/language_load.js');

var CONFIG_LNG = languageLoad.loadLangJson('config.json');

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('match', { C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG) });
});


router.get('/player', async function(req, res, next) {
    if (req.query.room_id) {
        try {
            // cpu_charaが明示的に渡された場合のみCPUモード（VS対戦では付与されない）
            var cpuChara = req.query.cpu_chara || null;
            if (cpuChara && cpuChara === req.query.chara) {
                res.render('match-cpu');
            }
            else if (req.query.lang === 'python') {
                res.render('match-player-python');
            }
            else {
                res.render('match-player');
            }
        }
        catch (e) {
            console.log(e);
        }
    }
    else {
        res.render('match-player');
    }
});

module.exports = router;
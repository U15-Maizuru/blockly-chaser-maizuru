var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('match');
});


router.get('/player', async function(req, res, next) {
    if (req.query.room_id) {
        try {
            // cpu_charaが明示的に渡された場合のみCPUモード（VS対戦では付与されない）
            var cpuChara = req.query.cpu_chara || null;
            if (cpuChara && cpuChara === req.query.chara) {
                res.render('match-cpu');
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
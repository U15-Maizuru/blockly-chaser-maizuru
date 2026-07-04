var express = require('express');
var languageLoad = require('../tool/language_load.js');

var LNG = languageLoad.loadLangJson('menu-programming.json');
var CONFIG_LNG = languageLoad.loadLangJson('config.json');
var TITLE = { ja: 'データ選択', 'ja-k': 'データせんたく' };

// menu-programming-exp.js からも再利用する（views/menu-programming.ejs 1つを variant で描き分ける）
function createMenuProgrammingRouter(variant) {
    var router = express.Router();
    router.get('/', function (req, res, next) {
        try {
            res.render('menu-programming', Object.assign({
                title: languageLoad.pickByCookie(req, TITLE),
                LNG: languageLoad.pickByCookie(req, LNG),
                C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG)
            }, variant));
        }
        catch (e) {
            res.render('menu-programming', Object.assign({ title: TITLE.ja, LNG: LNG.ja, C_LNG: CONFIG_LNG.ja }, variant));
        }
    });
    return router;
}

module.exports = createMenuProgrammingRouter({
    htmlTitle: 'CHaser Programming Menu',
    programmingPath: '/programming',
});
module.exports.createMenuProgrammingRouter = createMenuProgrammingRouter;

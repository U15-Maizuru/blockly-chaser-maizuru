var express = require('express');
const logger = require('../bin/logger.js');

var languageLoad = require('../tool/language_load.js');

var LNG = languageLoad.loadLangJson('programming.json');

// programming-exp.js からも再利用する（views/programming.ejs 1つを variant で描き分ける）
function createProgrammingRouter(variant) {
  var router = express.Router();
  router.get('/', function (req, res, next) {
    var locals = Object.assign({
      "title": 'プログラミング',
      "LNG": languageLoad.pickByCookie(req, LNG)
    }, variant);
    res.render('programming', locals);
  });
  return router;
}

module.exports = createProgrammingRouter({
  htmlTitle: 'CHaser Programming',
  menuPath: '/menu-programming',
  levelLabel: '【初級】',
  toolboxPartial: 'toolboxes/toolbox_categories',
  expMode: false,
});
module.exports.createProgrammingRouter = createProgrammingRouter;

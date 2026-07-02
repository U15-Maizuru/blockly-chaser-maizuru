var express = require('express');
const logger = require('../bin/logger.js');

var languageLoad = require('../tool/language_load.js');

var LNG = languageLoad.loadLangJson('programming.json');

// programming-exp.js からも再利用する（画面名以外は完全に同一処理のため）
function createProgrammingRouter(viewName) {
  var router = express.Router();
  router.get('/', function (req, res, next) {
    res.render(viewName, { "title": 'プログラミング', "LNG": languageLoad.pickByCookie(req, LNG) });
  });
  return router;
}

module.exports = createProgrammingRouter('programming');
module.exports.createProgrammingRouter = createProgrammingRouter;

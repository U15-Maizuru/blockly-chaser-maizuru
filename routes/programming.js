var express = require('express');
const logger = require('../bin/logger.js');

var fs = require('fs');
var path = require('path');

// programming-exp.js からも再利用する（画面名以外は完全に同一処理のため）
function createProgrammingRouter(viewName) {
  var router = express.Router();
  router.get('/', function (req, res, next) {
    try {
      var lg = req.cookies.lng;
      var LNG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', "language", lg, "programming.json"), "utf-8"));
    }
    catch (e) {
      var LNG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', "language", "ja", "programming.json"), "utf-8"));
    }
    res.render(viewName, { "title": 'プログラミング', "LNG": LNG });
  });
  return router;
}

module.exports = createProgrammingRouter('programming');
module.exports.createProgrammingRouter = createProgrammingRouter;

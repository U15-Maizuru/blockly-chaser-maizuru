var express = require('express');
var router = express.Router();

var tutorial_data = require('../tool/tutorial_data_load');
var deep_clone = require('../tool/deep_clone');
var languageLoad = require('../tool/language_load.js');

const stage_data = deep_clone.deepClone(tutorial_data.load());
var CONFIG_LNG = languageLoad.loadLangJson('config.json');

// <script> の中へ JSON を埋め込むときに、タグとして解釈されないよう < をエスケープする
function toScriptJson(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

/* GET チュートリアル (Pythonで解く)。ステージのデータは Blockly 版と共通 */
router.get('/', function (req, res, next) {
    var stage = req.query.stage;

    // stage_data に存在するステージ ID だけを受け付ける
    if (typeof stage !== 'string' || !Object.prototype.hasOwnProperty.call(stage_data, stage)) {
        res.status(400).send('不正なアクセス');
        return;
    }

    res.render('tutorial-python', {
        title: stage_data[stage].name,
        stagedata: stage_data[stage],
        stage_json: toScriptJson(stage_data[stage]),
        C_LNG: languageLoad.pickByCookie(req, CONFIG_LNG)
    });
});

module.exports = router;

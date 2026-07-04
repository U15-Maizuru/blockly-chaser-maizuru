const fs = require('fs');
const path = require('path');
const logger = require('../bin/logger.js');

// dirPath 内の各ファイルを読み込み、parseFn(rawText) の戻り値を keyFn(parsed, fileName) のキーで
// オブジェクトにまとめて返す。parseFn が例外を投げた場合や keyFn が falsy を返した場合はスキップしてログを出す
function loadDirAsMap(dirPath, parseFn, keyFn, errorLabel) {
    const fileNames = fs.readdirSync(dirPath);
    const result = {};
    for (const fileName of fileNames) {
        try {
            const raw = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
            const parsed = parseFn(raw);
            const key = keyFn(parsed, fileName);
            if (key) {
                result[key] = parsed;
            }
            else {
                logger.error('The format of the ' + errorLabel + ' is incorrect. Data to be loaded "' + fileName + '"');
            }
        }
        catch (e) {
            logger.error('Failed to read the ' + errorLabel + '. Data to be loaded "' + fileName + '"');
        }
    }
    return result;
}

module.exports = { loadDirAsMap: loadDirAsMap };

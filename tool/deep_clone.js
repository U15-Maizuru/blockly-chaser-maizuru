// tool/*_load.js のキャッシュを直接返すと呼び出し元の変更でキャッシュ自体が壊れるため、
// ロード済みデータを渡すたびに深いコピーを取るための共通ヘルパー
function deepClone(data) {
    return JSON.parse(JSON.stringify(data));
}

module.exports = { deepClone: deepClone };

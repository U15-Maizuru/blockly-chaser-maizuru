// Python実行用Workerの通信先を、Pyodideの配置先だけに限定するCSPヘッダの値を作る。
// パスで絞るには 'self' が使えず、オリジンまで書く必要があるため、リクエストごとに組み立てる。
// Host が想定外の文字を含む場合は、従来どおり同一オリジン全体を許可する値に戻す。

const PYODIDE_PATH = '/javascripts/vendor/pyodide/';
const SAFE_HOST = /^[A-Za-z0-9.\-]+(:[0-9]{1,5})?$|^\[[0-9A-Fa-f:.]+\](:[0-9]{1,5})?$/;

function workerCspHeader(protocol, host) {
    if ((protocol !== 'http' && protocol !== 'https') || typeof host !== 'string' || !SAFE_HOST.test(host)) {
        return "connect-src 'self'";
    }
    return 'connect-src ' + protocol + '://' + host + PYODIDE_PATH;
}

// リクエストからヘッダの値を作る。プロキシ背後では、転送された公開ホスト名を優先する
function workerCspHeaderForRequest(req) {
    const forwarded = req.app.get('trust proxy') && req.get('x-forwarded-host');
    const host = forwarded ? forwarded.split(',')[0].trim() : req.get('host');
    return workerCspHeader(req.protocol, host);
}

exports.workerCspHeader = workerCspHeader;
exports.workerCspHeaderForRequest = workerCspHeaderForRequest;
exports.PYODIDE_PATH = PYODIDE_PATH;

// local-runner.js(モード③)とnet-runner.js(モード①)で共通のPyodideブートストラップ/定数。
// map_format.js と同じUMD形式。
(function (root) {

    var DEFAULT_PLAYER_CODE = 'import argparse\n' +
        'from lib.pyCHaser import * # lib/pyCHaser.py\n\n' +
        'player = None\n' +
        'map_info = []\n\n' +
        'def main(port, name, host):\n' +
        '    global player, map_info\n\n' +
        '    # サーバーと接続\n' +
        '    player = Client(port=port, name=name, host=host)\n\n' +
        '    while True:\n' +
        '        # 準備完了 & 周辺探査\n' +
        '        map_info = player.get_ready()\n' +
        '        # ブロックがなければ上へ、あれば右へ\n' +
        '        if map_info[Up] != Block:\n' +
        '            player.walk(Up)\n' +
        '        else:\n' +
        '            player.walk(Right)\n\n' +
        'if __name__ == "__main__":\n' +
        '    parser = argparse.ArgumentParser()\n' +
        '    parser.add_argument("-p", "--port", default=2009)\n' +
        '    parser.add_argument("-n", "--name", default="player")\n' +
        '    parser.add_argument("-i", "--host", default="localhost")\n' +
        '    args = parser.parse_args()\n' +
        '    main(port=args.port, name=args.name, host=args.host)\n';

    function fetchText(url) {
        return fetch(url).then(function (res) {
            if (!res.ok) throw new Error('failed to fetch ' + url + ': ' + res.status);
            return res.text();
        });
    }

    // pyodide.stdout/stderrをwriteToConsole(グローバル関数)へ中継するよう設定する。
    // 呼び出し側は事前に root.writeToConsole を設定しておくこと。
    function installConsoleBridge(pyodide) {
        pyodide.runPython(
            'import sys\n' +
            'class ConsoleOutput:\n' +
            "    def __init__(self):\n" +
            "        self.buffer = ''\n" +
            '    def write(self, s):\n' +
            "        if s != '\\n':\n" +
            '            self.buffer += s\n' +
            '        else:\n' +
            '            from js import writeToConsole\n' +
            '            writeToConsole(self.buffer)\n' +
            "            self.buffer = ''\n" +
            '    def flush(self):\n' +
            '        pass\n' +
            'sys.stdout = sys.stderr = ConsoleOutput()\n\n' +
            'def custom_excepthook(exctype, value, tb):\n' +
            '    import traceback\n' +
            '    from js import writeToConsole\n' +
            "    tb_text = ''.join(traceback.format_exception(exctype, value, tb))\n" +
            '    writeToConsole(tb_text)\n' +
            'sys.excepthook = custom_excepthook\n'
        );
    }

    var RUNNER_SHARED = {
        DEFAULT_PLAYER_CODE: DEFAULT_PLAYER_CODE,
        fetchText: fetchText,
        installConsoleBridge: installConsoleBridge
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RUNNER_SHARED;
    } else {
        root.RUNNER_SHARED = RUNNER_SHARED;
    }
})(typeof window !== 'undefined' ? window : this);

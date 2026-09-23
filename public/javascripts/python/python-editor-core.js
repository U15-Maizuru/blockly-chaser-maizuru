// CodeMirrorエディタの初期化・タブ切替・アップロード/ダウンロードなど、
// モード①③で共通利用するUIグルー。Python-CHaser-Webのエディタ部分を移植。
// マップタブの有無はページ(views/*.ejs)側がDOM要素を用意するかどうかで決まる
// (モード①はプレイヤータブのみ、モード③はプレイヤー/対戦AI/マップの3タブ)。
(function (root) {

    function initPythonEditor(options) {
        options = options || {};
        var hasOpponentTab = !!options.hasOpponentTab;
        var hasMapTab = !!options.hasMapTab;

        var codeMirrorOptions = {
            mode: 'python',
            lineNumbers: true,
            indentUnit: 4,
            theme: 'monokai',
            autoCloseBrackets: true,
            matchBrackets: true,
            tabSize: 4,
            indentWithTabs: false,
            extraKeys: {
                Tab: function (cm) {
                    var spaces = Array(cm.getOption('indentUnit') + 1).join(' ');
                    cm.replaceSelection(spaces);
                }
            }
        };

        var playerEditor = CodeMirror.fromTextArea(document.getElementById('editor'), codeMirrorOptions);
        var opponentEditor = hasOpponentTab
            ? CodeMirror.fromTextArea(document.getElementById('editor-opponent-textarea'), codeMirrorOptions)
            : null;

        function replaceTabsWithSpaces(str) {
            return str.replace(/\t/g, '    ');
        }

        if (options.defaultPlayerCode) {
            playerEditor.setValue(replaceTabsWithSpaces(options.defaultPlayerCode));
        }
        if (opponentEditor && options.defaultOpponentCode) {
            opponentEditor.setValue(replaceTabsWithSpaces(options.defaultOpponentCode));
        }

        var EDITOR_TAB_LABELS = { player: 'プレイヤー', opponent: '対戦AI', map: 'マップ' };
        var EDITORS_BY_KEY = { player: playerEditor };
        if (opponentEditor) EDITORS_BY_KEY.opponent = opponentEditor;
        if (hasMapTab && options.mapEditorAdapter) EDITORS_BY_KEY.map = options.mapEditorAdapter;

        var activeEditorKey = 'player';
        function getActiveEditor() {
            return EDITORS_BY_KEY[activeEditorKey];
        }
        function switchEditorTab(key) {
            if (!EDITORS_BY_KEY[key]) return;
            activeEditorKey = key;
            Object.keys(EDITORS_BY_KEY).forEach(function (k) {
                var pane = document.getElementById('editor-' + k);
                if (pane) pane.classList.toggle('hidden', k !== key);
                var tab = document.getElementById('tab-' + k);
                if (tab) tab.classList.toggle('active', k === key);
            });
            var label = document.getElementById('active-editor-label');
            if (label) label.textContent = '編集中: ' + EDITOR_TAB_LABELS[key];
            var fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.setAttribute('accept', key === 'map' ? '.json' : '.py');
            getActiveEditor().refresh();
        }
        Object.keys(EDITORS_BY_KEY).forEach(function (key) {
            var tab = document.getElementById('tab-' + key);
            if (tab) tab.addEventListener('click', function () { switchEditorTab(key); });
        });

        // 全角スペース・不可視スペースの可視化オーバーレイ
        var fullWidthSpaceOverlay = {
            token: function (stream) {
                if (stream.peek() === '　') {
                    stream.next();
                    return 'full-width-space';
                }
                while (!stream.eol() && stream.peek() !== '　') {
                    stream.next();
                }
                return null;
            }
        };
        var invisiblesOverlay = {
            token: function (stream) {
                if (stream.peek() === ' ') {
                    stream.next();
                    return 'whitespace-space';
                }
                stream.next();
                return null;
            }
        };
        function renderLineIndentGuides(cm, line, element) {
            var text = line.text;
            var indentUnit = cm.getOption('indentUnit');
            var spaces = 0;
            for (var i = 0; i < text.length; i++) {
                if (text[i] === ' ') spaces++;
                else break;
            }
            var indentLevel = Math.floor(spaces / indentUnit);
            if (indentLevel > 0) element.classList.add('indent-level-' + indentLevel);
        }
        [playerEditor, opponentEditor].forEach(function (cm) {
            if (!cm) return;
            cm.addOverlay(fullWidthSpaceOverlay);
            cm.addOverlay(invisiblesOverlay);
            cm.on('renderLine', renderLineIndentGuides);
            cm.refresh();
        });

        // コンソール出力
        var consoleOutput = document.getElementById('console-output');
        function writeToConsole(msg) {
            if (!consoleOutput) return;
            consoleOutput.textContent += msg + '\n';
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
        function clearConsole() {
            if (consoleOutput) consoleOutput.textContent = '';
        }

        // ダウンロード/アップロード
        var DEFAULT_DOWNLOAD_NAME = { player: 'my_program', opponent: 'my_opponent', map: 'my_map' };
        var DOWNLOAD_EXTENSION = { player: '.py', opponent: '.py', map: '.json' };
        // Electron では window.prompt() が使えないため、ページ内ダイアログでファイル名を入力する。
        // キャンセル時は callback(null) を返す。
        function askFileName(message, defaultValue, callback) {
            function createElement(tag, css, text) {
                var e = document.createElement(tag);
                e.style.cssText = css;
                if (text) e.textContent = text;
                return e;
            }
            var buttonCss = 'padding:6px 16px;font-size:15px;font-weight:bold;border-radius:5px;cursor:pointer;';

            var overlay = createElement('div', 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.4);' +
                'display:flex;align-items:center;justify-content:center;');
            var box = createElement('div', 'background:#fff;color:#222;border-radius:12px;padding:16px;' +
                'width:80%;max-width:360px;box-shadow:2px 2px 8px rgba(0,0,0,0.4);font-size:15px;');
            var label = createElement('div', 'font-weight:bold;margin-bottom:8px;', message);
            var input = createElement('input', 'width:100%;box-sizing:border-box;padding:6px;font-size:15px;' +
                'border:1px solid #c0c0c0;border-radius:5px;');
            input.type = 'text';
            input.maxLength = 25;
            input.value = defaultValue || '';
            var buttons = createElement('div', 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px;');
            var cancelBtn = createElement('button', buttonCss + 'background:#eee;color:#222;border:1px solid #bbb;', 'キャンセル');
            var okBtn = createElement('button', buttonCss + 'background:#2b7de9;color:#fff;border:1px solid #2b7de9;', 'OK');
            cancelBtn.type = okBtn.type = 'button';

            function close(result) {
                overlay.remove();
                callback(result);
            }
            okBtn.addEventListener('click', function () { close(input.value); });
            cancelBtn.addEventListener('click', function () { close(null); });
            input.addEventListener('keydown', function (e) {
                // IME 変換確定の Enter では決定しない
                if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); close(input.value); }
                else if (e.key === 'Escape') { e.preventDefault(); close(null); }
            });

            buttons.append(cancelBtn, okBtn);
            box.append(label, input, buttons);
            overlay.append(box);
            document.body.append(overlay);
            input.focus();
            input.select();
        }

        var downloadBtn = document.getElementById('download-button');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function () {
                var code = getActiveEditor().getValue();
                var extension = DOWNLOAD_EXTENSION[activeEditorKey];
                var defaultName = DEFAULT_DOWNLOAD_NAME[activeEditorKey];
                askFileName('ファイル名を入力してください（拡張子は不要です）', defaultName, function (filename) {
                    if (filename === null) return;
                    filename = filename.trim();
                    if (filename === '') { alert('ファイル名が空です。'); return; }
                    var blob = new Blob([code], { type: 'text/plain' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = filename + extension;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            });
        }

        var uploadBtn = document.getElementById('upload-button');
        var fileInput = document.getElementById('file-input');
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', function () { fileInput.click(); });
            fileInput.addEventListener('change', function (event) {
                var file = event.target.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function (e) {
                    getActiveEditor().setValue(replaceTabsWithSpaces(e.target.result));
                };
                reader.readAsText(file);
                event.target.value = '';
            });
        }

        return {
            playerEditor: playerEditor,
            opponentEditor: opponentEditor,
            getActiveEditor: getActiveEditor,
            switchEditorTab: switchEditorTab,
            writeToConsole: writeToConsole,
            clearConsole: clearConsole
        };
    }

    var PYTHON_EDITOR_CORE = { initPythonEditor: initPythonEditor };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PYTHON_EDITOR_CORE;
    } else {
        root.PYTHON_EDITOR_CORE = PYTHON_EDITOR_CORE;
    }
})(typeof window !== 'undefined' ? window : this);

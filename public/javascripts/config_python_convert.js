// 設定画面の「プログラミング」タブから、保存済みのBlocklyプログラムファイル
// （.blch/.json/.xml）を選択またはドロップして、その場でPythonコードに変換・
// ダウンロードする機能。config.ejsは全画面共通で読み込まれるが、Blockly本体や
// Python生成器はprogramming.ejs/tutorial.ejsでしか読み込まれていないため、
// 未読み込みの場合はここで必要なスクリプトを遅延読み込みする。
var PYTHON_CONVERT_DEPS = [
    { test: function () { return typeof Blockly !== 'undefined'; }, src: '/javascripts/blockly/blockly_compressed.js' },
    { test: function () { return !!(Blockly.Blocks && Blockly.Blocks['controls_if']); }, src: '/javascripts/blockly/blocks_compressed.js' },
    { test: function () { return !!(Blockly.Blocks && Blockly.Blocks['wait']); }, src: '/javascripts/blocks/chaser_block.js' },
    { test: function () { return typeof python !== 'undefined' && !!python.pythonGenerator; }, src: '/javascripts/blockly/generators/python_compressed.js' },
    { test: function () { return typeof Kuroshiro !== 'undefined'; }, src: '/javascripts/vendor/kuroshiro/kuroshiro.min.js' },
    { test: function () { return typeof KuromojiAnalyzer !== 'undefined'; }, src: '/javascripts/vendor/kuroshiro/kuroshiro-analyzer-kuromoji.min.js' },
    { test: function () { return typeof ChaserTransliterator !== 'undefined'; }, src: '/javascripts/generators/name_transliterator.js' },
    { test: function () { return !!(python.pythonGenerator.forBlock && python.pythonGenerator.forBlock['wait']); }, src: '/javascripts/generators/python_chaser.js' },
    { test: function () { return typeof fflate !== 'undefined'; }, src: '/javascripts/fflate.js' }
];

var pythonConvertDepsPromise = null;

function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error('スクリプトの読み込みに失敗しました: ' + src)); };
        document.head.appendChild(s);
    });
}

function ensurePythonConvertDeps() {
    if (!pythonConvertDepsPromise) {
        pythonConvertDepsPromise = PYTHON_CONVERT_DEPS.reduce(function (promise, dep) {
            return promise.then(function () {
                if (dep.test()) return;
                return loadScriptOnce(dep.src);
            });
        }, Promise.resolve());
    }
    return pythonConvertDepsPromise;
}

function parseWorkspaceFromFile(file) {
    return new Promise(function (resolve, reject) {
        var fileName = file.name.toLowerCase();
        var reader = new FileReader();
        var workspace = new Blockly.Workspace();

        function fail(message, err) {
            workspace.dispose();
            if (err) console.error(err);
            reject(new Error(message));
        }

        reader.onerror = function () { fail('ファイルの読み込みに失敗しました'); };

        if (fileName.endsWith('.xml')) {
            reader.onload = function (e) {
                try {
                    var xmlDom = Blockly.utils.xml.textToDom(e.target.result.toString());
                    Blockly.Xml.domToWorkspace(xmlDom, workspace);
                    resolve(workspace);
                } catch (err) {
                    fail('XMLファイルの読み込みに失敗しました', err);
                }
            };
            reader.readAsText(file);
        } else if (fileName.endsWith('.json')) {
            reader.onload = function (e) {
                try {
                    var workspaceData = JSON.parse(e.target.result.toString());
                    Blockly.serialization.workspaces.load(workspaceData, workspace);
                    resolve(workspace);
                } catch (err) {
                    fail('JSONファイルの読み込みまたは解析に失敗しました', err);
                }
            };
            reader.readAsText(file);
        } else if (fileName.endsWith('.blch') || fileName.endsWith('.zip')) {
            reader.onload = function (e) {
                try {
                    var uint8 = new Uint8Array(e.target.result);
                    var unzipped = fflate.unzipSync(uint8);
                    if (!unzipped['program.json']) {
                        fail('program.json が ZIP 内に見つかりませんでした');
                        return;
                    }
                    var jsonText = new TextDecoder('utf-8').decode(unzipped['program.json']);
                    var workspaceData = JSON.parse(jsonText);
                    Blockly.serialization.workspaces.load(workspaceData, workspace);
                    resolve(workspace);
                } catch (err) {
                    fail('ZIPファイルの展開または読み込みに失敗しました', err);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            fail('対応していないファイル形式です（.blch / .json / .xml のいずれかを選択してください）');
        }
    });
}

function downloadPythonFile(pythonText, baseName) {
    var blob = new Blob([pythonText], { type: 'application/octet-stream' });
    var fileName = baseName + '.py';

    if (window.navigator.msSaveBlob) {
        window.navigator.msSaveBlob(blob, fileName);
    } else {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
    }
}

function pythonConvertBaseName(originalName) {
    return originalName.replace(/\.[^./\\]+$/, '') || originalName;
}

function setPythonConvertStatus(message, kind) {
    var el = document.getElementById('python_convert_status');
    if (!el) return;
    el.textContent = message;
    el.className = 'python_convert_status python_convert_status--' + (kind || 'info');
}

async function convertFileToPython(file) {
    setPythonConvertStatus('変換の準備をしています…', 'info');
    var workspace = null;

    try {
        await ensurePythonConvertDeps();
        workspace = await parseWorkspaceFromFile(file);

        var blocks = workspace.getAllBlocks(false);
        if (blocks.length === 0) {
            throw new Error('ブロックが1つもありません。');
        }

        var missingBlockTypes = [];
        blocks.forEach(function (b) {
            if (!python.pythonGenerator.forBlock[b.type] && missingBlockTypes.indexOf(b.type) === -1) {
                missingBlockTypes.push(b.type);
            }
        });
        if (missingBlockTypes.length > 0) {
            throw new Error('Python未対応のブロックが含まれています: ' + missingBlockTypes.join(', '));
        }

        await ChaserTransliterator.warmCache(workspace);
        var pythonCode = python.pythonGenerator.workspaceToCode(workspace);
        if (!pythonCode || !pythonCode.trim()) {
            throw new Error('実行可能なプログラムが見つかりません。ブロックが正しくつながっているか確認してください。');
        }

        downloadPythonFile(pythonCode, pythonConvertBaseName(file.name));
        setPythonConvertStatus('Pythonファイルをダウンロードしました', 'success');
    } catch (err) {
        console.error(err);
        setPythonConvertStatus((err && err.message) || '変換に失敗しました', 'error');
    } finally {
        if (workspace) workspace.dispose();
    }
}

window.addEventListener('load', function () {
    var dropzone = document.getElementById('python_convert_dropzone');
    var fileInput = document.getElementById('python_convert_file_input');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', function () {
        fileInput.click();
    });
    bindKeyboardActivate(dropzone);

    fileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        fileInput.value = '';
        if (file) convertFileToPython(file);
    });

    ['dragenter', 'dragover'].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'dragend'].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
            e.preventDefault();
            dropzone.classList.remove('is-dragover');
        });
    });

    dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragover');
        var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) convertFileToPython(file);
    });
});

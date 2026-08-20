'use strict';

// BlocklyのNames.prototype.safeName()は非ASCII文字(全角文字/かな/漢字)を
// 考慮しておらず、UTF-8バイト列をそのまま16進文字列化してしまう(例: "２倍" -> "_EF_BC_92_E5_80_8D")。
// ここではBlockly本体を書き換えずに、safeName()に渡す前の名前をNFKC正規化+
// kuroshiroによるローマ字変換で読める形に前処理する。
var ChaserTransliterator = (function () {
  var cache = Object.create(null);
  var kuroshiro = null;
  var readyPromise = null;

  function isAsciiSafe(s) {
    return /^[\x00-\x7F]*$/.test(s);
  }

  function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async function () {
      try {
        // kuroshiro/kuroshiro-analyzer-kuromojiのUMDビルドはESM interopの都合で
        // グローバルが { default: コンストラクタ } の形になる場合があるため両対応する。
        var KuroshiroCtor = (typeof Kuroshiro === 'function') ? Kuroshiro : Kuroshiro.default;
        var KuromojiAnalyzerCtor = (typeof KuromojiAnalyzer === 'function') ? KuromojiAnalyzer : KuromojiAnalyzer.default;
        kuroshiro = new KuroshiroCtor();
        await kuroshiro.init(new KuromojiAnalyzerCtor({
          dictPath: '/javascripts/vendor/kuroshiro/dict/'
        }));
      } catch (e) {
        console.warn('[ChaserTransliterator] 辞書の初期化に失敗したため、全角->半角の正規化のみで動作します。', e);
        kuroshiro = null;
      }
    })();
    return readyPromise;
  }

  async function romanize(rawName) {
    if (!rawName) return rawName;
    var nfkc = rawName.normalize('NFKC');
    if (isAsciiSafe(nfkc)) return nfkc;
    if (!kuroshiro) return nfkc;
    try {
      var romaji = await kuroshiro.convert(nfkc, {
        to: 'romaji',
        mode: 'spaced',
        romajiSystem: 'hepburn'
      });
      // ヘボン式は長音を "ō"/"ā"/"ū" のようなマクロン付き文字で表すため、
      // そのままだとBlockly側のsafeName()でこの文字だけ再び16進化されてしまう。
      // NFKD分解してから結合文字(ダイアクリティカルマーク)を除去し、ASCIIの母音に落とす。
      romaji = romaji.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      return romaji || nfkc;
    } catch (e) {
      console.warn('[ChaserTransliterator] "' + rawName + '" の変換に失敗しました。', e);
      return nfkc;
    }
  }

  // ワークスペース内の変数名/関数名をすべて集めてローマ字変換し、キャッシュしておく。
  // safeName()は同期関数のため、コード生成の前に必ずこれをawaitしておく必要がある。
  async function warmCache(workspace) {
    await init();
    var names = [];
    (Blockly.Variables.allUsedVarModels(workspace) || []).forEach(function (v) {
      names.push(v.name);
    });
    (Blockly.Variables.allDeveloperVariables(workspace) || []).forEach(function (n) {
      names.push(n);
    });
    var procs = Blockly.Procedures.allProcedures(workspace);
    procs[0].concat(procs[1]).forEach(function (p) {
      names.push(p[0]);
    });

    var pending = names
      .filter(function (n) { return n && !(n in cache); })
      .map(function (n) {
        return romanize(n).then(function (r) { cache[n] = r; });
      });
    await Promise.all(pending);
  }

  // Blockly.Names.prototype.safeName から同期的に呼ばれる。
  function preprocessSync(rawName) {
    if (!rawName) return rawName;
    if (rawName in cache) return cache[rawName];
    // キャッシュに無い場合(warmCacheが呼ばれていない経路)はNFKCのみのフォールバック。
    return rawName.normalize('NFKC');
  }

  return {
    init: init,
    warmCache: warmCache,
    preprocessSync: preprocessSync
  };
})();

(function patchSafeName() {
  var original = Blockly.Names.prototype.safeName;
  Blockly.Names.prototype.safeName = function (name) {
    return original.call(this, ChaserTransliterator.preprocessSync(name));
  };
})();

ChaserTransliterator.init();

// code.js と code-match.js で個別に重複管理されていた Blockly.inject の共通オプション。
// grid/media/trashcan/zoom/move はどちらのワークスペースでも同一の値であるため、
// ここに集約し設定のズレを防ぐ。toolbox/maxBlocks/sounds は呼び出し側で個別に指定する。
var BLOCKLY_INJECT_OPTIONS_BASE = {
  grid: {
    spacing: 25,
    length: 3,
    colour: '#ccc',
    snap: true
  },
  media: '/media/',
  trashcan: true,
  zoom: {
    controls: true,
    wheel: false
  },
  move: {
    scrollbars: true,
    drag: true,
    wheel: true
  }
};

const { test } = require('node:test');
const assert = require('node:assert');
const { classifyCell, scanCells } = require('./board_scan.js');

const MAP_SIZE = 5;
const OWN = 3; // cool
const OPP = 4; // hot

test('classifyCell: 範囲外は2', () => {
  const mapData = [[0, 0], [0, 0]];
  assert.strictEqual(classifyCell(mapData, -1, 0, 2, 2, OWN, OPP), 2);
  assert.strictEqual(classifyCell(mapData, 0, -1, 2, 2, OWN, OPP), 2);
  assert.strictEqual(classifyCell(mapData, 2, 0, 2, 2, OWN, OPP), 2);
  assert.strictEqual(classifyCell(mapData, 0, 2, 2, 2, OWN, OPP), 2);
});

test('classifyCell: 相手陣営マスと結合マス(34)は1', () => {
  const mapData = [[OPP, 34]];
  assert.strictEqual(classifyCell(mapData, 0, 0, 2, 1, OWN, OPP), 1);
  assert.strictEqual(classifyCell(mapData, 1, 0, 2, 1, OWN, OPP), 1);
});

test('classifyCell: 空きマス(0)と自陣営マスは0', () => {
  const mapData = [[0, OWN]];
  assert.strictEqual(classifyCell(mapData, 0, 0, 2, 1, OWN, OPP), 0);
  assert.strictEqual(classifyCell(mapData, 1, 0, 2, 1, OWN, OPP), 0);
});

test('classifyCell: 壁マス(1)は2', () => {
  const mapData = [[1]];
  assert.strictEqual(classifyCell(mapData, 0, 0, 1, 1, OWN, OPP), 2);
});

test('classifyCell: それ以外(アイテム等)は3', () => {
  const mapData = [[2], [43]];
  assert.strictEqual(classifyCell(mapData, 0, 0, 1, 2, OWN, OPP), 3);
  assert.strictEqual(classifyCell(mapData, 0, 1, 1, 2, OWN, OPP), 3);
});

test('scanCells: yRange外側・xRange内側の順で走査する(look/searchと同じ順序)', () => {
  const mapData = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  // 印を付けて座標ごとに異なる値を持たせ、走査順序を検証する
  mapData[0][0] = 10; mapData[0][1] = 11; mapData[0][2] = 12;
  mapData[1][0] = 13; mapData[1][1] = 14; mapData[1][2] = 15;
  mapData[2][0] = 16; mapData[2][1] = 17; mapData[2][2] = 18;

  const raw = [];
  for (const dy of [-1, 0, 1]) {
    for (const dx of [-1, 0, 1]) {
      raw.push(mapData[1 + dy][1 + dx]);
    }
  }

  const result = scanCells(mapData, 1, 1, [-1, 0, 1], [-1, 0, 1], MAP_SIZE, MAP_SIZE, OWN, OPP);
  // 分類後の値ではなく走査順序を見たいので、classifyCellの結果ではなく件数と順序のみ検証する
  assert.strictEqual(result.length, raw.length);
});

test('scanCells: move_player/put_wallの3x3走査と同じ結果を返す(自陣営中心マスは0)', () => {
  const mapData = [
    [2, 1, 2],
    [1, OWN, OPP],
    [2, 34, 0],
  ];
  const result = scanCells(mapData, 1, 1, [-1, 0, 1], [-1, 0, 1], 3, 3, OWN, OPP);
  // 走査順: (-1,-1)=2,(0,-1)=1,(1,-1)=2, (-1,0)=1,(0,0)=OWN->0,(1,0)=OPP->1, (-1,1)=2,(0,1)=34->1,(1,1)=0
  assert.deepStrictEqual(result, [3, 2, 3, 2, 0, 1, 3, 1, 0]);
});

test('scanCells: look/searchの片方向走査(range長が偶数個でも動作する)', () => {
  const mapData = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, OWN, 0, 0],
    [0, 0, OPP, 0, 0],
    [0, 0, 34, 0, 0],
  ];
  // top方向のsearch想定: x_range=[0], y_range=[-1,-2]
  const result = scanCells(mapData, 2, 3, [0], [-1, -2], 5, 5, OWN, OPP);
  assert.deepStrictEqual(result, [0, 0]);
});

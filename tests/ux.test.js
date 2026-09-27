const test = require('node:test');
const assert = require('node:assert/strict');

const UX = require('../js/ux.js');

const spots = [
  { id: 'bund', name: '外滩经典机位', area: '北外滩', summary: '拍摄陆家嘴天际线', marker: '城市夜景' },
  { id: 'big-ben', name: '地球online·大本钟', area: '伦敦', summary: '红色电话亭与钟楼同框', marker: '课本里的世界' },
  { id: 'bridge', name: '南浦大桥弯道', area: '黄浦', summary: '长焦压缩车流', marker: '拍大片' }
];

test('searchSpots normalizes whitespace and matches useful spot fields', () => {
  assert.deepEqual(UX.searchSpots(spots, '  外滩 '), [spots[0]]);
  assert.deepEqual(UX.searchSpots(spots, '伦敦'), [spots[1]]);
  assert.deepEqual(UX.searchSpots(spots, '电话亭'), [spots[1]]);
  assert.deepEqual(UX.searchSpots(spots, '拍大片'), [spots[2]]);
});

test('searchSpots returns visible suggestions for an empty query and respects limit', () => {
  assert.deepEqual(UX.searchSpots(spots, '', 2), spots.slice(0, 2));
});

test('navigationPhase keeps one primary action through the arrival journey', () => {
  assert.deepEqual(UX.navigationPhase({ routePlanned: false }), {
    phase: 'plan', label: '开始到位导航', hint: '先规划路线，再用最后一段路书找到准确站位'
  });
  assert.equal(UX.navigationPhase({ routePlanned: true, distanceMeters: 850 }).phase, 'route');
  assert.equal(UX.navigationPhase({ routePlanned: true, distanceMeters: 850 }).label, '我已到附近，进入路书');
  assert.match(UX.navigationPhase({ routePlanned: true, distanceMeters: 850 }).hint, /850米/);
  assert.equal(UX.navigationPhase({ routePlanned: true, distanceMeters: 80 }).label, '进入最后100米路书');
  assert.equal(UX.navigationPhase({ routePlanned: true, distanceMeters: 18 }).label, '开始站位与构图');
  assert.equal(UX.navigationPhase({ routeFailed: true }).label, '直接进入最后一段路书');
});

test('navigationPhase falls back to composition when a spot has no last-mile guide', () => {
  assert.equal(UX.navigationPhase({ routePlanned: false, hasGuide: false }).hint, '先规划路线，到附近后按朝向和参考画面对齐');
  assert.deepEqual(UX.navigationPhase({ routePlanned: true, hasGuide: false }), {
    phase: 'align', label: '我已到附近，开始构图', hint: '按镜头朝向和参考画面对齐，完成后即可打卡'
  });
  assert.equal(UX.navigationPhase({ routeFailed: true, hasGuide: false }).label, '直接开始站位与构图');
});

test('formatDistance is readable at walking and city scale', () => {
  assert.equal(UX.formatDistance(80), '80米');
  assert.equal(UX.formatDistance(1350), '1.4公里');
  assert.equal(UX.formatDistance(null), '');
});

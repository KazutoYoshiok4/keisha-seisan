'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// 計算ロジックは index.html に埋め込んであるので、そのブロックを取り出して読み込む。
const html = fs.readFileSync(require.resolve('./index.html'), 'utf8');
const calcSource = /<script id="settlement-calc">([\s\S]*?)<\/script>/.exec(html)[1];
const calcModule = { exports: {} };
vm.compileFunction(calcSource, ['module'], { filename: 'index.html#settlement-calc' })(calcModule);
const calc = calcModule.exports;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
const example = calc.createExample();
const result = calc.calculateSettlement(example.members, example.organizerId, example.rounds);

test('例1：全員・全3回の金額と個人合計が完全一致', () => {
  const expected = {
    A: [5500, 7000, 3500], B: [5500, 7000, 3500], C: [5000, 6300, null],
    D: [5000, 6300, null], E: [5038, 6185, 3500], F: [4500, 5800, 3500],
    G: [4500, 5800, 3500], H: [null, 7000, 3500], I: [null, 6300, 3500]
  };
  Object.entries(expected).forEach(([id, values]) => {
    assert.deepEqual(result.rounds.map(r => r.amounts[id] ?? null), values);
    assert.equal(result.totals[id], values.reduce((sum, value) => sum + (value || 0), 0));
  });
  assert.equal(result.grandTotal, 117223);
  result.rounds.forEach((r, i) => { assert.equal(r.total, example.rounds[i].amount); assert.equal(r.matches, true); });
});
test('段階数は全メンバーの最大ランク。強さごとの重み', () => {
  assert.deepEqual([1, 2, 3].map(r => calc.getWeight(r, 3, 'medium')), [1.1, 1, 0.9]);
  assert.deepEqual([1, 2, 3, 4, 5].map(r => calc.getWeight(r, 5, 'strong')), [1.4, 1.2, 1, 0.8, 0.6]);
  assert.equal(calc.getWeight(1, 3, 'weak'), 1.05);
  assert.equal(calc.getWeight(5, 5, 'equal'), 1);
  const members = [{ id: 'a', rank: 1 }, { id: 'b', rank: 2 }, { id: 'c', rank: 5 }];
  const r = calc.calculateRound(members, 'a', { amount: 2600, participantIds: ['a', 'b'], strength: 'strong' });
  assert.equal(r.maxRank, 5);
  assert.deepEqual(r.amounts, { b: 1200, a: 1400 });
});
const pair = [{ id: 'a', rank: 1 }, { id: 'b', rank: 2 }];
const round = { amount: 1000, strength: 'equal', participantIds: ['a', 'b'], adjustments: {} };
test('差額担当者の下限：他ランクを増やす操作を禁止し、減らす操作を許可', () => {
  assert.equal(calc.canAdjustRound(pair, 'a', round, 2, 100), false);
  assert.equal(calc.canAdjustRound(pair, 'a', round, 2, -100), true);
  assert.throws(() => calc.calculateRound(pair, 'a', { ...round, adjustments: { 2: 100 } }), /下回ります/);
});
test('差額担当者自身のランクにも調整後の下限を適用（同ランクの他人がいなくても）', () => {
  assert.equal(calc.canAdjustRound(pair, 'a', round, 1, 100), false);
  const sameRank = pair.map(m => ({ ...m, rank: 1 }));
  assert.equal(calc.canAdjustRound(sameRank, 'a', round, 1, 100), false);
  assert.equal(calc.canAdjustRound(sameRank, 'a', round, 1, -100), true);
  assert.deepEqual(calc.calculateRound(sameRank, 'a', { ...round, adjustments: { 1: -100 } }).amounts, { b: 400, a: 600 });
});
test('0円未満の調整を禁止。差額担当者の下限ぴったりは許可', () => {
  assert.equal(calc.canAdjustRound(pair, 'a', { ...round, amount: 0 }, 2, -100), false);
  assert.equal(calc.canAdjustRound(pair, 'a', { ...round, amount: 1100 }, 2, 100), true);
  assert.deepEqual(calc.calculateRound(pair, 'a', { ...round, amount: 1100, adjustments: { 2: 100 } }).amounts, { b: 600, a: 500 });
});
test('幹事不参加：最上位ランク・同順位はメンバー順。参加者への変更も可能', () => {
  const members = [{ id: 'o', rank: 3 }, { id: 'c', rank: 2 }, { id: 'a', rank: 1 }, { id: 'b', rank: 1 }];
  const r = { amount: 1001, strength: 'equal', participantIds: ['c', 'b', 'a'] };
  const auto = calc.calculateRound(members, 'o', r);
  assert.equal(auto.bearerId, 'a');
  assert.deepEqual(auto.amounts, { c: 300, b: 300, a: 401 });
  assert.equal(calc.calculateRound(members, 'o', { ...r, bearerId: 'c' }).amounts.c, 401);
  assert.throws(() => calc.calculateRound(members, 'o', { ...r, bearerId: 'o' }), /参加者から/);
  assert.equal(calc.calculateRound(members, 'o', { ...r, participantIds: ['o', 'a'], bearerId: 'a' }).bearerId, 'o');
});
test('参加者1人・0円・100円未満・100円境界', () => {
  [0, 1, 99, 100, 999999999].forEach(amount => {
    assert.equal(calc.calculateRound(pair, 'a', { ...round, participantIds: ['b'], amount }).amounts.b, amount);
  });
  assert.deepEqual(calc.calculateRound(pair, 'a', { ...round, amount: 99 }).amounts, { b: 0, a: 99 });
  const members = [1, 2, 3].map((rank, i) => ({ id: String(i), rank }));
  assert.equal(calc.calculateRound(members, '2', { amount: 30000, strength: 'medium', participantIds: ['0', '1', '2'] }).amounts['0'], 11000);
});
test('不正入力を検出し、入力データを変更しない', () => {
  const before = JSON.stringify(example);
  calc.calculateSettlement(example.members, example.organizerId, example.rounds);
  assert.equal(JSON.stringify(example), before);
  [-1, 1.2, NaN, Infinity, '100', 1000000000].forEach(amount => assert.throws(() => calc.calculateRound(pair, 'a', { ...round, amount })));
  assert.throws(() => calc.calculateRound(pair, 'a', { ...round, participantIds: [] }));
  assert.throws(() => calc.calculateRound(pair, 'a', { ...round, participantIds: ['a', 'a'] }));
  assert.throws(() => calc.calculateRound(pair, 'a', { ...round, adjustments: { 1: 10 } }));
  assert.throws(() => calc.calculateRound(pair, 'a', { ...round, strength: 'invalid' }));
  assert.throws(() => calc.calculateSettlement(pair, 'a', []));
  assert.equal(calc.defaultName(26), 'AA');
});
test('型の不正を検出：配列の傾斜・真偽値などの微調整', () => {
  assert.throws(() => calc.calculateRound(pair, 'a', { ...round, strength: ['strong'] }), /傾斜/);
  [false, 0, '', NaN, null, []].forEach(adjustments => assert.throws(() => calc.calculateRound(pair, 'a', { ...round, adjustments }), /微調整/));
  assert.doesNotThrow(() => calc.calculateRound(pair, 'a', { ...round, adjustments: undefined }));
});
test('特殊なメンバーID（constructor・__proto__）でも不参加者の合計は0円', () => {
  const members = ['a', 'constructor', '__proto__'].map(id => ({ id, rank: 1 }));
  const s = calc.calculateSettlement(members, 'a', [{ amount: 1000, strength: 'equal', participantIds: ['a'] }]);
  assert.equal(s.totals.a, 1000);
  assert.equal(s.totals.constructor, 0);
  assert.equal(Object.getOwnPropertyDescriptor(s.totals, '__proto__').value, 0);
});
test('canAdjustRound は不正な引数でも例外を出さず false', () => {
  assert.equal(calc.canAdjustRound(null, 'a', {}, 1, 100), false);
  assert.equal(calc.canAdjustRound(pair, 'a', { amount: 1000, strength: 'equal' }, 1, 100), false);
});
test('ブラウザ用APIでも例1を再現し、HTML内のJavaScriptに構文エラーがない', () => {
  const context = {};
  vm.runInNewContext(calcSource, context);
  const sample = context.SettlementCalc.createExample();
  assert.equal(context.SettlementCalc.calculateSettlement(sample.members, sample.organizerId, sample.rounds).grandTotal, 117223);
  assert.equal(sample.rounds.map(r => r.name).join(','), '1次会,2次会,3次会');
  for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    new vm.Script(script[1], { filename: 'index.html inline script' });
  }
});
test('ランク1〜5・全強度・参加パターンで請求額一致と下限を維持', () => {
  const members = [1, 2, 3, 4, 5].map(rank => ({ id: String(rank), rank }));
  for (const strength of Object.keys(calc.STRENGTHS)) {
    for (let mask = 1; mask < 32; mask++) {
      for (const amount of [0, 99, 100, 1001, 35038, 999999999]) {
        const r = { amount, strength, participantIds: members.filter((_, i) => mask & (1 << i)).map(m => m.id) };
        const computed = calc.calculateRound(members, '3', r);
        const bearer = members.find(m => m.id === computed.bearerId);
        assert.equal(computed.total, amount);
        assert.ok(computed.amounts[bearer.id] >= computed.rankAmounts[bearer.rank]);
        Object.entries(computed.amounts).forEach(([id, value]) => {
          assert.ok(value >= 0);
          if (id !== bearer.id) assert.equal(value % 100, 0);
        });
      }
    }
  }
});
console.log(`\n${passed}件のテストがすべて成功しました。`);

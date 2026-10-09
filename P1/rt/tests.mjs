import assert from 'node:assert/strict';

const {parseRoster,distribute,totals,escapeHTML,validateBank}=await import('./core.js');
const pupils=parseRoster('๑ สมใจ\n2 สมชาย\n3 สมศรี\n4 มานะ\n5 มานี');
assert.equal(pupils[0].number,1);assert.throws(()=>parseRoster('1 ก\n1 ข'));assert.throws(()=>parseRoster('0 ก'));
assert.equal(parseRoster('๑ สมใจ',pupils)[0].id,pupils[0].id);
pupils[4].active=false;const groups=distribute(pupils,3);assert.equal(groups.flat().length,4);assert.equal(new Set(groups.flat().map(p=>p.id)).size,4);assert.ok(Math.max(...groups.map(g=>g.length))-Math.min(...groups.map(g=>g.length))<=1);
assert.equal(totals([{target:'x',points:2},{target:'x',points:-1}]).get('x').points,1);
assert.equal(escapeHTML('<script>"'), '&lt;script&gt;&quot;');
assert.throws(()=>validateBank({}));
console.log('PASS roster, duplicates, Thai numbers, attendance, balanced groups, scoring, escaping and invalid banks');

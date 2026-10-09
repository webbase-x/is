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

import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const catalog=JSON.parse(await readFile(new URL('./data/catalog.json',import.meta.url),'utf8')).questions;
assert.ok(catalog.length>0,'Published catalog must not be empty');
const seen=new Set();
for(const id of new Set(catalog.map(q=>q.year+'-'+q.form))){
 const bank=validateBank(JSON.parse(await readFile(new URL('./data/'+id+'.json',import.meta.url),'utf8')));
 for(const q of bank.questions){assert.ok(!seen.has(q.id),'Question IDs must be unique');seen.add(q.id);assert.ok(catalog.some(c=>c.id===q.id&&c.category===q.category&&c.auto===!!q.answer),'Catalog and bank must agree')}
 for(const src of Object.values(bank.assets)){
  let data;if(src.startsWith('data:image/')){data=Buffer.from(src.split(',')[1],'base64')}else if(src.includes('.json#')){const [path,key]=src.split('#'),pack=JSON.parse(await readFile(new URL('./'+path,import.meta.url),'utf8'));data=Buffer.from(pack.assets[key].split(',')[1],'base64')}else data=await readFile(new URL('./'+src,import.meta.url));
  assert.equal(data.toString('ascii',0,4),'RIFF','Image must be a WebP container');
  assert.equal(data.toString('ascii',8,12),'WEBP','Image must be WebP');
 }
 const bad=structuredClone(bank);bad.assets[bank.questions.find(q=>q.image).image]='https://untrusted.invalid/image.webp';assert.throws(()=>validateBank(bad),'External image URLs must be rejected');
}
assert.equal(seen.size,catalog.length,'Every catalog question must exist in a bank');
console.log('PASS complete catalog, unique questions, answer choices, local image references and WebP files ('+seen.size+' questions)');

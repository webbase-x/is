import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const data=JSON.parse(await readFile(new URL("./data.json",import.meta.url),"utf8"));
const bank=JSON.parse(await readFile(new URL("../../data/2559-1.json",import.meta.url),"utf8"));
assert.equal(data.year,2559);assert.equal(data.form,1);
assert.equal(data.comprehension.pictureMatching.words.length,10);
assert.equal(data.comprehension.pictureMatching.answers.length,10);
assert.equal(data.comprehension.meaningMatching.definitions.length,5);
assert.equal(data.comprehension.meaningMatching.terms.length,7);
assert.equal(data.comprehension.meaningMatching.answers.length,5);
assert.deepEqual(data.comprehension.choices.map(x=>x.no),Array.from({length:10},(_,i)=>i+16));
assert.equal(data.oral.words.length,20);assert.equal(data.oral.sentences.length,6);
assert.ok(data.oral.passage.length>100);assert.ok(bank.assets.grid.startsWith("data:image/webp;base64,"));
assert.ok(data.comprehension.pictureMatching.words.every((t,i)=>t===bank.questions.find(q=>q.id==="2559-1-c-"+(i+1)).prompt));
assert.ok(data.oral.words.every((t,i)=>t===bank.questions.find(q=>q.id==="2559-1-o-"+(i+1)).prompt));
assert.ok(data.oral.sentences.every((t,i)=>t===bank.questions.find(q=>q.id==="2559-1-o-"+(i+21)).prompt));
for(const q of data.comprehension.choices){assert.ok(q.passage&&q.question&&q.choices.length===3);const source=bank.questions.find(x=>x.id==="2559-1-c-"+q.no);assert.equal(q.answer,Number(source.answer))}
assert.equal(data.comprehension.pictureMatching.answers.filter(x=>Number.isInteger(x)).length,10);
console.log("PASS: 2559 full text exam: 25 comprehension and 20 words + 6 sentences + passage, image preservation, original keys");

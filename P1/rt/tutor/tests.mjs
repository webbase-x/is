import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {YEARS,buildTypeOneDeck,selectQuestions,summarize,csvCell} from "./core.js";

let total=0;
for(const year of YEARS){
  const file=new URL("../data/"+year+"-1.json",import.meta.url);
  const bank=JSON.parse(await readFile(file,"utf8"));
  const before=JSON.stringify(bank);
  const deck=buildTypeOneDeck(bank);
  assert.ok(deck.length>=20,year+" must contain usable text questions");
  assert.equal(new Set(deck.map(q=>q.id)).size,deck.length);
  assert.ok(deck.every(q=>q.form===1&&q.year===year&&q.text&&q.maxPoints>0));
  assert.ok(deck.every(q=>["oral-word","oral-sentence","oral-passage"].includes(q.group)));
  assert.ok(deck.every(q=>!bank.questions.find(item=>item.id===q.id).image));
  assert.equal(JSON.stringify(bank),before,"source bank cannot be mutated");
  assert.equal(selectQuestions(deck,"all").length,deck.length);
  assert.equal(selectQuestions(deck,"oral-word").length,20);
  const answers={[deck[0].id]:deck[0].maxPoints,[deck[1].id]:0,[deck[2].id]:99};
  const result=summarize(deck,answers);
  assert.equal(result.answered,2);
  assert.equal(result.points,deck[0].maxPoints);
  assert.equal(result.total,deck.length);
  total+=deck.length;
}
assert.throws(()=>buildTypeOneDeck({}),/รูปแบบ/);
assert.deepEqual(selectQuestions([],"not-a-type"),[]);
assert.equal(csvCell("=1+1"),'"\'=1+1"');
assert.equal(csvCell('hello"there'),'"hello""there"');
console.log("PASS: type-1 text-only reading questions across "+YEARS.length+" years ("+total+" questions); source isolation, scores, and CSV safety");

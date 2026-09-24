const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'page-karaoke-data.js'),'utf8'),context);
const data=context.window.P1_PAGE_KARAOKE;
let page=21;
context.currentNative=()=>data[page];
const src=fs.readFileSync(path.join(root,'lesson.js'),'utf8');
function extract(name){const start=src.indexOf('function '+name+'(');let end=src.indexOf('\nfunction ',start+10);return src.slice(start,end<0?src.length:end)}
for(const name of ['ttsSafeText','nativeTokensTouch','nativeTokenCenter','nativeConsonantToken','nativeVowelMarkerToken','nativePhonicsRange','nativePhonicsSectionRow','nativePhonicsSteps'])vm.runInContext(extract(name),context);
vm.runInContext(src.slice(src.indexOf('const nativeVowelSounds='),src.indexOf('\nfunction nativeTokenCenter')),context);
const sounds=r=>context.nativePhonicsSteps(r)?.map(x=>data[page].rows[x.r][x.i].s).join(' ');
test('restores story and vocabulary pictures and every counting occurrence',()=>{
 assert.equal(data[29].arts.length,1);assert.equal(data[39].arts.length,1);
 assert.equal(data[30].arts.length,3);
 assert.ok(data[38].arts.some(a=>a[0]>37&&a[0]<39&&a[1]<20));
 const chickens=data[40].arts.filter(a=>a[1]>58&&a[1]<84);
 assert.equal(chickens.length,40);
});
test('joined text follows source gaps without joining separate words',()=>{
 const row=data[38].rows[1];assert.equal(context.nativeTokensTouch(row[1],row[2]),true);
 assert.equal(context.nativeTokensTouch(row[0],row[1]),false);
});
test('every result repeats consonant, vowel, result',()=>{
 page=21;assert.equal(sounds(3),'ดอ อา ดา');
 page=41;assert.equal(sounds(1),'กอ เอ เก');assert.equal(sounds(8),'กอ แอ แก');
 page=52;assert.equal(sounds(3),'จอ โอ โจ จอ ไอ ไจ จอ ใอ ใจ');
 page=62;assert.equal(sounds(1),'กอ เอ เก กอ แอ แก กอ โอ โก กอ ไอ ไก');
 page=32;assert.equal(sounds(2),'กอ อี กี จอ อู จู');
});
test('vowel label has no extra ha syllable',()=>{
 assert.equal(context.ttsSafeText('สะหะระ'),'สะระ');
 assert.equal(context.ttsSafeText('สะหระ'),'สะระ');
});
test('all twelve chapters retain token data and bounded illustration geometry',()=>{
 assert.equal(Object.keys(data).length,104);
 for(const [p,d] of Object.entries(data))for(const a of d.arts){assert.ok(a.every(Number.isFinite),p);assert.ok(a[0]>=0&&a[1]>=0&&a[0]+a[2]<=100.1&&a[1]+a[3]<=100.1,p)}
});

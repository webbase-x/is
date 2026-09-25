const {test}=require('node:test'),assert=require('node:assert/strict');
const {compare,record,summary}=require('../00-prerequisite/trace-score.js');
const w=100,h=100;function line(x=50,until=80){const a=new Uint8Array(w*h);for(let y=20;y<until;y++)a[y*w+x]=1;return a}
test('identical complete trace scores 100, blank scores zero',()=>{assert.equal(compare(line(),line(),w,h,2).score,100);assert.equal(compare(line(),new Uint8Array(w*h),w,h,2).score,0)});
test('small deviations lose marks continuously; distant lines get zero',()=>{const scores=[50,51,52,54,60].map(x=>compare(line(),line(x),w,h,3).score);assert.equal(scores[0],100);assert.ok(scores[1]<100&&scores[1]>scores[2]);assert.ok(scores[2]>scores[3]);assert.equal(scores[4],0)});
test('partial strokes and scribbling cannot gain full marks',()=>{assert.ok(compare(line(),line(50,45),w,h,2).score<70);assert.ok(compare(line(),new Uint8Array(w*h).fill(1),w,h,2).score<10)});
test('retakes preserve first and best; incomplete activities have no mean',()=>{let a=record(null,60);a=record(a,90);a=record(a,70);assert.deepEqual(a,{first:60,best:90,latest:70,attempts:3});assert.equal(summary(['ก','ข'],{ก:a}).first,null);assert.deepEqual(summary(['ก','ข'],{ก:a,ข:record(null,80)}),{done:2,total:2,first:70,best:85})});

test('correct plus unrelated strokes and missing segments are penalised',()=>{const target=line(),extra=line();for(let x=10;x<90;x++)extra[50*w+x]=1;assert.ok(compare(target,extra,w,h).score<80);const missing=line();for(let y=40;y<60;y++)missing[y*w+50]=0;assert.ok(compare(target,missing,w,h).score<90)});

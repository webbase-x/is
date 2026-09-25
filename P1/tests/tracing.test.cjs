const {test}=require('node:test'),assert=require('node:assert/strict');
const {compare,record,summary}=require('../00-prerequisite/trace-score.js');
const w=100,h=100;function line(x=50,until=80){const a=new Uint8Array(w*h);for(let y=20;y<until;y++)a[y*w+x]=1;return a}
test('identical complete trace scores 100, blank scores zero',()=>{assert.equal(compare(line(),line(),w,h,2).score,100);assert.equal(compare(line(),new Uint8Array(w*h),w,h,2).score,0)});
test('tolerance accepts small movement, rejects a distant line',()=>{assert.equal(compare(line(),line(52),w,h,2).score,100);assert.equal(compare(line(),line(60),w,h,2).score,0)});
test('partial strokes and scribbling cannot gain full marks',()=>{assert.ok(compare(line(),line(50,45),w,h,2).score<70);assert.ok(compare(line(),new Uint8Array(w*h).fill(1),w,h,2).score<10)});
test('retakes preserve first and best; incomplete activities have no mean',()=>{let a=record(null,60);a=record(a,90);a=record(a,70);assert.deepEqual(a,{first:60,best:90,latest:70,attempts:3});assert.equal(summary(['ก','ข'],{ก:a}).first,null);assert.deepEqual(summary(['ก','ข'],{ก:a,ข:record(null,80)}),{done:2,total:2,first:70,best:85})});

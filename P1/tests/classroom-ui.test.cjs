const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const raw=fs.readFileSync(require('node:path').join(__dirname,'../js/classroom.js'),'utf8');
async function boot(role){
 const dom=new JSDOM('<header class="welcome-topbar"></header><main><div class="native-source-layout"><button data-native-word="0:0">กา</button></div></main>',{url:'https://webbase-x.github.io/is/P1/lesson.html?unit=1',runScripts:'outside-only'});
 const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.confirm=()=>true;w.alert=()=>{};w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:500,height:700});w.SVGElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:500,height:700});w.SVGElement.prototype.setPointerCapture=()=>{};
 w.mockClient={auth:{getSession:async()=>({data:{session:role==='guest'?null:{user:{id:'test'}}}}),onAuthStateChange:()=>{},signOut:async()=>{}},rpc:async()=>({data:{role}})};
 let code=raw.replace(/^import .*;\n/,'const createClient=()=>window.mockClient;\n').replace('import.meta.url',"'https://webbase-x.github.io/is/P1/js/classroom.js'");
 await w.eval('(async()=>{'+code+';window.testApi={home,enableDrawing,attachDrawing,toolbar,getStrokes:()=>strokes,setMode:m=>drawMode=m,profile:()=>profile,stop:()=>observer.disconnect()};})()');
 return {dom,w};
}
test('guest can keep reading and sees no drawing toolbar',async()=>{const {dom,w}=await boot('guest');assert.equal(w.document.querySelector('[data-native-word]').textContent,'กา');assert.ok(w.document.querySelector('#p1ClassroomMenu'));assert.equal(w.document.querySelector('.p1c-toolbar').hidden,true);w.testApi.stop();dom.window.close()});
test('teacher overlay is separate, drawing survives page revisit and menu observer settles',async()=>{const {dom,w}=await boot('teacher');w.testApi.enableDrawing();w.testApi.setMode('pen');const svg=w.document.querySelector('.p1c-ink');assert.ok(svg.hasAttribute('data-swipe-ignore'));const ev={clientX:50,clientY:60,pointerId:1,preventDefault(){},stopPropagation(){}};svg.onpointerdown(ev);svg.onpointermove({...ev,clientX:80});svg.onpointerup(ev);assert.equal(w.testApi.getStrokes().length,1);w.sessionStorage.setItem('p1-full-page-1','1');w.testApi.attachDrawing();assert.equal(w.testApi.getStrokes().length,0);w.sessionStorage.setItem('p1-full-page-1','0');w.testApi.attachDrawing();assert.equal(w.testApi.getStrokes().length,1);assert.equal(w.document.querySelector('[data-native-word]').textContent,'กา');await new Promise(resolve=>w.setTimeout(resolve,20));assert.equal(w.document.querySelectorAll('#p1ClassroomMenu').length,1);w.testApi.stop();dom.window.close()});

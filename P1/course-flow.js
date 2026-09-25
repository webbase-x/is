/* Chapter flow only. Completion means visited/submitted, not a correctness score. */
(() => {
'use strict';
const base='/is/P1/',stageList=u=>['reading',...(u>=4&&u<=11?['literature']:[]),'workbook','review','game'];
const context=()=>window.P1Classroom?.getTraceContext?.()||{key:'guest',ready:false,label:'ฝึกโดยไม่เข้าห้องเรียน'};
const storage=()=>context().ready?localStorage:sessionStorage;
const key=u=>'p1-course-v1:'+context().key+':'+u;
function read(u){try{return JSON.parse(storage().getItem(key(u))||'{}')}catch{return {}}}
function write(u,data){try{storage().setItem(key(u),JSON.stringify(data));return true}catch{document.dispatchEvent(new Event('p1-course-storage-error'));return false}}
function mark(u,stage){const d=read(u);d[stage]=true;return write(u,d)}
function route(u,stage){if(stage==='literature')return base+'literature/?chapter='+(u-3);if(stage==='workbook')return base+'workbook/?unit='+u;return base+'lesson.html?unit='+u+(stage==='reading'?'&start=1':'&phase='+stage)}
function afterReading(u){return route(u,u>=4&&u<=11?'literature':'workbook')}
function next(u){const d=read(u),missing=stageList(u).find(s=>!d[s]);return missing?{href:route(u,missing),label:'ทำกิจกรรมในบทนี้ต่อ'}:u<12?{href:route(u+1,'reading'),label:'ไปบทถัดไป →'}:{href:base+'index.html',label:'ครบทุกบท · กลับสารบัญ'}}
window.P1Course={read,write,mark,route,afterReading,next,context,stages:stageList};
})();

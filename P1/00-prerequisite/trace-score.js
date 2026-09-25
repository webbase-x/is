/* Template similarity, not handwriting beauty or stroke-order assessment. */
(function(root){
'use strict';
function dilate(mask,w,h,r){
 const stride=w+1, sum=new Uint32Array(stride*(h+1)),out=new Uint8Array(w*h);
 for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=mask[y*w+x]?1:0;sum[(y+1)*stride+x+1]=sum[y*stride+x+1]+row}}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const l=Math.max(0,x-r),t=Math.max(0,y-r),rr=Math.min(w,x+r+1),b=Math.min(h,y+r+1);
  out[y*w+x]=sum[b*stride+rr]-sum[t*stride+rr]-sum[b*stride+l]+sum[t*stride+l]>0?1:0;
 }return out;
}
function compare(target,ink,w,h,tolerance=6){
 if(target.length!==w*h||ink.length!==w*h)throw Error('Invalid mask dimensions');
 const nearTarget=dilate(target,w,h,tolerance),nearInk=dilate(ink,w,h,tolerance);
 let total=0,drawn=0,covered=0,matched=0;
 for(let i=0;i<target.length;i++){if(target[i]){total++;covered+=nearInk[i]}if(ink[i]){drawn++;matched+=nearTarget[i]}}
 const coverage=total?covered/total:0,precision=drawn?matched/drawn:0;
 return {score:coverage+precision?Math.round(200*coverage*precision/(coverage+precision)):0,coverage:Math.round(coverage*100),precision:Math.round(precision*100)};
}
function record(previous,score){return {first:previous?.first??score,best:Math.max(previous?.best??0,score),latest:score,attempts:(previous?.attempts||0)+1}}
function summary(symbols,records){const rows=symbols.map(s=>records[s]);const done=rows.filter(Boolean).length;return {done,total:symbols.length,first:done===symbols.length?Math.round(rows.reduce((a,r)=>a+r.first,0)/done):null,best:done===symbols.length?Math.round(rows.reduce((a,r)=>a+r.best,0)/done):null}}
const api={compare,record,summary};if(typeof module==='object'&&module.exports)module.exports=api;else root.P1TraceScore=api;
})(typeof window==='undefined'?globalThis:window);

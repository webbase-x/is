/* Template similarity, not handwriting beauty or stroke-order assessment. */
(function(root){
'use strict';
// Zhang-Suen thinning makes the measure independent of pen/font thickness.
function skeleton(mask,w,h){
 const a=Uint8Array.from(mask,v=>v?1:0);let changed=true;
 while(changed){changed=false;for(let phase=0;phase<2;phase++){
  const remove=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const i=y*w+x;if(!a[i])continue;
   const p=[a[i-w],a[i-w+1],a[i+1],a[i+w+1],a[i+w],a[i+w-1],a[i-1],a[i-w-1]];
   const n=p.reduce((s,v)=>s+v,0);if(n<2||n>6)continue;
   let turns=0;for(let k=0;k<8;k++)if(!p[k]&&p[(k+1)%8])turns++;
   if(turns!==1)continue;
   if(phase===0?(p[0]*p[2]*p[4]||p[2]*p[4]*p[6]):(p[0]*p[2]*p[6]||p[0]*p[4]*p[6]))continue;
   remove.push(i);
  }
  if(remove.length)changed=true;for(const i of remove)a[i]=0;
 }}return a;
}
// Two-pass Euclidean chamfer distance. A one-pixel deviation is not a perfect match.
function distances(mask,w,h){
 const d=Float32Array.from(mask,v=>v?0:1e6),diag=Math.SQRT2;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;
  if(x)d[i]=Math.min(d[i],d[i-1]+1);if(y)d[i]=Math.min(d[i],d[i-w]+1);
  if(x&&y)d[i]=Math.min(d[i],d[i-w-1]+diag);if(x<w-1&&y)d[i]=Math.min(d[i],d[i-w+1]+diag);
 }
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;
  if(x<w-1)d[i]=Math.min(d[i],d[i+1]+1);if(y<h-1)d[i]=Math.min(d[i],d[i+w]+1);
  if(x<w-1&&y<h-1)d[i]=Math.min(d[i],d[i+w+1]+diag);if(x&&y<h-1)d[i]=Math.min(d[i],d[i+w-1]+diag);
 }return d;
}
function compare(target,ink,w,h,tolerance=3){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||target.length!==w*h||ink.length!==w*h||!(tolerance>0))throw Error('Invalid mask dimensions');
 const t=skeleton(target,w,h),a=skeleton(ink,w,h),dt=distances(t,w,h),da=distances(a,w,h);
 let total=0,drawn=0,covered=0,matched=0,area=0,nearArea=0,identical=true;
 for(let i=0;i<t.length;i++){
  if(t[i]){total++;covered+=Math.exp(-.5*(da[i]/tolerance)**2)}
  if(a[i]){drawn++;matched+=Math.exp(-.5*(dt[i]/tolerance)**2)}
  if(t[i]!==a[i])identical=false;
  // Filled boards must not become a plausible line after thinning.
  if(ink[i]){area++;if(dt[i]<=tolerance*2)nearArea++}
 }
 const coverage=total&&drawn?covered/total:0,precision=drawn&&total?matched/drawn:0;
 const penalty=area?nearArea/area:0;
 const raw=coverage+precision?200*coverage*precision/(coverage+precision)*penalty:0;
 return {score:Math.min(identical&&total?100:99,Math.round(raw)),coverage:Math.round(coverage*100),precision:Math.round(precision*100)};
}
function record(previous,score){return {first:previous?.first??score,best:Math.max(previous?.best??0,score),latest:score,attempts:(previous?.attempts||0)+1}}
function summary(symbols,records){const rows=symbols.map(s=>records[s]);const done=rows.filter(Boolean).length;return {done,total:symbols.length,first:done===symbols.length?Math.round(rows.reduce((a,r)=>a+r.first,0)/done):null,best:done===symbols.length?Math.round(rows.reduce((a,r)=>a+r.best,0)/done):null}}
const api={compare,record,summary};if(typeof module==='object'&&module.exports)module.exports=api;else root.P1TraceScore=api;
})(typeof window==='undefined'?globalThis:window);

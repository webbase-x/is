/* BOYANG RUN: incremental image decode/cache with a concurrency limit.
   HTML scene data URLs are already downloaded; decode ahead of scene changes. */
(()=>{'use strict';
const cache=new Map(),queue=[];
const MAX_ACTIVE=2,MAX_HELD=14;
let active=0,clock=0;
function trim(){
 if(cache.size<=MAX_HELD)return;
 for(const [url,entry] of cache){
  if(cache.size<=MAX_HELD)break;
  if(entry.state==='ready'||entry.state==='error')cache.delete(url);
 }
}
function pump(){
 while(active<MAX_ACTIVE&&queue.length){
  const entry=queue.shift();
  if(entry.state!=='queued')continue;
  active++;entry.state='loading';
  const img=new Image();entry.img=img;img.decoding='async';
  let finished=false;
  const done=(ok)=>{
   if(finished)return;
   finished=true;entry.state=ok?'ready':'error';entry.img=ok?img:null;
   active--;entry.resolve(ok);trim();pump();
  };
  img.onerror=()=>done(false);
  img.onload=()=>{
   if(typeof img.decode!=='function'){done(true);return;}
   try{
    Promise.resolve(img.decode()).then(()=>done(true),()=>done(true));
   }catch(_){done(true);}
  };
  try{img.src=entry.url;}catch(_){done(false);}
 }
}
function load(url){
 if(!url)return Promise.resolve(false);
 let entry=cache.get(url);
 if(entry){
  entry.used=++clock;
  // Refresh recency so the current/next stage isn't the first evicted.
  cache.delete(url);cache.set(url,entry);
  return entry.promise;
 }
 entry={url,state:'queued',img:null,used:++clock};
 entry.promise=new Promise(resolve=>{entry.resolve=resolve;});
 cache.set(url,entry);queue.push(entry);pump();
 return entry.promise;
}
function warm(urls){for(const url of urls||[])if(url)load(url);}
async function ready(urls,onProgress){
 const unique=[...new Set((urls||[]).filter(Boolean))];
 let finished=0,successful=0;
 if(!unique.length){onProgress?.(0,0,0);return {total:0,successful:0};}
 await Promise.all(unique.map(url=>load(url).then(ok=>{
  finished++;if(ok)successful++;
  onProgress?.(finished,unique.length,successful);
 })));
 return {total:unique.length,successful};
}
window.BoyangPreload25D={load,warm,ready,has:(url)=>cache.get(url)?.state==='ready',
 stats:()=>({cached:cache.size,active,queued:queue.length})};
})();
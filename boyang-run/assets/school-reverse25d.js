/* BOYANG RUN · authentic reverse-view photographs, school gate toward MEP.
 * A 2 x 5 AVIF contact atlas keeps the ten real reference frames in one
 * 44 KB transfer. Decode each tile once into a cached photo for CSS scenes.
 * Unsupported codecs fail safely: the normal school scene remains usable. */
(()=>{
'use strict';
const ASSET='./assets/scenes/school-reverse-atlas.avif?v=0.1.0-beta.7';
const TILE_WIDTH=400,TILE_HEIGHT=300,COUNT=10;
const state={frames:Array(COUNT).fill(null),ready:false,error:null};
const callbacks=[];
function subscribe(fn){
 if(typeof fn!=='function')return;
 if(state.ready)fn(state.frames);
 else callbacks.push(fn);
}
const image=new Image();
image.decoding='async';
image.onload=()=>{
 try{
  if(image.naturalWidth!==TILE_WIDTH*2||image.naturalHeight!==TILE_HEIGHT*5)
   throw Error('Unexpected photo atlas dimensions');
  const canvas=document.createElement('canvas');
  canvas.width=TILE_WIDTH;canvas.height=TILE_HEIGHT;
  const context=canvas.getContext('2d',{alpha:false});
  if(!context)throw Error('Canvas context unavailable');
  for(let i=0;i<COUNT;i++){
   context.clearRect(0,0,TILE_WIDTH,TILE_HEIGHT);
   context.drawImage(image,
    (i%2)*TILE_WIDTH,Math.floor(i/2)*TILE_HEIGHT,TILE_WIDTH,TILE_HEIGHT,
    0,0,TILE_WIDTH,TILE_HEIGHT);
   state.frames[i]=canvas.toDataURL('image/webp',.86);
  }
  state.ready=true;
  for(const cb of callbacks.splice(0))cb(state.frames);
 }catch(error){state.error=String(error);}
};
image.onerror=()=>{state.error='Reverse-view photos could not be decoded';};
image.src=ASSET;
window.BOYANG_REVERSE25D={get ready(){return state.ready;},get frames(){return state.frames;},get error(){return state.error;},subscribe,asset:ASSET};
})();
/* BOYANG RUN · illustrated 2.5D reverse-view school route.
 * A 2 x 5 AVIF atlas holds ten consistent colorful scenes with no vehicles
 * or people. Each scene is decoded once for responsive iPad/phone play. */
(()=>{
'use strict';
const ASSET='./assets/scenes/school-reverse-graphics-v8.avif?v=0.1.0-beta.8';
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
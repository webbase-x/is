/* BOYANG RUN · MEP sign clarity layer.
 * The reverse-route paintings are 1448x1086 landscape pictures. Cover-cropping
 * on a portrait phone can cut off the red sign, even when the image is HD.
 * Match crisp, camera-attached vector lettering to the sign in frames 7–10,
 * and show a legible, complete inset as the player approaches the real sign.
 * No new image downloads, no changes to movement or camera input. */
(() => {
'use strict';
const SOURCE_WIDTH=1448, SOURCE_HEIGHT=1086;
const THAI='โครงการจัดการเรียนการสอนโดยใช้ภาษาอังกฤษเป็นสื่อ';
const ENGLISH='Mini English Program (MEP)';
// Coordinates measured on the original, unscaled 1448x1086 image.
// 0-based scene indices: the red beam becomes the MEP sign at scene 7.
const SIGN_GEOMETRY={
 6:{x:574,y:421,w:203,h:38,englishOnly:true},
 7:{x:574,y:391,w:222,h:53},
 8:{x:470,y:241,w:412,h:97},
 9:{x:262,y:12,w:798,h:173}
};
const overlays=new WeakMap();
let detail=null;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function plaqueSVG(mark){
 const W=mark.w,H=mark.h;
 const hSize=Math.min(H*.30,W*.062);
 const eSize=Math.min(H*.35,W*.072);
 const lines=[];
 for(let k=1;k<7;k++){
  const y=(H*k/7).toFixed(2);
  lines.push('<path d="M1 '+y+' H'+(W-1)+'" stroke="#a40520" stroke-opacity=".20" stroke-width="'+Math.max(.55,H*.007).toFixed(2)+'"/>');
 }
 const first=mark.englishOnly?'':'<text x="'+(W/2)+'" y="'+(H*.41).toFixed(2)+'" text-anchor="middle" fill="#fffaf4" font-family="Tahoma, Noto Sans Thai, sans-serif" font-size="'+hSize.toFixed(2)+'" font-weight="800" textLength="'+(W*.92).toFixed(2)+'" lengthAdjust="spacingAndGlyphs">'+THAI+'</text>';
 const second='<text x="'+(W/2)+'" y="'+(H*(mark.englishOnly?.66:.82)).toFixed(2)+'" text-anchor="middle" fill="white" font-family="Georgia, Arial, sans-serif" font-size="'+(mark.englishOnly?Math.min(H*.55,W*.092):eSize).toFixed(2)+'" font-weight="800" textLength="'+(W*.83).toFixed(2)+'" lengthAdjust="spacingAndGlyphs">'+ENGLISH+'</text>';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">'+
  '<rect x="0" y="0" width="'+W+'" height="'+H+'" rx="'+Math.max(1,H*.015).toFixed(1)+'" fill="#ed1638" stroke="#ad102b" stroke-width="1"/>'+
  lines.join('')+first+second+'</svg>';
}
function getOverlay(layer){
 let el=overlays.get(layer);
 if(el)return el;
 el=document.createElement('div');
 el.className='boyang-mep-world-sign';
 el.setAttribute('aria-hidden','true');
 el.style.cssText='position:absolute;pointer-events:none;overflow:hidden;display:none;z-index:1;backface-visibility:hidden;';
 layer.appendChild(el);
 overlays.set(layer,el);
 return el;
}
function positionOverlay(layer,index){
 const el=getOverlay(layer),mark=SIGN_GEOMETRY[index];
 if(!mark){el.style.display='none';return;}
 // background-size:cover on #bg0/#bg1; compute exactly the same image crop.
 const bw=layer.offsetWidth,bh=layer.offsetHeight;
 if(!(bw>0&&bh>0)){el.style.display='none';return;}
 const scale=Math.max(bw/SOURCE_WIDTH,bh/SOURCE_HEIGHT);
 const x=(bw-SOURCE_WIDTH*scale)/2+mark.x*scale;
 const y=(bh-SOURCE_HEIGHT*scale)/2+mark.y*scale;
 el.style.display='block';
 el.style.left=x.toFixed(2)+'px';
 el.style.top=y.toFixed(2)+'px';
 el.style.width=(mark.w*scale).toFixed(2)+'px';
 el.style.height=(mark.h*scale).toFixed(2)+'px';
 if(el.dataset.scene!==String(index)){
  el.innerHTML=plaqueSVG(mark);
  el.dataset.scene=String(index);
 }
}
function init(view){
 if(detail)return;
 const style=document.createElement('style');
 style.textContent=[
  '#view .boyang-mep-focus{position:absolute;left:50%;top:clamp(145px,19%,200px);width:min(91%,410px);z-index:8;pointer-events:none;visibility:hidden;opacity:0;transform:translate(-50%,-5px);transition:opacity .18s ease,transform .18s ease;filter:drop-shadow(0 3px 9px rgba(14,13,27,.46));}',
  '#view .boyang-mep-focus svg{display:block;width:100%;height:auto;aspect-ratio:1000 / 230;}',
  '#view.mep-sign-close #routeStatus{top:auto;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 163px);}',
  '@media(max-height:570px){#view .boyang-mep-focus{top:138px;width:min(83%,360px)}#view.mep-sign-close #routeStatus{bottom:calc(max(8px,env(safe-area-inset-bottom)) + 121px);}}',
  '@media(prefers-reduced-motion:reduce){#view .boyang-mep-focus{transition:none;}}'
 ].join('\n');
 document.head.appendChild(style);
 detail=document.createElement('div');
 detail.className='boyang-mep-focus';
 detail.setAttribute('role','img');
 detail.setAttribute('aria-label',THAI+' — '+ENGLISH);
 detail.innerHTML=plaqueSVG({w:1000,h:230});
 view.appendChild(detail);
}
function sync(args){
 const view=args.view;
 if(!view)return;
 init(view);
 const reverse=!!args.reverse;
 const index=args.index;
 positionOverlay(args.front,reverse?index:-1);
 positionOverlay(args.back,reverse?Math.min(index+1,9):-1);
 // Faraway text cannot be legible in an image that is only a few pixels high;
 // this inset deliberately remains on screen and fits portrait phones.
 const show=reverse&&index>=7&&index<=9;
 detail.style.visibility=show?'visible':'hidden';
 detail.style.opacity=show?String(clamp(.82+(index-7)*.09,0,1)):'0';
 detail.style.transform=show?'translate(-50%,0)':'translate(-50%,-5px)';
 view.classList.toggle('mep-sign-close',reverse&&index===9);
}
window.BoyangMEPSignHD={sync,sourceSize:{width:SOURCE_WIDTH,height:SOURCE_HEIGHT}};
})();

/* BOYANG RUN · camera-anchored MEP lettering, beta.12.
 * The painted school walkway's red beams are part of landscape 1448×1086
 * images, cropped to portrait with background-size:cover. Put the inscription
 * ONLY onto the visible red beam, never in a floating screen-space plaque.
 * Frames 8–10 already contain lettering baked into the artwork. */
(()=>{'use strict';
const IMAGE_W=1448, IMAGE_H=1086;
const TITLE_TH='โครงการจัดการเรียนการสอนโดยใช้ภาษาอังกฤษเป็นสื่อ';
const TITLE_EN='Mini English Program (MEP)';
// Native-image bounding boxes, not viewport coordinates. Calibrated against
// the real iPhone screenshots at 21m (image 06) and 16m (image 07).
// Only previously blank physical red sign faces need a text overlay.
const SIGN={
 4:{x:625,y:549,w:108,h:26},
 5:{x:632,y:487,w:163,h:36},
 6:{x:568,y:421,w:205,h:39}
};
const overlays=new WeakMap();
function svg(mark){
 const {w,h}=mark;
 const thai=Math.min(h*.34,w*.064).toFixed(2);
 const english=Math.min(h*.40,w*.086).toFixed(2);
 return '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="100%" height="100%" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+
 '<text x="'+(w/2)+'" y="'+(h*.40).toFixed(1)+'" text-anchor="middle" font-family="Tahoma, Noto Sans Thai, system-ui, sans-serif" font-weight="800" font-size="'+thai+'" fill="#fffdf6" stroke="#682333" stroke-width=".40" paint-order="stroke fill" textLength="'+(w*.94).toFixed(1)+'" lengthAdjust="spacingAndGlyphs">'+TITLE_TH+'</text>'+
 '<text x="'+(w/2)+'" y="'+(h*.85).toFixed(1)+'" text-anchor="middle" font-family="Georgia, Arial, serif" font-weight="800" font-size="'+english+'" fill="#fffdf6" stroke="#682333" stroke-width=".45" paint-order="stroke fill" textLength="'+(w*.88).toFixed(1)+'" lengthAdjust="spacingAndGlyphs">'+TITLE_EN+'</text></svg>';
}
function overlay(layer){
 let el=overlays.get(layer);
 if(el)return el;
 el=document.createElement('div');
 el.setAttribute('aria-hidden','true');
 el.className='boyang-mep-world-sign';
 el.style.cssText='position:absolute;display:none;pointer-events:none;overflow:hidden;backface-visibility:hidden;z-index:1;';
 layer.appendChild(el);
 overlays.set(layer,el);
 return el;
}
function position(layer,index){
 const el=overlay(layer);
 const mark=SIGN[index];
 if(!mark){el.style.display='none';return;}
 const bw=layer.offsetWidth,bh=layer.offsetHeight;
 if(!bw||!bh){el.style.display='none';return;}
 const scale=Math.max(bw/IMAGE_W,bh/IMAGE_H);
 const offsetX=(bw-IMAGE_W*scale)/2;
 const offsetY=(bh-IMAGE_H*scale)/2;
 el.style.left=(offsetX+mark.x*scale).toFixed(2)+'px';
 el.style.top=(offsetY+mark.y*scale).toFixed(2)+'px';
 el.style.width=(mark.w*scale).toFixed(2)+'px';
 el.style.height=(mark.h*scale).toFixed(2)+'px';
 el.style.display='block';
 if(el.dataset.scene!==String(index)){
  el.innerHTML=svg(mark);
  el.dataset.scene=String(index);
 }
}
function sync({view,front,back,reverse,index}){
 if(!view||!front||!back)return;
 // No special HUD repositioning or inset. One inscription follows the
 // corresponding transformed scene through walking, turning and crossfades.
 position(front,reverse?index:-1);
 position(back,reverse?Math.min(index+1,9):-1);
 view.classList.remove('mep-sign-close');
}
window.BoyangMEPSignHD={sync,sourceSize:{width:IMAGE_W,height:IMAGE_H}};
})();
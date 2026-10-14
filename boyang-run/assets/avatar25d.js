/* BOYANG RUN — 2.5D painterly schoolchild sprite.
   Layered Canvas2D with hand-drawn shapes, gradients and 8-direction-like projection.
   No 3D renderer, no external libraries, retains BOYANG joystick and wardrobe API. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const defaults={
 male:{gender:'male',shirt:'uniform',bottom:'auto',shoes:'black',hat:'none',bag:'none',glasses:'none'},
 female:{gender:'female',shirt:'uniform',bottom:'auto',shoes:'black',hat:'none',bag:'none',glasses:'none'}
};
let outfit={...defaults.male},previewAngle=180,previewPointer=null;
const state={heading:0,phase:0,moving:false,run:false,jump:0,slide:0,laneX:0,y:0};
const stick={active:false,power:0,heading:0};
const approvedSpritePreview={};
function drawApprovedSprite(c,angle){
 const customized=outfit.gender!=='male'||outfit.shirt!=='uniform'||outfit.bottom!=='auto'||outfit.shoes!=='black'||outfit.hat!=='none'||outfit.bag!=='none'||outfit.glasses!=='none';
 if(customized||!window.BOYANG_SPRITES_25D)return false;
 const rot=(angle%360+360)%360;
 const dir=(rot>=45&&rot<135)?'right':(rot>=135&&rot<225)?'front':(rot>=225&&rot<315)?'left':'back';
 const key='idle_'+(dir==='left'?'right':dir);
 let im=approvedSpritePreview[key];
 if(!im){im=new Image();im.src=window.BOYANG_SPRITES_25D[key];approvedSpritePreview[key]=im;}
 c.clearRect(0,0,420,680);
 if(!im.complete||!im.naturalWidth)return true;
 c.save();c.translate(210,340);if(dir==='left')c.scale(-1,1);
 const hh=580,ww=im.naturalWidth*hh/im.naturalHeight;
 c.drawImage(im,-ww/2,-hh/2,ww,hh);c.restore();
 return true;
}

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const TAU=2*Math.PI;
const api={
 get outfit(){return {...outfit}}, get stick(){return {...stick}},get ready(){return !!gameContext},
 apply,animate,toward(angle){state.heading=(angle%360+360)%360},
 reset(){state.heading=0;stick.active=false;stick.power=0;resetPad()},
 openPreview(){ $('wardrobe')?.classList.remove('hide') },
 closePreview(){ $('wardrobe')?.classList.add('hide') }
};
// Preserve existing game interface while replacing the renderer entirely.
window.Boyang25D=api;
const gameSlot=$('avatar25dSlot'),preview=$('avatarPreview'),oldRunner=$('runner');
let gameCanvas=null,gameContext=null,previewContext=null;
try{
 gameCanvas=document.createElement('canvas');
 gameCanvas.width=420;gameCanvas.height=680;
 gameCanvas.style.cssText='display:block;height:100%;width:auto;max-width:100%;margin:0 auto;pointer-events:none';
 gameCanvas.setAttribute('aria-hidden','true');
 gameContext=gameCanvas.getContext('2d',{alpha:true});
 preview.width=420;preview.height=680;
 previewContext=preview.getContext('2d',{alpha:true});
 if(!gameContext||!previewContext)throw Error('Canvas2D unavailable');
 gameSlot.appendChild(gameCanvas);
 gameSlot.style.display='block';
 oldRunner.style.display='none';
}catch(e){console.warn('BOYANG 2.5D fallback:',e);gameContext=null;gameSlot.style.display='none';oldRunner.style.display='block';}

function gradient(c,x1,y1,x2,y2,stops){
 const g=c.createLinearGradient(x1,y1,x2,y2);
 for(const [at,clr] of stops)g.addColorStop(at,clr);
 return g;
}
function radial(c,x,y,r,colors){
 const g=c.createRadialGradient(x-r*.24,y-r*.29,1,x,y,r);
 for(const [p,v] of colors)g.addColorStop(p,v);
 return g;
}
function path(c,draw,fill,stroke,width=1.7){
 c.beginPath();draw(c);if(fill){c.fillStyle=fill;c.fill()}
 if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke()}
}
function oval(c,x,y,rx,ry,fill,stroke,width=1.6){
 c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);
 if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}
}
function line(c,pts,color,width=2){
 c.beginPath();c.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)c.lineTo(...pts[i]);
 c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
}
function curve(c,coords,color,w=2){
 c.beginPath();c.moveTo(coords[0],coords[1]);
 for(let i=2;i<coords.length;i+=6)c.bezierCurveTo(...coords.slice(i,i+6));
 c.lineWidth=w;c.strokeStyle=color;c.lineCap='round';c.stroke();
}
function rounded(c,x,y,w,h,r,fill,stroke,width=1.5){
 r=Math.min(r,w/2,h/2);path(c,p=>{
  p.moveTo(x+r,y);p.lineTo(x+w-r,y);p.quadraticCurveTo(x+w,y,x+w,y+r);
  p.lineTo(x+w,y+h-r);p.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  p.lineTo(x+r,y+h);p.quadraticCurveTo(x,y+h,x,y+h-r);
  p.lineTo(x,y+r);p.quadraticCurveTo(x,y,x+r,y);
 },fill,stroke,width);
}
const outfits={
 uniform:['#fafaf8','#e2e9ef','#c7d0db'],
 sports:['#69b8d3','#3b90bc','#247ca3'],
 yellow:['#f8d980','#e6b951','#c08d2e'],
 pink:['#f6add2','#e88cb9','#ba6190'],
 blue:['#94bee9','#6798d4','#416da7']
};
const bottoms={shorts:'#344c75',trousers:'#35445f',skirt:'#344c75',sports:'#456b91'};
const shoecolors={black:'#252833',brown:'#795140',white:'#f5f7fc',blue:'#315f9b'};
const bagcolors={navy:'#355b88',black:'#303849',pink:'#da83a9',green:'#4a8874'};
const hatcolors={white:'#f8f4ec',navy:'#345783',yellow:'#f3d47a'};
function leg(c,side,swing,bottom,front){
 c.save();c.translate(side*38,446);c.rotate(swing);
 if(bottom==='trousers'){
  path(c,p=>{p.moveTo(-24,-3);p.lineTo(23,-4);p.bezierCurveTo(26,50,17,100,16,151);
   p.quadraticCurveTo(3,163,-17,151);p.bezierCurveTo(-23,95,-24,49,-24,-3)},gradient(c,-20,0,21,120,[[0,'#506488'],[.55,bottoms.trousers],[1,'#1f2f4b']]),'#273b57',1.2);
  line(c,[[-16,16],[-17,95]],'#667b9b',1);
 }else{
  path(c,p=>{p.moveTo(-17,0);p.quadraticCurveTo(5,0,18,1);p.bezierCurveTo(19,51,17,109,12,154);
   p.quadraticCurveTo(1,161,-13,155);p.bezierCurveTo(-17,110,-17,52,-17,0)},gradient(c,-18,10,21,130,[[0,'#f9ceb2'],[.52,'#eab392'],[1,'#cd9278']]),'#bd8c70',1);
  rounded(c,-16,137,32,28,10,'#fbf7f0','#d6d0d0',1.2);
  line(c,[[-14,144],[13,144]],'#e7e6e4',1.5);
 }
 c.save();c.translate(0,161);
 // Realistic rounded school shoes with reflective upper and low sole.
 const shoe=shoecolors[outfit.shoes]||shoecolors.black;
 oval(c,1,13,27,13,'#171e2a88');
 path(c,p=>{p.moveTo(-23,-9);p.bezierCurveTo(-31,-6,-34,16,-23,21);p.bezierCurveTo(-3,29,26,25,31,16);
  p.bezierCurveTo(30,0,22,-13,-3,-14);p.quadraticCurveTo(-16,-15,-23,-9)},gradient(c,-24,-14,27,24,[[0,'#c3c5cf'],[.1,shoe],[.85,shoe],[1,'#101a25']]),'#232733',2);
 curve(c,[-13,-7,-5,-16,11,-14,21,-5],outfit.shoes==='white'?'#a9afb8':'#ffffff65',2);
 c.restore();c.restore();
}
function drawBag(c,backFacing){
 if(outfit.bag==='none')return;
 const main=bagcolors[outfit.bag]||bagcolors.navy;
 if(!backFacing){
  // Front view: narrow straps show at each shoulder; the rest sits behind the body.
  for(const side of [-1,1]){
   curve(c,[side*73,319,side*104,363,side*89,416,side*86,444],main,15);
   curve(c,[side*74,318,side*95,359,side*83,411,side*84,437],'#dce6fa79',2);
  }
  return;
 }
 path(c,p=>{p.moveTo(-91,328);p.quadraticCurveTo(-113,332,-112,359);p.lineTo(-111,426);
   p.quadraticCurveTo(-107,469,-77,473);p.lineTo(82,473);p.quadraticCurveTo(113,469,114,431);
   p.lineTo(114,366);p.quadraticCurveTo(108,328,88,329);p.quadraticCurveTo(0,300,-91,328)},gradient(c,-110,315,120,466,[[0,'#a9bad397'],[.1,main],[1,'#223956']]),'#273a56',3);
 rounded(c,-83,378,165,70,22,main,'#d8ecf44f',2);
 curve(c,[-59,416,-35,430,35,430,60,416],'#e3f5ff60',3);
 rounded(c,-18,350,35,20,6,'#e5ecf5b5',null);
}
function arms(c,side,walk,shirt,front){
 const elbow=side*95;
 c.save();c.translate(side*82,326);c.rotate(side*.09+walk);
 // Short sleeve tailored and curving toward elbow.
 path(c,p=>{p.moveTo(-side*25,-16);p.quadraticCurveTo(side*9,-28,side*26,-9);
  p.quadraticCurveTo(side*41,7,side*28,49);p.lineTo(-side*7,52);
  p.quadraticCurveTo(-side*24,15,-side*25,-16)},gradient(c,-30,-30,45,45,[[0,shirt[0]],[.48,shirt[1]],[1,shirt[2]]]),'#8b9fb688',1.5);
 curve(c,[-side*9,43,side*3,51,side*21,52,side*30,44],'#8196b699',1.5);
 path(c,p=>{p.moveTo(-side*7,51);p.quadraticCurveTo(side*12,56,side*26,50);
  p.bezierCurveTo(side*31,88,side*21,123,side*26,149);
  p.quadraticCurveTo(side*18,171,-side*5,165);
  p.quadraticCurveTo(-side*19,153,-side*10,139);
  p.quadraticCurveTo(-side*23,97,-side*7,51)},gradient(c,-23,66,40,166,[[0,'#f9cfb1'],[.5,'#eab69b'],[1,'#c68a70']]),'#cb9a80',1.2);
 oval(c,side*12,161,15,19,'#efbd9e','#d6a187',1);
 c.restore();
}
function body(c,front){
 const cloth=outfits[outfit.shirt]||outfits.uniform;
 // Shirt shoulders, rounded tailoring and curved hem.
 path(c,p=>{p.moveTo(-46,285);p.bezierCurveTo(-70,280,-81,293,-89,319);
  p.bezierCurveTo(-80,356,-79,386,-85,427);
  p.quadraticCurveTo(-80,450,-48,451);p.quadraticCurveTo(0,455,49,451);
  p.quadraticCurveTo(85,450,84,426);
  p.bezierCurveTo(78,380,82,349,90,321);
  p.bezierCurveTo(80,294,68,282,46,285);p.quadraticCurveTo(0,303,-46,285)},gradient(c,-85,314,93,444,[[0,cloth[1]],[.25,cloth[0]],[.55,cloth[0]],[1,cloth[2]]]),'#90a3bc',1.6);
 curve(c,[-74,413,-36,431,35,434,74,414],'#a9afc090',1.6);
 // Fabric folds and subtle outline
 curve(c,[-68,335,-61,372,-65,400,-57,426],'#8fa1b344',2);
 curve(c,[66,333,59,366,63,400,55,429],'#7c91aa55',2);
 if(front){
  // Collar points, pocket, buttons.
  path(c,p=>{p.moveTo(-44,286);p.quadraticCurveTo(-14,293,0,306);p.lineTo(-24,338);
   p.lineTo(-58,301);p.closePath()},'#ffffffea','#a5b4c6',1.4);
  path(c,p=>{p.moveTo(44,286);p.quadraticCurveTo(12,294,0,306);p.lineTo(24,338);
   p.lineTo(58,301);p.closePath()},'#ffffffea','#a5b4c6',1.4);
  line(c,[[0,310],[0,438]],'#bac7d2',1.6);
  for(const y of [344,367,390,413])oval(c,0,y,3.1,3.1,'#bdc2c8');
  if(outfit.shirt==='uniform'){
   rounded(c,32,345,31,28,4,'#f9faf9','#bec7cf',1.3);
   line(c,[[35,353],[48,365],[61,353]],'#ced6dc',1);
  }
 }else{
  curve(c,[-48,288,-26,318,22,320,47,290],'#a6b5c899',2);
 }
}
function shorts(c){
 const bottom=outfit.bottom==='auto'?(outfit.gender==='female'?'skirt':'shorts'):outfit.bottom;
 if(bottom==='trousers'||bottom==='skirt')return;
 const col=bottoms[bottom]||bottoms.shorts;
 path(c,p=>{p.moveTo(-78,436);p.lineTo(77,435);p.lineTo(75,500);
 p.quadraticCurveTo(58,506,39,498);p.lineTo(0,491);p.lineTo(-39,498);
 p.quadraticCurveTo(-58,506,-76,500);p.closePath()},gradient(c,-77,445,80,504,[[0,'#526993'],[.5,col],[1,'#233754']]),'#273a5d',2);
 line(c,[[0,448],[0,492]],'#9ab1cf55',2);
 line(c,[[-69,491],[-43,492]],'#b0bfce',1);
 line(c,[[44,493],[68,490]],'#a8b5ce',1);
}
function skirt(c){
 const bottom=outfit.bottom==='auto'?(outfit.gender==='female'?'skirt':'shorts'):outfit.bottom;
 if(bottom!=='skirt')return;
 path(c,p=>{p.moveTo(-74,433);p.quadraticCurveTo(-4,448,75,433);
   p.lineTo(103,508);p.quadraticCurveTo(58,524,0,517);p.quadraticCurveTo(-64,524,-103,508);
   p.closePath()},gradient(c,-100,450,104,520,[[0,'#526a91'],[.45,bottoms.skirt],[1,'#1b2c4c']]),'#1d3050',2.5);
 for(const x of [-78,-51,-25,0,25,51,78]){
  curve(c,[x*.77,443,x*.94,471,x*1.18,492,x*1.12,514],'#bbc7e04a',1.8);
 }
 line(c,[[-77,439],[77,439]],'#1c2b45',3);
}
function head(c,view,blink){
 const faceVisible=view.frontness>.30;
 const side=view.side;
 const faceX=side*13;
 const skin=radial(c,faceX-12,193,134,[[0,'#ffe2c7'],[.65,'#f3c5a6'],[1,'#d5a184']]);
 // Hair rear layer and (for girls) soft pigtails visible on both views.
 oval(c,faceX,177,89,104,gradient(c,-93,85,100,260,[[0,'#4a3b34'],[.45,'#292530'],[1,'#141720']]),'#2b2630',2);
 if(outfit.gender==='female'){
  for(const sideX of [-1,1]){
   path(c,p=>{p.moveTo(faceX+sideX*76,146);p.quadraticCurveTo(faceX+sideX*119,152,faceX+sideX*114,207);
    p.quadraticCurveTo(faceX+sideX*122,260,faceX+sideX*89,285);
    p.quadraticCurveTo(faceX+sideX*65,270,faceX+sideX*77,243);
    p.quadraticCurveTo(faceX+sideX*70,182,faceX+sideX*76,146)},gradient(c,sideX*-10,133,sideX*120,275,[[0,'#51433a'],[.5,'#322b32'],[1,'#181b26']]),'#231d26',1);
   oval(c,faceX+sideX*95,194,13,10,'#536c8c','#d9d7d399',1);
  }
 }
 // Ears, head, shaded chin.
 oval(c,faceX-74,203,18,28,'#e8ad91','#be846f');
 oval(c,faceX+74,203,18,28,'#eab39a','#c18d78');
 path(c,p=>{p.moveTo(faceX-71,152);p.bezierCurveTo(faceX-74,106,faceX-24,103,faceX+6,106);
  p.bezierCurveTo(faceX+73,108,faceX+84,155,faceX+74,217);
  p.bezierCurveTo(faceX+70,260,faceX+27,285,faceX,287);
  p.bezierCurveTo(faceX-34,280,faceX-74,248,faceX-71,200);p.closePath()},skin,'#cb987e',1.6);
 oval(c,faceX-46,228,24,12,'#f3a2a75a');
 oval(c,faceX+47,228,24,12,'#f3a2a75a');
 // Neck and tiny collar shadow.
 if(faceVisible){
  const nearSide=side>0?1:-1;
  const eyes= Math.abs(side)<.58?[-1,1]:[nearSide];
  for(const q of eyes){
   const shift=faceX+q*29+side*7;
   oval(c,shift,199,17.5,Math.max(2,12*(1-.91*blink)), '#fffdf9','#aa7864',1.5);
   if(blink<.8){
    oval(c,shift+side*2,201,9.8,10,'#68483b');
    oval(c,shift+side*2,201,6,7.5,'#211b23');
    oval(c,shift-4,196,3.3,3.5,'white');
   }
   curve(c,[shift-20,183,shift-9,176,shift+9,176,shift+20,183],'#3a2c2b',3);
   curve(c,[shift-16,168,shift-6,165,shift+6,165,shift+17,168],'#504039',3.6);
  }
  // Slight nose profile and gentle smile.
  oval(c,faceX+side*15,220,6,8,'#e0a389');
  curve(c,[faceX-15+side*12,241,faceX-5+side*12,249,faceX+6+side*12,249,faceX+17+side*12,240],'#a85c65',2.6);
  oval(c,faceX,256,14,3,'#ffffff35');
 }
 // Front bangs with many soft layers; on back view hair fills the silhouette.
 if(outfit.gender==='male'){
  path(c,p=>{p.moveTo(faceX-87,174);p.quadraticCurveTo(faceX-86,105,faceX-48,97);
   p.quadraticCurveTo(faceX+6,69,faceX+71,111);
   p.quadraticCurveTo(faceX+96,141,faceX+75,176);
   p.lineTo(faceX+68,150);p.quadraticCurveTo(faceX+15,139,faceX-25,164);
   p.quadraticCurveTo(faceX-58,153,faceX-78,187);p.closePath()},gradient(c,faceX-91,92,faceX+90,186,[[0,'#3f3532'],[.46,'#2a2630'],[1,'#171922']]),'#28222b',1.6);
  curve(c,[faceX-42,118,faceX-10,95,faceX+23,101,faceX+55,123],'#a88d8260',2.7);
  curve(c,[faceX-52,143,faceX-15,127,faceX+12,136,faceX+49,133],'#b09b9060',1.7);
 }else{
  path(c,p=>{p.moveTo(faceX-88,173);p.bezierCurveTo(faceX-93,100,faceX-35,82,faceX+6,85);
   p.bezierCurveTo(faceX+70,83,faceX+95,125,faceX+83,178);
   p.quadraticCurveTo(faceX+53,142,faceX+31,148);
   p.quadraticCurveTo(faceX-10,178,faceX-46,148);
   p.quadraticCurveTo(faceX-67,154,faceX-88,173)},gradient(c,faceX-87,93,faceX+89,181,[[0,'#51423d'],[.47,'#302832'],[1,'#1a1c27']]),'#242029',1.5);
  curve(c,[faceX-28,119,faceX+4,138,faceX+16,139,faceX+46,128],'#93796d70',2.4);
 }
 if(!faceVisible){
  // Back of the head: no facial features; gives a clear 2.5D rear viewpoint.
  oval(c,faceX,187,73,75,gradient(c,faceX-75,112,faceX+85,253,[[0,'#453730'],[.55,'#28252e'],[1,'#171922']]));
  for(const x of [-45,-23,0,24,45])curve(c,[faceX+x,133,faceX+x+7,163,faceX+x-3,206,faceX+x-9,242],'#a88c7b30',1.4);
 }
}
function glasses(c,view){
 if(outfit.glasses==='none'||view.frontness<=.30)return;
 const tone=outfit.glasses==='blue'?'#316ba7':'#2e323b';
 const side=view.side;
 const faceX=side*13;
 c.save();
 for(const x of [-32,32]){
  oval(c,faceX+x+side*7,201,24,18,'#b6e8ff17',tone,4);
 }
 curve(c,[faceX-8,195,faceX-2,191,faceX+3,191,faceX+8,195],tone,4);
 line(c,[[faceX-58,194],[faceX-73,189]],tone,3);
 line(c,[[faceX+58,194],[faceX+73,189]],tone,3);
 c.restore();
}
function hat(c){
 if(outfit.hat==='none')return;
 const hc=hatcolors[outfit.hat]||hatcolors.white;
 path(c,p=>{p.moveTo(-67,113);p.quadraticCurveTo(-77,66,-47,40);
   p.quadraticCurveTo(1,9,50,40);p.quadraticCurveTo(77,69,68,113);
   p.closePath()},gradient(c,-67,48,75,116,[[0,'#ffffffb0'],[.35,hc],[1,'#8e9baf']]),'#748496',2);
 oval(c,0,111,97,18,gradient(c,-98,105,98,135,[[0,'#e4e4d9'],[.48,hc],[1,'#6c809f']]),'#65758a',2);
 rounded(c,-18,90,36,12,4,'#eaeef080');
}
function avatar(c,heading,phase,moving,run,now){
 c.clearRect(0,0,420,680);
 const yaw=(heading%360+360)%360,rad=yaw*Math.PI/180;
 const frontness=(1-Math.cos(rad))/2,side=Math.sin(rad);
 const backFacing=frontness<.5,view={frontness,side,backFacing};
 const stride=moving?Math.sin(phase*2.15)*(run?.27:.18):0;
 const bob=moving?Math.abs(Math.sin(phase*2.15))*2.5:Math.sin(now*.002)*.7;
 const blinkTime=(now/1000+1)%4.1;
 const blink=blinkTime<.16?Math.sin(blinkTime/.16*Math.PI):0;
 c.save();c.translate(210,4+bob);
 // 2.5D view projection: silhouette narrows in profile and accessories change depth order.
 c.scale(.70+.30*Math.abs(Math.cos(rad)),1);
 if(!backFacing)drawBag(c,false);
 leg(c,-1,stride,outfit.bottom,frontness);
 leg(c,1,-stride,outfit.bottom,frontness);
 // Arms are behind the shirt when facing the camera and ahead when viewed from the back.
 if(!backFacing){arms(c,-1,-stride*(.75),outfits[outfit.shirt]||outfits.uniform,true);arms(c,1,stride*.75,outfits[outfit.shirt]||outfits.uniform,true)}
 body(c,!backFacing);
 if(backFacing){arms(c,-1,-stride*.75,outfits[outfit.shirt]||outfits.uniform,false);arms(c,1,stride*.75,outfits[outfit.shirt]||outfits.uniform,false)}
 shorts(c);skirt(c);
 // A subtle neck is visible between body and face.
 rounded(c,-15,278,30,32,12,'#eec0a2','#c68d75');
 head(c,view,blink);
 if(backFacing)drawBag(c,true);
 glasses(c,view);hat(c);
 c.restore();
}
function animate(info={}){
 Object.assign(state,info);
 if(!gameContext)return;
 const width=$('view').clientWidth;
 const x=clamp((info.laneX||0)*width*.17,-width*.2,width*.2);
 gameSlot.style.transform='translateX(calc(-50% + '+x.toFixed(1)+'px)) translateY('+Number(info.y||0).toFixed(1)+'px)';
}
let pointerId=null;
function setPad(e){
 const pad=$('joystick'),b=pad.getBoundingClientRect();
 const dx=(e.clientX-b.left-b.width/2)/(b.width*.38);
 const dy=(b.top+b.height/2-e.clientY)/(b.height*.38);
 const r=Math.hypot(dx,dy),power=Math.min(1,r);
 stick.power=power;stick.active=power>.12;
 if(stick.active)stick.heading=(Math.atan2(dx,dy)*180/Math.PI+360)%360;
 const k=$('joyKnob');
 if(k){k.style.transform='translate('+(r?38*dx/r*power:0).toFixed(1)+'px,'+(r?-38*dy/r*power:0).toFixed(1)+'px)'}
 $('joyAngle').textContent='ทิศ '+Math.round(stick.heading)+'°';
}
function resetPad(){if($('joyKnob'))$('joyKnob').style.transform='translate(0,0)'}
function bindJoystick(){
 const pad=$('joystick');if(!pad)return;
 pad.addEventListener('pointerdown',e=>{e.preventDefault();pointerId=e.pointerId;
   try{pad.setPointerCapture(pointerId)}catch(_){}
   setPad(e)});
 pad.addEventListener('pointermove',e=>{if(pointerId===e.pointerId)setPad(e)});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])
  pad.addEventListener(type,e=>{if(pointerId!==e.pointerId)return;pointerId=null;stick.active=false;stick.power=0;resetPad()});
 window.addEventListener('blur',()=>{pointerId=null;stick.active=false;stick.power=0;resetPad()});
}
function save(){
 try{localStorage.setItem('boyang-avatar-outfit-v1',JSON.stringify(outfit))}catch(_){}
}
function apply(changes={}){
 if(changes.gender && changes.gender!==outfit.gender && defaults[changes.gender]){
   outfit={...defaults[changes.gender]};
 }
 for(const key of ['shirt','bottom','shoes','hat','bag','glasses'])
   if(changes[key]!==undefined && $('outfit-'+key)?.querySelector('option[value="'+changes[key]+'"]'))outfit[key]=changes[key];
 save();return {...outfit};
}
function wardrobe(){
 try{
  const old=JSON.parse(localStorage.getItem('boyang-avatar-outfit-v1')||'null');
  if(old&&defaults[old.gender]){outfit={...defaults[old.gender]};apply(old)}
 }catch(_){}
 const categories=['shirt','bottom','shoes','hat','bag','glasses'];
 function sync(){
  for(const btn of document.querySelectorAll('[data-gender]')){
   const chosen=btn.dataset.gender===outfit.gender;
   btn.classList.toggle('active',chosen);btn.setAttribute('aria-pressed',String(chosen));
  }
  for(const k of categories){const e=$('outfit-'+k);if(e&&e.querySelector('option[value="'+outfit[k]+'"]'))e.value=outfit[k]}
 }
 for(const btn of document.querySelectorAll('[data-gender]'))btn.addEventListener('click',()=>{
  outfit={...defaults[btn.dataset.gender]};save();sync()
 });
 for(const k of categories)$('outfit-'+k)?.addEventListener('change',e=>{apply({[k]:e.target.value});sync()});
 $('outfitReset')?.addEventListener('click',()=>{outfit={...defaults[outfit.gender]};save();sync()});
 sync();
 if(preview){
  preview.style.touchAction='none';
  preview.setAttribute('title','ลากตัวละครเพื่อหมุนดูด้านหน้า ด้านข้าง และด้านหลัง');
  preview.addEventListener('pointerdown',e=>{previewPointer={id:e.pointerId,x:e.clientX,angle:previewAngle};
   try{preview.setPointerCapture(e.pointerId)}catch(_){}});
  preview.addEventListener('pointermove',e=>{
   if(!previewPointer||e.pointerId!==previewPointer.id)return;
   previewAngle=(previewPointer.angle+(e.clientX-previewPointer.x)*1.4+720)%360;
  });
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])preview.addEventListener(ev,e=>{
   if(previewPointer&&previewPointer.id===e.pointerId)previewPointer=null;
  });
 }
 const label=$('wardrobeEngine');if(label)label.textContent='ภาพ 2.5D · ลากตัวละครเพื่อหมุนดูรอบตัว';
 const tag=document.querySelector('.wardrobeTop .choiceTag');
 if(tag)tag.textContent='BOYANG RUN · CHARACTER 2.5D';
}
function loop(now){
 requestAnimationFrame(loop);
 if(document.hidden)return;
 if(gameContext)avatar(gameContext,state.heading,state.phase,state.moving,state.run,now);
 if(previewContext && !$('wardrobe').classList.contains('hide')){
  if(!drawApprovedSprite(previewContext,previewAngle))avatar(previewContext,previewAngle,0,false,false,now);
 }
}
bindJoystick();wardrobe();
if(gameContext)requestAnimationFrame(loop);
})();
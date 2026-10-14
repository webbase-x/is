/* BOYANG RUN: 2.5D sprite navigation only. No wardrobe or alternative avatar renderer. */
(()=>{'use strict';
 const joystick=document.getElementById('joystick');
 const knob=document.getElementById('joyKnob');
 const text=document.getElementById('joyAngle');
 const stick={active:false,power:0,heading:0};
 let pointer=null;
 function release(){
   pointer=null;stick.active=false;stick.power=0;
   if(knob)knob.style.transform='translate(0px,0px)';
 }
 function update(e){
   const box=joystick.getBoundingClientRect();
   const dx=(e.clientX-(box.left+box.width/2))/(box.width*.38);
   const dy=((box.top+box.height/2)-e.clientY)/(box.height*.38);
   const size=Math.hypot(dx,dy);
   stick.power=Math.min(1,size);
   stick.active=stick.power>.12;
   if(stick.active)stick.heading=(Math.atan2(dx,dy)*180/Math.PI+360)%360;
   const x=size?38*dx/size*stick.power:0;
   const y=size?-38*dy/size*stick.power:0;
   if(knob)knob.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
   if(text)text.textContent='ทิศ '+Math.round(stick.heading)+'°';
 }
 if(joystick){
  joystick.style.touchAction='none';
  joystick.addEventListener('pointerdown',e=>{
    e.preventDefault();pointer=e.pointerId;
    try{joystick.setPointerCapture(pointer)}catch(_){}update(e);
  });
  joystick.addEventListener('pointermove',e=>{if(pointer===e.pointerId)update(e)});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])
   joystick.addEventListener(name,e=>{if(pointer===e.pointerId)release()});
  window.addEventListener('blur',release);
 }
 window.Boyang25D={
  get stick(){return {...stick}},
  toward(a){if(Number.isFinite(a))stick.heading=(a%360+360)%360},
  reset(){release();stick.heading=0;if(text)text.textContent='ทิศ 0°'},
 };
})();
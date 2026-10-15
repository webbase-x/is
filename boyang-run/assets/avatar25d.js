/* BOYANG RUN — unified 2.5D analog joystick.
   One control steers in 360 degrees and determines walking/running speed.
   No wardrobe, separate run button, or alternative avatar renderer. */
(()=>{'use strict';
 const joystick=document.getElementById('joystick');
 const dial=document.getElementById('joyDial');
 const knob=document.getElementById('joyKnob');
 const status=document.getElementById('joyAngle');
 const stick={active:false,power:0,heading:0,run:false};
 const WALK_THRESHOLD=.71,DEAD_ZONE=.12;
 let pointer=null;
 function label(){
   if(!status)return;
   const mode=!stick.active?'● หยุด':stick.run?'● วิ่ง':'● เดิน';
   status.textContent=mode+' · '+Math.round(stick.heading)+'°';
 }
 function release(){
   pointer=null;stick.active=false;stick.power=0;stick.run=false;
   if(knob)knob.style.transform='translate3d(0,0,0)';
   joystick?.classList.remove('moving','running');
   label();
 }
 function update(e){
   const box=dial.getBoundingClientRect();
   const x=e.clientX-(box.left+box.width/2);
   const y=(box.top+box.height/2)-e.clientY;
   const length=Math.hypot(x,y);
   const radius=Math.max(22,Math.min(box.width,box.height)*.35);
   stick.power=Math.min(1,length/radius);
   stick.active=stick.power>DEAD_ZONE;
   stick.run=stick.active&&stick.power>=WALK_THRESHOLD;
   if(stick.active)stick.heading=(Math.atan2(x,y)*180/Math.PI+360)%360;
   const travel=radius*Math.min(1,stick.power);
   const tx=length?travel*x/length:0,ty=length?-travel*y/length:0;
   if(knob)knob.style.transform='translate3d('+tx.toFixed(1)+'px,'+ty.toFixed(1)+'px,0)';
   joystick?.classList.toggle('moving',stick.active);
   joystick?.classList.toggle('running',stick.run);
   label();
 }
 if(joystick&&dial){
   joystick.style.touchAction='none';
   joystick.addEventListener('pointerdown',e=>{
     if(pointer!==null)return;
     e.preventDefault();
     pointer=e.pointerId;
     try{joystick.setPointerCapture(pointer)}catch(_){}
     update(e);
   });
   joystick.addEventListener('pointermove',e=>{if(pointer===e.pointerId)update(e)});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])
     joystick.addEventListener(type,e=>{if(pointer===e.pointerId)release()});
   window.addEventListener('blur',release);
   document.addEventListener('visibilitychange',()=>{if(document.hidden)release()});
 }
 window.Boyang25D={
   get stick(){return {...stick}},
   toward(a){if(Number.isFinite(a)){stick.heading=(a%360+360)%360;label()}},
   stop:release,
   reset(){release();stick.heading=0;label()}
 };
 label();
})();
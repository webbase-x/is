/* BOYANG RUN — student avatar, outfit builder, and 360-degree steering.
 * True WebGL geometry renders over the existing photo-based 2.5D route.
 * If 3D/WebGL is unavailable the original runner image remains visible. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const outfits={
  male:{gender:'male',shirt:'uniform',bottom:'auto',shoes:'black',hat:'none',bag:'none',glasses:'none'},
  female:{gender:'female',shirt:'uniform',bottom:'auto',shoes:'black',hat:'none',bag:'none',glasses:'none'}
};
let outfit={...outfits.male},THREE=null,scene=null,model=null,gameRenderer=null,previewRenderer=null;
let gameCamera=null,previewCamera=null,parts={},alive=true,lastWidth=0,lastHeight=0,lastPreviewWidth=0,lastPreviewHeight=0;
const state={heading:0,phase:0,moving:false,run:false,jump:0,slide:0,laneX:0,y:0,mode:'idle'};
const stick={active:false,power:0,heading:0};
const api={
  get outfit(){return {...outfit}},get stick(){return {...stick}},
  get ready(){return !!gameRenderer},
  apply,animate,toward(angle){state.heading=((angle%360)+360)%360;},reset(){state.heading=0;stick.active=false;stick.power=0;resetPad();},
  openPreview(){if($('wardrobe'))$('wardrobe').classList.remove('hide');},
  closePreview(){if($('wardrobe'))$('wardrobe').classList.add('hide');}
};
window.Boyang3D=api;
function color(v){return new THREE.Color(v)}
function mat(c,extra={}){return new THREE.MeshStandardMaterial({color:c,roughness:.82,metalness:0,...extra})}
function mesh(parent,g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o}
function box(parent,w,h,d,m,x=0,y=0,z=0){return mesh(parent,new THREE.BoxGeometry(w,h,d),m,x,y,z)}
function sphere(parent,r,m,x=0,y=0,z=0){return mesh(parent,new THREE.SphereGeometry(r,20,14),m,x,y,z)}
function limb(parent,m,x,y,z,w,h,d){return box(parent,w,h,d,m,x,y,z)}
function makeAvatar(){
  const skin=mat('#e4b38d'),hair=mat('#19212c'),eyes=mat('#1c2637'),white=mat('#f8f8f4'),navy=mat('#182d55');
  const root=new THREE.Group(),body=new THREE.Group();
  root.add(body); scene.add(root);parts={root,body,skin,hair,white,navy};
  // Positive Z is the front of the student's body; rotate the whole figure for heading.
  const leftLeg=new THREE.Group(),rightLeg=new THREE.Group();
  leftLeg.position.set(-.22,1.07,0);rightLeg.position.set(.22,1.07,0);
  body.add(leftLeg,rightLeg);parts.leftLeg=leftLeg;parts.rightLeg=rightLeg;
  for(const leg of [leftLeg,rightLeg]){
    limb(leg,skin,0,-.39,0,.22,.48,.24);
    const ankle=box(leg,.20,.22,.21,white,0,-.65,0);
    box(leg,.30,.17,.48,navy,0,-.83,.10);
    leg.userData.sock=ankle;leg.userData.shoe=leg.children[2];
  }
  const torso=box(body,.82,1,.42,white,0,1.72,0);parts.shirt=torso;
  const neck=box(body,.20,.20,.19,skin,0,2.30,0);
  const collarL=box(body,.32,.11,.04,navy,-.19,2.19,.232),collarR=box(body,.32,.11,.04,navy,.19,2.19,.232);
  collarL.rotation.z=-.31;collarR.rotation.z=.31;
  parts.collar=[collarL,collarR];
  const leftArm=new THREE.Group(),rightArm=new THREE.Group();
  leftArm.position.set(-.52,2.11,0);rightArm.position.set(.52,2.11,0);
  body.add(leftArm,rightArm);parts.leftArm=leftArm;parts.rightArm=rightArm;
  for(const [arm,sign] of [[leftArm,-1],[rightArm,1]]){
    box(arm,.23,.46,.28,white,sign*.025,-.23,0);
    box(arm,.19,.43,.20,skin,sign*.037,-.65,0);
  }
  const head=sphere(body,.36,skin,0,2.67,0);
  head.scale.set(.90,1.06,.91);parts.head=head;
  const hairCap=sphere(body,.35,hair,0,2.85,-.028);
  hairCap.scale.set(1.02,.51,1.0);parts.hairCap=hairCap;
  for(const side of [-1,1])sphere(body,.078,skin,side*.32,2.64,0);
  sphere(body,.035,eyes,-.13,2.69,.318);
  sphere(body,.035,eyes,.13,2.69,.318);
  sphere(body,.07,skin,0,2.57,.343).scale.set(.70,.62,.75);
  const smile=mesh(body,new THREE.TorusGeometry(.095,.011,6,20,Math.PI),mat('#934b4b'),0,2.49,.338);
  smile.rotation.z=Math.PI;
  // Pants, skirt and gym shorts are swapped as independent uniform pieces.
  parts.bottomShort=box(body,.79,.42,.43,navy,0,1.10,0);
  parts.bottomPants=[
    box(leftLeg,.27,.57,.31,navy,0,-.34,0),
    box(rightLeg,.27,.57,.31,navy,0,-.34,0)
  ];
  parts.skirt=mesh(body,new THREE.CylinderGeometry(.44,.56,.72,20,1),navy,0,1.00,0);
  parts.hat=new THREE.Group();body.add(parts.hat);
  const hatCrown=mesh(parts.hat,new THREE.CylinderGeometry(.29,.34,.35,20),white,0,3.05,0);
  const brim=mesh(parts.hat,new THREE.CylinderGeometry(.43,.43,.035,20),white,0,2.91,.12);
  parts.hatPieces=[hatCrown,brim];
  parts.bag=new THREE.Group();body.add(parts.bag);
  box(parts.bag,.73,.89,.27,navy,0,1.67,-.35);
  for(const x of [-.27,.27])box(parts.bag,.11,.93,.09,navy,x,1.72,-.22);
  parts.glasses=new THREE.Group();body.add(parts.glasses);
  const frameMat=mat('#1e293b',{metalness:.25});
  for(const x of [-.15,.15]){
    const ring=mesh(parts.glasses,new THREE.TorusGeometry(.135,.022,8,24),frameMat,x,2.68,.34);
    ring.scale.y=.84;
  }
  box(parts.glasses,.08,.027,.025,frameMat,0,2.68,.34);
  parts.frameMat=frameMat;
  return root;
}
function apply(v={}){
  if(v.gender && v.gender!==outfit.gender)outfit={...outfits[v.gender]};
  for(const key of ['shirt','bottom','shoes','hat','bag','glasses'])if(v[key]!==undefined)outfit[key]=v[key];
  // Keep the selection available after refreshing the page, when storage is permitted.
  try{localStorage.setItem('boyang-avatar-outfit-v1',JSON.stringify(outfit))}catch(_){}
  if(!THREE||!model)return;
  const shirtColors={uniform:'#f6f7f6',sports:'#3ea0bc',yellow:'#f4cc62',pink:'#ef95bc',blue:'#5286d3'};
  const shortColors={auto:'#182d55',shorts:'#182d55',trousers:'#263958',skirt:'#1a325d',sports:'#263c64'};
  parts.shirt.material.color.set(shirtColors[outfit.shirt]||shirtColors.uniform);
  for(const arm of [parts.leftArm,parts.rightArm])arm.children[0].material.color.set(shirtColors[outfit.shirt]||shirtColors.uniform);
  const bottom=outfit.bottom==='auto'?(outfit.gender==='female'?'skirt':'shorts'):outfit.bottom;
  parts.skirt.visible=bottom==='skirt';parts.bottomShort.visible=(bottom==='shorts'||bottom==='sports');
  for(const o of parts.bottomPants)o.visible=bottom==='trousers';
  const bottomColor=shortColors[bottom]||shortColors.auto;
  parts.skirt.material.color.set(bottomColor);parts.bottomShort.material.color.set(bottomColor);
  for(const p of parts.bottomPants)p.material.color.set(bottomColor);
  const shoeColor={black:'#19212a',brown:'#66432d',white:'#edf1f6',blue:'#2a62a4'}[outfit.shoes]||'#19212a';
  for(const leg of [parts.leftLeg,parts.rightLeg])leg.userData.shoe.material.color.set(shoeColor);
  parts.hat.visible=outfit.hat!=='none';
  const hatColor={white:'#f9f7f2',navy:'#264474',yellow:'#edcc6d'}[outfit.hat]||'#f9f7f2';
  for(const p of parts.hatPieces)p.material.color.set(hatColor);
  parts.bag.visible=outfit.bag!=='none';
  const bagColor={navy:'#234a76',pink:'#da70a5',black:'#29313d',green:'#34765c'}[outfit.bag]||'#234a76';
  for(const p of parts.bag.children)p.material.color.set(bagColor);
  parts.glasses.visible=outfit.glasses!=='none';
  parts.frameMat.color.set(outfit.glasses==='blue'?'#3376c7':'#242930');
  // Character customization is not tied to either gender: pants and skirts remain selectable for all.
  parts.hairCap.scale.y=outfit.gender==='female'?.58:.48;
}
function setupRenderers(T){
  THREE=T;
  const glSlot=$('avatar3dSlot'),preview=$('avatarPreview');
  if(!glSlot||!preview)throw new Error('missing avatar view');
  gameRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  gameRenderer.setPixelRatio(Math.min(1.6,window.devicePixelRatio||1));
  gameRenderer.setClearColor(0,0);
  gameRenderer.domElement.setAttribute('aria-hidden','true');
  glSlot.appendChild(gameRenderer.domElement);
  previewRenderer=new THREE.WebGLRenderer({canvas:preview,alpha:true,antialias:true,powerPreference:'low-power'});
  previewRenderer.setPixelRatio(Math.min(1.6,window.devicePixelRatio||1));
  previewRenderer.setClearColor(0,0);
  scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff','#8c9bb5',2.25));
  const light=new THREE.DirectionalLight('#ffffff',2.25);
  light.position.set(-3,7,6);scene.add(light);
  const rim=new THREE.DirectionalLight('#c0eaff',1.05);rim.position.set(5,3,-5);scene.add(rim);
  model=makeAvatar();
  gameCamera=new THREE.PerspectiveCamera(32,1,.1,50);
  gameCamera.position.set(0,2.0,7.2);gameCamera.lookAt(0,1.52,0);
  previewCamera=new THREE.PerspectiveCamera(36,1,.1,50);
  previewCamera.position.set(0,1.9,6.4);previewCamera.lookAt(0,1.56,0);
  apply();
  $('runner').style.display='none';
  glSlot.style.display='block';
}
function size(){
  if(!gameRenderer)return;
  const a=$('avatar3dSlot').getBoundingClientRect();
  const width=Math.round(a.width),height=Math.round(a.height);
  if(width>0&&height>0&&(lastWidth!==width||lastHeight!==height)){
    gameRenderer.setSize(width,height,false);gameCamera.aspect=width/height;gameCamera.updateProjectionMatrix();
    lastWidth=width;lastHeight=height;
  }
  const p=$('avatarPreview').getBoundingClientRect(),pw=Math.round(p.width),ph=Math.round(p.height);
  if(pw>0&&ph>0&&(pw!==lastPreviewWidth||ph!==lastPreviewHeight)){
    previewRenderer.setSize(pw,ph,false);previewCamera.aspect=pw/ph;previewCamera.updateProjectionMatrix();
    lastPreviewWidth=pw;lastPreviewHeight=ph;
  }
}
let lastTime=performance.now();
function draw(t){
  if(!alive)return;requestAnimationFrame(draw);
  if(!gameRenderer)return;
  size();const time=t/1000;
  const stride=state.moving?Math.sin(state.phase*2.1)*(state.run?.52:.35):0;
  parts.leftLeg.rotation.x=stride;
  parts.rightLeg.rotation.x=-stride;
  parts.leftArm.rotation.x=-stride*.65;
  parts.rightArm.rotation.x=stride*.65;
  parts.body.position.y=Math.max(0,state.jump)*.32-Math.max(0,state.slide)*.30+(state.moving?Math.abs(Math.sin(state.phase*2.1))*.045:Math.sin(time*2)*.013);
  parts.body.scale.y=state.slide? .84:1;
  model.rotation.y=Math.PI-state.heading*Math.PI/180;
  // The same mesh is rendered with an independent camera to preview the outfit.
  gameRenderer.render(scene,gameCamera);
  if(!$('wardrobe').classList.contains('hide')){
    const previous=model.rotation.y;model.rotation.y=Math.sin(time*.7)*.43;
    previewRenderer.render(scene,previewCamera);
    model.rotation.y=previous;
  }
  lastTime=t;
}
function animate(info={}){
  Object.assign(state,info);
  if(!gameRenderer)return;
  const view=$('view'),slot=$('avatar3dSlot'),W=view.clientWidth;
  const px=Math.max(-W*.2,Math.min(W*.2,(info.laneX||0)*W*.17));
  slot.style.transform='translateX(calc(-50% + '+px.toFixed(1)+'px)) translateY('+((info.y||0).toFixed(1))+'px)';
}
function setPadPointer(e){
  const wrap=$('joystick'),rect=wrap.getBoundingClientRect();
  const dx=(e.clientX-(rect.left+rect.width/2))/(rect.width*.38);
  const dy=((rect.top+rect.height/2)-e.clientY)/(rect.height*.38);
  const magnitude=Math.hypot(dx,dy),power=Math.min(1,magnitude);
  stick.power=power;stick.active=power>.12;
  if(stick.active)stick.heading=((Math.atan2(dx,dy)*180/Math.PI)%360+360)%360;
  const x=(magnitude?dx/magnitude:0)*power*38;
  const y=(magnitude?-dy/magnitude:0)*power*38;
  $('joyKnob').style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
  $('joyAngle').textContent='ทิศ '+Math.round(stick.heading)+'°';
}
function resetPad(){const k=$('joyKnob');if(k)k.style.transform='translate(0,0)'}
function initJoystick(){
  const pad=$('joystick');if(!pad)return;
  let pid=null;
  pad.addEventListener('pointerdown',e=>{e.preventDefault();pid=e.pointerId;try{pad.setPointerCapture(pid)}catch(_){}setPadPointer(e)});
  pad.addEventListener('pointermove',e=>{if(e.pointerId===pid)setPadPointer(e)});
  for(const name of ['pointerup','pointercancel','lostpointercapture']){
    pad.addEventListener(name,e=>{if(pid===null||e.pointerId!==pid)return;pid=null;stick.active=false;stick.power=0;resetPad()});
  }
  window.addEventListener('blur',()=>{stick.active=false;stick.power=0;resetPad()});
}
function initWardrobe(){
  try{const stored=JSON.parse(localStorage.getItem('boyang-avatar-outfit-v1')||'null');
    if(stored&&(stored.gender==='male'||stored.gender==='female')){
      outfit={...outfits[stored.gender]};for(const key of ['shirt','bottom','shoes','hat','bag','glasses'])if(typeof stored[key]==='string')outfit[key]=stored[key];
    }
  }catch(_){}
  const controls=['shirt','bottom','shoes','hat','bag','glasses'];
  function sync(){
    for(const b of document.querySelectorAll('[data-gender]')){
      const selected=b.dataset.gender===outfit.gender;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));
    }
    for(const k of controls)if($('outfit-'+k))$('outfit-'+k).value=outfit[k];
  }
  for(const b of document.querySelectorAll('[data-gender]'))b.addEventListener('click',()=>{
    outfit={...outfits[b.dataset.gender]};sync();apply(outfit);
  });
  for(const k of controls)$('outfit-'+k)?.addEventListener('change',e=>{apply({[k]:e.target.value});sync()});
  $('outfitReset')?.addEventListener('click',()=>{outfit={...outfits[outfit.gender]};sync();apply(outfit)});
  sync();
}
initJoystick();initWardrobe();
import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js')
  .then(T=>{setupRenderers(T);requestAnimationFrame(draw)})
  .catch(err=>{
    console.warn('[BOYANG] 3D renderer unavailable, using 2D fallback',err);
    const note=$('wardrobeEngine');
    if(note)note.textContent='อุปกรณ์นี้ยังโหลด 3D ไม่ได้ · ใช้ภาพนักเรียนสำรอง';
  });
})();
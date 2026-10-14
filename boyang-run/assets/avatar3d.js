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
  /* Smooth semi-realistic primary-school pupil. No box limbs or block-shaped face.
     All shapes are true 3D geometry, so the same character can be viewed from any angle. */
  const skin=mat('#efbd9c',{roughness:.76}),skinLight=mat('#ffd0ad',{roughness:.69});
  const hair=mat('#222027',{roughness:.95}),hairLight=mat('#302a30',{roughness:.88});
  const whites=mat('#fffdf8',{roughness:.28}),iris=mat('#4b332b',{roughness:.32});
  const black=mat('#19191f',{roughness:.38}),glint=new THREE.MeshBasicMaterial({color:'#ffffff'});
  const blush=mat('#ec9fa3',{roughness:1,transparent:true,opacity:.24,depthWrite:false});
  const lip=mat('#a35760',{roughness:.78}),uniform=mat('#f6f6f1',{roughness:.94});
  const seam=mat('#d3d8db',{roughness:.93}),navy=mat('#263758',{roughness:.94});
  const sole=mat('#24252b',{roughness:.87}),lace=mat('#dadada',{roughness:1});
  const root=new THREE.Group(),body=new THREE.Group();
  scene.add(root);root.add(body);
  parts={root,body,skin,hair,white:uniform,navy,shirtPieces:[],bottomPieces:[],hatPieces:[],bagPieces:[],shoePieces:[]};
  const smoothBall=(p,m,x,y,z,sx,sy,sz)=>{
    const o=mesh(p,new THREE.SphereGeometry(1,24,16),m,x,y,z);
    o.scale.set(sx,sy,sz);return o;
  };
  const tapered=(p,m,x,y,z,rTop,rBottom,h)=>{
    const o=mesh(p,new THREE.CylinderGeometry(rTop,rBottom,h,24,1),m,x,y,z);
    return o;
  };
  const stroke=(p,points,thick,m)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));
    return mesh(p,new THREE.TubeGeometry(curve,Math.max(12,points.length*8),thick,7,false),m);
  };
  // Shoes have soft rounded toes, a separate sole and little highlights.
  const legGroups=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();
    leg.position.set(side*.225,1.13,0);
    body.add(leg);legGroups.push(leg);
    smoothBall(leg,skin,0,-.33,0,.15,.48,.155);
    smoothBall(leg,skinLight,0,-.72,0,.115,.3,.115);
    const sock=smoothBall(leg,uniform,0,-.86,0,.121,.14,.125);
    const shoeGroup=new THREE.Group();leg.add(shoeGroup);
    shoeGroup.position.set(0,-1.05,.12);
    smoothBall(shoeGroup,sole,0,-.025,0,.176,.145,.30);
    smoothBall(shoeGroup,sole,0,.014,.065,.173,.11,.265);
    smoothBall(shoeGroup,lace,0,-.13,.03,.175,.032,.289);
    const upper=smoothBall(shoeGroup,sole,0,.062,-.087,.17,.097,.141);
    const shoeSurface=shoeGroup.children.filter(p=>p.material===sole);
    parts.shoePieces.push(...shoeSurface);
    parts['shoe'+(side<0?'Left':'Right')]=shoeGroup;
    parts['sock'+(side<0?'Left':'Right')]=sock;
    const trouser=tapered(leg,navy,0,-.355,0,.174,.150,.70);
    const seamLine=stroke(leg,[[side*.015,-.03,.176],[side*.015,-.30,.165],[side*.015,-.62,.153]],.007,seam);
    parts.bottomPieces.push(trouser);
    parts['pants'+(side<0?'Left':'Right')]=[trouser,seamLine];
  }
  parts.leftLeg=legGroups[0];parts.rightLeg=legGroups[1];
  // Body is a soft, tailored shirt silhouette rather than a rectangular torso.
  const shirtProfile=[
    [0,1.24],[.34,1.24],[.415,1.29],[.405,1.48],
    [.395,1.72],[.438,1.99],[.405,2.20],[.28,2.235],[0,2.235]
  ].map(p=>new THREE.Vector2(p[0],p[1]));
  const shirt=mesh(body,new THREE.LatheGeometry(shirtProfile,32),uniform);
  shirt.scale.z=.68;
  parts.shirt=shirt;parts.shirtPieces.push(shirt);
  // Subtle hem, breast pocket, buttons and real-shaped collar flaps.
  const hem=tapered(body,seam,0,1.256,0,.410,.413,.018);
  hem.scale.z=.70;
  const pocket=smoothBall(body,uniform,.217,1.87,.281,.116,.122,.024);
  parts.shirtPieces.push(pocket);
  stroke(body,[[.129,1.92,.298],[.217,1.89,.309],[.30,1.92,.298]],.008,seam);
  for(const y of [1.54,1.74,1.94])smoothBall(body,mat('#d4dbe0'),0,y,.280,.018,.018,.012);
  const collarL=smoothBall(body,uniform,-.175,2.185,.161,.176,.115,.047);
  const collarR=smoothBall(body,uniform,.175,2.185,.161,.176,.115,.047);
  collarL.rotation.z=-.37;collarR.rotation.z=.37;
  for(const side of [-1,1]){
    stroke(body,[[side*.075,2.235,.23],[side*.20,2.125,.241],[side*.30,2.17,.20]],.014,navy);
  }
  const neck=tapered(body,skin,0,2.278,0,.115,.120,.25);
  const neckShade=smoothBall(body,skin,0,2.345,0,.13,.10,.13);
  // Arm pivots follow the natural shoulders; curved forearms and fingers swing when walking.
  for(const side of [-1,1]){
    const arm=new THREE.Group();
    arm.position.set(side*.437,2.145,0);
    body.add(arm);
    const shoulder=smoothBall(arm,uniform,side*.026,-.08,0,.19,.23,.21);
    const sleeve=tapered(arm,uniform,side*.027,-.233,0,.183,.151,.36);
    const cuff=tapered(arm,navy,side*.027,-.414,0,.154,.156,.028);
    const elbow=smoothBall(arm,skinLight,side*.028,-.487,0,.128,.107,.133);
    const forearm=smoothBall(arm,skin,side*.029,-.675,0,.127,.233,.132);
    const hand=smoothBall(arm,skinLight,side*.027,-.899,.018,.127,.156,.110);
    smoothBall(arm,skin,side*.147,-.862,.065,.060,.107,.069).rotation.z=-side*.26;
    parts.shirtPieces.push(shoulder,sleeve);
    parts[side<0?'leftArm':'rightArm']=arm;
  }
  // Shorts, tapered trouser legs and a pleated skirt are interchangeable.
  const shortGroup=new THREE.Group();body.add(shortGroup);
  tapered(shortGroup,navy,0,1.205,0,.402,.402,.205).scale.z=.75;
  for(const side of [-1,1]){
    const piece=smoothBall(shortGroup,navy,side*.208,1.028,0,.213,.256,.241);
    stroke(shortGroup,[[side*.20,1.22,.237],[side*.205,1.04,.245],[side*.20,.87,.196]],.007,seam);
    parts.bottomPieces.push(piece);
  }
  parts.bottomShort=shortGroup;
  const skirt=new THREE.Group();body.add(skirt);
  const skirtGeo=new THREE.CylinderGeometry(.382,.574,.615,32,2,false);
  const skirtMain=mesh(skirt,skirtGeo,navy,0,1.025,0);
  skirtMain.scale.z=.78;
  // Tiny soft pleat ridges read as fabric from both front and rear.
  for(let i=0;i<18;i++){
    const angle=i/18*Math.PI*2;
    const x=Math.sin(angle),z=Math.cos(angle);
    stroke(skirt,[[x*.378,1.314,z*.295],[x*.463,1.02,z*.352],[x*.56,.729,z*.426]],.012,navy);
  }
  tapered(skirt,navy,0,1.326,0,.39,.395,.075).scale.z=.79;
  parts.skirt=skirt;parts.bottomPieces.push(skirtMain);
  // Head: soft cheeks, chin, oval face, ears and an expressive but subtle smile.
  const headGroup=new THREE.Group();headGroup.position.set(0,2.755,.026);body.add(headGroup);
  parts.headGroup=headGroup;
  const face=smoothBall(headGroup,skin,0,0,0,.435,.505,.386);
  smoothBall(headGroup,skinLight,0,-.237,.118,.336,.233,.290);
  for(const side of [-1,1]){
    smoothBall(headGroup,skin,side*.419,-.035,-.015,.089,.149,.086);
    smoothBall(headGroup,skinLight,side*.425,-.046,.040,.033,.064,.032);
    smoothBall(headGroup,blush,side*.267,-.135,.307,.110,.075,.017);
    // Almond eye shape with white, iris, pupil and two small catchlights.
    const eyeWhite=smoothBall(headGroup,whites,side*.166,.043,.352,.126,.091,.062);
    const eyeIris=smoothBall(headGroup,iris,side*.160,.043,.409,.061,.069,.020);
    const pupil=smoothBall(headGroup,black,side*.160,.041,.426,.039,.052,.013);
    smoothBall(headGroup,glint,side*.145,.071,.438,.019,.020,.009);
    smoothBall(headGroup,glint,side*.181,.019,.439,.008,.009,.008);
    stroke(headGroup,[[side*.058,.115,.378],[side*.148,.139,.384],[side*.269,.106,.351]],.016,hair);
    stroke(headGroup,[[side*.082,.255,.312],[side*.164,.274,.320],[side*.258,.248,.288]],.017,hairLight);
  }
  smoothBall(headGroup,skinLight,0,-.102,.399,.064,.103,.065);
  smoothBall(headGroup,skin,0,-.182,.433,.079,.039,.041);
  stroke(headGroup,[[-.100,-.253,.348],[-.043,-.278,.379],[0,-.284,.385],[.043,-.278,.379],[.100,-.253,.348]],.012,lip);
  smoothBall(headGroup,skinLight,0,-.310,.361,.092,.018,.027);
  // Both hairstyles are modeled separately; choosing gender changes hair and proportions.
  const hairBase=smoothBall(headGroup,hair,0,.260,-.056,.453,.340,.406);
  const boyHair=new THREE.Group();headGroup.add(boyHair);
  for(let i=0;i<7;i++){
    const x=(i-3)*.111;
    const lock=smoothBall(boyHair,i%2?hair:hairLight,x,.333,.240,.135,.182,.187);
    lock.rotation.z=(3-i)*.20;
  }
  for(const side of [-1,1]){
    smoothBall(boyHair,hair,side*.382,.090,-.135,.115,.208,.216);
  }
  // Girls have softly layered jaw-length hair and two tied-back strands.
  const girlHair=new THREE.Group();headGroup.add(girlHair);
  smoothBall(girlHair,hair,0,-.045,-.185,.449,.490,.326);
  for(const side of [-1,1]){
    const lock=smoothBall(girlHair,hair,side*.383,-.144,-.028,.144,.356,.248);
    lock.rotation.z=side*.10;
    const tie=smoothBall(girlHair,mat('#28466f'),side*.395,-.256,-.242,.065,.055,.061);
    const pony=smoothBall(girlHair,hair,side*.418,-.443,-.240,.137,.239,.162);
    pony.rotation.z=side*.24;
  }
  for(let i=0;i<5;i++){
    const x=(i-2)*.151;
    const fringe=smoothBall(girlHair,i%2?hairLight:hair,x,.298,.287,.14,.171,.130);
    fringe.rotation.z=.27;
  }
  parts.boyHair=boyHair;parts.girlHair=girlHair;
  // Optional brimmed hat with fabric crown.
  const hat=new THREE.Group();headGroup.add(hat);
  const crown=mesh(hat,new THREE.CylinderGeometry(.327,.355,.275,28),uniform,0,.520,0);
  const capTop=smoothBall(hat,uniform,0,.660,0,.33,.074,.33);
  const brim=mesh(hat,new THREE.CylinderGeometry(.475,.475,.033,32),uniform,0,.403,.115);
  parts.hat=hat;parts.hatPieces.push(crown,capTop,brim);
  // Rounded fabric backpack behind the pupil.
  const bag=new THREE.Group();body.add(bag);
  smoothBall(bag,navy,0,1.782,-.424,.391,.535,.211);
  smoothBall(bag,navy,0,1.497,-.605,.318,.173,.070);
  for(const side of [-1,1]){
    stroke(bag,[[side*.274,2.151,-.226],[side*.362,1.758,-.290],[side*.240,1.359,-.344]],.060,navy);
  }
  parts.bag=bag;bag.children.forEach(o=>parts.bagPieces.push(o));
  // Eyewear follows the face during turn animation.
  const glasses=new THREE.Group();headGroup.add(glasses);
  const rim=mat('#303039',{roughness:.45,metalness:.14});
  const lens=mat('#bbdfeb',{roughness:.15,metalness:.03,transparent:true,opacity:.10,depthWrite:false});
  for(const side of [-1,1]){
    const ring=mesh(glasses,new THREE.TorusGeometry(.132,.017,9,32),rim,side*.171,.047,.455);
    ring.scale.y=.74;
    smoothBall(glasses,lens,side*.171,.047,.441,.112,.084,.007);
    stroke(glasses,[[side*.30,.061,.44],[side*.36,.078,.373],[side*.429,.081,.260]],.019,rim);
  }
  stroke(glasses,[[-.040,.063,.456],[0,.080,.474],[.04,.063,.456]],.018,rim);
  parts.glasses=glasses;parts.frameMat=rim;
  // Unique mutable material per clothing/accessory mesh to prevent the skin,
  // piping, pocket, hair and soles changing color unintentionally.
  for(const item of [...parts.shirtPieces,...parts.bottomPieces,...parts.hatPieces,...parts.shoePieces]){
    item.material=item.material.clone();
  }
  // Bag straps are tubes with one material; a copied material enables recoloring.
  for(const item of parts.bagPieces)item.material=item.material.clone();
  return root;
}
function apply(v={}){
  if(v.gender && v.gender!==outfit.gender)outfit={...outfits[v.gender]};
  for(const key of ['shirt','bottom','shoes','hat','bag','glasses'])if(v[key]!==undefined)outfit[key]=v[key];
  try{localStorage.setItem('boyang-avatar-outfit-v1',JSON.stringify(outfit))}catch(_){}
  if(!THREE||!model)return;
  const shirtColors={uniform:'#f8f8f5',sports:'#50afd0',yellow:'#f5d772',pink:'#f49dc1',blue:'#669de0'};
  const bottoms={auto:'#283a5b',shorts:'#283a5b',trousers:'#344663',skirt:'#283b5a',sports:'#385477'};
  const shirtColor=shirtColors[outfit.shirt]||shirtColors.uniform;
  for(const piece of parts.shirtPieces)piece.material.color.set(shirtColor);
  const bottom=outfit.bottom==='auto'?(outfit.gender==='female'?'skirt':'shorts'):outfit.bottom;
  parts.bottomShort.visible=bottom==='shorts'||bottom==='sports';
  parts.skirt.visible=bottom==='skirt';
  for(const leg of [parts.leftLeg,parts.rightLeg]){
    const pantPieces=leg===parts.leftLeg?parts.pantsLeft:parts.pantsRight;
    for(const piece of pantPieces)piece.visible=bottom==='trousers';
  }
  const bottomColor=bottoms[bottom]||bottoms.auto;
  for(const piece of parts.bottomPieces)piece.material.color.set(bottomColor);
  const shoeColor={black:'#20232a',brown:'#784d3c',white:'#f3f5f8',blue:'#346aaf'}[outfit.shoes]||'#20232a';
  for(const piece of parts.shoePieces)piece.material.color.set(shoeColor);
  parts.hat.visible=outfit.hat!=='none';
  const hatColor={white:'#f8f7f5',navy:'#31537a',yellow:'#f4d370'}[outfit.hat]||'#f8f7f5';
  for(const piece of parts.hatPieces)piece.material.color.set(hatColor);
  parts.bag.visible=outfit.bag!=='none';
  const bagColor={navy:'#355581',pink:'#e188b9',black:'#343946',green:'#44876e'}[outfit.bag]||'#355581';
  for(const piece of parts.bagPieces)piece.material.color.set(bagColor);
  parts.glasses.visible=outfit.glasses!=='none';
  parts.frameMat.color.set(outfit.glasses==='blue'?'#397abe':'#272d36');
  parts.boyHair.visible=outfit.gender==='male';
  parts.girlHair.visible=outfit.gender==='female';
  // The head and outfit can be customized independently: skirts/pants for either character.
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
    const previous=model.rotation.y;model.rotation.y=(time*.45)%(Math.PI*2);
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
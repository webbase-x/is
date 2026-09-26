const MODULE='/is/P1/js/classroom.js?v=20260926-icon-tools-2';

function hasJoinHash(){
  const h=new URLSearchParams(location.hash.slice(1));
  return h.has('student')||h.has('room');
}

async function loadClassroom(openAfter=false){
  const lazy=document.getElementById('p1ClassroomLazy');
  if(lazy){lazy.disabled=true;lazy.setAttribute('aria-busy','true')}
  try{
    lazy?.remove();
    await import(MODULE);
    if(openAfter)document.getElementById('p1ClassroomMenu')?.click();
  }catch(error){
    console.error('P1 classroom lazy load:',error);
    if(lazy){
      lazy.disabled=false;
      lazy.removeAttribute('aria-busy');
      lazy.title='ลองเปิดห้องเรียนอีกครั้ง';
    }
  }
}

function installLauncher(){
  if(document.getElementById('p1ClassroomLazy')||document.getElementById('p1ClassroomMenu'))return;
  const top=document.querySelector('.welcome-topbar')||document.querySelector('header');
  if(!top)return;
  const b=document.createElement('button');
  b.id='p1ClassroomLazy';
  b.type='button';
  b.className='home-link p1-classroom-lazy';
  b.textContent='🏫';
  b.setAttribute('aria-label','ห้องเรียน / เครื่องมือครู');
  b.title='ห้องเรียน / เครื่องมือครู';
  b.addEventListener('click',()=>loadClassroom(true),{once:true});
  const home=top.querySelector('.home-link-icon');
  if(home)top.insertBefore(b,home);else top.append(b);
}

if(hasJoinHash()){
  loadClassroom(false);
}else if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',installLauncher,{once:true});
}else{
  installLauncher();
}

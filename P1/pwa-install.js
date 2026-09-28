(() => {
  'use strict';

  const button = document.getElementById('installWebApp');
  const dialog = document.getElementById('webAppInstallDialog');
  const close = document.getElementById('closeWebAppInstall');
  const note = document.getElementById('webAppInstallNote');
  let deferredPrompt = null;

  const standalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function setInstalledState(){
    if(!button) return;
    button.classList.add('is-installed');
    button.innerHTML = '<span aria-hidden="true">✓</span> Web App พร้อมใช้';
    button.setAttribute('aria-label','เปิดใช้งานแบบ Web App แล้ว');
    button.disabled = true;
  }

  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isSafari(){
    return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
  }

  function showGuide(message){
    if(note) note.innerHTML = message;
    if(dialog?.showModal) dialog.showModal();
  }

  async function registerSW(){
    if(!('serviceWorker' in navigator)) return;
    try{
      await navigator.serviceWorker.register('/is/P1/p1-media-sw.js?v=20260928-pwa-1',{scope:'/is/P1/'});
    }catch(error){
      console.warn('P1 Web App service worker:',error);
    }
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt = event;
    if(button && !standalone()){
      button.hidden = false;
      button.classList.add('is-ready');
    }
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt = null;
    setInstalledState();
    try{localStorage.setItem('p1-webapp-installed','1')}catch{}
  });

  button?.addEventListener('click',async()=>{
    if(standalone()){
      setInstalledState();
      return;
    }

    if(deferredPrompt){
      deferredPrompt.prompt();
      try{
        const choice = await deferredPrompt.userChoice;
        if(choice?.outcome === 'accepted') setInstalledState();
      }catch{}
      deferredPrompt = null;
      return;
    }

    if(isIOS()){
      showGuide(
        '<strong>ติดตั้งบน iPhone/iPad</strong><br>' +
        '๑. แตะปุ่ม <b>แชร์</b> ใน Safari<br>' +
        '๒. เลือก <b>เพิ่มไปยังหน้าจอโฮม</b><br>' +
        '๓. แตะ <b>เพิ่ม</b>'
      );
      return;
    }

    showGuide(
      '<strong>ติดตั้ง Web App</strong><br>' +
      'เปิดเมนูของเบราว์เซอร์ แล้วเลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มไปยังหน้าจอหลัก</b>'
    );
  });

  close?.addEventListener('click',()=>dialog?.close());
  dialog?.addEventListener('click',event=>{
    if(event.target === dialog) dialog.close();
  });

  if(standalone()) setInstalledState();
  else if(button){
    button.hidden = false;
    if(isIOS() && !isSafari()) button.title = 'แนะนำให้เปิดด้วย Safari เพื่อติดตั้งบนหน้าจอโฮม';
  }

  if(document.readyState === 'complete') registerSW();
  else window.addEventListener('load',registerSW,{once:true});
})();
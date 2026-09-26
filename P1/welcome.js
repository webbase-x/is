function revealWelcome(){
  document.body.classList.remove('app-loading');
  const screen=document.querySelector('#preloadScreen');
  if(screen){
    screen.setAttribute('aria-busy','false');
    screen.classList.add('preload-complete');
    screen.hidden=true;
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',revealWelcome,{once:true});
}else{
  revealWelcome();
}

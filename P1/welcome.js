const imageAssetVersion = '20260721-2';
const warmAssets = [
  `img/02.png?v=${imageAssetVersion}`,
  'book/unit1-cover.webp',
  'book/unit2-cover.webp',
  'book/unit3-cover.webp'
];

function warmWelcomeCache(){
  warmAssets.forEach(asset=>{
    const img=new Image();
    img.decoding='async';
    img.src=asset;
  });
}

function revealWelcome(){
  document.body.classList.remove('app-loading');
  const screen=document.querySelector('#preloadScreen');
  if(screen){
    screen.setAttribute('aria-busy','false');
    screen.classList.add('preload-complete');
    screen.hidden=true;
  }
  warmWelcomeCache();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',revealWelcome,{once:true});
}else{
  revealWelcome();
}

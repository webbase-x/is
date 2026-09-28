const CACHE_NAME='p1-media-v2';
const SHELL_CACHE='p1-shell-v1';
const MEDIA_RE=/\.(?:webp|png|jpe?g|gif|svg|mp3|m4a|wav|ogg|woff2?|ttf|otf)(?:\?|$)/i;
const APP_SHELL=[
  '/is/P1/',
  '/is/P1/index.html',
  '/is/P1/welcome.css',
  '/is/P1/child-ui.css',
  '/is/P1/welcome.js',
  '/is/P1/child-ui.js',
  '/is/P1/manifest.webmanifest',
  '/is/P1/pwa-install.js',
  '/is/P1/assets/p1-app-icon.svg',
  '/is/P1/assets/p1-thai-learning-cover.webp'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    await Promise.allSettled(APP_SHELL.map(url=>cache.add(url)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>
      (k.startsWith('p1-media-')&&k!==CACHE_NAME)||
      (k.startsWith('p1-shell-')&&k!==SHELL_CACHE)
    ).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type!=='PRECACHE_MEDIA'||!Array.isArray(data.assets))return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    for(const raw of data.assets){
      try{
        const url=new URL(raw,self.location.origin);
        if(url.origin!==self.location.origin)continue;
        const request=new Request(url.href,{credentials:'same-origin'});
        const hit=await cache.match(request);
        if(hit)continue;
        const response=await fetch(request);
        if(response.ok)await cache.put(request,response.clone());
      }catch{}
    }
    event.source?.postMessage?.({type:'PRECACHE_MEDIA_DONE'});
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  let url;
  try{url=new URL(request.url)}catch{return}
  if(url.origin!==self.location.origin)return;
  if(!url.pathname.startsWith('/is/P1/'))return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const shell=await caches.open(SHELL_CACHE);
      try{
        const response=await fetch(request);
        if(response.ok)await shell.put(request,response.clone());
        return response;
      }catch{
        return (await shell.match(request))||
          (await shell.match('/is/P1/index.html'))||
          Response.error();
      }
    })());
    return;
  }

  if(MEDIA_RE.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      const cached=await cache.match(request);
      if(cached)return cached;
      try{
        const response=await fetch(request);
        if(response.ok)cache.put(request,response.clone());
        return response;
      }catch{
        return cached||Response.error();
      }
    })());
  }
});

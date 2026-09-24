const CACHE_NAME='p1-media-v1';
const MEDIA_RE=/\.(?:webp|png|jpe?g|gif|svg|mp3|m4a|wav|ogg|woff2?|ttf|otf)(?:\?|$)/i;

self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('p1-media-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));
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
  if(!MEDIA_RE.test(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(request);
    if(cached)return cached;
    try{
      const response=await fetch(request);
      if(response.ok)cache.put(request,response.clone());
      return response;
    }catch(error){
      return cached||Response.error();
    }
  })());
});

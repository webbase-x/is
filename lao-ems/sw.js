const CACHE_NAME="lao-ems-shell-v0.19.66";
const SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./VERSION",
  "./assets/icon.svg",
  "./assets/css/app.css?v=0.19.66",
  "./assets/js/app.js?v=0.19.66",
  "./assets/js/version.js?v=0.19.66",
  "./assets/js/supabase.js?v=20260927-2",
  "./assets/js/config.js"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("lao-ems-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request,{cache:"no-store"})
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy));
          }
          return response;
        })
        .catch(()=>caches.match("./index.html"))
    );
    return;
  }

  if(!url.pathname.startsWith(new URL("./",self.location.href).pathname))return;

  const isFreshnessCritical=
    url.pathname.endsWith("/VERSION")||
    url.pathname.endsWith("/index.html")||
    url.pathname.endsWith("/assets/js/app.js")||
    url.pathname.endsWith("/assets/js/version.js")||
    url.pathname.endsWith("/assets/css/app.css");

  event.respondWith(
    fetch(request,isFreshnessCritical?{cache:"no-store"}:undefined)
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(request).then(hit=>hit||caches.match(url.pathname.endsWith("/index.html")?"./index.html":request)))
  );
});

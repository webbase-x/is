// Fullscreen book viewer. Prefer the native Fullscreen API; use a fixed
// viewport overlay on browsers such as iOS Safari that cannot fullscreen divs.
export function installBookFullscreen(host, button, {doc=document, win=window}={}){
 if(!host||!button)throw Error("ต้องมีหนังสือและปุ่มเต็มจอ");
 let fallbackOpen=false;
 let savedScroll=0;
 let pending=false;
 let disposed=false;

 const nativeActive=()=>doc.fullscreenElement===host;
 const isExpanded=()=>fallbackOpen||nativeActive();

 function sync(){
  if(disposed)return;
  const active=isExpanded();
  host.classList.toggle("is-book-expanded",active);
  button.setAttribute("aria-pressed",String(active));
  const label=active?"ออกจากเต็มจอ":"ขยายหนังสือเต็มจอ";
  button.setAttribute("aria-label",label);
  button.title=label;
  button.textContent=active?"⤢ ย่อหน้าจอ":"⛶ เต็มจอ";
 }
 function fallbackOn(){
  if(fallbackOpen||disposed)return;
  savedScroll=Number.isFinite(win.scrollY)?win.scrollY:0;
  doc.body.style.setProperty("--book-fallback-scroll",(-savedScroll)+"px");
  doc.body.classList.add("book-fallback-lock");
  fallbackOpen=true;
  sync();
 }
 function fallbackOff(){
  if(!fallbackOpen)return;
  fallbackOpen=false;
  doc.body.classList.remove("book-fallback-lock");
  doc.body.style.removeProperty("--book-fallback-scroll");
  sync();
  if(typeof win.scrollTo==="function")win.scrollTo(0,savedScroll);
 }
 async function close(){
  if(pending)return;
  if(fallbackOpen){fallbackOff();return}
  if(nativeActive()&&typeof doc.exitFullscreen==="function"){
   pending=true;
   try{await doc.exitFullscreen()}
   catch{/* A browser may refuse an exit; keep the state truthful. */}
   finally{pending=false;sync()}
  }
 }
 async function toggle(){
  if(disposed||pending)return;
  if(isExpanded()){await close();return}
  if(typeof host.requestFullscreen==="function"){
   pending=true;
   try{
    // Call directly inside the user-click path to retain user activation.
    await host.requestFullscreen();
    sync();
    return;
   }catch{
    // Unsupported/denied element fullscreen: emulate an immersive viewport.
   }finally{pending=false}
  }
  fallbackOn();
 }
 function onKey(event){
  if(event.key==="Escape"&&fallbackOpen){
   event.preventDefault?.();
   fallbackOff();
  }
 }
 const onChange=()=>sync();
 button.type="button";
 button.addEventListener("click",toggle);
 doc.addEventListener("fullscreenchange",onChange);
 doc.addEventListener("webkitfullscreenchange",onChange);
 win.addEventListener("keydown",onKey);
 sync();
 return {
  isExpanded, toggle, close,
  dispose(){
   if(disposed)return;
   fallbackOff();
   disposed=true;
   button.removeEventListener?.("click",toggle);
   doc.removeEventListener?.("fullscreenchange",onChange);
   doc.removeEventListener?.("webkitfullscreenchange",onChange);
   win.removeEventListener?.("keydown",onKey);
  }
 };
}

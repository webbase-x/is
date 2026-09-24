(() => {
  const MIN_DISTANCE = 54;
  const MAX_DISTANCE = 118;
  const MAX_DURATION = 950;
  const AXIS_RATIO = 1.18;
  const FAST_VELOCITY = 0.42;
  const LOCK_MS = 620;
  let gesture = null;
  let lockUntil = 0;
  let suppressClickUntil = 0;
  let hintTimer = 0;

  const NEXT = ['[data-page-next]:not(:disabled)','#nextActivity:not(:disabled)','#nextStep:not(:disabled)','.next-unit a[href]','a[rel="next"][href]'];
  const PREV = ['[data-page-prev]:not(:disabled)','#previousActivity:not(:disabled)','#prevStep:not(:disabled)','a[rel="prev"][href]'];

  function visible(el){
    if(!el) return false;
    const s=getComputedStyle(el), r=el.getBoundingClientRect();
    return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0;
  }
  function firstVisible(selectors){
    for(const selector of selectors){
      const found=[...document.querySelectorAll(selector)].find(visible);
      if(found) return found;
    }
    return null;
  }
  function allowedBookWord(target){
    return !!target?.closest?.('.book-paper .native-word,.book-paper .karaoke-token,.book-paper .exact-title-token,.book-paper .reading-card');
  }
  function ignored(target){
    if(!(target instanceof Element)) return false;
    if(target.closest('input,textarea,select,option,[contenteditable="true"],audio,video,canvas,dialog[open],.song-karaoke-player,[data-swipe-ignore]')) return true;
    const interactive=target.closest('a,button');
    return !!interactive && !allowedBookWord(target);
  }
  function fallback(direction){
    const path=location.pathname, q=new URLSearchParams(location.search);
    if(/\/P1\/00-prerequisite\/?$/.test(path)) return direction==='next'?'../01-bai-bok-bai-bua/':'../index.html';
    if(/\/P1\/01-bai-bok-bai-bua\/?$/.test(path)) return direction==='next'?'../lesson.html?unit=1':'../00-prerequisite/';
    if(/\/P1\/thai-consonants\.html$/.test(path)) return direction==='next'?'unit1-lesson1.html':'index.html';
    const legacy=path.match(/\/P1\/unit(\d+)-lesson1\.html$/);
    if(legacy){
      const unit=Number(legacy[1]);
      if(direction==='next') return unit<6?`unit${unit+1}-lesson1.html`:'index.html';
      return unit>1?`unit${unit-1}-lesson1.html`:'thai-consonants.html';
    }
    if(/\/P1\/lesson\.html$/.test(path)){
      const unit=Number(q.get('unit')||1);
      if(unit===1 && document.body?.classList.contains('unit1-prototype')) return null;
      if(direction==='next' && unit<12) return `lesson.html?unit=${unit+1}`;
      if(direction==='prev' && unit>1) return `lesson.html?unit=${unit-1}`;
    }
    return null;
  }
  function hint(direction, blocked=false){
    let el=document.getElementById('p1SwipeHint');
    if(!el){ el=document.createElement('div'); el.id='p1SwipeHint'; document.body.appendChild(el); }
    el.textContent=direction==='next'?'›':'‹';
    el.style.left=direction==='prev'?'14px':'auto';
    el.style.right=direction==='next'?'14px':'auto';
    el.classList.toggle('blocked',blocked);
    el.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer=setTimeout(()=>el.classList.remove('show'),320);
  }
  function action(direction){
    if(performance.now()<lockUntil) return false;
    const target=firstVisible(direction==='next'?NEXT:PREV);
    if(target){
      lockUntil=performance.now()+LOCK_MS;
      hint(direction,false);
      target.click();
      return true;
    }
    const href=fallback(direction);
    if(href){
      lockUntil=performance.now()+LOCK_MS;
      hint(direction,false);
      location.href=href;
      return true;
    }
    hint(direction,true);
    lockUntil=performance.now()+250;
    return false;
  }
  function resetVisual(){
    document.body.classList.remove('p1-swipe-tracking');
    document.body.style.removeProperty('--p1-swipe-x');
    document.body.style.removeProperty('--p1-swipe-rot');
  }
  function start(e){
    if(performance.now()<lockUntil) return;
    if(e.pointerType==='mouse' && e.button!==0) return;
    if(ignored(e.target)) return;
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,t:performance.now(),horizontal:false,cancelled:false};
  }
  function move(e){
    const g=gesture; if(!g||g.id!==e.pointerId) return;
    const dx=e.clientX-g.x, dy=e.clientY-g.y;
    g.lastX=e.clientX; g.lastY=e.clientY;
    if(!g.horizontal){
      if(Math.abs(dy)>18 && Math.abs(dy)>Math.abs(dx)*1.28){ g.cancelled=true; resetVisual(); return; }
      if(Math.abs(dx)>14 && Math.abs(dx)>Math.abs(dy)*AXIS_RATIO) g.horizontal=true;
    }
    if(!g.horizontal||g.cancelled) return;
    if(e.cancelable) e.preventDefault();
    const cap=Math.max(-110,Math.min(110,dx));
    document.body.classList.add('p1-swipe-tracking');
    document.body.style.setProperty('--p1-swipe-x',`${cap*.22}px`);
    document.body.style.setProperty('--p1-swipe-rot',`${cap*.008}deg`);
  }
  function end(e){
    const g=gesture; if(!g||g.id!==e.pointerId) return;
    gesture=null; resetVisual();
    if(g.cancelled) return;
    const dx=e.clientX-g.x, dy=e.clientY-g.y, duration=Math.max(1,performance.now()-g.t);
    const velocity=Math.abs(dx)/duration;
    const threshold=Math.min(MAX_DISTANCE,Math.max(MIN_DISTANCE,innerWidth*.12));
    const horizontal=Math.abs(dx)>Math.abs(dy)*AXIS_RATIO;
    const enough=Math.abs(dx)>=threshold || (Math.abs(dx)>=38 && velocity>=FAST_VELOCITY);
    if(duration>MAX_DURATION || !horizontal || !enough) return;
    const direction=dx<0?'next':'prev';
    if(action(direction)) suppressClickUntil=performance.now()+450;
  }

  document.addEventListener('pointerdown',start,{passive:true});
  document.addEventListener('pointermove',move,{passive:false});
  document.addEventListener('pointerup',end,{passive:true});
  document.addEventListener('pointercancel',()=>{gesture=null;resetVisual()},{passive:true});
  document.addEventListener('click',e=>{
    if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}
  },true);

  document.documentElement.classList.add('p1-swipe-enabled');
  window.P1SwipeNavigation={next:()=>action('next'),prev:()=>action('prev')};
})();

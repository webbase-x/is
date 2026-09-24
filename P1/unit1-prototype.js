(() => {
  const params = new URLSearchParams(location.search);
  const path = location.pathname.replace(/\/+$/,'');
  const isHome = /\/P1(?:\/index\.html)?$/.test(path);
  const isUnit1 = /\/P1\/lesson\.html$/.test(path) && Number(params.get('unit') || 1) === 1;

  if (isHome) {
    document.body.classList.add('unit1-home-prototype');
    const applyHome = () => {
      const hero = document.querySelector('.hero-action');
      if (hero) hero.href = 'lesson.html?unit=1&start=1';
      const grid = document.querySelector('.units-grid');
      if (!grid || grid.querySelector('.other-units')) return;
      const cards = [...grid.querySelectorAll(':scope > .unit-card')];
      if (!cards.length) return;
      const first = cards[0];
      first.querySelectorAll('a[href*="lesson.html?unit=1"]').forEach(a => a.href = 'lesson.html?unit=1&start=1');
      if (cards.length > 1) {
        const details = document.createElement('details');
        details.className = 'other-units';
        details.innerHTML = '<summary>☰ บทอื่น ๆ</summary><div class="other-units-grid"></div>';
        const inner = details.querySelector('.other-units-grid');
        cards.slice(1).forEach(card => inner.appendChild(card));
        grid.appendChild(details);
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyHome, {once:true});
    else applyHome();
  }

  if (!isUnit1) return;

  const UNIT1_MEDIA = [
    'book/unit1-cover.webp',
    'book/unit1-complete.webp',
    'book/unit1-book.webp',
    'book/word-img/unit1-words.webp',
    'sounds/karaoke-unit-01.mp3'
  ];

  function setMediaStatus(text,state='') {
    const el=document.getElementById('unit1MediaStatus');
    if(!el)return;
    el.textContent=text;
    el.classList.remove('ready','error');
    if(state)el.classList.add(state);
  }

  async function warmUnit1Media() {
    setMediaStatus('⏳ กำลังเตรียมสื่อ');
    try {
      if('fonts' in document) {
        document.fonts.load('1em "Noto Sans Thai Looped"').catch(()=>{});
      }

      let registration=null;
      if('serviceWorker' in navigator) {
        try {
          registration=await navigator.serviceWorker.register('p1-media-sw.js?v=1',{scope:'./'});
          await navigator.serviceWorker.ready;
          const worker=registration.active||registration.waiting||registration.installing;
          worker?.postMessage?.({type:'PRECACHE_MEDIA',assets:UNIT1_MEDIA});
        } catch {}
      }

      const loaded=await Promise.allSettled(UNIT1_MEDIA.map(async raw=>{
        const url=new URL(raw,location.href).href;
        const response=await fetch(url,{cache:'force-cache',credentials:'same-origin'});
        if(!response.ok)throw new Error('โหลดสื่อไม่สำเร็จ');
        await response.arrayBuffer();
        if(/\.(?:webp|png|jpe?g|gif|svg)$/i.test(new URL(url).pathname)){
          const img=new Image();
          img.decoding='async';
          img.src=url;
          try{await img.decode()}catch{}
        }
        return true;
      }));
      const ok=loaded.filter(x=>x.status==='fulfilled').length;
      if(ok===UNIT1_MEDIA.length)setMediaStatus('✓ สื่อพร้อม','ready');
      else if(ok>0)setMediaStatus('✓ สื่อหลักพร้อม','ready');
      else setMediaStatus('สื่อจะโหลดเมื่อเปิดหน้า','error');
    } catch {
      setMediaStatus('สื่อจะโหลดเมื่อเปิดหน้า','error');
    }
  }

  document.body.classList.add('unit1-prototype');
  sessionStorage.setItem('p1-book-step-1','3');
  if (params.get('start') === '1') {
    sessionStorage.setItem('p1-full-page-1','0');
    params.delete('start');
    const next = location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.replaceState(null,'',next);
  }

  function buildChrome() {
    if (document.querySelector('.unit1-mini-bar')) return;
    const bar = document.createElement('header');
    bar.className = 'unit1-mini-bar';
    bar.innerHTML = '<button class="unit1-mini-menu" id="unit1MenuOpen" type="button" aria-label="เปิดเมนู" aria-expanded="false">☰</button><strong class="unit1-mini-title">บทที่ ๑ · ใบโบก ใบบัว</strong><button class="unit1-top-audio" id="unit1TopAudio" type="button" aria-label="ฟังหน้านี้" title="ฟังหน้านี้">🔊</button>';
    document.body.prepend(bar);

    const backdrop = document.createElement('div');
    backdrop.className = 'unit1-menu-backdrop';
    backdrop.id = 'unit1MenuBackdrop';
    backdrop.innerHTML = '<aside class="unit1-menu-panel" role="dialog" aria-modal="true" aria-label="เมนูบทเรียน"><div class="unit1-menu-head"><strong>เมนู</strong><button class="unit1-menu-close" id="unit1MenuClose" type="button" aria-label="ปิดเมนู">✕</button></div><div class="unit1-menu-list"><a href="index.html"><span class="menu-icon">🏠</span><span>หน้าเลือกบท</span></a><button id="unit1GoCover" type="button"><span class="menu-icon">📘</span><span>หน้าปกบท</span></button><button id="unit1Sound" type="button"><span class="menu-icon" id="unit1SoundIcon">🔊</span><span id="unit1SoundLabel">เสียงเปิด</span></button><button id="unit1Restart" type="button"><span class="menu-icon">↺</span><span>เริ่มบทใหม่</span></button></div><div class="unit1-media-status" id="unit1MediaStatus">⏳ กำลังเตรียมสื่อ</div></aside>';
    document.body.appendChild(backdrop);

    const openBtn = document.getElementById('unit1MenuOpen');
    const closeBtn = document.getElementById('unit1MenuClose');
    const panel = backdrop.querySelector('.unit1-menu-panel');
    const open = () => { backdrop.classList.add('open'); openBtn.setAttribute('aria-expanded','true'); closeBtn.focus(); };
    const close = () => { backdrop.classList.remove('open'); openBtn.setAttribute('aria-expanded','false'); openBtn.focus(); };
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    panel.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && backdrop.classList.contains('open')) close(); });

    const goCover = () => { sessionStorage.setItem('p1-book-step-1','3'); sessionStorage.setItem('p1-full-page-1','0'); location.href='lesson.html?unit=1'; };
    document.getElementById('unit1GoCover').addEventListener('click', goCover);
    document.getElementById('unit1Restart').addEventListener('click', goCover);

    const soundBtn = document.getElementById('unit1Sound');
    const syncSound = () => {
      const source = document.getElementById('soundToggle');
      const on = source?.getAttribute('aria-pressed') !== 'false';
      document.getElementById('unit1SoundIcon').textContent = on ? '🔊' : '🔇';
      document.getElementById('unit1SoundLabel').textContent = on ? 'เสียงเปิด' : 'เสียงปิด';
    };
    soundBtn.addEventListener('click', () => { document.getElementById('soundToggle')?.click(); syncSound(); });
    syncSound();

    const topAudio = document.getElementById('unit1TopAudio');
    const syncTopAudio = () => {
      const source = document.getElementById('readPageKaraoke');
      if (!topAudio) return;
      if (!source) {
        topAudio.disabled = true;
        topAudio.textContent = '🔊';
        topAudio.setAttribute('aria-label','ฟังหน้านี้');
        topAudio.title = 'ฟังหน้านี้';
        return;
      }
      const icon = source.querySelector('.book-control-icon')?.textContent?.trim() || (source.textContent.includes('⏸') ? '⏸' : source.textContent.includes('▶') ? '▶' : '🔊');
      const label = source.getAttribute('aria-label') || source.getAttribute('title') || 'ฟังหน้านี้';
      topAudio.textContent = icon;
      topAudio.disabled = source.disabled;
      topAudio.setAttribute('aria-label',label);
      topAudio.title = label;
    };
    topAudio?.addEventListener('click', () => document.getElementById('readPageKaraoke')?.click());
    const stage = document.getElementById('activityStage');
    if (stage) {
      const observer = new MutationObserver(() => queueMicrotask(syncTopAudio));
      observer.observe(stage,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-label','title']});
    }
    queueMicrotask(syncTopAudio);
    warmUnit1Media();

    if (!localStorage.getItem('p1-unit1-swipe-onboard-v1')) {
      const hint = document.createElement('div');
      hint.className = 'unit1-swipe-onboard';
      hint.innerHTML = '<span class="arrows">‹ 👆 ›</span>ปัดซ้าย–ขวาเพื่อเปิดหน้า';
      document.body.appendChild(hint);
      localStorage.setItem('p1-unit1-swipe-onboard-v1','1');
      setTimeout(() => hint.remove(), 2600);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildChrome, {once:true});
  else buildChrome();
})();

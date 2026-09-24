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
    bar.innerHTML = '<button class="unit1-mini-menu" id="unit1MenuOpen" type="button" aria-label="เปิดเมนู" aria-expanded="false">☰</button><strong class="unit1-mini-title">บทที่ ๑ · ใบโบก ใบบัว</strong><span class="unit1-mini-spacer" aria-hidden="true"></span>';
    document.body.prepend(bar);

    const backdrop = document.createElement('div');
    backdrop.className = 'unit1-menu-backdrop';
    backdrop.id = 'unit1MenuBackdrop';
    backdrop.innerHTML = '<aside class="unit1-menu-panel" role="dialog" aria-modal="true" aria-label="เมนูบทเรียน"><div class="unit1-menu-head"><strong>เมนู</strong><button class="unit1-menu-close" id="unit1MenuClose" type="button" aria-label="ปิดเมนู">✕</button></div><div class="unit1-menu-list"><a href="index.html"><span class="menu-icon">🏠</span><span>หน้าเลือกบท</span></a><button id="unit1GoCover" type="button"><span class="menu-icon">📘</span><span>หน้าปกบท</span></button><button id="unit1Sound" type="button"><span class="menu-icon" id="unit1SoundIcon">🔊</span><span id="unit1SoundLabel">เสียงเปิด</span></button><button id="unit1Restart" type="button"><span class="menu-icon">↺</span><span>เริ่มบทใหม่</span></button></div></aside>';
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

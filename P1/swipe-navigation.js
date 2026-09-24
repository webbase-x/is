(() => {
  const THRESHOLD = 58;
  const AXIS_RATIO = 1.2;
  const MAX_DURATION = 1100;
  const EDGE_RESIST = 22;
  let gesture = null;
  let suppressClickUntil = 0;
  let hintTimer = 0;

  const nextSelectors = [
    '[data-page-next]:not(:disabled)',
    '#nextActivity:not(:disabled)',
    '#nextStep:not(:disabled)',
    '.next-unit a[href]',
    'a[rel="next"][href]'
  ];
  const prevSelectors = [
    '[data-page-prev]:not(:disabled)',
    '#previousActivity:not(:disabled)',
    '#prevStep:not(:disabled)',
    'a[rel="prev"][href]'
  ];

  function visible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function firstVisible(selectors) {
    for (const selector of selectors) {
      const items = [...document.querySelectorAll(selector)];
      const found = items.find(visible);
      if (found) return found;
    }
    return null;
  }

  function isIgnoredTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest([
      'input','textarea','select','option','[contenteditable="true"]',
      'audio','video','canvas','dialog[open]','.song-karaoke-player',
      '.student-dialog','.bingo-example-dialog','[data-swipe-ignore]'
    ].join(','));
  }

  function hasHorizontalScroller(target) {
    let el = target instanceof Element ? target : null;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      const overflowX = style.overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 12) return true;
      el = el.parentElement;
    }
    return false;
  }

  function fallbackHref(direction) {
    const path = location.pathname;
    const query = new URLSearchParams(location.search);

    if (/\/P1\/00-prerequisite\/?$/.test(path)) {
      return direction === 'next' ? '../01-bai-bok-bai-bua/' : '../index.html';
    }
    if (/\/P1\/01-bai-bok-bai-bua\/?$/.test(path)) {
      return direction === 'next' ? '../lesson.html?unit=1' : '../00-prerequisite/';
    }
    if (/\/P1\/thai-consonants\.html$/.test(path)) {
      return direction === 'next' ? 'unit1-lesson1.html' : 'index.html';
    }

    const legacy = path.match(/\/P1\/unit(\d+)-lesson1\.html$/);
    if (legacy) {
      const unit = Number(legacy[1]);
      if (direction === 'next') {
        if (unit < 6) return `unit${unit + 1}-lesson1.html`;
        return 'index.html';
      }
      if (unit > 1) return `unit${unit - 1}-lesson1.html`;
      return 'thai-consonants.html';
    }

    if (/\/P1\/lesson\.html$/.test(path)) {
      const unit = Number(query.get('unit') || 1);
      if (direction === 'next' && unit < 12 && !firstVisible(nextSelectors)) return `lesson.html?unit=${unit + 1}`;
      if (direction === 'prev' && unit > 1 && !firstVisible(prevSelectors)) return `lesson.html?unit=${unit - 1}`;
    }
    return null;
  }

  function showHint(direction, available = true) {
    let hint = document.getElementById('p1SwipeHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'p1SwipeHint';
      hint.setAttribute('aria-live', 'polite');
      Object.assign(hint.style, {
        position:'fixed', top:'50%', zIndex:'99999', transform:'translateY(-50%)',
        width:'54px', height:'54px', borderRadius:'999px', display:'grid',
        placeItems:'center', fontSize:'32px', fontWeight:'800',
        background:'rgba(255,255,255,.94)', color:'var(--unit,#5f4aa8)',
        boxShadow:'0 8px 28px rgba(35,25,60,.22)', pointerEvents:'none',
        opacity:'0', transition:'opacity .16s ease, transform .16s ease'
      });
      document.body.appendChild(hint);
    }
    hint.textContent = direction === 'next' ? '›' : '‹';
    hint.style.left = direction === 'prev' ? '14px' : 'auto';
    hint.style.right = direction === 'next' ? '14px' : 'auto';
    hint.style.opacity = available ? '1' : '.35';
    hint.style.transform = 'translateY(-50%) scale(1.08)';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hint.style.opacity = '0';
      hint.style.transform = 'translateY(-50%) scale(.92)';
    }, 360);
  }

  function activate(direction) {
    const target = firstVisible(direction === 'next' ? nextSelectors : prevSelectors);
    if (target) {
      showHint(direction, true);
      target.click();
      return true;
    }
    const href = fallbackHref(direction);
    if (href) {
      showHint(direction, true);
      location.href = href;
      return true;
    }
    showHint(direction, false);
    return false;
  }

  function begin(clientX, clientY, pointerId, target) {
    if (isIgnoredTarget(target) || hasHorizontalScroller(target)) return;
    gesture = {
      x: clientX, y: clientY, lastX: clientX, lastY: clientY,
      time: performance.now(), pointerId, target, cancelled:false
    };
  }

  function move(clientX, clientY) {
    if (!gesture) return;
    gesture.lastX = clientX;
    gesture.lastY = clientY;
    const dx = clientX - gesture.x;
    const dy = clientY - gesture.y;
    if (Math.abs(dy) > Math.abs(dx) * 1.35 && Math.abs(dy) > EDGE_RESIST) gesture.cancelled = true;
  }

  function finish(clientX, clientY) {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    const dx = clientX - g.x;
    const dy = clientY - g.y;
    const duration = performance.now() - g.time;
    if (g.cancelled || duration > MAX_DURATION) return;
    if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return;
    const direction = dx < 0 ? 'next' : 'prev';
    if (activate(direction)) suppressClickUntil = performance.now() + 420;
  }

  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    begin(e.clientX, e.clientY, e.pointerId, e.target);
  }, {passive:true});

  document.addEventListener('pointermove', e => {
    if (!gesture || gesture.pointerId !== e.pointerId) return;
    move(e.clientX, e.clientY);
  }, {passive:true});

  document.addEventListener('pointerup', e => {
    if (!gesture || gesture.pointerId !== e.pointerId) return;
    finish(e.clientX, e.clientY);
  }, {passive:true});

  document.addEventListener('pointercancel', () => { gesture = null; }, {passive:true});

  document.addEventListener('click', e => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  document.documentElement.classList.add('p1-swipe-enabled');
  const style = document.createElement('style');
  style.textContent = `
    .p1-swipe-enabled body{overscroll-behavior-x:none}
    .p1-swipe-enabled .book-paper,
    .p1-swipe-enabled .complete-reader,
    .p1-swipe-enabled main{touch-action:pan-y pinch-zoom}
    .p1-swipe-enabled input[type="range"],
    .p1-swipe-enabled canvas,
    .p1-swipe-enabled [data-swipe-ignore]{touch-action:auto}
  `;
  document.head.appendChild(style);

  window.P1SwipeNavigation = { next:() => activate('next'), prev:() => activate('prev') };
})();

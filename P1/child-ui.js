(() => {
  function onHome() {
    const path = location.pathname.replace(/\\/+$/,'');
    return /\\/P1(?:\\/index\\.html)?$/.test(path);
  }

  function enhanceHome() {
    if (!onHome()) return;
    document.body.classList.add('kid-home');
    document.querySelectorAll('.unit-card').forEach((card, index) => {
      if (card.querySelector('.kid-open-button')) return;
      const cover = card.querySelector('.unit-cover[href]');
      const content = card.querySelector('.unit-content');
      if (!cover || !content) return;
      const title = card.querySelector('h3')?.textContent?.trim() || ('บทที่ ' + (index + 1));
      const open = document.createElement('a');
      open.className = 'kid-open-button';
      open.href = cover.getAttribute('href');
      open.setAttribute('aria-label', 'เปิดบท ' + title);
      open.innerHTML = '<span aria-hidden="true">▶</span><span>เปิดบทนี้</span>';
      content.appendChild(open);

      if (index === 0 && !card.querySelector('.kid-prerequisite')) {
        const pre = document.createElement('a');
        pre.className = 'kid-prerequisite';
        pre.href = '00-prerequisite/';
        pre.textContent = '🔤 ฝึกพยัญชนะก่อนเรียน';
        content.appendChild(pre);
      }
    });
  }

  function markReady() {
    document.body?.classList.add('kid-ui-ready');
    enhanceHome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, {once:true});
  } else {
    markReady();
  }
})();

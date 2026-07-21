const imageAssetVersion = '20260721-2';
const preloadAssets = [
  '02.png','ขา.png','งวง.png','งา.png','ดีใจ.png','ดูแล.png','ตา.png','พ่อ.png','ภูผา.png','รัก.png','หา.png','หาง.png','หู.png','แม่.png','ใบบัว.png','ใบโบก.png','ให้-ได้.png'
].map(file => `img/${encodeURIComponent(file)}?v=${imageAssetVersion}`).concat([
  'sounds/02%20เพื่อนภูผา.mp3?v=20260721-1',
  'downloads/p1-train-word-cards-a4.pdf?v=20260721-2',
  `plan/02/${encodeURIComponent('แผนที่1.docx')}?v=20260721-1`
]);
const preloadScreen = document.querySelector('#preloadScreen');
const preloadStatus = document.querySelector('#preloadStatus');
const preloadBar = document.querySelector('#preloadBar');
const preloadPercent = document.querySelector('#preloadPercent');
const retryPreload = document.querySelector('#retryPreload');
async function preloadWelcomeAssets() {
  retryPreload.hidden = true;
  preloadScreen.setAttribute('aria-busy', 'true');
  let completed = 0;
  const updateProgress = () => {
    const percent = Math.round((completed / preloadAssets.length) * 100);
    preloadBar.style.width = `${percent}%`;
    preloadPercent.textContent = `${percent}%`;
    preloadStatus.textContent = `โหลดไฟล์แล้ว ${completed} จาก ${preloadAssets.length} รายการ`;
  };
  updateProgress();
  try {
    await Promise.all(preloadAssets.map(async asset => {
      const response = await fetch(asset, {cache:'force-cache', credentials:'same-origin'});
      if (!response.ok) throw new Error(`${asset}: ${response.status}`);
      await response.arrayBuffer();
      completed += 1;
      updateProgress();
    }));
    if (document.fonts?.ready) await document.fonts.ready;
    preloadStatus.textContent = 'พร้อมเลือกหน่วยการเรียนรู้';
    preloadScreen.setAttribute('aria-busy', 'false');
    preloadScreen.classList.add('preload-complete');
    document.body.classList.remove('app-loading');
    setTimeout(() => { preloadScreen.hidden = true; }, 380);
  } catch (error) {
    console.error('Asset preload failed', error);
    preloadStatus.textContent = 'โหลดไฟล์ไม่ครบ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
    retryPreload.hidden = false;
    preloadScreen.setAttribute('aria-busy', 'false');
  }
}
retryPreload.addEventListener('click', preloadWelcomeAssets);
preloadWelcomeAssets();

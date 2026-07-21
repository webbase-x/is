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
async function preloadApplication() {
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
    preloadStatus.textContent = 'พร้อมเริ่มกิจกรรม';
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
retryPreload.addEventListener('click', preloadApplication);
preloadApplication();

const activities = [...document.querySelectorAll('.activity')];
const progressButtons = [...document.querySelectorAll('[data-go]')];
const navDots = [...document.querySelectorAll('.activity-position i')];
let currentActivity = Number(sessionStorage.getItem('p1Activity') || 0);

function stopRunningActivities() {
  document.querySelectorAll('audio, video').forEach(media => {
    media.pause();
    media.currentTime = 0;
  });
  if (window.p1SpinTimer) {
    clearTimeout(window.p1SpinTimer);
    window.p1SpinTimer = null;
  }
  if (window.p1SpinInterval) { clearInterval(window.p1SpinInterval); window.p1SpinInterval = null; }
  (window.p1ShadowTimers || []).forEach(timer => { clearTimeout(timer); clearInterval(timer); });
  window.p1ShadowTimers = [];
  (window.p1AudioContexts || []).forEach(context => context.close().catch(() => {}));
  window.p1AudioContexts = [];
  window.p1ShadowRun = (window.p1ShadowRun || 0) + 1;
  document.querySelector('#shadowGame')?.classList.remove('is-correct', 'is-wrong', 'is-shuffling', 'is-revealed', 'awaiting-answer', 'name-drawing');
  document.querySelector('#studentResult')?.classList.remove('student-success', 'student-minimized');
  const minimizeStudent = document.querySelector('#minimizeStudent');
  if (minimizeStudent) minimizeStudent.hidden = true;
  const flowerRain = document.querySelector('#flowerRain');
  if (flowerRain) flowerRain.innerHTML = '';
  const shuffleButton = document.querySelector('#shuffleShadow');
  if (shuffleButton) shuffleButton.disabled = false;
  const randomStudentButton = document.querySelector('#randomStudent');
  if (randomStudentButton) randomStudentButton.disabled = false;
  document.querySelector('#wheel')?.classList.remove('spinning');
  const spinButton = document.querySelector('#spinWheel');
  if (spinButton) spinButton.disabled = false;
}

function showActivity(index) {
  const nextActivity = Math.max(0, Math.min(activities.length - 1, index));
  if (nextActivity !== currentActivity) stopRunningActivities();
  currentActivity = nextActivity;
  activities.forEach((activity, i) => { activity.hidden = i !== currentActivity; activity.classList.toggle('active', i === currentActivity); });
  progressButtons.forEach((button, i) => button.classList.toggle('active', i === currentActivity));
  navDots.forEach((dot, i) => dot.classList.toggle('active', i === currentActivity));
  document.querySelector('#activityPosition').textContent = `${currentActivity + 1} / ${activities.length}`;
  document.querySelector('#previousActivity').disabled = currentActivity === 0;
  document.querySelector('#nextActivity').disabled = currentActivity === activities.length - 1;
  sessionStorage.setItem('p1Activity', currentActivity);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelector('#previousActivity').addEventListener('click', () => showActivity(currentActivity - 1));
document.querySelector('#nextActivity').addEventListener('click', () => showActivity(currentActivity + 1));
progressButtons.forEach(button => button.addEventListener('click', () => showActivity(Number(button.dataset.go))));
const fullscreenButton = document.querySelector('#fullscreenButton');
function syncFullscreenPresentation() {
  const active = Boolean(document.fullscreenElement);
  document.body.classList.toggle('game-fullscreen', active);
  fullscreenButton.textContent = active ? '✕' : '⛶';
  fullscreenButton.setAttribute('aria-label', active ? 'ออกจากเต็มหน้าจอ' : 'แสดงเต็มหน้าจอ');
  fullscreenButton.title = active ? 'ออกจากเต็มหน้าจอ' : 'เต็มหน้าจอ';
}
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn('Fullscreen is unavailable', error);
  }
});
document.addEventListener('fullscreenchange', syncFullscreenPresentation);
syncFullscreenPresentation();
showActivity(currentActivity);

const song = document.querySelector('#song');
const lyricButtons = [...document.querySelectorAll('#lyrics button')];
const lyricWords = [...document.querySelectorAll('#lyrics [data-cue]')];
const songSeek = document.querySelector('#songSeek');
const karaokeCues = [[14,0],[17,1],[18,2],[20,3],[21,4],[23,5],[25,6],[27,7],[28,8],[30,9],[32,10],[35,-1],[51,0],[53,1],[54,2],[56,3],[57,4],[58,5],[60,6],[62,7],[63,8],[65,9],[67,10]];
const formatTime = value => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '–:––';
function updateSong() {
  const ratio = song.duration ? song.currentTime / song.duration : 0;
  if (document.activeElement !== songSeek) songSeek.value = ratio * 100;
  document.querySelector('#songTime').textContent = formatTime(song.currentTime);
  let cue = -1;
  karaokeCues.forEach(([time, index]) => { if (song.currentTime >= time) cue = index; });
  lyricWords.forEach((word, i) => { word.classList.toggle('singing', i === cue); word.classList.toggle('sung', cue >= 0 && i < cue); });
  const activeWord = lyricWords[cue];
  lyricButtons.forEach(button => button.classList.toggle('active', Boolean(activeWord && button.contains(activeWord))));
}
song.loop = true;
song.addEventListener('loadedmetadata', () => document.querySelector('#songDuration').textContent = formatTime(song.duration));
song.addEventListener('timeupdate', updateSong);
song.addEventListener('play', () => document.querySelector('#playSong').textContent = '❚❚');
song.addEventListener('pause', () => document.querySelector('#playSong').textContent = '▶');
song.addEventListener('ended', () => { if (!song.loop) { song.currentTime = 0; updateSong(); } });
document.querySelector('#playSong').addEventListener('click', () => song.paused ? song.play() : song.pause());
document.querySelector('#restartSong').addEventListener('click', () => { song.currentTime = 0; song.play(); });
document.querySelector('#muteSong').addEventListener('click', event => { song.muted = !song.muted; event.currentTarget.textContent = song.muted ? '🔇' : '🔊'; });
document.querySelector('#loopSong').addEventListener('click', event => { song.loop = !song.loop; event.currentTarget.classList.toggle('active', song.loop); event.currentTarget.setAttribute('aria-pressed', song.loop); });
songSeek.addEventListener('input', () => { if (song.duration) song.currentTime = song.duration * Number(songSeek.value) / 100; updateSong(); });
lyricButtons.forEach(button => button.addEventListener('click', () => { song.currentTime = Number(button.dataset.seek); song.play(); }));

const vocabulary = [
  ['ภูผา','👦','เด็กผู้ชายผู้เป็นเพื่อนของใบโบกและใบบัว','ภู – ผา'],['พ่อ','👨','ผู้ชายผู้ดูแลครอบครัว','พ่อ'],['แม่','👩','ผู้หญิงผู้ให้ความรักและดูแลลูก','แม่'],['ตา','👴','คุณตาผู้สูงอายุในครอบครัว','ตา'],['ใบโบก','🐘','ช้างสีฟ้า เพื่อนของภูผา','ใบ – โบก'],['ใบบัว','🐘','ช้างสีส้ม เพื่อนของภูผา','ใบ – บัว'],['ขา','🦵','อวัยวะที่ใช้ยืนและเดิน','ขา'],['หู','👂','อวัยวะที่ใช้ฟังเสียง','หู'],['งา','🦷','ส่วนสีขาวยาวอยู่ข้างปากช้าง','งา'],['งวง','🐘','จมูกยาวของช้าง ใช้หยิบจับสิ่งของ','งวง'],['หาง','🐿️','ส่วนที่อยู่ด้านหลังของสัตว์','หาง'],['หา','🔎','มองดูเพื่อให้พบสิ่งที่ต้องการ','หา'],['ให้','🎁','ยื่นสิ่งของแก่ผู้อื่น','ให้'],['ได้','🙌','ได้รับหรือทำสำเร็จ','ได้'],['ดีใจ','😄','ความรู้สึกเมื่อมีเรื่องน่ายินดี','ดี – ใจ'],['ดูแล','🤲','เอาใจใส่และช่วยเหลือ','ดู – แล'],['รัก','❤️','ความรู้สึกผูกพันและห่วงใย','รัก']
];

const shadowVocabulary = [
  ['ภูผา','ภูผา.png'],['พ่อ','พ่อ.png'],['แม่','แม่.png'],['ตา','ตา.png'],
  ['ใบโบก','ใบโบก.png'],['ใบบัว','ใบบัว.png'],['ขา','ขา.png'],['หู','หู.png'],
  ['งา','งา.png'],['งวง','งวง.png'],['หาง','หาง.png'],['หา','หา.png'],
  ['ให้–ได้','ให้-ได้.png'],['ดีใจ','ดีใจ.png'],['ดูแล','ดูแล.png'],['รัก','รัก.png']
];
let currentShadow = 0;
let remainingShadows = shadowVocabulary.map((_, index) => index);
const studentScores = new Map();
window.p1ShadowTimers = [];
window.p1AudioContexts = [];
const shadowGame = document.querySelector('#shadowGame');
const shadowImage = document.querySelector('#shadowImage');
const rememberShadowTimer = timer => (window.p1ShadowTimers.push(timer), timer);
const shuffleItems = items => [...items].sort(() => Math.random() - .5);
function playFeedback(correct) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  window.p1AudioContexts.push(context);
  const notes = correct ? [523.25, 659.25, 783.99] : [185, 138];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = correct ? 'sine' : 'sawtooth'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, context.currentTime + index * .1);
    gain.gain.exponentialRampToValueAtTime(.16, context.currentTime + index * .1 + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + index * .1 + .22);
    oscillator.connect(gain).connect(context.destination); oscillator.start(context.currentTime + index * .1); oscillator.stop(context.currentTime + index * .1 + .24);
  });
  rememberShadowTimer(setTimeout(() => { context.close(); window.p1AudioContexts = window.p1AudioContexts.filter(item => item !== context); }, 700));
}
function renderShadowImage(index) {
  const [word, file] = shadowVocabulary[index];
  shadowImage.src = `img/${encodeURIComponent(file)}?v=${imageAssetVersion}`;
  shadowImage.alt = `ภาพครึ่งเงาและครึ่งภาพจริงสำหรับทายคำ ${word}`;
  document.querySelector('#shadowPicture').setAttribute('aria-label', 'ภาพด้านซ้ายเป็นเงา และภาพด้านขวาเป็นภาพจริงสำหรับทายคำ');
}
function renderChoices() {
  const answer = shadowVocabulary[currentShadow][0];
  const distractors = shuffleItems(shadowVocabulary.filter((_, index) => index !== currentShadow)).slice(0, 2).map(item => item[0]);
  const container = document.querySelector('#answerChoices');
  container.innerHTML = '';
  const colorThemes = shuffleItems([
    ['#fff0f3','#e43f68','#9d1538'],['#eef8ff','#3182ce','#164e86'],['#ecfff5','#1ca97d','#08644b'],['#fff8dc','#e4a20b','#795400'],['#f5efff','#8457d9','#4b2994'],['#fff0e8','#ee7548','#9a3514'],['#eafcff','#159ab0','#086072'],['#f3fae8','#6b9f24','#3f6610']
  ]).slice(0, 3);
  shuffleItems([answer, ...distractors]).forEach((word, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'answer-card'; button.textContent = word;
    button.style.setProperty('--choice-bg', colorThemes[index][0]); button.style.setProperty('--choice-border', colorThemes[index][1]); button.style.setProperty('--choice-ink', colorThemes[index][2]);
    button.addEventListener('click', () => answerShadow(button, word === answer)); container.append(button);
  });
}
function rainFlowers() {
  const rain = document.querySelector('#flowerRain'); rain.innerHTML = '';
  const flowers = ['🌸','🌼','🌺','🌻','🌷','💮'];
  for (let i = 0; i < 38; i += 1) {
    const flower = document.createElement('span'); flower.textContent = flowers[i % flowers.length];
    flower.style.setProperty('--x', `${Math.random() * 100}%`); flower.style.setProperty('--delay', `${Math.random() * .5}s`); flower.style.setProperty('--fall', `${1.25 + Math.random() * .8}s`); flower.style.setProperty('--size', `${20 + Math.random() * 27}px`); rain.append(flower);
  }
  rememberShadowTimer(setTimeout(() => { rain.innerHTML = ''; }, 2600));
}
function answerShadow(button, correct) {
  if (shadowGame.classList.contains('is-correct') || shadowGame.classList.contains('is-shuffling') || shadowGame.classList.contains('name-drawing')) return;
  shadowGame.classList.remove('is-wrong'); void shadowGame.offsetWidth;
  shadowGame.classList.add(correct ? 'is-correct' : 'is-wrong'); button.classList.add(correct ? 'correct' : 'wrong');
  shadowGame.classList.remove('awaiting-answer');
  document.querySelector('#minimizeStudent').hidden = true;
  [...document.querySelectorAll('.answer-card')].forEach(choice => choice.disabled = true);
  playFeedback(correct);
  if (correct) {
    document.querySelector('#shadowPrompt').textContent = 'เก่งมาก! ตอบถูกแล้ว'; rainFlowers();
    [...document.querySelectorAll('.answer-card')].forEach(choice => choice.classList.toggle('dismissed', choice !== button));
    if (selectedStudent) {
      const studentResult = document.querySelector('#studentResult');
      studentScores.set(selectedStudent, (studentScores.get(selectedStudent) || 0) + 5); updateScoreBoard();
      studentResult.classList.remove('student-success', 'student-minimized'); studentResult.hidden = true;
      document.querySelector('#minimizeStudent').hidden = true; selectedStudent = '';
    }
    remainingShadows = remainingShadows.filter(index => index !== currentShadow);
    document.querySelector('#shadowCount').textContent = remainingShadows.length ? `เหลือ ${remainingShadows.length} ภาพ` : 'ตอบครบทั้ง 16 ภาพแล้ว!';
    if (remainingShadows.length) document.querySelector('#shadowPrompt').textContent = 'ตอบถูกแล้ว! กด “สุ่มภาพ” เพื่อไปภาพถัดไป';
    else finishShadowRound();
  } else {
    document.querySelector('#shadowPrompt').textContent = 'ลองอีกครั้ง เลือกคำใหม่ให้ตรงกับภาพ';
    rememberShadowTimer(setTimeout(() => { shadowGame.classList.remove('is-wrong'); renderChoices(); }, 700));
  }
}
function settleShadow(index) {
  currentShadow = index;
  renderShadowImage(currentShadow);
  document.querySelector('#shadowCount').textContent = `เหลือ ${remainingShadows.length} ภาพ`;
  document.querySelector('#shadowPrompt').textContent = 'ดูเงาแล้วลองทายว่าคือภาพอะไร';
  shadowGame.classList.remove('is-revealed');
  shadowGame.classList.remove('is-shuffling', 'is-correct', 'is-wrong'); renderChoices();
  document.querySelector('#answerChoices').hidden = true;
  document.querySelector('#revealShadow').hidden = false;
  document.querySelector('#shuffleShadow').disabled = false;
}
function finishShadowRound() {
  document.querySelector('#shadowPrompt').textContent = 'ยอดเยี่ยม! ตอบครบทุกภาพแล้ว คำตอบและชื่อผู้ตอบจะค้างไว้จนกด “เริ่มใหม่”';
  document.querySelector('#revealShadow').hidden = true;
  document.querySelector('#shuffleShadow').disabled = true;
}
function shuffleShadow() {
  if (!remainingShadows.length) { finishShadowRound(); return; }
  (window.p1ShadowTimers || []).forEach(timer => { clearTimeout(timer); clearInterval(timer); }); window.p1ShadowTimers = [];
  const run = window.p1ShadowRun = (window.p1ShadowRun || 0) + 1;
  shadowGame.classList.remove('is-correct', 'is-wrong', 'is-revealed', 'awaiting-answer'); shadowGame.classList.add('is-shuffling');
  document.querySelector('#minimizeStudent').hidden = true;
  document.querySelector('#shuffleShadow').disabled = true; document.querySelector('#answerChoices').innerHTML = '';
  document.querySelector('#shadowPrompt').textContent = 'กำลังสุ่มภาพ…';
  const interval = rememberShadowTimer(setInterval(() => renderShadowImage(remainingShadows[Math.floor(Math.random() * remainingShadows.length)]), 75));
  rememberShadowTimer(setTimeout(() => { clearInterval(interval); if (run === window.p1ShadowRun) settleShadow(remainingShadows[Math.floor(Math.random() * remainingShadows.length)]); }, 1050));
}
document.querySelector('#shuffleShadow').addEventListener('click', shuffleShadow);
document.querySelector('#revealShadow').addEventListener('click', event => {
  shadowGame.classList.add('is-revealed'); event.currentTarget.hidden = true;
  document.querySelector('#answerChoices').hidden = false; document.querySelector('#shadowPrompt').textContent = 'คำใดตรงกับภาพนี้?';
});
document.querySelector('#resetShadow').addEventListener('click', () => {
  remainingShadows = shadowVocabulary.map((_, index) => index); selectedStudent = '';
  studentScores.clear(); updateScoreBoard();
  const studentResult = document.querySelector('#studentResult'); studentResult.classList.remove('student-success', 'student-minimized'); studentResult.textContent = 'กด “สุ่มชื่อ” เพื่อเลือกผู้ตอบ';
  studentResult.hidden = false;
  document.querySelector('#randomStudent').disabled = false; document.querySelector('#minimizeStudent').hidden = true; shuffleShadow();
});
shadowVocabulary.forEach(([, file]) => { const image = new Image(); image.src = `img/${encodeURIComponent(file)}?v=${imageAssetVersion}`; });
settleShadow(0);

const studentDialog = document.querySelector('#studentDialog');
const studentNamesInput = document.querySelector('#studentNames');
let studentNames = JSON.parse(localStorage.getItem('p1StudentNames') || '[]');
let selectedStudent = '';
function parseStudentNames(value) {
  const parts = value.includes(',') ? value.split(',') : value.trim().split(/\s+/);
  return [...new Set(parts.map(item => item.trim().replace(/^"(.*)"$/, '$1').trim()).filter(Boolean))];
}
function updateStudentButtons() { document.querySelector('#editStudents').hidden = !studentNames.length; }
function openStudentDialog() { studentNamesInput.value = studentNames.map(name => name.includes(' ') ? `"${name}"` : name).join(', '); studentDialog.showModal(); studentNamesInput.focus(); }
document.querySelector('#randomStudent').addEventListener('click', () => {
  if (!studentNames.length) { openStudentDialog(); return; }
  const result = document.querySelector('#studentResult'); const button = document.querySelector('#randomStudent');
  result.hidden = false; result.classList.remove('name-pop', 'student-success', 'student-minimized'); button.disabled = true; document.querySelector('#minimizeStudent').hidden = true;
  shadowGame.classList.add('awaiting-answer', 'name-drawing');
  const nameInterval = rememberShadowTimer(setInterval(() => {
    result.textContent = studentNames[Math.floor(Math.random() * studentNames.length)];
    result.classList.toggle('name-tick');
  }, 75));
  rememberShadowTimer(setTimeout(() => {
    clearInterval(nameInterval); selectedStudent = studentNames[Math.floor(Math.random() * studentNames.length)];
    result.textContent = selectedStudent; result.classList.remove('name-tick'); result.classList.add('name-pop'); shadowGame.classList.remove('name-drawing'); document.querySelector('#minimizeStudent').hidden = false; button.disabled = false;
  }, 1200));
});
document.querySelector('#minimizeStudent').addEventListener('click', event => { shadowGame.classList.remove('awaiting-answer'); document.querySelector('#studentResult').classList.add('student-minimized'); event.currentTarget.hidden = true; });
document.querySelector('#editStudents').addEventListener('click', openStudentDialog);
document.querySelector('#cancelStudents').addEventListener('click', () => studentDialog.close());
document.querySelector('#studentForm').addEventListener('submit', event => {
  event.preventDefault(); studentNames = parseStudentNames(studentNamesInput.value); localStorage.setItem('p1StudentNames', JSON.stringify(studentNames)); updateStudentButtons(); studentDialog.close(); selectedStudent = '';
  document.querySelector('#studentResult').textContent = studentNames.length ? `บันทึกแล้ว ${studentNames.length} คน · กด “สุ่มชื่อ”` : 'ยังไม่มีรายชื่อ กด “สุ่มชื่อ” เพื่อเพิ่มรายชื่อ';
});
updateStudentButtons();

function updateScoreBoard() {
  document.querySelector('#scoreTotal').textContent = studentScores.size ? `${studentScores.size} คนได้คะแนน` : 'ยังไม่มีผู้ได้คะแนน';
  const scoreNames = document.querySelector('#scoreNames'); scoreNames.replaceChildren();
  if (!studentScores.size) { const empty = document.createElement('p'); empty.textContent = 'ยังไม่มีผู้ได้คะแนน'; scoreNames.append(empty); return; }
  studentScores.forEach((score, name) => {
    const row = document.createElement('div'); const student = document.createElement('strong'); const stars = document.createElement('span'); const points = document.createElement('small');
    student.textContent = name; stars.textContent = `${'★'.repeat(Math.min(5, score))} `; points.textContent = `${score} คะแนน`; stars.append(points); row.append(student, stars); scoreNames.append(row);
  });
}
document.querySelector('#scoreBadge').addEventListener('click', () => { updateScoreBoard(); document.querySelector('#scoreDialog').showModal(); });
document.querySelector('#closeScores').addEventListener('click', () => document.querySelector('#scoreDialog').close());
updateScoreBoard();

const bingoWords = vocabulary.filter(item => item[0] !== 'รัก').map(item => item[0]);
const bingoSheetDialog = document.querySelector('#bingoSheetDialog');
const bingoSheetWordsInput = document.querySelector('#bingoSheetWords');
const shuffleBingoWords = words => {
  const copy = [...words];
  for (let index = copy.length - 1; index > 0; index -= 1) { const pick = Math.floor(Math.random() * (index + 1)); [copy[index], copy[pick]] = [copy[pick], copy[index]]; }
  return copy;
};
const escapeBingoText = text => text.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
document.querySelector('#openBingoSheetMaker').addEventListener('click', () => {
  bingoSheetWordsInput.value = bingoWords.join(', ');
  document.querySelector('#bingoSheetMessage').textContent = '';
  bingoSheetDialog.showModal();
});
document.querySelector('#cancelBingoSheet').addEventListener('click', () => bingoSheetDialog.close());
document.querySelector('#bingoSheetForm').addEventListener('submit', event => {
  event.preventDefault();
  const raw = bingoSheetWordsInput.value.trim();
  const separator = raw.includes(',') ? /\s*,\s*/ : /\n+/;
  const words = [...new Set(raw.split(separator).map(word => word.trim()).filter(Boolean))];
  const pageCount = Math.min(100, Math.max(1, Number(document.querySelector('#bingoPageCount').value) || 1));
  const message = document.querySelector('#bingoSheetMessage');
  if (words.length < 16) { message.textContent = `กรุณาเพิ่มคำให้ครบอย่างน้อย 16 คำ (ขณะนี้มี ${words.length} คำ)`; return; }
  const maximumLayouts = words.length === 16 ? 100 : pageCount;
  const boards = []; const signatures = new Set(); let attempts = 0;
  while (boards.length < Math.min(pageCount, maximumLayouts) && attempts < pageCount * 60) {
    const board = shuffleBingoWords(words).slice(0, 16); const signature = board.join('|'); attempts += 1;
    if (!signatures.has(signature)) { signatures.add(signature); boards.push(board); }
  }
  if (boards.length < pageCount) { message.textContent = 'ไม่สามารถสร้างหน้าที่ไม่ซ้ำกันได้ครบตามจำนวน กรุณาเพิ่มคำอีกเล็กน้อย'; return; }
  const pages = boards.map((board, pageIndex) => `<section class="page"><header><div class="student-header"><h1>บิงโก!</h1><p class="student-line"><span class="student-name">ชื่อ <i></i></span><span class="student-number">เลขที่ ______</span></p></div><b>ชุดที่ ${pageIndex + 1}</b></header><main>${board.map(word => `<div>${escapeBingoText(word)}</div>`).join('')}</main><footer>ฟังคำจากวงล้อ แล้ววางเบี้ยให้ตรงกับคำ • เรียงครบ 4 ช่อง พูดว่า “บิงโก!”</footer></section>`).join('');
  const printWindow = window.open('', '_blank');
  if (!printWindow) { message.textContent = 'เบราว์เซอร์ปิดกั้นหน้าดาวน์โหลด กรุณาอนุญาตป๊อปอัปแล้วลองใหม่'; return; }
  printWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ตารางบิงโก ${pageCount} หน้า</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,sans-serif;color:#241d46}.page{width:186mm;height:273mm;display:flex;flex-direction:column;page-break-after:always;padding:7mm;border:2px solid #5a48d6;border-radius:5mm;background:linear-gradient(145deg,#fff 70%,#f5f1ff)}.page:last-child{page-break-after:auto}header{display:flex;justify-content:space-between;align-items:start;gap:8mm;margin-bottom:8mm}.student-header{min-width:0;flex:1}h1{margin:0;color:#5a48d6;font-size:30pt}.student-line{display:flex;align-items:end;gap:6mm;margin:3mm 0 0;font-size:13pt;white-space:nowrap}.student-name{min-width:0;flex:1;display:flex;align-items:end;gap:2mm}.student-name i{height:1em;flex:1;border-bottom:1px solid #655e78}.student-number{flex:0 0 auto}header b{flex:0 0 auto;padding:3mm 5mm;border-radius:99px;background:#fff1b8;color:#7b5900}main{flex:1;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:3mm}main div{display:grid;place-items:center;padding:3mm;border:2px solid #6c5bd8;border-radius:4mm;background:white;text-align:center;font-size:22pt;font-weight:700;overflow-wrap:anywhere}footer{margin-top:6mm;text-align:center;font-size:12pt;color:#655e78}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${pages}<script>window.onload=()=>{window.print()}<\/script></body></html>`);
  printWindow.document.close(); bingoSheetDialog.close();
});
let remainingWords = [...bingoWords];
let calledWords = [];
function renderCalledWords() {
  const container = document.querySelector('#calledWords');
  container.innerHTML = calledWords.length ? calledWords.map(word => `<span>${word}</span>`).join('') : '<p>กด “หมุนวงล้อ” เพื่อเริ่มกิจกรรม</p>';
  document.querySelector('#calledCount').textContent = calledWords.length;
}
document.querySelector('#spinWheel').addEventListener('click', () => {
  if (!remainingWords.length) { document.querySelector('#spinHint').textContent = 'ครบทุกคำแล้ว กด “เริ่มรอบใหม่”'; return; }
  const wheel = document.querySelector('#wheel');
  wheel.classList.remove('spinning'); void wheel.offsetWidth; wheel.classList.add('spinning');
  document.querySelector('#spinWheel').disabled = true;
  document.querySelector('#spinHint').textContent = 'กำลังหมุนวงล้อ…';
  const AudioContext = window.AudioContext || window.webkitAudioContext; const wheelAudio = AudioContext ? new AudioContext() : null;
  window.p1WheelAudio = wheelAudio; if (wheelAudio) window.p1AudioContexts.push(wheelAudio);
  const wheelTone = (frequency, duration = .055, volume = .045) => {
    if (!wheelAudio || wheelAudio.state === 'closed') return;
    const oscillator = wheelAudio.createOscillator(); const gain = wheelAudio.createGain(); oscillator.type = 'square'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, wheelAudio.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, wheelAudio.currentTime + duration); oscillator.connect(gain).connect(wheelAudio.destination); oscillator.start(); oscillator.stop(wheelAudio.currentTime + duration);
  };
  let previewIndex = 0;
  window.p1SpinInterval = setInterval(() => { previewIndex = (previewIndex + 1) % remainingWords.length; document.querySelector('#wheelWord').textContent = remainingWords[previewIndex]; wheelTone(320 + (previewIndex % 4) * 55); }, 75);
  window.p1SpinTimer = setTimeout(() => {
    clearInterval(window.p1SpinInterval); window.p1SpinInterval = null;
    wheel.classList.remove('spinning');
    const index = Math.floor(Math.random() * remainingWords.length);
    const word = remainingWords.splice(index, 1)[0]; calledWords.push(word);
    document.querySelector('#wheelWord').textContent = word; renderCalledWords();
    wheelTone(660, .18, .12); setTimeout(() => wheelTone(880, .26, .12), 140);
    document.querySelector('#spinWheel').disabled = false;
    document.querySelector('#spinHint').textContent = remainingWords.length ? `เหลืออีก ${remainingWords.length} คำ` : 'ครบทุกคำแล้ว!';
    window.p1SpinTimer = null;
    setTimeout(() => { if (wheelAudio && wheelAudio.state !== 'closed') wheelAudio.close(); window.p1AudioContexts = window.p1AudioContexts.filter(context => context !== wheelAudio); if (window.p1WheelAudio === wheelAudio) window.p1WheelAudio = null; }, 700);
  }, 3000);
});
document.querySelector('#resetWheel').addEventListener('click', () => {
  if (window.p1SpinTimer) { clearTimeout(window.p1SpinTimer); window.p1SpinTimer = null; }
  if (window.p1SpinInterval) { clearInterval(window.p1SpinInterval); window.p1SpinInterval = null; }
  if (window.p1WheelAudio && window.p1WheelAudio.state !== 'closed') window.p1WheelAudio.close(); window.p1AudioContexts = window.p1AudioContexts.filter(context => context !== window.p1WheelAudio); window.p1WheelAudio = null;
  document.querySelector('#wheel').classList.remove('spinning'); document.querySelector('#spinWheel').disabled = false;
  remainingWords = [...bingoWords]; calledWords = []; document.querySelector('#wheelWord').textContent = 'พร้อม!'; document.querySelector('#spinHint').textContent = 'คำที่ออกแล้วจะไม่ซ้ำจนกว่าจะเริ่มรอบใหม่'; renderCalledWords();
});
const bingoExampleWords = ['ภูผา','ดูแล','ใบโบก','ใบบัว','พ่อ','แม่','หู','งา','ขา','หา','ดีใจ','รัก','ตา','หาง','งวง','ได้'];
const bingoExamples = [
  {title:'แนวนอน', winners:[4,5,6,7], explanation:'ดูแถวที่พาดจากซ้ายไปขวา เมื่อมีเบี้ยเรียงติดกันครบ 4 ช่องในแถวเดียวกัน แบบนี้เรียกว่า “แนวนอน” และได้คะแนน'},
  {title:'แนวตั้ง', winners:[2,6,10,14], explanation:'ดูแถวที่ลากจากด้านบนลงด้านล่าง เมื่อมีเบี้ยเรียงติดกันครบ 4 ช่องในหลักเดียวกัน แบบนี้เรียกว่า “แนวตั้ง” และได้คะแนน'},
  {title:'แนวทแยง ซ้ายบนไปขวาล่าง', winners:[0,5,10,15], explanation:'เริ่มจากช่องมุมซ้ายบน แล้วไล่เฉียงลงไปทางขวาจนครบ 4 ช่อง แบบนี้เรียกว่า “แนวทแยง” และได้คะแนน'},
  {title:'แนวทแยง ขวาบนไปซ้ายล่าง', winners:[3,6,9,12], explanation:'เริ่มจากช่องมุมขวาบน แล้วไล่เฉียงลงไปทางซ้ายจนครบ 4 ช่อง นี่ก็เป็น “แนวทแยง” อีกแบบหนึ่งและได้คะแนน'}
];
let currentBingoExample = 0;
function renderBingoExample(index) {
  currentBingoExample = (index + bingoExamples.length) % bingoExamples.length; const example = bingoExamples[currentBingoExample];
  document.querySelector('#bingoExamplePosition').textContent = `แบบที่ ${currentBingoExample + 1} จาก ${bingoExamples.length}`;
  document.querySelector('#bingoExampleTitle').textContent = example.title; document.querySelector('#bingoExampleExplanation').textContent = example.explanation;
  const board = document.querySelector('#bingoExampleBoard'); board.replaceChildren();
  bingoExampleWords.forEach((word, cellIndex) => { const cell = document.createElement('span'); cell.textContent = word; if (example.winners.includes(cellIndex)) { cell.classList.add('winner'); const token = document.createElement('i'); token.textContent = '●'; cell.append(token); } board.append(cell); });
}
document.querySelector('#showBingoExample').addEventListener('click', () => { currentBingoExample = 0; renderBingoExample(0); document.querySelector('#bingoExampleDialog').showModal(); });
document.querySelector('#previousBingoExample').addEventListener('click', () => renderBingoExample(currentBingoExample - 1));
document.querySelector('#nextBingoExample').addEventListener('click', () => renderBingoExample(currentBingoExample + 1));
document.querySelector('#closeBingoExample').addEventListener('click', () => document.querySelector('#bingoExampleDialog').close());

let savedSentenceWords = [];
try { savedSentenceWords = JSON.parse(localStorage.getItem('p1TrainSentences') || '[]'); } catch { savedSentenceWords = []; }
const baseSentenceChallenges = [
  ['ภูผา','รัก','พ่อ','แม่'],
  ['ภูผา','รัก','ใบโบก'],
  ['ภูผา','รัก','ใบบัว'],
  ['ภูผา','ดูแล','ใบโบก'],
  ['ภูผา','ดูแล','ใบบัว'],
  ['ตา','ดูแล','ภูผา'],
  ['ภูผา','หา','ใบโบก'],
  ['ภูผา','หา','ใบบัว'],
  ['ตา','หา','ภูผา'],
  ['พ่อ','หา','ภูผา'],
  ['แม่','หา','ภูผา'],
  ['พ่อ','ให้','ภูผา','ดูแล','ใบโบก'],
  ['พ่อ','ให้','ภูผา','ดูแล','ใบบัว']
];
const challenges = [
  ...baseSentenceChallenges.map(words => ({answers:[words]})),
  ...savedSentenceWords.filter(words => Array.isArray(words) && words.length > 1).map(words => ({answers:[words]}))
];
let currentChallenge = 0;
let currentTrainTiles = [];
let placedTrainTiles = [];
const groupStars = [0,0,0,0,0];
function renderScores() { document.querySelector('#groupScores').innerHTML = groupStars.map((score,i) => `<div class="group-row"><span>กลุ่ม ${i+1}</span><strong>${'★'.repeat(score) || '–'}</strong></div>`).join(''); }
function makeTrainTile(tile, slotIndex = -1) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'word-tile'; button.textContent = tile.word; button.dataset.tileId = tile.id; button.dataset.slotIndex = slotIndex;
  button.draggable = true;
  button.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', String(tile.id)); event.dataTransfer.effectAllowed = 'move'; button.classList.add('drag-source'); });
  button.addEventListener('dragend', () => button.classList.remove('drag-source'));
  button.style.setProperty('--tilt', `${-5 + Math.random() * 10}deg`);
  let ghost = null; let moved = false;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return; event.preventDefault(); moved = false; button.setPointerCapture(event.pointerId);
    ghost = button.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`; document.body.append(ghost); button.classList.add('drag-source');
  });
  button.addEventListener('pointermove', event => { if (!ghost) return; moved = true; ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`; });
  button.addEventListener('pointerup', event => {
    if (!ghost) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.train-slot'); ghost.remove(); ghost = null; button.classList.remove('drag-source');
    if (target) moveTrainTile(Number(tile.id), Number(target.dataset.slotIndex));
    button.dataset.suppressClick = moved ? '1' : '0'; setTimeout(() => { button.dataset.suppressClick = '0'; }, 80);
  });
  button.addEventListener('click', () => {
    if (button.dataset.suppressClick === '1') return;
    if (slotIndex >= 0) moveTrainTile(tile.id, -1); else { const empty = placedTrainTiles.indexOf(null); if (empty >= 0) moveTrainTile(tile.id, empty); }
  });
  return button;
}
function moveTrainTile(tileId, targetSlot) {
  const sourceSlot = placedTrainTiles.indexOf(tileId); if (sourceSlot >= 0) placedTrainTiles[sourceSlot] = null;
  if (targetSlot >= 0) placedTrainTiles[targetSlot] = tileId;
  document.querySelector('.challenge').classList.remove('train-correct','train-wrong'); renderTrainGame();
}
function renderTrainGame() {
  const bank = document.querySelector('#wordBank'); const train = document.querySelector('#trainCars'); bank.replaceChildren(); train.replaceChildren();
  currentTrainTiles.filter(tile => !placedTrainTiles.includes(tile.id)).forEach(tile => bank.append(makeTrainTile(tile)));
  placedTrainTiles.forEach((tileId, index) => { const slot = document.createElement('span'); slot.className = 'train-slot'; slot.dataset.slotIndex = index; slot.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; slot.classList.add('drag-over'); }); slot.addEventListener('dragleave', () => slot.classList.remove('drag-over')); slot.addEventListener('drop', event => { event.preventDefault(); slot.classList.remove('drag-over'); const draggedId = Number(event.dataTransfer.getData('text/plain')); if (Number.isFinite(draggedId)) moveTrainTile(draggedId, index); }); if (tileId !== null) slot.append(makeTrainTile(currentTrainTiles.find(tile => tile.id === tileId), index)); else slot.textContent = `${index + 1}`; train.append(slot); });
}
function showChallenge(index) {
  currentChallenge = (index + challenges.length) % challenges.length;
  const challenge = challenges[currentChallenge]; const words = challenge.answers[0];
  document.querySelector('#challengeNumber').textContent = `โจทย์ที่ ${currentChallenge + 1} จาก ${challenges.length}`;
  document.querySelector('#challengeClue').textContent = 'ลากบัตรคำที่วางสลับกัน มาเรียงบนรถไฟให้เป็นประโยคที่อ่านรู้เรื่อง';
  currentTrainTiles = shuffleItems(words.map((word, id) => ({word,id}))); placedTrainTiles = Array(words.length).fill(null);
  document.querySelector('.challenge').classList.remove('train-correct','train-wrong'); renderTrainGame();
}
document.querySelector('#previousChallenge').addEventListener('click', () => showChallenge(currentChallenge - 1));
document.querySelector('#nextChallenge').addEventListener('click', () => showChallenge(currentChallenge + 1));
document.querySelector('#checkSentence').addEventListener('click', () => {
  const arrangedWords = placedTrainTiles.map(tileId => currentTrainTiles.find(tile => tile.id === tileId)?.word || '');
  const correct = challenges[currentChallenge].answers.some(answer => answer.length === arrangedWords.length && answer.every((word, index) => word === arrangedWords[index])); document.querySelector('.challenge').classList.remove('train-correct','train-wrong'); void document.querySelector('.challenge').offsetWidth; document.querySelector('.challenge').classList.add(correct ? 'train-correct' : 'train-wrong');
  document.querySelector('#challengeClue').textContent = correct ? 'เก่งมาก! เรียงประโยคถูกต้องแล้ว' : 'ยังไม่ถูก ลองสลับตำแหน่งคำแล้วตรวจอีกครั้ง'; playFeedback(correct);
});
document.querySelector('#revealSentence').addEventListener('click', () => { placedTrainTiles = challenges[currentChallenge].answers[0].map((_, index) => index); document.querySelector('.challenge').classList.remove('train-wrong'); document.querySelector('.challenge').classList.add('train-correct'); document.querySelector('#challengeClue').textContent = 'อ่านประโยคบนขบวนรถไฟพร้อมกัน'; renderTrainGame(); });
document.querySelector('#awardStar').addEventListener('click', () => { const index = Number(document.querySelector('#groupSelect').value); groupStars[index] += 1; renderScores(); });
document.querySelector('#addSentence').addEventListener('click', () => document.querySelector('#sentenceDialog').showModal());
document.querySelector('#cancelSentence').addEventListener('click', () => document.querySelector('#sentenceDialog').close());
function renderSentenceList() {
  document.querySelector('#sentenceList').innerHTML = challenges.map((challenge, index) => `<li><span>${index + 1}</span>${challenge.answers[0].join(' ')}</li>`).join('');
}
document.querySelector('#showSentenceList').addEventListener('click', () => { renderSentenceList(); document.querySelector('#sentenceListDialog').showModal(); });
document.querySelector('#closeSentenceList').addEventListener('click', () => document.querySelector('#sentenceListDialog').close());
document.querySelector('#sentenceForm').addEventListener('submit', event => {
  event.preventDefault(); const added = document.querySelector('#newSentences').value.split(',').map(sentence => sentence.trim().split(/\s+/).filter(Boolean)).filter(words => words.length > 1);
  if (!added.length) return; added.forEach(words => challenges.push({answers:[words]})); savedSentenceWords.push(...added); localStorage.setItem('p1TrainSentences', JSON.stringify(savedSentenceWords)); document.querySelector('#newSentences').value = ''; document.querySelector('#sentenceDialog').close(); showChallenge(challenges.length - added.length);
});
renderScores(); showChallenge(0); renderCalledWords();

const drawingCanvas = document.querySelector('#drawingCanvas'); const laserCanvas = document.querySelector('#laserCanvas'); const drawingContext = drawingCanvas.getContext('2d'); const laserContext = laserCanvas.getContext('2d');
let drawingMode = 'pointer'; let drawingActive = false; let laserClearTimer = null;
function resizeDrawingCanvases() {
  const ratio = window.devicePixelRatio || 1;
  [drawingCanvas, laserCanvas].forEach((canvas, index) => { const context = index ? laserContext : drawingContext; canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio); canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; context.setTransform(ratio,0,0,ratio,0,0); context.lineCap = 'round'; context.lineJoin = 'round'; });
}
function setDrawingMode(mode) {
  drawingMode = mode; document.querySelectorAll('[data-draw-mode]').forEach(button => button.classList.toggle('active', button.dataset.drawMode === mode));
  const draws = ['laser','pen','eraser'].includes(mode); drawingCanvas.classList.toggle('drawing-enabled', draws); document.body.classList.toggle('annotation-drawing', draws); document.querySelector('#screenPointer').classList.toggle('active', mode === 'pointer');
}
function drawingPoint(event) { return {x:event.clientX,y:event.clientY}; }
function beginDrawing(event) {
  if (!['laser','pen','eraser'].includes(drawingMode)) return;
  if (event.target instanceof Element && event.target.closest('button,input,textarea,select,a,label,audio,dialog,[role="button"],.annotation-toolbar')) return;
  drawingActive = true; event.preventDefault(); const point = drawingPoint(event); const context = drawingMode === 'laser' ? laserContext : drawingContext;
  context.beginPath(); context.moveTo(point.x, point.y); context.lineWidth = Number(document.querySelector('#drawSize').value); context.strokeStyle = document.querySelector('#drawColor').value; context.globalCompositeOperation = drawingMode === 'eraser' ? 'destination-out' : 'source-over';
  context.shadowColor = drawingMode === 'laser' ? document.querySelector('#drawColor').value : 'transparent'; context.shadowBlur = drawingMode === 'laser' ? Math.max(14, context.lineWidth * 3) : 0; context.globalAlpha = drawingMode === 'laser' ? .95 : 1;
}
function continueDrawing(event) { if (!drawingActive) return; const context = drawingMode === 'laser' ? laserContext : drawingContext; const point = drawingPoint(event); context.lineTo(point.x,point.y); context.stroke(); }
function endDrawing() { if (!drawingActive) return; drawingActive = false; drawingContext.globalAlpha = 1; drawingContext.shadowBlur = 0; if (drawingMode === 'laser') { laserContext.globalAlpha = 1; laserContext.shadowBlur = 0; clearTimeout(laserClearTimer); laserClearTimer = setTimeout(() => laserContext.clearRect(0,0,laserCanvas.width,laserCanvas.height),1000); } }
window.addEventListener('pointerdown', beginDrawing, {passive:false}); window.addEventListener('pointermove', continueDrawing, {passive:false}); window.addEventListener('pointerup', endDrawing); window.addEventListener('pointercancel', endDrawing);
document.querySelectorAll('[data-draw-mode]').forEach(button => button.addEventListener('click', () => setDrawingMode(button.dataset.drawMode)));
document.querySelector('#clearDrawing').addEventListener('click', () => { drawingContext.clearRect(0,0,drawingCanvas.width,drawingCanvas.height); laserContext.clearRect(0,0,laserCanvas.width,laserCanvas.height); });
document.querySelector('#toggleAnnotation').addEventListener('click', () => {
  const toolbar = document.querySelector('#annotationToolbar'); const collapsed = toolbar.classList.toggle('collapsed'); const toggle = document.querySelector('#toggleAnnotation');
  const label = collapsed ? 'เปิดเครื่องมือเขียน' : 'ปิดเครื่องมือเขียน';
  toggle.setAttribute('aria-expanded', String(!collapsed)); toggle.setAttribute('aria-label', label); toggle.title = label; toggle.querySelector('.sr-only').textContent = label;
  if (collapsed) setDrawingMode('pointer');
});
window.addEventListener('pointermove', event => { if (drawingMode !== 'pointer') return; const pointer = document.querySelector('#screenPointer'); pointer.style.left = `${event.clientX}px`; pointer.style.top = `${event.clientY}px`; });
window.addEventListener('resize', resizeDrawingCanvases); resizeDrawingCanvases(); setDrawingMode('pointer');

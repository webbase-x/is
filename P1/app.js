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
document.querySelector('#fullscreenButton').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
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
  shadowImage.src = `img/${encodeURIComponent(file)}`;
  shadowImage.alt = `ภาพครึ่งเงาและครึ่งภาพจริงสำหรับทายคำ ${word}`;
  document.querySelector('#shadowPicture').setAttribute('aria-label', 'ภาพด้านซ้ายเป็นเงา และภาพด้านขวาเป็นภาพจริงสำหรับทายคำ');
}
function renderChoices() {
  const answer = shadowVocabulary[currentShadow][0];
  const distractors = shuffleItems(shadowVocabulary.filter((_, index) => index !== currentShadow)).slice(0, 2).map(item => item[0]);
  const container = document.querySelector('#answerChoices');
  container.innerHTML = '';
  shuffleItems([answer, ...distractors]).forEach(word => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'answer-card'; button.textContent = word;
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
      studentResult.textContent = `${selectedStudent}  ⭐ ⭐ ⭐ ⭐`;
      studentResult.classList.add('student-success');
      document.querySelector('#randomStudent').disabled = true;
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
  const studentResult = document.querySelector('#studentResult'); studentResult.classList.remove('student-success', 'student-minimized'); studentResult.textContent = 'กด “สุ่มชื่อ” เพื่อเลือกผู้ตอบ';
  document.querySelector('#randomStudent').disabled = false; document.querySelector('#minimizeStudent').hidden = true; shuffleShadow();
});
shadowVocabulary.forEach(([, file]) => { const image = new Image(); image.src = `img/${encodeURIComponent(file)}`; });
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
  result.classList.remove('name-pop', 'student-success', 'student-minimized'); button.disabled = true; document.querySelector('#minimizeStudent').hidden = true;
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

const bingoWords = vocabulary.filter(item => item[0] !== 'รัก').map(item => item[0]);
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
  window.p1SpinTimer = setTimeout(() => {
    const index = Math.floor(Math.random() * remainingWords.length);
    const word = remainingWords.splice(index, 1)[0]; calledWords.push(word);
    document.querySelector('#wheelWord').textContent = word; renderCalledWords();
    document.querySelector('#spinWheel').disabled = false;
    document.querySelector('#spinHint').textContent = remainingWords.length ? `เหลืออีก ${remainingWords.length} คำ` : 'ครบทุกคำแล้ว!';
    window.p1SpinTimer = null;
  }, 760);
});
document.querySelector('#resetWheel').addEventListener('click', () => { remainingWords = [...bingoWords]; calledWords = []; document.querySelector('#wheelWord').textContent = 'พร้อม!'; document.querySelector('#spinHint').textContent = 'คำที่ออกแล้วจะไม่ซ้ำจนกว่าจะเริ่มรอบใหม่'; renderCalledWords(); });

const challenges = [
  {picture:'👨 🔎 👦',clue:'พ่อกำลังตามหาภูผา',words:['พ่อ','หา','ภูผา']},
  {picture:'👦 ❤️ 🐘',clue:'ภูผารักใบโบก',words:['ภูผา','รัก','ใบโบก']},
  {picture:'👩 🎁 🐘',clue:'แม่ยื่นของให้ใบโบก',words:['แม่','ให้','ใบโบก']},
  {picture:'👴 🤲 🐘',clue:'ตาดูแลใบบัว',words:['ตา','ดูแล','ใบบัว']},
  {picture:'👦 😄 🐘',clue:'ภูผาดีใจที่ได้ดูแลใบบัว',words:['ภูผา','ดีใจ','ได้','ดูแล','ใบบัว']}
];
let currentChallenge = 0;
const groupStars = [0,0,0,0,0];
function renderScores() { document.querySelector('#groupScores').innerHTML = groupStars.map((score,i) => `<div class="group-row"><span>กลุ่ม ${i+1}</span><strong>${'★'.repeat(score) || '–'}</strong></div>`).join(''); }
function showChallenge(index) {
  currentChallenge = (index + challenges.length) % challenges.length;
  const challenge = challenges[currentChallenge];
  document.querySelector('#challengeNumber').textContent = `โจทย์ที่ ${currentChallenge + 1} จาก ${challenges.length}`;
  document.querySelector('#challengePicture').textContent = challenge.picture;
  document.querySelector('#challengeClue').textContent = challenge.clue;
  document.querySelector('#trainCars').innerHTML = challenge.words.map(word => `<span>${word}</span>`).join('');
  document.querySelector('#trainCars').classList.add('covered');
  document.querySelector('#revealSentence').textContent = 'เปิดเฉลยขบวนรถไฟ';
}
document.querySelector('#previousChallenge').addEventListener('click', () => showChallenge(currentChallenge - 1));
document.querySelector('#nextChallenge').addEventListener('click', () => showChallenge(currentChallenge + 1));
document.querySelector('#revealSentence').addEventListener('click', event => { const covered = document.querySelector('#trainCars').classList.toggle('covered'); event.currentTarget.textContent = covered ? 'เปิดเฉลยขบวนรถไฟ' : 'ซ่อนเฉลย'; });
document.querySelector('#awardStar').addEventListener('click', () => { const index = Number(document.querySelector('#groupSelect').value); groupStars[index] += 1; renderScores(); });
renderScores(); showChallenge(0); renderCalledWords();

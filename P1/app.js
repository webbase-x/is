const activities = [...document.querySelectorAll('.activity')];
const progressButtons = [...document.querySelectorAll('[data-go]')];
const navDots = [...document.querySelectorAll('.activity-position i')];
let currentActivity = Number(sessionStorage.getItem('p1Activity') || 0);

function showActivity(index) {
  currentActivity = Math.max(0, Math.min(activities.length - 1, index));
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
const formatTime = value => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '–:––';
function updateSong() {
  const ratio = song.duration ? song.currentTime / song.duration : 0;
  document.querySelector('#songProgress').style.width = `${ratio * 100}%`;
  document.querySelector('#songTime').textContent = formatTime(song.currentTime);
  const line = Math.min(3, Math.floor(ratio * 4));
  lyricButtons.forEach((button, i) => { button.classList.toggle('active', i === line); button.classList.toggle('past', i < line); });
}
song.addEventListener('loadedmetadata', () => document.querySelector('#songDuration').textContent = formatTime(song.duration));
song.addEventListener('timeupdate', updateSong);
song.addEventListener('play', () => document.querySelector('#playSong').textContent = '❚❚');
song.addEventListener('pause', () => document.querySelector('#playSong').textContent = '▶');
song.addEventListener('ended', () => { song.currentTime = 0; updateSong(); });
document.querySelector('#playSong').addEventListener('click', () => song.paused ? song.play() : song.pause());
document.querySelector('#restartSong').addEventListener('click', () => { song.currentTime = 0; song.play(); });
document.querySelector('#muteSong').addEventListener('click', event => { song.muted = !song.muted; event.currentTarget.textContent = song.muted ? '🔇' : '🔊'; });
lyricButtons.forEach((button, i) => button.addEventListener('click', () => { if (song.duration) song.currentTime = song.duration * i / 4; song.play(); }));

const vocabulary = [
  ['ภูผา','👦','เด็กผู้ชายผู้เป็นเพื่อนของใบโบกและใบบัว','ภู – ผา'],['พ่อ','👨','ผู้ชายผู้ดูแลครอบครัว','พ่อ'],['แม่','👩','ผู้หญิงผู้ให้ความรักและดูแลลูก','แม่'],['ตา','👴','คุณตาผู้สูงอายุในครอบครัว','ตา'],['ใบโบก','🐘','ช้างสีฟ้า เพื่อนของภูผา','ใบ – โบก'],['ใบบัว','🐘','ช้างสีส้ม เพื่อนของภูผา','ใบ – บัว'],['ขา','🦵','อวัยวะที่ใช้ยืนและเดิน','ขา'],['หู','👂','อวัยวะที่ใช้ฟังเสียง','หู'],['งา','🦷','ส่วนสีขาวยาวอยู่ข้างปากช้าง','งา'],['งวง','🐘','จมูกยาวของช้าง ใช้หยิบจับสิ่งของ','งวง'],['หาง','🐿️','ส่วนที่อยู่ด้านหลังของสัตว์','หาง'],['หา','🔎','มองดูเพื่อให้พบสิ่งที่ต้องการ','หา'],['ให้','🎁','ยื่นสิ่งของแก่ผู้อื่น','ให้'],['ได้','🙌','ได้รับหรือทำสำเร็จ','ได้'],['ดีใจ','😄','ความรู้สึกเมื่อมีเรื่องน่ายินดี','ดี – ใจ'],['ดูแล','🤲','เอาใจใส่และช่วยเหลือ','ดู – แล'],['รัก','❤️','ความรู้สึกผูกพันและห่วงใย','รัก']
];
let currentWord = 0;
const wordList = document.querySelector('#wordList');
vocabulary.forEach((item, i) => { const button = document.createElement('button'); button.textContent = item[0]; button.addEventListener('click', () => showWord(i)); wordList.append(button); });
function showWord(index) {
  currentWord = (index + vocabulary.length) % vocabulary.length;
  const [word, picture, clue, spelling] = vocabulary[currentWord];
  document.querySelector('#shadowCount').textContent = `คำที่ ${currentWord + 1} จาก ${vocabulary.length}`;
  document.querySelector('#shadowPicture span').textContent = picture;
  document.querySelector('#wordClue').textContent = clue;
  document.querySelector('#wordAnswer').textContent = word;
  document.querySelector('#wordSpelling').textContent = spelling;
  document.querySelector('#shadowPicture').classList.add('hidden-picture');
  document.querySelector('#answerArea').classList.add('hidden-answer');
  document.querySelector('#revealWord').textContent = 'เปิดภาพและเฉลย';
  [...wordList.children].forEach((button, i) => button.classList.toggle('active', i === currentWord));
}
document.querySelector('#previousWord').addEventListener('click', () => showWord(currentWord - 1));
document.querySelector('#nextWord').addEventListener('click', () => showWord(currentWord + 1));
document.querySelector('#revealWord').addEventListener('click', event => { const hidden = document.querySelector('#answerArea').classList.toggle('hidden-answer'); document.querySelector('#shadowPicture').classList.toggle('hidden-picture', hidden); event.currentTarget.textContent = hidden ? 'เปิดภาพและเฉลย' : 'ซ่อนเฉลย'; });
showWord(0);

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
  setTimeout(() => {
    const index = Math.floor(Math.random() * remainingWords.length);
    const word = remainingWords.splice(index, 1)[0]; calledWords.push(word);
    document.querySelector('#wheelWord').textContent = word; renderCalledWords();
    document.querySelector('#spinWheel').disabled = false;
    document.querySelector('#spinHint').textContent = remainingWords.length ? `เหลืออีก ${remainingWords.length} คำ` : 'ครบทุกคำแล้ว!';
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

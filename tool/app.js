const STORAGE_KEY = 'plern-thai-teacher-toolkit-v1';
const SUPABASE_URL = 'https://xnpzkhjodokvcgzovlxx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_r0M5jKyJcrQAKstRlmYOdQ_J_0aLofN';
const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const defaultWords = ['ภูผา','ใบโบก','ใบบัว','พ่อ','แม่','ตา','ดูแล','หา','รัก','ดีใจ','หู','งา','ขา','หาง','งวง','ได้'];
const tools = [
  {id:'bingo-tool',icon:'▦',title:'สร้างสื่อปิงโก',description:'สร้างตารางคำศัพท์เฉพาะชั้นเรียน กำหนดจำนวนผู้เล่นและพิมพ์เป็น PDF',action:'เปิดเครื่องมือ →'},
  {id:'wheel-tool',icon:'◉',title:'วงล้อสุ่มคำ',description:'สุ่มคำแบบไม่ซ้ำ พร้อมเสียงเอฟเฟกต์และบันทึกผู้ชนะในเครื่อง',action:'เปิดเครื่องมือ →'},
  {icon:'＋',title:'เครื่องมือถัดไป',description:'พื้นที่สำหรับเพิ่มเครื่องมืออำนวยความสะดวกในการสอนในอนาคต',action:'เร็ว ๆ นี้',comingSoon:true}
];

const parseWords = value => [...new Set(value.split(/[\n,]+/).map(word => word.trim()).filter(Boolean))];
const shuffle = items => { const copy = [...items]; for (let index = copy.length - 1; index > 0; index -= 1) { const swapIndex = Math.floor(Math.random() * (index + 1)); [copy[index],copy[swapIndex]] = [copy[swapIndex],copy[index]]; } return copy; };
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const loadState = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
let state = loadState();
const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const directory = document.querySelector('#toolDirectory');
directory.innerHTML = tools.map(tool => tool.comingSoon ? `<article class="tool-card coming-soon"><div class="icon">${tool.icon}</div><h3>${tool.title}</h3><p>${tool.description}</p><strong>${tool.action}</strong></article>` : `<a class="tool-card" href="#${tool.id}"><div class="icon">${tool.icon}</div><h3>${tool.title}</h3><p>${tool.description}</p><strong>${tool.action}</strong></a>`).join('');

const wordInput = document.querySelector('#wordInput');
const boardSize = document.querySelector('#boardSize');
const playerCount = document.querySelector('#playerCount');
const bingoBoards = document.querySelector('#bingoBoards');
const bingoMessage = document.querySelector('#bingoMessage');
const boardSummary = document.querySelector('#boardSummary');
const printBoards = document.querySelector('#printBoards');
let currentBoards = Array.isArray(state.currentBoards) ? state.currentBoards : [];
wordInput.value = (state.bingoWords || defaultWords).join('\n');

function buildBoards(words, size, players) {
  const required = size ** 2;
  const selected = words.length > required ? words : words;
  const boards = []; const signatures = new Set(); let attempts = 0;
  while (boards.length < players && attempts < players * 40) {
    const board = shuffle(selected).slice(0, required); const signature = board.join('|'); attempts += 1;
    if (!signatures.has(signature)) { signatures.add(signature); boards.push(board); }
  }
  return boards;
}
function renderBoards(size) {
  bingoBoards.innerHTML = currentBoards.map((board, index) => `<article class="bingo-board"><header><strong>บิงโก!</strong><span>ผู้เล่น ${index + 1}</span></header><div class="bingo-grid" style="grid-template-columns:repeat(${size},1fr)">${board.map(word => `<span class="bingo-cell">${escapeHtml(word)}</span>`).join('')}</div></article>`).join('');
}
document.querySelector('#bingoForm').addEventListener('submit', event => {
  event.preventDefault(); const words = parseWords(wordInput.value); const size = Number(boardSize.value); const players = Math.min(60, Math.max(1, Number(playerCount.value) || 1)); const required = size ** 2;
  if (words.length < required) { bingoMessage.textContent = `ตาราง ${size} × ${size} ต้องมีอย่างน้อย ${required} คำ (ตอนนี้มี ${words.length} คำ)`; printBoards.disabled = true; return; }
  currentBoards = buildBoards(words, size, players); state.currentBoards = currentBoards; state.bingoWords = words; state.lastBoardSize = size; state.lastPlayers = players; saveState(); renderBoards(size);
  bingoMessage.textContent = currentBoards.length < players ? `สร้างได้ ${currentBoards.length} ตารางที่ไม่ซ้ำจากคำที่มี` : '';
  boardSummary.textContent = `${currentBoards.length} ตาราง · ${size} × ${size}`; printBoards.disabled = !currentBoards.length;
});
printBoards.addEventListener('click', () => {
  if (!currentBoards.length) return; const size = Number(boardSize.value); const pages = currentBoards.map((board,index) => `<section class="print-page"><header><h1>บิงโกคำศัพท์</h1><p>ผู้เล่น ${index + 1} &nbsp; ชื่อ ____________________</p></header><main style="grid-template-columns:repeat(${size},1fr)">${board.map(word => `<div>${escapeHtml(word)}</div>`).join('')}</main><footer>ฟังคำจากวงล้อ แล้ววางเบี้ยบนคำที่ตรงกัน</footer></section>`).join('');
  const printWindow = window.open('', '_blank'); if (!printWindow) { bingoMessage.textContent = 'เบราว์เซอร์ปิดกั้นหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัปแล้วลองอีกครั้ง'; return; } printWindow.opener = null; printWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ตารางบิงโก</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,'Noto Sans Thai',sans-serif;color:#222}.print-page{break-after:page;min-height:270mm}.print-page:last-child{break-after:auto}header{display:flex;justify-content:space-between;align-items:end;border-bottom:3px solid #5b3fd0}h1{margin:0;color:#5b3fd0;font-size:28pt}p{font-size:13pt}main{display:grid;gap:7px;margin-top:16px}main div{min-height:44mm;display:grid;place-items:center;padding:4mm;border:2px solid #5b3fd0;border-radius:5mm;font-size:20pt;font-weight:bold;text-align:center}footer{margin-top:10mm;text-align:center;font-size:12pt;color:#555}</style></head><body>${pages}<script>window.onload=()=>window.print()<\/script></body></html>`); printWindow.document.close();
});

const wheelWordsInput = document.querySelector('#wheelWords');
const wheel = document.querySelector('#wheel');
const selectedWord = document.querySelector('#selectedWord');
const wheelHint = document.querySelector('#wheelHint');
const calledWords = document.querySelector('#calledWords');
const calledCount = document.querySelector('#calledCount');
const remainingCount = document.querySelector('#remainingCount');
const winnerList = document.querySelector('#winnerList');
let wheelWords = state.wheelWords || state.bingoWords || defaultWords;
let called = state.calledWords || [];
let rotation = 0; let spinning = false; let soundEnabled = state.soundEnabled !== false;
wheelWordsInput.value = wheelWords.join('\n');
function drawWheel() { const colors = ['#6545d8','#f47b5f','#f7bd47','#21a88b','#9270ed','#ef9c68','#f3d464','#35bda0']; const slices = Math.max(1, wheelWords.length); const step = 360 / slices; wheel.style.background = `conic-gradient(${wheelWords.map((word,index) => `${colors[index % colors.length]} ${index * step}deg ${(index + 1) * step}deg`).join(',')})`; }
function renderCalled() { const remaining = wheelWords.filter(word => !called.includes(word)); const disabled = !remaining.length || spinning; remainingCount.textContent = `เหลือ ${remaining.length} คำ`; calledCount.textContent = `${called.length} คำ`; calledWords.innerHTML = called.length ? called.map(word => `<span>${escapeHtml(word)}</span>`).join('') : '<p>ยังไม่มีคำที่สุ่ม</p>'; wheel.classList.toggle('is-disabled', disabled); wheel.setAttribute('aria-disabled', String(disabled)); }
function renderWinners() { const winners = state.winners || []; winnerList.innerHTML = winners.length ? winners.map(item => `<li><span>🏆 ${escapeHtml(item.name)}</span><small>${escapeHtml(item.word)} · ${escapeHtml(item.time)}</small></li>`).join('') : '<li class="empty-winner">ยังไม่มีผู้ชนะที่บันทึกไว้</li>'; }
function persistWheel() { state.wheelWords = wheelWords; state.calledWords = called; state.soundEnabled = soundEnabled; saveState(); }
function playTone(frequency, duration, start = 0, type = 'sine') { if (!soundEnabled) return; try { const context = new (window.AudioContext || window.webkitAudioContext)(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, context.currentTime + start); gain.gain.setValueAtTime(.0001, context.currentTime + start); gain.gain.exponentialRampToValueAtTime(.12, context.currentTime + start + .02); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + start + duration); oscillator.connect(gain).connect(context.destination); oscillator.start(context.currentTime + start); oscillator.stop(context.currentTime + start + duration + .03); } catch {} }
function updateWheelWords() { wheelWords = parseWords(wheelWordsInput.value); called = called.filter(word => wheelWords.includes(word)); selectedWord.textContent = called.at(-1) || 'พร้อม!'; drawWheel(); renderCalled(); persistWheel(); }
wheelWordsInput.addEventListener('change', updateWheelWords);
document.querySelector('#useBingoWords').addEventListener('click', () => { const words = parseWords(wordInput.value); if (!words.length) return; wheelWordsInput.value = words.join('\n'); updateWheelWords(); wheelHint.textContent = 'นำคำจากเครื่องมือปิงโกมาใช้แล้ว'; });
function spinWheel() {
  const remaining = wheelWords.filter(word => !called.includes(word)); if (!remaining.length || spinning) return; spinning = true; renderCalled(); const selected = remaining[Math.floor(Math.random() * remaining.length)]; const slice = 360 / Math.max(1,wheelWords.length); const selectedIndex = wheelWords.indexOf(selected); const previewWords = shuffle(remaining); let previewIndex = 0;
  rotation += 1080 + (360 - selectedIndex * slice - slice / 2); wheel.style.setProperty('--rotation', `${rotation}deg`); wheel.classList.add('spinning'); wheelHint.textContent = 'กำลังสุ่มคำ…'; const previewTimer = window.setInterval(() => { selectedWord.textContent = previewWords[previewIndex % previewWords.length]; previewIndex += 1; }, 85);
  window.setTimeout(() => { window.clearInterval(previewTimer); called.push(selected); selectedWord.textContent = selected; wheelHint.textContent = `คำที่ ${called.length}: ${selected}`; wheel.classList.remove('spinning'); spinning = false; playTone(660,.14,0,'sine'); playTone(880,.25,.15,'sine'); persistWheel(); renderCalled(); }, 3000);
}
wheel.addEventListener('click', spinWheel);
wheel.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); spinWheel(); } });
document.querySelector('#newRound').addEventListener('click', () => { called = []; selectedWord.textContent = 'พร้อม!'; wheelHint.textContent = 'เริ่มรอบใหม่แล้ว คำจะยังไม่ซ้ำจนกว่าจะออกครบ'; persistWheel(); renderCalled(); });
document.querySelector('#soundToggle').addEventListener('click', event => { soundEnabled = !soundEnabled; event.currentTarget.setAttribute('aria-pressed', String(soundEnabled)); event.currentTarget.textContent = soundEnabled ? '🔊 เสียง' : '🔇 ปิดเสียง'; persistWheel(); });
document.querySelector('#winnerForm').addEventListener('submit', event => { event.preventDefault(); const input = document.querySelector('#winnerName'); const name = input.value.trim(); if (!name) { input.focus(); return; } const word = selectedWord.textContent === 'พร้อม!' ? 'ยังไม่ได้หมุนคำ' : selectedWord.textContent; state.winners = [{name,word,time:new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date())},...(state.winners || [])].slice(0,30); saveState(); input.value = ''; renderWinners(); playTone(784,.12,0,'sine'); playTone(1046,.28,.13,'sine'); });
document.querySelector('#clearWinners').addEventListener('click', () => { if (!state.winners?.length || !confirm('ล้างประวัติผู้ชนะที่บันทึกในเครื่องนี้หรือไม่?')) return; state.winners = []; saveState(); renderWinners(); });
boardSize.value = state.lastBoardSize || '4'; playerCount.value = state.lastPlayers || 10; document.querySelector('#soundToggle').setAttribute('aria-pressed', String(soundEnabled)); document.querySelector('#soundToggle').textContent = soundEnabled ? '🔊 เสียง' : '🔇 ปิดเสียง'; drawWheel(); renderCalled(); renderWinners(); if (currentBoards.length) { renderBoards(Number(boardSize.value)); boardSummary.textContent = currentBoards.length + ' ตาราง · ' + boardSize.value + ' × ' + boardSize.value; printBoards.disabled = false; }

const cloudSignedOut = document.querySelector('#cloudSignedOut');
const cloudSignedIn = document.querySelector('#cloudSignedIn');
const cloudMessage = document.querySelector('#cloudMessage');
const cloudSaveList = document.querySelector('#cloudSaveList');
const setCloudMessage = (message, isError = false) => { cloudMessage.textContent = message; cloudMessage.classList.toggle('is-error', isError); };

function buildCloudPayload() {
  return {
    bingoWords: parseWords(wordInput.value),
    lastBoardSize: Number(boardSize.value),
    lastPlayers: Number(playerCount.value) || 1,
    currentBoards,
    wheelWords: parseWords(wheelWordsInput.value),
    calledWords: called,
    soundEnabled,
    winners: state.winners || []
  };
}
async function refreshCloudSaves() {
  if (!cloudClient) return;
  const { data, error } = await cloudClient.from('toolkit_saves').select('id,name,updated_at').order('updated_at', { ascending: false });
  if (error) { setCloudMessage('โหลดรายการบันทึกไม่สำเร็จ: ' + error.message, true); return; }
  cloudSaveList.innerHTML = data.length ? data.map(item => '<option value="' + item.id + '">' + escapeHtml(item.name) + ' · ' + new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.updated_at)) + '</option>').join('') : '<option value="">ยังไม่มีข้อมูล</option>';
}
async function refreshCloudAuth() {
  if (!cloudClient) { setCloudMessage('ไม่สามารถเชื่อมต่อระบบบันทึกออนไลน์ได้', true); return; }
  const { data: { session } } = await cloudClient.auth.getSession();
  const signedIn = Boolean(session?.user);
  cloudSignedOut.hidden = signedIn; cloudSignedIn.hidden = !signedIn;
  document.querySelector('#cloudUserEmail').textContent = session?.user?.email || '';
  if (signedIn) await refreshCloudSaves();
}
document.querySelector('#cloudGoogleSignIn').addEventListener('click', async () => {
  if (!cloudClient) { setCloudMessage('ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้', true); return; }
  setCloudMessage('กำลังเปิดหน้าเข้าสู่ระบบ Google…');
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await cloudClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } }
  });
  if (error) setCloudMessage('เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ' + error.message, true);
});
document.querySelector('#cloudSignOut').addEventListener('click', async () => { await cloudClient.auth.signOut(); setCloudMessage('ออกจากระบบแล้ว'); await refreshCloudAuth(); });
document.querySelector('#cloudSave').addEventListener('click', async () => {
  const name = document.querySelector('#cloudSaveName').value.trim(); if (!name) { setCloudMessage('กรุณาตั้งชื่อชุดที่จะบันทึก', true); return; }
  const { data: { user } } = await cloudClient.auth.getUser(); if (!user) { setCloudMessage('กรุณาเข้าสู่ระบบก่อนบันทึก', true); return; }
  const payload = buildCloudPayload(); state = {...state, ...payload}; saveState(); setCloudMessage('กำลังบันทึก…');
  const { error } = await cloudClient.from('toolkit_saves').upsert({ user_id:user.id, name, data:payload, updated_at:new Date().toISOString() }, { onConflict:'user_id,name' });
  if (error) { setCloudMessage('บันทึกไม่สำเร็จ: ' + error.message, true); return; }
  setCloudMessage('บันทึก “' + name + '” แล้ว เปิดใช้จากเครื่องอื่นได้'); await refreshCloudSaves();
});
document.querySelector('#cloudLoad').addEventListener('click', async () => {
  const id = cloudSaveList.value; if (!id) return;
  setCloudMessage('กำลังเปิดข้อมูล…'); const { data, error } = await cloudClient.from('toolkit_saves').select('name,data').eq('id', id).single();
  if (error) { setCloudMessage('เปิดข้อมูลไม่สำเร็จ: ' + error.message, true); return; }
  state = {...state, ...data.data}; saveState();
  wordInput.value = (state.bingoWords || defaultWords).join('\n'); boardSize.value = state.lastBoardSize || '4'; playerCount.value = state.lastPlayers || 10;
  currentBoards = Array.isArray(state.currentBoards) ? state.currentBoards : []; bingoBoards.innerHTML = currentBoards.length ? '' : '<div class="empty-state">ชุดนี้ยังไม่มีตารางที่สร้างไว้</div>';
  if (currentBoards.length) renderBoards(Number(boardSize.value)); boardSummary.textContent = currentBoards.length ? currentBoards.length + ' ตาราง · ' + boardSize.value + ' × ' + boardSize.value : 'รอสร้างตาราง'; printBoards.disabled = !currentBoards.length;
  wheelWords = state.wheelWords || state.bingoWords || defaultWords; called = state.calledWords || []; soundEnabled = state.soundEnabled !== false; wheelWordsInput.value = wheelWords.join('\n');
  selectedWord.textContent = called.at(-1) || 'พร้อม!'; drawWheel(); renderCalled(); renderWinners();
  document.querySelector('#soundToggle').setAttribute('aria-pressed', String(soundEnabled)); document.querySelector('#soundToggle').textContent = soundEnabled ? '🔊 เสียง' : '🔇 ปิดเสียง';
  setCloudMessage('เปิดชุด “' + data.name + '” แล้ว');
});
document.querySelector('#cloudDelete').addEventListener('click', async () => {
  const id = cloudSaveList.value; if (!id || !confirm('ลบชุดที่บันทึกนี้หรือไม่?')) return;
  const { error } = await cloudClient.from('toolkit_saves').delete().eq('id', id);
  if (error) { setCloudMessage('ลบไม่สำเร็จ: ' + error.message, true); return; }
  setCloudMessage('ลบชุดที่บันทึกแล้ว'); await refreshCloudSaves();
});
cloudClient?.auth.onAuthStateChange(() => window.setTimeout(refreshCloudAuth, 0));
refreshCloudAuth();

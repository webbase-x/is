import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://xnpzkhjodokvcgzovlxx.supabase.co','sb_publishable_r0M5jKyJcrQAKstRlmYOdQ_J_0aLofN');
const lesson=location.pathname.includes('thai-consonants')?'thai-consonants':'unit1-lesson1';
const blocks=lesson==='thai-consonants'?[...document.querySelectorAll('main>.panel,main>.grid,main>.game')]:[...document.querySelectorAll('main>.grid,main>.panel,main>.game')];
const css=document.createElement('style');css.textContent='.p1-auth{margin-left:auto;display:flex;gap:8px;align-items:center;font-size:.9rem}.p1-login,.p1-pass{border:0;border-radius:12px;padding:9px 13px;background:#5848d7;color:white;font-weight:800;cursor:pointer}.p1-gate{padding:28px;text-align:center;background:#fff;border:2px dashed #b7acee;border-radius:18px;margin:20px 0}.p1-stage[hidden]{display:none!important}.p1-pass{display:block;margin:18px auto 0;background:#228b58}.p1-stage-label{font-weight:900;color:#5848d7;margin-bottom:8px}';document.head.append(css);
const auth=document.createElement('div');auth.className='p1-auth';document.querySelector('.bar')?.append(auth);
let user=null,stage=1,points=0;
function paint(){blocks.forEach((b,i)=>{b.classList.add('p1-stage');b.hidden=!user||i+1>stage;if(i+1<=stage&&!b.querySelector('.p1-pass')){const x=document.createElement('div');x.className='p1-stage-label';x.textContent='ด่าน '+(i+1)+' จาก '+blocks.length;b.prepend(x);if(i+1<blocks.length){const p=document.createElement('button');p.className='p1-pass';p.textContent='ผ่านด่านนี้ · ไปด่านถัดไป →';p.onclick=()=>complete(i+2);b.append(p)}}});document.querySelector('.hero')?.toggleAttribute('hidden',!user)}
async function save(){if(!user)return;await db.from('p1_learning_progress').upsert({user_id:user.id,lesson_key:lesson,current_stage:stage,completed_stages:Array.from({length:stage-1},(_,i)=>i+1),total_points:points,last_activity_at:new Date().toISOString()},{onConflict:'user_id,lesson_key'})}
async function complete(next){stage=Math.max(stage,next);await save();paint();window.scrollTo({top:0,behavior:'smooth'})}
async function score(game){if(!user)return;points+=1;await db.from('p1_game_scores').insert({user_id:user.id,lesson_key:lesson,game_key:game,score:1,max_score:1});await save()}
function renderAuth(){auth.innerHTML=user?'<span>👤 '+(user.user_metadata.full_name||user.email||'ผู้เรียน')+'</span><button class="p1-login">ออกจากระบบ</button>':'<button class="p1-login">เข้าสู่ระบบด้วย Google</button>';auth.querySelector('button').onclick=async()=>{if(user)await db.auth.signOut();else await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href}})}}
const gate=document.createElement('div');gate.className='p1-gate';gate.innerHTML='<h2>🔐 เริ่มเรียนด้วยบัญชี Google</h2><p>เพื่อบันทึกด่านที่เรียน คะแนนเกม และประวัติการเข้าใช้ของคุณ</p><button class="p1-login">เข้าสู่ระบบด้วย Google</button>';gate.querySelector('button').onclick=()=>db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href}});document.querySelector('main')?.prepend(gate);
db.auth.onAuthStateChange(async(_e,s)=>{user=s?.user||null;gate.hidden=!!user;renderAuth();if(user){const{data}=await db.from('p1_learning_progress').select('*').eq('lesson_key',lesson).maybeSingle();stage=data?.current_stage||1;points=data?.total_points||0}paint()});
document.addEventListener('click',e=>{if(!user)return;const b=e.target.closest('.choice');if(b)setTimeout(()=>{if(b.closest('.game')?.querySelector('.ok'))score('quiz')},60);const m=e.target.closest('.match.done');if(m)score('match')});

// Thai read-aloud controls: headings, directions, stories, and the current unlocked stage.
const speech=window.speechSynthesis;
function thaiVoice(){return speech.getVoices().find(v=>/^th(-|_)/i.test(v.lang))||speech.getVoices().find(v=>/thai|ไทย/i.test(v.name))}
function readText(text){speech.cancel();const u=new SpeechSynthesisUtterance(String(text).replace(/🔐|👤|→|·/g,' ').replace(/\s+/g,' ').trim());u.lang='th-TH';const v=thaiVoice();if(v)u.voice=v;u.rate=.86;u.pitch=1;speech.speak(u)}
speech.onvoiceschanged=()=>thaiVoice();
const reader=document.createElement('div');reader.className='p1-auth';reader.innerHTML='<button class="p1-login" type="button">🔊 อ่านทั้งด่าน</button><button class="p1-login" type="button">■ หยุดอ่าน</button>';
document.querySelector('.bar')?.append(reader);
reader.children[0].onclick=()=>{const active=blocks[Math.max(0,stage-1)];readText(active?.innerText||document.querySelector('main')?.innerText)};
reader.children[1].onclick=()=>speech.cancel();
document.addEventListener('click',event=>{const t=event.target.closest('h1,h2,h3,p,.story,.eyebrow,.word-card,.letter');if(!t||t.closest('.p1-auth'))return;if(t.classList.contains('word-card')||t.classList.contains('letter'))return;readText(t.innerText)});

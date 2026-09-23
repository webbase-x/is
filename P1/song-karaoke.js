(function(){
'use strict';

var TRACKS={
 23:{title:'โยกไป โยกมา',fileId:'1mRUcfGRtSZhQKrCAnhwpMa_z-XZeYLxa',duration:81.998,start:5.11,cycle:20.43,lastRow:5},
 33:{title:'เพื่อนภูผา',fileId:'14WaMWmBmkhDBCeb9jQQ6Bs_KrM7Cv03S',duration:90.697,start:5.72,cycle:35.11,lastRow:5},
 43:{title:'เพื่อนลูกช้าง',fileId:'1XVDii5UgtAESMNbDNVkZC6AZ4p4DDiQV',duration:116.637,start:5.81,cycle:38.64,lastRow:5},
 54:{title:'โป๊กเป๊ก',fileId:'1Q6y-bP9L2f-tnuLAdXMZBuzw2H9xbSS4',duration:112.875,start:8.29,cycle:32.60,lastRow:6},
 64:{title:'ลากันไปโรงเรียน',fileId:'1YcEOfinsHiOg6uN8d5gJH7TPaOerltbD',duration:137.691,start:4.49,cycle:29.72,lastRow:5},
 73:{title:'ฝึกจูงหาง',fileId:'1zFBFGZsJTg8-UJSxxThYa9SAtmb0lig2',duration:134.949,start:4.76,cycle:32.70,lastRow:5},
 89:{title:'ช้างอาบน้ำ',fileId:'1_y7pyQyONxgylGieg27SJKcdOxZMZC6f',duration:132.101,start:4.60,cycle:31.21,lastRow:9},
 101:{title:'ช้างก็มีหัวใจ',fileId:'1X-vcZFacrk_jFIgvuI-XvsCfUmiz3bdK',duration:141.688,start:4.06,cycle:28.42,lastRow:9},
 117:{title:'จ้องตากัน',fileId:'1r0UJBovuPpJDibhw5GIVCOzLUfzKPxXk',duration:154.070,start:6.09,cycle:56.56,lastRow:7},
 131:{title:'ดินโป่ง',fileId:'1kfnd_Wo-Taq9S9uYc7YCamHMzH_gP-Zy',duration:114.547,start:6.09,cycle:37.71,lastRow:9},
 147:{title:'อายจัง อายจัง',fileId:'1gsN-YAfjotwe4xq1Y9mCL0bskEQebrsr',duration:179.540,start:5.72,cycle:42.63,lastRow:15},
 161:{title:'ปีใหม่ไทย',fileId:'1kCjstBxa0POpfyzObK1-N2-cwnu7CD1Q',duration:163.187,start:6.11,cycle:33.67,lastRow:13}
};

var state={
 audio:null,frame:0,cfg:null,schedule:[],activeKey:'',stage:null,button:null,
 stopSpeech:null,ensureSound:null
};

function configForPage(page){return TRACKS[Number(page)]||null}
function audioUrl(cfg){return 'https://drive.google.com/uc?export=download&id='+encodeURIComponent(cfg.fileId)}
function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function formatTime(sec){sec=Math.max(0,Number(sec)||0);var m=Math.floor(sec/60),s=Math.floor(sec%60);return m+':'+String(s).padStart(2,'0')}

function playerMarkup(cfg){
 return '<section class="song-karaoke-panel" aria-label="เครื่องเล่นเพลงคาราโอเกะ">'+
   '<div class="song-karaoke-head"><strong>🎵 '+escapeHtml(cfg.title)+'</strong><span id="songKaraokeStatus">พร้อมร้องตามเพลง</span></div>'+
   '<input id="songSeek" class="song-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="เลื่อนไปตำแหน่งในเพลง">'+
   '<div class="song-karaoke-foot"><span id="songTime">0:00 / '+formatTime(cfg.duration)+'</span><button type="button" id="songRestart">↺ เริ่มเพลงใหม่</button></div>'+
   '<small>คาราโอเกะไฮไลต์คำตามจังหวะของเพลงต้นฉบับ</small>'+
  '</section>';
}

function clearHighlights(){
 if(state.stage)state.stage.querySelectorAll('.song-word-active,.song-row-active').forEach(function(el){el.classList.remove('song-word-active','song-row-active')});
 state.activeKey='';
}

function tokensTouch(a,b){
 if(!a||!a.b||!b||!b.b)return false;
 var gap=b.b[0]-(a.b[0]+a.b[2]);
 var overlap=Math.min(a.b[1]+a.b[3],b.b[1]+b.b[3])-Math.max(a.b[1],b.b[1]);
 var minH=Math.min(a.b[3],b.b[3]);
 return gap<=0.30&&overlap>=minH*0.45;
}

function tokenWeight(text){
 var base=String(text||'').normalize('NFC').replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\s]/g,'');
 return Math.max(0.8,Math.min(2.2,base.length/2.2));
}

function rowGroups(data,r){
 var row=data&&data.rows&&data.rows[r]||[],groups=[];
 row.forEach(function(token,i){
  var last=groups[groups.length-1];
  if(last&&tokensTouch(last.tokens[last.tokens.length-1].token,token)){
   last.tokens.push({r:r,i:i,token:token});
   last.label+=token.t;
  }else{
   groups.push({r:r,tokens:[{r:r,i:i,token:token}],label:token.t});
  }
 });
 return groups;
}

function buildSchedule(cfg,data){
 var rows=[];
 var last=Math.min(cfg.lastRow,(data&&data.rows?data.rows.length:1)-1);
 for(var r=1;r<=last;r++){
  var groups=rowGroups(data,r);
  if(!groups.length)continue;
  var groupWeight=groups.reduce(function(sum,g){return sum+tokenWeight(g.label)},0);
  rows.push({r:r,groups:groups,weight:Math.max(1,1+(groupWeight-4)*0.12)});
 }
 var total=rows.reduce(function(sum,row){return sum+row.weight},0)||1,cursor=0,out=[];
 rows.forEach(function(row){
  var rowDur=cfg.cycle*(row.weight/total);
  var weights=row.groups.map(function(g){return tokenWeight(g.label)});
  var sum=weights.reduce(function(a,b){return a+b},0)||1,within=0;
  row.groups.forEach(function(g,i){
   var dur=rowDur*(weights[i]/sum),start=cursor+within,end=start+dur;
   out.push({key:String(row.r)+':'+String(i),row:row.r,refs:g.tokens.map(function(x){return {r:x.r,i:x.i}}),label:g.label,start:start,end:end});
   within+=dur;
  });
  cursor+=rowDur;
 });
 return out;
}

function updateButton(){
 var btn=state.button;if(!btn||!state.cfg)return;
 var playing=!!state.audio&&!state.audio.paused&&!state.audio.ended;
 btn.innerHTML='<span class="book-control-icon">'+(playing?'⏸':'🎵')+'</span><span>'+(playing?'หยุดเพลง':'เล่นเพลง')+'</span>';
 btn.setAttribute('aria-label',playing?'หยุดเพลงคาราโอเกะ':'เล่นเพลงคาราโอเกะ');
}

function syncControls(time){
 if(!state.cfg||!state.stage)return;
 var t=Math.max(0,Number(time)||0);
 var seek=state.stage.querySelector('#songSeek'),clock=state.stage.querySelector('#songTime');
 if(seek)seek.value=String(Math.round(Math.min(1,t/state.cfg.duration)*1000));
 if(clock)clock.textContent=formatTime(t)+' / '+formatTime(state.cfg.duration);
}

function updateHighlight(time){
 if(!state.cfg||!state.schedule.length||!state.stage)return;
 syncControls(time);
 var status=state.stage.querySelector('#songKaraokeStatus');
 if(time<state.cfg.start){
  if(state.activeKey!=='intro'){clearHighlights();state.activeKey='intro'}
  if(status)status.textContent='🎼 อินโทร · เตรียมร้อง';
  return;
 }
 var local=(time-state.cfg.start)%state.cfg.cycle,active=state.schedule[state.schedule.length-1];
 for(var i=0;i<state.schedule.length;i++){
  if(local>=state.schedule[i].start&&local<state.schedule[i].end){active=state.schedule[i];break}
 }
 if(!active||state.activeKey===active.key)return;
 clearHighlights();state.activeKey=active.key;
 active.refs.forEach(function(ref){
  state.stage.querySelectorAll('[data-native-word="'+ref.r+':'+ref.i+'"]').forEach(function(el){el.classList.add('song-word-active')});
 });
 state.stage.querySelectorAll('[data-native-row="'+active.row+'"]').forEach(function(el){el.classList.add('song-row-active')});
 if(status)status.textContent='กำลังร้อง: '+active.label;
}

function frameTick(){
 if(!state.audio||state.audio.paused||state.audio.ended){state.frame=0;return}
 updateHighlight(state.audio.currentTime);
 state.frame=requestAnimationFrame(frameTick);
}

function pause(clear){
 if(state.frame){cancelAnimationFrame(state.frame);state.frame=0}
 if(state.audio&&!state.audio.paused)state.audio.pause();
 if(clear!==false)clearHighlights();
 updateButton();
}

function dispose(){
 pause(true);
 if(state.audio){
  state.audio.onplay=state.audio.onpause=state.audio.onended=state.audio.onerror=state.audio.ontimeupdate=null;
  try{state.audio.removeAttribute('src');state.audio.load()}catch(_){}
 }
 state.audio=null;state.cfg=null;state.schedule=[];state.activeKey='';
 state.stage=null;state.button=null;state.stopSpeech=null;state.ensureSound=null;
}

function setup(opts){
 dispose();
 if(!opts||!opts.cfg||!opts.stage||!opts.data)return;
 state.cfg=opts.cfg;state.stage=opts.stage;state.button=opts.button||null;
 state.stopSpeech=typeof opts.stopSpeech==='function'?opts.stopSpeech:null;
 state.ensureSound=typeof opts.ensureSound==='function'?opts.ensureSound:null;
 state.schedule=buildSchedule(state.cfg,opts.data);
 state.audio=new Audio(audioUrl(state.cfg));
 state.audio.preload='metadata';
 state.audio.playsInline=true;
 state.audio.onplay=function(){updateButton();if(state.frame)cancelAnimationFrame(state.frame);frameTick()};
 state.audio.onpause=function(){updateButton()};
 state.audio.onended=function(){
  clearHighlights();syncControls(state.cfg.duration);updateButton();
  var s=state.stage&&state.stage.querySelector('#songKaraokeStatus');if(s)s.textContent='ร้องจบแล้ว 👏';
 };
 state.audio.onerror=function(){
  pause(true);
  var s=state.stage&&state.stage.querySelector('#songKaraokeStatus');if(s)s.textContent='โหลดเพลงไม่สำเร็จ · ตรวจการเชื่อมต่ออินเทอร์เน็ต';
 };
 state.audio.ontimeupdate=function(){
  syncControls(state.audio.currentTime);
  if(state.audio.paused)updateHighlight(state.audio.currentTime);
 };
 var seek=state.stage.querySelector('#songSeek');
 if(seek)seek.oninput=function(e){
  var t=(Number(e.currentTarget.value)/1000)*state.cfg.duration;
  try{state.audio.currentTime=t}catch(_){}
  updateHighlight(t);
 };
 var restart=state.stage.querySelector('#songRestart');
 if(restart)restart.onclick=function(){
  try{state.audio.currentTime=0}catch(_){}
  clearHighlights();syncControls(0);
  if(state.audio.paused)toggle();
 };
 syncControls(0);updateButton();
}

async function toggle(){
 if(!state.audio||!state.cfg)return;
 if(state.ensureSound)state.ensureSound();
 if(state.audio.paused||state.audio.ended){
  if(state.stopSpeech)state.stopSpeech();
  if(state.audio.ended)try{state.audio.currentTime=0}catch(_){}
  try{await state.audio.play()}
  catch(_){
   var s=state.stage&&state.stage.querySelector('#songKaraokeStatus');if(s)s.textContent='แตะปุ่มเล่นอีกครั้งเพื่อเริ่มเพลง';
  }
 }else pause(false);
}

window.P1SongKaraoke={
 configForPage:configForPage,
 playerMarkup:playerMarkup,
 setup:setup,
 toggle:toggle,
 pause:pause,
 dispose:dispose
};
})();
(function(){
'use strict';

var PAGE_BY_UNIT={1:23,2:33,3:43,4:54,5:64,6:73,7:89,8:101,9:117,10:131,11:147,12:161};
var stage=document.querySelector('#activityStage');
var engine=window.P1SongKaraoke;
if(!stage||!engine)return;

var activeSignature='';
var scheduled=false;

function currentUnit(){
 var n=Number(new URLSearchParams(location.search).get('unit'))||1;
 return Math.max(1,Math.min(12,n));
}

function isSongPage(){
 var heading=stage.querySelector('.book-reader-heading strong');
 if(!heading)return false;
 var text=(heading.textContent||'').replace(/\s+/g,' ');
 return text.indexOf('อ่านคล่อง')>=0&&text.indexOf('ร้องเล่น')>=0;
}

function scheduleSync(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(function(){scheduled=false;sync()});
}

function sync(){
 if(!isSongPage()){
  if(activeSignature){engine.dispose();activeSignature=''}
  return;
 }

 var unit=currentUnit();
 var pageNo=PAGE_BY_UNIT[unit];
 var cfg=engine.configForPage(pageNo);
 var data=window.P1_PAGE_KARAOKE&&window.P1_PAGE_KARAOKE[pageNo];
 var controls=stage.querySelector('.book-reader-controls');
 var button=stage.querySelector('#readPageKaraoke');
 if(!cfg||!data||!controls||!button)return;

 var signature=String(unit)+':'+String(pageNo);
 if(activeSignature===signature&&stage.querySelector('.song-karaoke-panel'))return;
 engine.dispose();
 activeSignature=signature;

 var oldPanel=stage.querySelector('.song-karaoke-panel');
 if(oldPanel)oldPanel.remove();
 controls.insertAdjacentHTML('beforebegin',engine.playerMarkup(cfg));

 var tip=stage.querySelector('.book-reader-tip');
 if(tip)tip.textContent='🎵 กดเล่นเพลง แล้วร้องตามคำที่ไฮไลต์บนหน้าหนังสือ';

 button.innerHTML='<span class="book-control-icon">🎵</span><span>เล่นเพลง</span>';
 button.setAttribute('aria-label','เล่นเพลงคาราโอเกะ');
 button.onclick=function(e){
  if(e){e.preventDefault();e.stopPropagation()}
  engine.toggle();
 };

 engine.setup({
  cfg:cfg,
  stage:stage,
  data:data,
  button:button,
  stopSpeech:function(){
   try{window.speechSynthesis&&window.speechSynthesis.cancel()}catch(_){}
   stage.querySelectorAll('.speaking-now,.native-reading-active,.native-row-active').forEach(function(el){
    el.classList.remove('speaking-now','native-reading-active','native-row-active');
   });
  }
 });
}

stage.addEventListener('click',function(e){
 var target=e.target&&e.target.closest?e.target.closest('[data-native-word],[data-native-line]'):null;
 if(target)engine.pause(true);
},true);

var soundToggle=document.querySelector('#soundToggle');
if(soundToggle){
 soundToggle.addEventListener('click',function(){
  requestAnimationFrame(function(){
   if(soundToggle.getAttribute('aria-pressed')==='false')engine.pause(true);
  });
 },false);
}

var observer=new MutationObserver(scheduleSync);
observer.observe(stage,{childList:true,subtree:true});

window.addEventListener('pagehide',function(){engine.dispose()});
sync();
})();
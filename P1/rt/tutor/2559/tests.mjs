import {PICTURE_LABELS,PICTURE_SPRITE,CORRECT_PICTURE_POSITIONS,verifyPictureOrder} from "./color-pictures.js";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const data=JSON.parse(await readFile(new URL("./data.json",import.meta.url),"utf8"));
const bank=JSON.parse(await readFile(new URL("../../data/2559-1.json",import.meta.url),"utf8"));
assert.equal(data.year,2559);assert.equal(data.form,1);
assert.equal(data.comprehension.pictureMatching.words.length,10);
assert.equal(data.comprehension.pictureMatching.answers.length,10);
assert.equal(data.comprehension.meaningMatching.definitions.length,5);
assert.equal(data.comprehension.meaningMatching.terms.length,7);
assert.equal(data.comprehension.meaningMatching.answers.length,5);
assert.deepEqual(data.comprehension.choices.map(x=>x.no),Array.from({length:10},(_,i)=>i+16));
assert.equal(data.oral.words.length,20);assert.equal(data.oral.sentences.length,6);
assert.ok(data.oral.passage.length>100);assert.ok(bank.assets.grid.startsWith("data:image/webp;base64,"));
assert.ok(data.comprehension.pictureMatching.words.every((t,i)=>t===bank.questions.find(q=>q.id==="2559-1-c-"+(i+1)).prompt));
assert.ok(data.oral.words.every((t,i)=>t===bank.questions.find(q=>q.id==="2559-1-o-"+(i+1)).prompt));
assert.ok(data.oral.sentences.every((t,i)=>t===bank.questions.find(q=>q.id==="2559-1-o-"+(i+21)).prompt));
for(const q of data.comprehension.choices){assert.ok(q.passage&&q.question&&q.choices.length===3);const source=bank.questions.find(x=>x.id==="2559-1-c-"+q.no);assert.equal(q.answer,Number(source.answer))}
assert.equal(data.comprehension.pictureMatching.answers.filter(x=>Number.isInteger(x)).length,10);
console.log("PASS: 2559 full text exam: 25 comprehension and 20 words + 6 sentences + passage, image preservation, original keys");

assert.equal(PICTURE_LABELS.length,12);
assert.equal(PICTURE_SPRITE.rows,12);
assert.equal(PICTURE_SPRITE.rowHeight*PICTURE_SPRITE.rows,PICTURE_SPRITE.height);
const image=await readFile(new URL(PICTURE_SPRITE.path,import.meta.url));
assert.equal(image.toString("ascii",0,4),"RIFF");
assert.equal(image.toString("ascii",8,12),"WEBP");
assert.ok(image.length>5000);
const appSource=await readFile(new URL("./app.js",import.meta.url),"utf8");
assert.ok(appSource.includes("picture-sprite"));
assert.ok(!appSource.includes("picture.svg"));
assert.deepEqual(CORRECT_PICTURE_POSITIONS,data.comprehension.pictureMatching.answers);
assert.equal(verifyPictureOrder(data.comprehension.pictureMatching.answers),true);
assert.throws(()=>verifyPictureOrder(Array(10).fill(1)));
console.log("PASS: 12 semirealistic colored raster pictures, original positions and answer-key mapping");

import {buildVocabulary,filterVocabulary,countProgress,shuffleDeck} from "./vocabulary.js";
const vocab=buildVocabulary(data);
assert.equal(vocab.length,37);
assert.equal(filterVocabulary(vocab,"picture").length,10);
assert.equal(filterVocabulary(vocab,"oral").length,20);
assert.equal(filterVocabulary(vocab,"meaning").length,7);
assert.deepEqual(vocab.map(card=>card.group).filter((group,index,all)=>index===0||group!==all[index-1]),["picture","meaning","oral"]);
assert.deepEqual(vocab.filter(card=>card.group==="picture").map(card=>card.sourceNo),Array.from({length:10},(_,i)=>i+1));
assert.deepEqual(vocab.filter(card=>card.group==="oral").map(card=>card.sourceNo),Array.from({length:20},(_,i)=>i+1));
assert.deepEqual(vocab.filter(card=>card.group==="meaning").map(card=>card.choiceIndex),Array.from({length:7},(_,i)=>i+1));
assert.deepEqual(vocab.filter(card=>card.group==="meaning"&&card.questionNo!==null).map(card=>card.questionNo).sort((x,y)=>x-y),[11,12,13,14,15]);
assert.equal(vocab.filter(card=>card.group==="meaning"&&card.definition!==null).length,5);
assert.equal(vocab.filter(card=>card.group==="meaning"&&card.definition===null).length,2);
assert.equal(filterVocabulary(vocab,"all","ทะเล").length,1);
assert.equal(new Set(vocab.map(card=>card.id)).size,37);
assert.ok(vocab.filter(card=>card.group==="picture").every((card,i)=>card.position===data.comprehension.pictureMatching.answers[i]-1));
assert.ok(vocab.filter(card=>card.group==="oral").every((card,i)=>card.word===data.oral.words[i]));
assert.deepEqual(countProgress(vocab,{[vocab[0].id]:"known",[vocab[1].id]:"retry"}),{total:37,known:1,retry:1,unrated:35});
const shuffled=shuffleDeck(vocab,()=>0.3);
assert.equal(shuffled.length,37);
assert.deepEqual(new Set(shuffled.map(card=>card.id)),new Set(vocab.map(card=>card.id)));
const vocabUI=await readFile(new URL("./vocabulary-ui.js",import.meta.url),"utf8");
assert.ok(vocabUI.includes("mountVocabulary")&&vocabUI.includes("flash-card")&&vocabUI.includes("flash-known"));
const vocabularyHTML=await readFile(new URL("./index.html",import.meta.url),"utf8");
assert.ok(vocabularyHTML.includes('data-tab="vocab"')&&vocabularyHTML.includes("vocabulary.css"));
console.log("PASS: 37 source-derived vocabulary cards, grouped search, picture indices, game progress and flashcard UI contracts");


import {normalizeThaiAnswer,isCorrectPictureAnswer,pictureBookCards,pictureBookStats} from "./picture-book-core.js";
const pictureCards=pictureBookCards(vocab);
assert.equal(pictureCards.length,10);
assert.deepEqual(pictureCards.map(card=>card.word),data.comprehension.pictureMatching.words);
assert.deepEqual(pictureCards.map(card=>card.position+1),data.comprehension.pictureMatching.answers);
assert.deepEqual(pictureBookStats(pictureCards,{}),{total:10,solved:0,remaining:10});
assert.deepEqual(pictureBookStats(pictureCards,{"pic-1":true,"pic-2":true}),{total:10,solved:2,remaining:8});
assert.ok(isCorrectPictureAnswer("เลี้ยงแพะ"," เลี้ยง แพะ "));
assert.ok(isCorrectPictureAnswer("กระดุมเสื้อ","กระดุมเสื้อ"));
assert.ok(isCorrectPictureAnswer("กระโปรง","กระ\u200bโปรง"));
assert.ok(!isCorrectPictureAnswer("กระโปรง","กระเป๋า"));
assert.ok(!isCorrectPictureAnswer("แตงโม"," "));
assert.equal(normalizeThaiAnswer("  ผูก เชือก  "),"ผูกเชือก");
const pictureBookJS=await readFile(new URL("./picture-book.js",import.meta.url),"utf8");
const pictureBookCSS=await readFile(new URL("./picture-book.css",import.meta.url),"utf8");
const linkedUI=await readFile(new URL("./vocabulary-ui.js",import.meta.url),"utf8");
assert.ok(pictureBookJS.includes("book-spread")&&pictureBookJS.includes("book-plaque")&&pictureBookJS.includes("book-answer-form"));
assert.ok(pictureBookJS.includes("isCorrectPictureAnswer")&&pictureBookJS.includes("fireworks(host)")&&pictureBookJS.includes("playSuccessSound(soundOn)"));
assert.ok(pictureBookCSS.includes("@media(max-width:780px)")&&pictureBookCSS.includes("rotateX(180deg)"));
assert.ok(linkedUI.includes("mountPictureBook")&&linkedUI.includes("pictureBook.setCards"));
assert.ok(vocabularyHTML.includes('href="picture-book.css"'));
console.log("PASS: interactive picture book, exact Thai spelling, 10 original image matches, navigation and success effects");


// Physical leaf turning rather than rotating/repainting the entire spread.
const turningScript=await readFile(new URL("./picture-book.js",import.meta.url),"utf8");
const turningStyles=await readFile(new URL("./picture-book.css",import.meta.url),"utf8");
assert.ok(turningScript.includes("function turnTo(nextIndex,direction)"));
assert.ok(turningScript.includes("cleanSnapshot(left)")&&turningScript.includes("cleanSnapshot(right)"));
assert.ok(turningScript.includes("front.appendChild(")&&turningScript.includes("back.appendChild("));
assert.ok(turningScript.includes('turnTo(position-1,"backward")'));
assert.ok(turningScript.includes('turnTo(position<cards.length-1?position+1:0,"forward")'));
assert.ok(turningScript.includes("if(turning||!cards.length"));
assert.ok(turningScript.includes("if(reducedMotion())"));
assert.ok(turningScript.includes("turnTimer=window.setTimeout(finish,1150)"));
assert.ok(turningStyles.includes("@keyframes bookTurnForward"));
assert.ok(turningStyles.includes("@keyframes bookTurnBackward"));
assert.ok(turningStyles.includes("rotateY(-180deg)")&&turningStyles.includes("rotateY(180deg)"));
assert.ok(turningStyles.includes("backface-visibility:hidden"));
assert.ok(turningStyles.includes(".book-turn-layer.is-mobile"));
console.log("PASS: 3D paper leaf turns in both directions, spine, backing pages and reduced-motion fallback");


// New scrambled-letter hint: hidden by default, Thai grapheme-safe tiles,
// correct insertion and reset semantics tied to each page of the book.
import {splitThaiHintUnits,makeScrambledHint} from "./picture-book-core.js";
for(const card of pictureCards){
 const units=splitThaiHintUnits(card.word);
 const scrambled=makeScrambledHint(card.word,card.id);
 assert.equal(scrambled.length,units.length);
 assert.equal(new Set(scrambled.map(t=>t.id)).size,scrambled.length);
 assert.equal(scrambled.map(t=>t.text).join("").normalize("NFC")===card.word,false);
 assert.deepEqual(scrambled.map(t=>t.text).sort(),[...units].sort());
 assert.equal(makeScrambledHint(card.word,card.id).map(t=>t.text).join(""),scrambled.map(t=>t.text).join(""));
 assert.ok(isCorrectPictureAnswer(card.word,units.join("")));
}
assert.deepEqual(splitThaiHintUnits(""),[]);
assert.ok(splitThaiHintUnits("เลี้ยงแพะ").some(item=>item.includes("ี้")));
assert.ok(turningScript.includes("hintPanel.hidden=true")||turningScript.includes("resetHints()"));
const hintsScript=await readFile(new URL("./picture-book.js",import.meta.url),"utf8");
const hintsCSS=await readFile(new URL("./picture-book.css",import.meta.url),"utf8");
assert.ok(hintsScript.includes("showHints.addEventListener")&&hintsScript.includes("hintPanel.hidden=!showing"));
assert.ok(hintsScript.includes("input.value+=tile.text")&&hintsScript.includes("button.disabled=true"));
assert.ok(hintsScript.includes('undoHint.addEventListener("click",undoLastHint)'));
assert.ok(hintsScript.includes('clearHint.addEventListener("click",()=>'));
assert.ok(hintsScript.includes("hints.hidden=complete")&&hintsScript.includes("hints.hidden=true"));
assert.ok(hintsCSS.includes(".book-hint-tile")&&hintsCSS.includes("@media print{.book-hints{display:none!important}}"));
console.log("PASS: 10 shuffled Thai picture-word hints, initial concealment, tile insertion, undo, clear and page reset");


// Full-screen book mode with a browser-native path, fixed-overlay fallback,
// Escape, restoration of scroll position, and state labels.
import {installBookFullscreen} from "./fullscreen-book.js";
function makeFullscreenMock(native){
 const listeners=new Map(), classes=new Set(), bodyClasses=new Set(), props=new Map();
 const eventTarget=()=>({
  addEventListener(name,fn){listeners.set(name,fn)},
  removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name)}
 });
 const body={classList:{add:c=>bodyClasses.add(c),remove:c=>bodyClasses.delete(c),contains:c=>bodyClasses.has(c)},
  style:{setProperty:(key,value)=>props.set(key,value),removeProperty:key=>props.delete(key)}};
 const doc={...eventTarget(),fullscreenElement:null,body,async exitFullscreen(){doc.fullscreenElement=null;listeners.get("fullscreenchange")?.()}};
 const win={...eventTarget(),scrollY:240,scrollTo(x,y){win.restored=[x,y]}};
 const host={classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key),contains:key=>classes.has(key)}};
 if(native)host.requestFullscreen=async()=>{doc.fullscreenElement=host;listeners.get("fullscreenchange")?.()};
 const button={...eventTarget(),type:"",textContent:"",attrs:{},
  setAttribute(key,value){this.attrs[key]=String(value)}};
 return {host,button,doc,win,listeners,classes,bodyClasses,props};
}
const fsNative=makeFullscreenMock(true);
const nativeController=installBookFullscreen(fsNative.host,fsNative.button,{doc:fsNative.doc,win:fsNative.win});
assert.equal(nativeController.isExpanded(),false);
assert.equal(fsNative.button.attrs["aria-pressed"],"false");
await nativeController.toggle();
assert.equal(nativeController.isExpanded(),true);
assert.equal(fsNative.button.attrs["aria-pressed"],"true");
assert.ok(fsNative.classes.has("is-book-expanded"));
assert.equal(fsNative.bodyClasses.size,0);
await nativeController.toggle();
assert.equal(nativeController.isExpanded(),false);
assert.ok(!fsNative.classes.has("is-book-expanded"));
nativeController.dispose();
const fsFallback=makeFullscreenMock(false);
const fallbackController=installBookFullscreen(fsFallback.host,fsFallback.button,{doc:fsFallback.doc,win:fsFallback.win});
await fallbackController.toggle();
assert.equal(fallbackController.isExpanded(),true);
assert.equal(fsFallback.props.get("--book-fallback-scroll"),"-240px");
assert.ok(fsFallback.bodyClasses.has("book-fallback-lock"));
fsFallback.listeners.get("keydown")({key:"Escape",preventDefault(){}});
assert.equal(fallbackController.isExpanded(),false);
assert.deepEqual(fsFallback.win.restored,[0,240]);
assert.ok(!fsFallback.bodyClasses.has("book-fallback-lock"));
fallbackController.dispose();
const fsDenied=makeFullscreenMock(false);
fsDenied.host.requestFullscreen=async()=>{throw new Error("NotAllowedError")};
const deniedController=installBookFullscreen(fsDenied.host,fsDenied.button,{doc:fsDenied.doc,win:fsDenied.win});
await deniedController.toggle();
assert.equal(deniedController.isExpanded(),true);
assert.ok(fsDenied.bodyClasses.has("book-fallback-lock"));
await deniedController.close();
assert.equal(deniedController.isExpanded(),false);
deniedController.dispose();
const fsHTML=await readFile(new URL("./picture-book.js",import.meta.url),"utf8");
const fsCSS=await readFile(new URL("./picture-book.css",import.meta.url),"utf8");
assert.ok(fsHTML.includes("installBookFullscreen(host,expandButton)"));
assert.ok(fsCSS.includes(".picture-book.is-book-expanded"));
assert.ok(fsCSS.includes("height:100dvh"));
assert.ok(fsCSS.includes("@media(max-width:780px)"));
assert.ok(fsCSS.includes("safe-area-inset-bottom"));
console.log("PASS: native fullscreen, iOS fallback, Escape, state labels and scroll restoration");


// Source sprite upgraded to a sharp high-DPI image without changing logical
// positions used by the original test and the book's cropped image strips.
assert.equal(PICTURE_SPRITE.sourceWidth,576);
assert.equal(PICTURE_SPRITE.sourceHeight,2880);
assert.equal(PICTURE_SPRITE.path,"./assets/pictures-2559-vivid-hd.webp");
assert.equal(PICTURE_SPRITE.sourceHeight/PICTURE_SPRITE.rows,240);
assert.deepEqual(data.comprehension.pictureMatching.answers,[3,6,5,1,4,10,8,9,12,11]);
assert.ok(!vocabularyHTML.includes("pictures-2559-cartoon.webp"));
console.log("PASS: upgraded HD colorful sprite with preserved 12-picture order and original key");


// Real closed-cover first-launch contract; all cover numerals and producer credits
// are HTML overlays, so their Thai glyphs remain crisp at every zoom level.
const coverScript=await readFile(new URL("./picture-book.js",import.meta.url),"utf8");
const coverStyle=await readFile(new URL("./picture-book.css",import.meta.url),"utf8");
const thaiVocab=await readFile(new URL("./vocabulary-ui.js",import.meta.url),"utf8");
const coverMeta=await readFile(new URL("./index.html",import.meta.url),"utf8");
const coverImage=await readFile(new URL("./assets/rt2559-book-cover-volume-1-revised.webp",import.meta.url));
assert.equal(coverImage.toString("ascii",0,4),"RIFF");
assert.equal(coverImage.toString("ascii",8,12),"WEBP");
assert.ok(coverImage.length>50000);
assert.ok(coverScript.includes('host.classList.add("is-cover-closed")'));
assert.ok(coverScript.includes('coverStage.hidden=true'));
assert.ok(coverScript.includes('coverStage.hidden=false'));
assert.ok(coverScript.includes('coverOpen.addEventListener("click",openBook)'));
assert.ok(coverScript.includes('closeCover.addEventListener("click",closeBook)'));
assert.ok(coverScript.includes('const coverArt=add(coverFront,"img","book-cover-art")'));
assert.ok(coverScript.includes('เล่ม ๑')&&coverScript.includes('๒๕๕๙')&&coverScript.includes('ครูไพรัช อินควรชุม'));
assert.ok(coverStyle.includes(".book-cover-stage.is-opening .book-cover-front"));
assert.ok(coverStyle.includes("rotateY(-170deg)"));
assert.ok(coverStyle.includes("@media(max-width:600px)"));
assert.ok(coverMeta.includes("พ.ศ. ๒๕๕๙"));
assert.ok(thaiVocab.includes("thaiNumber(vocab.length)"));
console.log("PASS: closed cover on first visit, opening/closing, Thai volume, Thai years, producer credit and cover artwork");

const allThaiPage=await readFile(new URL("./index.html",import.meta.url),"utf8");
const allThaiVocab=await readFile(new URL("./vocabulary-ui.js",import.meta.url),"utf8");
const allThaiExam=await readFile(new URL("./app.js",import.meta.url),"utf8");
assert.ok(allThaiPage.includes("RT ป.๑")&&allThaiPage.includes("ปี ๒๕๕๙"));
assert.ok(allThaiVocab.includes('thaiNumber(card.source)'));
assert.ok(allThaiExam.includes('nThai(points)')&&allThaiExam.includes('answers.map(nThai)'));
console.log("PASS: Thai numerals in RT Tutor book, vocabulary, teacher key and page labels");

assert.ok(coverScript.includes('rt2559-book-cover-volume-1-revised.webp'));
assert.ok(!coverScript.includes('const coverText=add(coverFront'));
assert.ok(!coverScript.includes('const credit=add(coverFront'));
assert.ok(coverScript.includes('ครูไพรัช  อินควรชุม'));
console.log("PASS: revised cover and no duplicate overlaid title or credit");


// Volume 1 includes both real RT 2559 chapters, not just picture matching.
import {bookVocabularyCards} from "./picture-book-core.js";
const fullVolume=bookVocabularyCards(vocab);
assert.equal(fullVolume.length,30);
assert.equal(fullVolume.filter(card=>card.group==="picture").length,10);
assert.equal(fullVolume.filter(card=>card.group==="oral").length,20);
assert.deepEqual(fullVolume.slice(0,10).map(card=>card.word),data.comprehension.pictureMatching.words);
assert.deepEqual(fullVolume.slice(10).map(card=>card.word),data.oral.words);
assert.deepEqual(fullVolume.slice(10).map(card=>card.sourceNo),Array.from({length:20},(_,i)=>i+1));
assert.deepEqual(bookVocabularyCards(vocab.filter(card=>card.group==="oral")).map(card=>card.word),data.oral.words);
assert.deepEqual(bookVocabularyCards(vocab.filter(card=>card.group==="picture")).map(card=>card.word),data.comprehension.pictureMatching.words);
const bookChapterJS=await readFile(new URL("./picture-book.js",import.meta.url),"utf8");
const chapterUI=await readFile(new URL("./vocabulary-ui.js",import.meta.url),"utf8");
const chapterCSS=await readFile(new URL("./picture-book.css",import.meta.url),"utf8");
assert.ok(bookChapterJS.includes("book-oral-word")&&bookChapterJS.includes("book-chapter-nav"));
assert.ok(bookChapterJS.includes('onPracticed(current,status)'));
assert.ok(bookChapterJS.includes('getOralProgress(current)'));
assert.ok(bookChapterJS.includes("bookVocabularyCards(subset)"));
assert.ok(chapterUI.includes('const listed=visible.filter(card=>card.group==="meaning")'));
assert.ok(chapterUI.includes("pictureBook.setCards(bookCards)"));
assert.ok(chapterCSS.includes(".book-oral-word")&&chapterCSS.includes(".book-oral-panel"));
assert.ok(chapterCSS.includes("@media(max-width:780px)"));
console.log("PASS: 10 picture + 20 original oral words in the 30-page book; chapter switching, self-recording and reading layout");

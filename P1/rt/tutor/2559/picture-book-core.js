// Pure validation and scoring for the 2559 picture-vocabulary book.
export function normalizeThaiAnswer(value){
 return String(value??"").normalize("NFC").replace(/[\u200b-\u200d\uFEFF]/g,"").replace(/\s+/g,"").trim();
}
export function isCorrectPictureAnswer(expected,submitted){
 const cleaned=normalizeThaiAnswer(submitted);
 return cleaned.length>0&&cleaned===normalizeThaiAnswer(expected);
}
export function pictureBookCards(items){
 if(!Array.isArray(items))throw Error("ไม่พบคำจับคู่ภาพ");
 const cards=items.filter(item=>item?.group==="picture");
 const ids=new Set();
 for(const item of cards){
  if(typeof item.id!=="string"||ids.has(item.id)||
    typeof item.word!=="string"||!item.word.trim()||
    !Number.isInteger(item.position)||item.position<0||item.position>=12)
   throw Error("ข้อมูลภาพและคำไม่ถูกต้อง");
  ids.add(item.id);
 }
 return cards;
}
export function pictureBookStats(cards,solved){
 const count=cards.filter(card=>solved?.[card.id]===true).length;
 return {total:cards.length,solved:count,remaining:cards.length-count};
}


// Split Thai into display-safe grapheme units: marks stay with their base letters.
// Modern browsers use Intl.Segmenter; the fallback retains combining marks.
export function splitThaiHintUnits(word){
 const text=String(word??"").normalize("NFC").trim();
 if(!text)return [];
 if(typeof Intl!=="undefined"&&typeof Intl.Segmenter==="function"){
  return [...new Intl.Segmenter("th",{granularity:"grapheme"}).segment(text)]
   .map(part=>part.segment).filter(part=>part.trim().length);
 }
 const units=[];
 for(const c of Array.from(text)){
  if(/\p{Mark}/u.test(c)&&units.length)units[units.length-1]+=c;
  else if(c.trim())units.push(c);
 }
 return units;
}
// Deterministic shuffled letter tiles, never in the original order.
// Stable IDs distinguish recurring letters and permit disabling only clicked tiles.
export function makeScrambledHint(word,seed=""){
 const units=splitThaiHintUnits(word);
 let state=2166136261;
 for(const c of String(seed)+":"+String(word)){
  state=Math.imul(state^c.codePointAt(0),16777619)>>>0;
 }
 const tiles=units.map((text,index)=>({id:"tile-"+index,text}));
 for(let i=tiles.length-1;i>0;i--){
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  const j=state%(i+1);
  [tiles[i],tiles[j]]=[tiles[j],tiles[i]];
 }
 if(tiles.length>1&&tiles.map(t=>t.text).join("")===units.join("")){
  const j=tiles.findIndex(t=>t.text!==tiles[0].text);
  if(j>=0)[tiles[0],tiles[j]]=[tiles[j],tiles[0]];
 }
 return tiles;
}

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

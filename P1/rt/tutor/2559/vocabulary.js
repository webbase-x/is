// Vocabulary is derived only from RT Tutor year 2559's actual question data.
// No synthetic meanings are assigned to oral-reading words or unused distractors.
export const VOCAB_GROUPS=Object.freeze([
 {id:"all",label:"ทั้งหมด"},
 {id:"picture",label:"คำจับคู่ภาพ"},
 {id:"oral",label:"คำอ่านออกเสียง"},
 {id:"meaning",label:"คำจับคู่ความหมาย"}
]);
export function buildVocabulary(exam){
 const picture=exam?.comprehension?.pictureMatching;
 const meanings=exam?.comprehension?.meaningMatching;
 const words=exam?.oral?.words;
 if(exam?.year!==2559||exam?.form!==1||
  picture?.words?.length!==10||picture?.answers?.length!==10||
  !Array.isArray(words)||words.length!==20||
  meanings?.terms?.length!==7||meanings?.definitions?.length!==5||
  meanings?.answers?.length!==5)throw Error("ข้อมูลคลังคำศัพท์ปี 2559 ไม่ครบ");
 const cards=[];
 picture.words.forEach((word,i)=>{
  const position=picture.answers[i];
  if(!Number.isInteger(position)||position<1||position>12)throw Error("ตำแหน่งภาพไม่ถูกต้อง");
  cards.push({id:"pic-"+(i+1),group:"picture",word,position:position-1,sourceNo:i+1,
   source:"การอ่านรู้เรื่อง ข้อ "+(i+1)});
 });
 meanings.terms.forEach((word,i)=>{
  const matchingIndex=meanings.answers.indexOf(i+1);
  cards.push({id:"meaning-"+(i+1),group:"meaning",word,choiceIndex:i+1,
   questionNo:matchingIndex>=0?11+matchingIndex:null,
   definition:matchingIndex>=0?meanings.definitions[matchingIndex]:null,
   source:"การอ่านรู้เรื่อง ข้อ 11–15"});
 });
 words.forEach((word,i)=>{
  cards.push({id:"oral-"+(i+1),group:"oral",word,sourceNo:i+1,
   source:"การอ่านออกเสียง ข้อ "+(i+1)});
 });
 if(cards.some(c=>typeof c.word!=="string"||!c.word.trim()))throw Error("พบคำศัพท์ว่าง");
 return cards;
}
export function filterVocabulary(cards,group="all",query=""){
 const term=String(query).trim().toLocaleLowerCase("th-TH");
 return cards.filter(card=>
  (group==="all"||card.group===group)&&
  (!term||[card.word,card.definition||"",card.source].some(v=>v.toLocaleLowerCase("th-TH").includes(term)))
 );
}
export function countProgress(cards,progress){
 let known=0,retry=0;
 for(const item of cards){
  if(progress?.[item.id]==="known")known++;
  else if(progress?.[item.id]==="retry")retry++;
 }
 return {total:cards.length,known,retry,unrated:cards.length-known-retry};
}
export function shuffleDeck(items,random=Math.random){
 const deck=[...items];
 for(let i=deck.length-1;i>0;i--){
  const j=Math.floor(Math.min(0.999999999999,Math.max(0,random()))*(i+1));
  [deck[i],deck[j]]=[deck[j],deck[i]];
 }
 return deck;
}

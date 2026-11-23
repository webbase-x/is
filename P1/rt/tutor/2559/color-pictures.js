// Meaning and order of the 12 semirealistic illustrated raster pictures for RT 2559.
export const PICTURE_LABELS=Object.freeze([
 "นาฬิกา","ลูกแพร์ (ภาพหลอก)","กระโปรง","เลี้ยงแพะ","ทะเล","แตงโม",
 "เด็กกับช้าง (ภาพหลอก)","ยืนตรง","บันได","กระดุมเสื้อ","ผูกเชือก","ลูกโป่ง"
]);
export const PICTURE_SPRITE=Object.freeze({path:"./assets/pictures-2559-vivid-hd.webp",width:144,height:720,rowHeight:60,rows:12,sourceWidth:576,sourceHeight:2880});
export const CORRECT_PICTURE_POSITIONS=Object.freeze([3,6,5,1,4,10,8,9,12,11]);
export function verifyPictureOrder(answers){
 if(!Array.isArray(answers)||answers.length!==CORRECT_PICTURE_POSITIONS.length||
    !answers.every((pos,i)=>pos===CORRECT_PICTURE_POSITIONS[i])||PICTURE_LABELS.length!==12)
  throw new Error("ลำดับภาพสีไม่ตรงกับเฉลยข้อสอบเดิม");
 return true;
}

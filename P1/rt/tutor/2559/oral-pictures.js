// Semantically grounded, local offline-friendly picture prompts for the
// 20 original oral-reading words. Each prompt is a visual question, not a
// visible answer; the original words remain defined only in data.json.
export const ORAL_SCENES=Object.freeze([
 {symbol:"🧒 🧺",description:"เด็กกำลังปูเสื่อบนพื้น",color:"#ffe5bd"},
 {symbol:"🍲",description:"หม้อแกงร้อนอยู่บนเตา",color:"#ffe2c1"},
 {symbol:"👧 🧒 🧒",description:"กลุ่มเพื่อนที่สนิทสนมกัน",color:"#d9eafa"},
 {symbol:"🗣️ 💢",description:"คนสองคนกำลังถกเถียงกัน",color:"#ffe1e0"},
 {symbol:"👩‍🌾 🪴 🧒",description:"ผู้ใหญ่สอนเด็กปลูกต้นไม้",color:"#d5f1ce"},
 {symbol:"🍠 🥔",description:"หัวเผือกและมันหลายหัว",color:"#f9e3dc"},
 {symbol:"🏛️ 🙋",description:"ผู้แทนกำลังยกมืออภิปรายคัดค้าน",color:"#e8e6fc"},
 {symbol:"👨‍👩‍👧‍👦",description:"สมาชิกครอบครัวอยู่พร้อมหน้ากัน",color:"#fce3de"},
 {symbol:"🏆 🌟",description:"นักเรียนยกถ้วยรางวัลเพื่อยกย่องความดี",color:"#fff0c1"},
 {symbol:"🧒 🤝 🧑",description:"เด็กสองคนบังเอิญพบกัน",color:"#deefe0"},
 {symbol:"🥣 🐖",description:"ถ้วยโจ๊กใส่หมูสับ",color:"#f7e9c7"},
 {symbol:"🪛 🪑",description:"ช่างกำลังซ่อมเก้าอี้ไม้",color:"#e0effa"},
 {symbol:"🧒 🍱 🧒",description:"เด็กแบ่งอาหารให้เพื่อน",color:"#fae5d3"},
 {symbol:"🫛",description:"ฝักถั่วยาวสีเขียวสด",color:"#e0f5d4"},
 {symbol:"⛏️ 🕳️",description:"คนใช้จอบขุดหลุมในสวน",color:"#efdec7"},
 {symbol:"🪥 🧒",description:"เด็กแปรงฟันเป็นกิจวัตร",color:"#d3edf3"},
 {symbol:"🐘 🐘",description:"ช้างตัวใหญ่กับลูกช้างตัวเล็ก",color:"#e3edd4"},
 {symbol:"👖",description:"เข็มขัดหนังพร้อมหัวเข็มขัด",color:"#e8dccd"},
 {symbol:"🥤 💧",description:"แก้วเครื่องดื่มเกลือแร่",color:"#d5f3fa"},
 {symbol:"⏰ 🧒 ✏️",description:"เด็กเริ่มทำงานทันทีข้างนาฬิกา",color:"#fff0ce"}
]);
if(ORAL_SCENES.length!==20)throw Error("ภาพประกอบบทที่สองต้องมีครบ ๒๐ รายการ");

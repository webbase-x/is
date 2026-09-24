import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const ROOT=path.resolve(new URL('..',import.meta.url).pathname);
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');

function extractObject(src,marker){
  const pos=src.indexOf(marker);
  assert.ok(pos>=0,`ไม่พบ ${marker}`);
  const start=src.indexOf('{',pos);
  assert.ok(start>=0,`ไม่พบ object ของ ${marker}`);
  let depth=0,inString=false,escape=false;
  for(let i=start;i<src.length;i++){
    const ch=src[i];
    if(inString){
      if(escape)escape=false;
      else if(ch==='\\')escape=true;
      else if(ch==='"')inString=false;
      continue;
    }
    if(ch==='"'){inString=true;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){
      depth--;
      if(depth===0)return vm.runInNewContext('('+src.slice(start,i+1)+')',Object.create(null));
    }
  }
  throw new Error(`object ของ ${marker} ปิดไม่ครบ`);
}

const complete=extractObject(read('complete-pages.js'),'window.P1_COMPLETE_PAGES');
const karaoke=extractObject(read('page-karaoke-data.js'),'window.P1_PAGE_KARAOKE');
const songs=extractObject(read('song-karaoke-data.js'),'window.P1_SONG_KARAOKE');
const cues=extractObject(read('song-karaoke-cues.js'),'window.P1_SONG_WORD_CUES');

let physicalTotal=0;
let displayTotal=0;
const summary=[];

for(let unit=1;unit<=12;unit++){
  const book=complete[String(unit)];
  assert.ok(book,`บทที่ ${unit}: ไม่มีข้อมูล complete pages`);
  assert.ok(Array.isArray(book.pages)&&book.pages.length>1,`บทที่ ${unit}: ไม่มีรายการหน้า`);
  physicalTotal+=book.end-book.start+1;
  displayTotal+=book.pages.length;

  const first=book.pages[0];
  assert.equal(first.kind,'cover',`บทที่ ${unit}: หน้าแรกต้องเป็นหน้าปก`);
  assert.equal(first.page,book.start,`บทที่ ${unit}: เลขหน้าปกเริ่มไม่ตรง start`);
  assert.equal(first.lastPage,book.start+1,`บทที่ ${unit}: หน้าปกต้องครอบคลุม ๒ หน้าต้นฉบับ`);

  const expected=[];
  for(let p=book.start+2;p<=book.end;p++)expected.push(p);
  const actual=Array.from(book.pages.slice(1),p=>Number(p.page));
  assert.deepEqual(actual,expected,`บทที่ ${unit}: มีหน้าระหว่างปกถึงท้ายบทตกหล่นหรือเกินมา`);

  const last=book.pages.at(-1);
  assert.equal(last.page,book.end,`บทที่ ${unit}: หน้าสุดท้ายไม่ตรง end`);
  assert.match(last.kind,/อ่านคล่อง\s*ร้องเล่น/,`บทที่ ${unit}: หน้าสุดท้ายต้องเป็น อ่านคล่อง ร้องเล่น`);

  for(const page of book.pages.slice(1)){
    const data=karaoke[String(page.page)];
    assert.ok(data,`บทที่ ${unit} หน้า ${page.page}: ไม่มีข้อมูล page-karaoke`);
    assert.ok(Array.isArray(data.rows)&&data.rows.length>0,`บทที่ ${unit} หน้า ${page.page}: ไม่มีบรรทัดข้อความ`);
    for(const [ri,row] of data.rows.entries()){
      assert.ok(Array.isArray(row)&&row.length>0,`บทที่ ${unit} หน้า ${page.page} แถว ${ri+1}: ว่าง`);
      for(const token of row){
        assert.equal(typeof token.t,'string',`บทที่ ${unit} หน้า ${page.page}: token ไม่มีข้อความ`);
        assert.ok(Array.isArray(token.b)&&token.b.length===4,`บทที่ ${unit} หน้า ${page.page}: token ไม่มีตำแหน่งครบ ๔ ค่า`);
      }
    }
  }

  const song=songs[String(unit)];
  assert.ok(song,`บทที่ ${unit}: ไม่มี song config`);
  assert.equal(Number(song.page),book.end,`บทที่ ${unit}: เพลงต้องอยู่หน้า อ่านคล่อง ร้องเล่น`);
  const expectedAudio=`sounds/karaoke-unit-${String(unit).padStart(2,'0')}.mp3`;
  assert.equal(song.src,expectedAudio,`บทที่ ${unit}: อ้างไฟล์เพลงไม่ตรงมาตรฐาน`);
  assert.ok(fs.existsSync(path.join(ROOT,expectedAudio)),`บทที่ ${unit}: ไม่พบไฟล์เพลง ${expectedAudio}`);
  assert.ok(Array.isArray(cues[String(unit)])&&cues[String(unit)].length>0,`บทที่ ${unit}: ไม่มี cue รายคำของเพลง`);

  const cover=`book/unit${unit}-cover.webp`;
  assert.ok(fs.existsSync(path.join(ROOT,cover)),`บทที่ ${unit}: ไม่พบภาพหน้าปก ${cover}`);
  assert.ok(fs.existsSync(path.join(ROOT,book.asset)),`บทที่ ${unit}: ไม่พบภาพหน้าต้นฉบับ ${book.asset}`);

  summary.push({unit,start:book.start,end:book.end,displayPages:book.pages.length,lastKind:last.kind});
}

assert.equal(physicalTotal,128,'จำนวนหน้าต้นฉบับรวมต้องเป็น ๑๒๘ หน้า');
assert.equal(displayTotal,116,'จำนวนหน้าที่เปิดในระบบต้องเป็น ๑๑๖ รายการ (ปกคู่คิดเป็น ๑ หน้าแสดงผล)');

console.log('P1 book integrity: PASS');
console.table(summary);
console.log(`physical pages: ${physicalTotal}, display pages: ${displayTotal}`);

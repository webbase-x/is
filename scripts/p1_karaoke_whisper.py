from pathlib import Path
import json, os, time
from faster_whisper import WhisperModel

ROOT=Path(__file__).resolve().parents[1]
SOUNDS=ROOT/'P1'/'sounds'
OUT=ROOT/'P1'/'karaoke-whisper-analysis.json'
lyrics={
1:'ใบโบก ใบบัว โยก ตัว ไป มา โยก หัว โยก ขา โยก มา โยก ไป',
2:'ภูผา ดูแล ใบโบก ภูผา ดูแล ใบบัว ภูผา มี เพื่อน ข้าง ตัว ชื่อ ใบบัว ชื่อ ใบโบก',
3:'เด็ก เด็ก เป็น เพื่อน ลูก ช้าง ลูก ช้าง เป็น เพื่อน เด็ก เด็ก ลูก ช้าง แม้ ตัว ยัง เล็ก แต่ เด็ก เด็ก ตัว เล็ก กว่า ลูก ช้าง',
4:'กระดึง เสียง ดัง โป๊ก เป๊ก กระพรวน เสียง ดัง กรุ๋ง กริ๋ง ภูผา เที่ยว หา วุ่น วิ่ง ตาม เสียง กรุ๋ง กริ๋ง และ เสียง โป๊ก เป๊ก',
5:'ภูผา เดิน หน้า ช้าง น้อย ตาม หลัง น่า รัก น่าชัง จะ ไป โรงเรียน ช้าง หิ้ว ปิ่นโต กระเป๋า เครื่อง เขียน มา ถึง โรงเรียน โบกมือ ลา กัน',
6:'บท เรียน ลูก ช้าง จูง หาง ออก เดิน ไม่มี ขัด เขิน เดิน ตาม กัน ไป เดิน เป็น วงกลม น่า ชม กระไร ฝึก แล้ว ดีใจ ได้ กิน กล้วย อ้อย',
7:'ชวน ช้าง ไป อาบ น้ำ แสน ชื่น ฉ่ำ น้ำ เย็น ใส เพื่อน เด็ก อาบ น้ำ ให้ ถู ที่ หลัง ขา และ หาง เพื่อน ช้าง พ่น น้ำ ใส่ อาบ น้ำ ให้ เพื่อน เด็ก บ้าง อาบ พลาง หัวเราะ พลาง คน รัก ช้าง ช้าง รัก คน',
8:'พูด เพราะ ช้าง ถูกใจ จะ ว่า ง่าย ไม่ ดื้อ ดึง ถ้า ดุ จะ มึนตึง เสียง โกรธ ขึ้ง จะ ดื้อ ใส่ ถึง แม้ จะ เป็น ช้าง รู้ ไว้ บ้าง มี หัวใจ ใจ ใคร ก็ ใจ ใคร พูด เพราะ ไว้ ได้ ไมตรี',
9:'ใบโบก ใบบัว ตัว สั่น ขา แข็ง หู ไร้ เรี่ยวแรง หาง แกว่ง ไม่ ออก เจอ งู ตัว ดำ แลบ ลิ้น ล่อ หลอก แม่ เบี้ย แผ่ ออก น่า กลัว นักหนา จ้อง ตา กัน ไป จ้อง ตา กัน มา งู เลื้อย เข้า ป่า ช้าง น้อย โล่ง ใจ',
10:'ใบโบก ใบบัว เดิน ทั่ว ใน ป่า ไป กับ ภูผา เที่ยว เดิน เพลิน ใจ เจอ กอง ดิน โป่ง ตัว โก่ง วิ่ง ใส่ ดูด กิน ชื่น ใจ อร่อย จริง จริง อิ่ม แล้ว หัน มา ภูผา อย่า วิ่ง รสดี จริง จริง กิน อย่าง พวก เรา ภูผา ชอบใจ ไม่ กิน หรอก เจ้า เพราะ ว่า คน เขา ไม่ กิน ดิน โป่ง',
11:'ใบโบก ใบบัว แต่ง ตัว สวย สวย ภูผา ไป ด้วย ร่วม งาน หรรษา ใบโบก ส่ง ไม้ ประธาน รับ มา เพราะ ได้ เวลา ตี ฆ้อง นำทาง พอ เสียง เพลง ดัง ช้าง ต่าง จัด แถว ช้าง น้อย แน่ แน่ว วิ่ง สุด แรง ช้าง เดิน ตาม กัน ไป ใช้ งวง จับ หาง ชวน กัน เหยาะ ย่าง ตาม จังหวะ เพลง รายการ สุดท้าย ช้าง ระบาย สี ใบโบก เร็ว รี่ แสดง ความ เก่ง ภูผา ส่ง แปรง ใบโบก แสดง เอง มือ แปรง ละเลง ภูผา จังงัง คน ดู ชอบใจ ช้าง น้อย แสนรู้ ใบบัว โบก หู อาย จัง อาย จัง',
12:'ถึง วัน ปี ใหม่ ไทย ต่าง พร้อมใจ ไป ทำบุญ ขน ทราย เข้า วัด หนุน ชวน กัน ก่อ พระ เจดีย์ เพลิน ใจ เล่น สงกรานต์ ล้วน เบิก บาน อย่าง เต็ม ที่ คน ช้าง แสน ยินดี สาด น้ำ ใส่ กัน และ กัน รดน้ำ พ่อ และ แม่ พร้อม เพื่อน แท้ สอง เชือก นั้น ขอ พร พ่อ แม่ พลัน ช้าง ขอ ด้วย คำ อวยพร'
}
model_name=os.environ.get('WHISPER_MODEL','large-v3-turbo')
print('Loading',model_name,flush=True)
model=WhisperModel(model_name,device='cpu',compute_type='int8',cpu_threads=max(2,os.cpu_count() or 2))
result={'model':model_name,'generated_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'units':{}}
for unit in range(1,13):
    path=SOUNDS/f'karaoke-unit-{unit:02d}.mp3'
    prompt='เพลงภาษาไทยสำหรับเด็ก เนื้อร้อง: '+lyrics[unit]+' เนื้อร้องอาจมีการร้องนำ ร้องตาม และร้องซ้ำ กรุณาถอดตามเสียงจริงทุกครั้งที่มีการร้องซ้ำ'
    print(f'UNIT {unit:02d}: {path.name}',flush=True)
    segments,info=model.transcribe(
        str(path),language='th',task='transcribe',beam_size=5,best_of=5,
        word_timestamps=True,vad_filter=False,condition_on_previous_text=False,
        initial_prompt=prompt,temperature=0.0,no_speech_threshold=0.65,
        log_prob_threshold=-1.2,compression_ratio_threshold=2.6
    )
    segs=[]
    for seg in segments:
        words=[]
        for w in (seg.words or []):
            words.append({'start':round(float(w.start),3),'end':round(float(w.end),3),'word':w.word.strip(),'probability':round(float(w.probability),4)})
        segs.append({'start':round(float(seg.start),3),'end':round(float(seg.end),3),'text':seg.text.strip(),'avg_logprob':round(float(seg.avg_logprob),4),'no_speech_prob':round(float(seg.no_speech_prob),4),'words':words})
        print(f'  {seg.start:7.2f}-{seg.end:7.2f} {seg.text.strip()}',flush=True)
    result['units'][str(unit)]={'file':path.name,'duration':round(float(info.duration),3),'language':info.language,'language_probability':round(float(info.language_probability),4),'lyrics_prompt':lyrics[unit],'segments':segs}
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('Wrote',OUT,flush=True)

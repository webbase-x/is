# LAO-EMS Architecture — Foundation

## 1. เป้าหมาย

แพลตฟอร์มเดียวรองรับหลายสถานศึกษาในสังกัด อปท. โดยใช้ข้อมูลต้นทางร่วมกันและลดการกรอกซ้ำ

**Single Data Entry → Integrated Data → Reusable Information**

ข้อมูลที่มีอยู่แล้วต้องถูกอ้างอิง ไม่สร้างสำเนาใหม่โดยไม่มีเหตุผลทางธุรกิจ

## 2. ขอบเขตระบบ

```text
Local Government Organization
  └── Schools (many)
       ├── Academic Years / Terms
       ├── Personnel
       ├── Students / Guardians
       ├── Curriculum / Classes / Subjects
       ├── Enrollment / Attendance / Assessment
       ├── Educational Records / ปพ.
       ├── School Website
       ├── Forms / Assignments / Surveys / Tests
       ├── Student Care
       ├── QA / SAR
       └── Reports / Dashboards
```

## 3. Multi-tenant model

ทุกข้อมูลที่เป็นขององค์กรหรือโรงเรียนต้องมี scope ชัดเจน

- `organization_id` — อปท. เจ้าของข้อมูล
- `school_id` — โรงเรียนเจ้าของข้อมูล (nullable สำหรับข้อมูลระดับ อปท.)
- ผู้ใช้หนึ่งคนมีได้หลาย membership และหลาย role
- ห้ามใช้ email เป็น foreign key ของข้อมูลธุรกิจ
- ใช้ UUID เป็น primary key

## 4. Identity and registration

ลำดับลงทะเบียนมาตรฐาน:

```text
สร้างบัญชี
→ ยืนยันตัวตน
→ กรอกโปรไฟล์ขั้นต่ำ
→ ขอเข้าร่วม อปท./โรงเรียน
→ ผู้มีอำนาจตรวจสอบ
→ อนุมัติ membership
→ กำหนด role/scope
→ เริ่มใช้งาน
```

นักเรียนและผู้ปกครองไม่ควรสร้าง student record ใหม่เอง แต่ต้องผูกกับ master record ที่โรงเรียนมีอยู่แล้ว

## 5. Roles

Role ตั้งต้น:

- platform_admin
- organization_admin
- organization_viewer
- school_admin
- school_executive
- registrar
- academic_officer
- teacher
- staff
- student
- guardian

Role เป็นเพียงกลุ่มสิทธิ์ ส่วนขอบเขตข้อมูลต้องตรวจจาก membership/scope อีกชั้น

## 6. File architecture

ไฟล์จริงเก็บใน Google Drive

Supabase เก็บเฉพาะ:

- Google Drive File ID
- filename / mime type / size
- owner organization / school
- module / record relation
- visibility: private / internal / public
- uploader
- created / modified metadata
- hash หรือ version metadata เมื่อจำเป็น

ไฟล์ public จึงสามารถนำไปแสดงเว็บไซต์ได้ ส่วนไฟล์ private ต้องผ่าน authorization ก่อนให้ผู้ใช้เข้าถึง

## 7. Audit

ข้อมูลสำคัญต้องมีประวัติ เช่น:

- ผลการเรียน
- การย้าย/จำหน่ายนักเรียน
- สิทธิ์ผู้ใช้
- การอนุมัติ
- การแก้ข้อมูลทะเบียน
- การเปลี่ยน visibility ของไฟล์

Audit log ต้องเก็บ actor, action, table/entity, record, before/after (ตามความเหมาะสม), timestamp, request context

## 8. Security baseline

- เปิด RLS ทุกตารางที่ client เข้าถึง
- ใช้ publishable key ใน browser เท่านั้น
- service role ใช้เฉพาะ backend/Edge Function
- ห้ามเก็บ Google refresh token หรือ secret ใน client
- ใช้ Supabase Edge Function เป็นตัวกลางสำหรับงาน Google Drive ที่ต้องใช้ credential ฝั่ง server
- แยก public website data ออกจาก private student/personnel data ด้วย policy
- มี rate limit / abuse control สำหรับแบบฟอร์มสาธารณะ
- validate ทั้ง client และ server

## 9. Google Drive integration

เป้าหมาย flow:

```text
Web App
→ authorize request
→ Supabase Edge Function
→ Google Drive API
→ return file metadata / signed or authorized access path
→ save metadata in Supabase
```

Public website image:
```text
Public content record
→ file_objects (visibility=public)
→ Drive file
→ website renderer
```

## 10. Development sequence

Foundation ต้องเสร็จก่อนโมดูลธุรกิจ:

1. Organization / School
2. Academic year / term
3. Profile / membership / role
4. Registration approval workflow
5. Audit
6. File metadata
7. Personnel
8. Students / guardians
9. Academic structure
10. Assessment and records

## 11. Deployment

ระยะเริ่มต้นวาง frontend ใน `/lao-ems/` ของ repository `webbase-x/is` โดยไม่กระทบ P1, P2 และ rs

เมื่อ backend พร้อม:
- client → Supabase Auth + RLS
- privileged operations → Edge Functions
- source → GitHub
- file binary → Google Drive

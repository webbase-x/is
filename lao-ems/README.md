# LAO-EMS

**ระบบสารสนเทศเพื่อการบริหารจัดการศึกษาขององค์กรปกครองส่วนท้องถิ่น**

LAO-EMS เป็นแพลตฟอร์มเดียวสำหรับหลายสถานศึกษาในสังกัด อปท. ออกแบบตามแนวคิด **Single Data Entry + Single Source of Truth + Role & Scope Based Access**

## โครงสร้างที่ใช้จริง

- Frontend: `webbase-x/is/lao-ems/`
- GitHub Pages: `https://webbase-x.github.io/is/lao-ems/`
- Supabase: Project `ISSQL`
- Database objects ของระบบนี้: ใช้คำนำหน้า `lao_` ทั้งหมด
- Authentication: ใช้ Supabase Auth ของ ISSQL แต่สิทธิ์ LAO-EMS แยกด้วย `lao_memberships`
- ไฟล์จริง: Google Drive ของแต่ละสถานศึกษา
- Metadata ไฟล์และสิทธิ์: Supabase
- ความปลอดภัย: RLS + Role/Scope + Audit log

## Phase 1 ที่ทำแล้ว

1. Application shell แบบ responsive
2. หน้าเข้าสู่ระบบและสมัครบัญชี
3. โปรไฟล์ LAO-EMS แยกจากระบบเดิม
4. Membership request: สมัคร → ขอเข้าร่วมโรงเรียน → รออนุมัติ
5. Role และขอบเขต อปท./โรงเรียน
6. Platform admin bootstrap model
7. โครงสร้าง อปท. / สถานศึกษา
8. ปีการศึกษา / ภาคเรียน
9. Google Drive connection metadata
10. File metadata และ Public/Internal/Private visibility
11. Audit log foundation
12. RLS สำหรับตาราง LAO-EMS

## ตารางหลัก

`lao_organizations`, `lao_schools`, `lao_academic_years`, `lao_terms`, `lao_profiles`, `lao_memberships`, `lao_roles`, `lao_membership_roles`, `lao_platform_admins`, `lao_drive_connections`, `lao_files`, `lao_audit_logs`

## Google Drive

หลักการคือ **หนึ่งโรงเรียน = หนึ่ง Google Drive connection** ไฟล์จริงไม่เก็บใน GitHub และไม่เก็บซ้ำใน Supabase โดย Supabase เก็บเพียง File ID, metadata, relation และ visibility

OAuth/Upload/Preview ของ Google Drive จะทำในขั้นถัดไปผ่าน backend/Edge Function เพื่อไม่เปิดเผย token หรือ secret ใน browser

## ลำดับพัฒนาต่อ

1. ตั้งค่า อปท. และสถานศึกษาแรก
2. สร้าง Platform Admin คนแรก
3. Personnel
4. Students / Guardians
5. Academic structure
6. Attendance / Assessment
7. ปพ. และรายงานผล
8. School Website
9. Forms / Assignments / Surveys / Tests
10. Student Care
11. QA / SAR
12. Dashboards
13. Smart Search / AI

> ห้าม commit service-role key, Google OAuth client secret, refresh token หรือ credential ลับลง GitHub

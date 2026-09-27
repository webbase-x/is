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


## LEC Source of Truth

ข้อมูลทางราชการของสถานศึกษาและนักเรียนใช้ไฟล์ที่ดาวน์โหลดจากระบบ LEC เป็นแหล่งต้นทาง:
- School Admin เป็นผู้ทำรายการนำเข้า XLS/XLSX หลังได้รับอนุมัติ
- ไม่ยึด worksheet แรกหรือชื่อ worksheet: ระบบตรวจทุกชีตและเลือกชีตที่มีคอลัมน์ **จังหวัด / อำเภอ / อปท. / สถานศึกษา / เลขประจำตัวนักเรียน / ชื่อ / นามสกุล** ครบ
- ไม่มีหน้าจอแก้ไขข้อมูลนักเรียนจาก LEC ด้วยมือ
- ไฟล์รอบใหม่ทำหน้าที่ sync ข้อมูลปัจจุบัน แต่ไม่ลบประวัติเดิม
- นักเรียนที่ไม่พบในไฟล์รอบล่าสุดถูกทำเครื่องหมาย `not_in_latest_lec` และไม่ถือว่า “ย้ายออก”
- การย้ายออก/จบ/จำหน่ายจะเป็น workflow งานทะเบียนและเอกสาร ปพ. แยกต่างหาก
- ชีตอื่นที่ไม่ตรงโครงสร้าง เช่น `stuent`, ชีตย่อย หรือ ปพ.8 จะถูกข้ามโดยอัตโนมัติ
- เก็บชื่อชีตที่เลือก, import batch, raw row, canonical row, SHA-256 และ audit trail เพื่อย้อนตรวจสอบแหล่งที่มา


### School data confirmation on recurring LEC imports
The same LEC file is also used to sync official school details. On first import, the tenant is bound to the school identity found in LEC. On later imports:
- exact school match → import can continue;
- same school but official details changed → School Admin must explicitly accept the new LEC values before importing;
- school identity from the selected LEC sheet (province, district, LGO, school, and school code when available) is compared before import;
- choosing to keep the existing school data cancels that import round rather than mixing old school metadata with new student data.


## Admin-managed user accounts

Public self-registration is not part of LAO-EMS. Accounts are initiated by administrators:
- Platform Admin invites only the first School Admin of a school.
- After that, the School Admin invites users and additional School Admins for that school.
- The recipient receives an authentication email, opens the secure link, completes their profile, and sets their own password.
- LAO-EMS does not email plaintext temporary passwords.
- An Auth account from another app in the shared Supabase project does not grant LAO-EMS access unless it has a LAO invitation/membership or Platform Admin status.


### Automatic LEC period import
The LEC import page has no manual academic-year or term fields. The importer reads school identity, academic year, term, classroom and student data from the selected authoritative LEC worksheet. If academic year or term is missing or inconsistent, the import is blocked rather than asking the user to type a replacement value.


### No manual LGO/school bootstrap
Platform Admin no longer types official LGO or school master data. The first School Admin is invited by email without a school record. After the recipient confirms the account and profile, the first LEC import creates or reuses the LGO and creates/binds the school from LEC source values. Direct authenticated INSERT/UPDATE/DELETE on `lao_organizations` and `lao_schools` is revoked.


### School setup gate after LEC
After the first LEC import, School Admin must finish school readiness before inviting any users:
1. LEC source is imported and the school has a stable `school_id`.
2. School operational settings are confirmed.
3. Google Drive is connected and a root folder named `/LAO-EMS/` is provisioned.
4. Only then does the School Admin user-invitation workflow unlock.

The folder root is fixed as `LAO-EMS`. Subfolders are intentionally provisioned later by each module as those modules are enabled, rather than creating an unused folder tree upfront.


> Current implementation note: the school-readiness gate and `/LAO-EMS/` folder contract are active. The Google Drive connect button is wired to the server endpoint, but Google OAuth client credentials have not yet been configured in the Supabase Edge Function environment, so a real Drive connection cannot complete until that one-time platform configuration is supplied.


### Platform Admin School Admin invitation links
Platform Admin can create copyable School Admin application links and turn each link on or off. The link does not grant access. Applicants must provide identity/contact details and upload a PDF/JPG/PNG verification document (maximum 10 MB). Platform Admin reviews the private document before approval; only approval triggers the actual LAO-EMS Auth invitation.

Verification files are temporarily stored in the private `lao-ems-admin-verification` bucket because the applicant's school Google Drive does not exist yet. Normal school files continue to use the per-school Google Drive architecture after school onboarding.

A Platform Admin who also manages a school can start their own School Admin context directly from LEC through `lao_platform_begin_school_onboarding()`.


### LEC workbook format
The workbook currently used during development contains **older-year data**, but the LEC workbook format remains the same as the current system format: `Sheet1` uses row 1 for the report title, rows 2–3 for main/subheaders with merged groups, and student data starts on row 4. The importer therefore treats this structure as the normal LEC format while retaining content-based fallback detection for resilience.

# LAO-EMS Architecture — Foundation

## เป้าหมาย

แพลตฟอร์มเดียวรองรับหลายสถานศึกษาในสังกัด อปท. โดยข้อมูลต้นทางถูกบันทึกเพียงครั้งเดียวและนำไปใช้ซ้ำตามสิทธิ์

```text
One Platform
  └── Local Administrative Organizations
       └── Schools
            ├── Personnel
            ├── Students / Guardians
            ├── Curriculum / Classes / Subjects
            ├── Attendance / Assessment
            ├── Educational Records / ปพ.
            ├── School Website
            ├── Forms / Tasks / Surveys / Tests
            ├── Student Care
            ├── QA / SAR
            └── Reports / Dashboards
```

## Deployment

- Source: `webbase-x/is/lao-ems/`
- Frontend: GitHub Pages
- Database/Auth: Supabase ISSQL
- Namespace: `lao_*`
- File binary: Google Drive ของแต่ละโรงเรียน
- Privileged file operations: backend/Edge Function

## Tenant model

ทุกข้อมูลต้องมี scope ชัดเจน

- `organization_id` = อปท.
- `school_id` = สถานศึกษา
- ผู้ใช้หนึ่งคนมีหลาย membership และหลาย role ได้
- Global platform admin แยกใน `lao_platform_admins`
- School/organization roles อยู่ใน `lao_memberships` + `lao_membership_roles`

## Identity flow

```text
สร้างบัญชี
→ ยืนยันตัวตน
→ lao_ensure_profile()
→ เลือก อปท./โรงเรียน
→ lao_request_membership()
→ ผู้ดูแลตรวจสอบ
→ lao_review_membership()
→ ได้ Role + Scope
→ เข้าใช้งานโมดูลตามสิทธิ์
```

นักเรียนและผู้ปกครองจะไม่สร้าง Student Master ใหม่เอง เมื่อโมดูลนักเรียนถูกสร้าง จะใช้การผูกบัญชีกับ Student Master ที่สถานศึกษามีอยู่แล้ว

## Security baseline

- RLS เปิดทุกตารางของ LAO-EMS
- publishable key ใช้ใน browser ได้
- service-role key ห้ามอยู่ใน browser/GitHub
- anonymous Supabase users ไม่สามารถสร้าง LAO profile หรือ Membership
- SECURITY DEFINER RPC ทุกตัวตรวจ auth และ authorization ภายใน
- Audit log เก็บเหตุการณ์สำคัญ
- Google OAuth token/refresh token จะอยู่ฝั่ง server เท่านั้น

## Google Drive

```text
School A → Google Drive A
School B → Google Drive B
School C → Google Drive C
```

Supabase เก็บ `lao_drive_connections` และ `lao_files` เพื่อรู้ว่าไฟล์อยู่ที่ใด เป็นของโรงเรียนใด เชื่อมกับ record ใด และเป็น Public/Internal/Private

Public image:
```text
School Website
→ public content record
→ lao_files (visibility=public)
→ authorized Drive delivery
→ browser
```

Private file:
```text
Authenticated user
→ RLS / Role / Scope check
→ backend Drive access
→ preview/download
```

## URL model

ระยะแรก:

```text
https://webbase-x.github.io/is/lao-ems/
https://webbase-x.github.io/is/lao-ems/s/<school-slug>/
```

เมื่อมีโดเมนจริง ระบบต้องรองรับการ map ไปยัง subdomain หรือ custom domain โดยไม่เปลี่ยน `school_id`

## Development order

Foundation → Personnel → Students/Guardians → Academic → Assessment → ปพ. → School Website → Forms/Workflow → Student Care → QA/SAR → Dashboards → AI

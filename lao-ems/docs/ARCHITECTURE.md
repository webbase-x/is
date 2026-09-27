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
ผู้ดูแลกรอกอีเมล + บทบาท
→ lao-invite-user ส่งคำเชิญ
→ ผู้รับยืนยันอีเมล
→ ตั้งค่าโปรไฟล์ + รหัสผ่าน
→ lao_complete_invitation()
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


## LEC authoritative data boundary

LEC is the authoritative source for official school/student master fields. LAO-EMS does not expose normal client UPDATE paths for LEC-owned school fields and does not provide manual CRUD for LEC student master data.

The importer does **not** assume that worksheet 1 is authoritative. It scans the workbook and selects the worksheet whose header contains the complete school identity columns: province, district, LGO, school, student number, first name and last name. This prevents derived sheets such as `stuent`, partial sheets, or ปพ.8 from being treated as the source table.

Import layers:
1. `lao_lec_import_batches` — provenance for every uploaded LEC report.
2. `lao_lec_import_rows` — immutable source-row evidence (raw + canonical mapping).
3. `lao_students` — durable person identity, reused across years/schools when citizen ID matches.
4. `lao_student_school_records` — school-specific student number and current LEC presence.
5. `lao_student_term_enrollments` — year/term/classroom history.
6. Family, address, measurement and benefit snapshot tables — time-stamped by LEC import batch.

A missing student in a newer LEC file is not deleted and is not automatically classified as transferred out. Only a future registry/ปพ. workflow may change the official registry status.


### School identity reconciliation
LEC school metadata and student rows are treated as one source snapshot. The school identity is read from the same selected data rows (จังหวัด / อำเภอ / อปท. / สถานศึกษา), not only from report headings. `lao_lec_school_check()` compares the incoming school identity/details with the tenant before import. `lao_lec_school_snapshots` preserves each accepted school snapshot and its diff. A different already-bound school code is a hard stop. Non-identity changes require explicit School Admin confirmation to adopt the new LEC snapshot. Keeping old values means cancelling the import, not importing students against stale school metadata.


## Admin-managed authentication boundary

LAO-EMS has no public self-signup workflow. `lao_user_invitations` is the admission boundary. A shared Supabase Auth identity from P1/P2/other apps does not become a LAO-EMS user merely by existing in `auth.users`; `lao_has_lao_access()` requires Platform Admin status, a LAO membership, or a pending LAO invitation.

The `lao-invite-user` Edge Function uses the service role only on the server. It verifies the calling JWT, enforces Platform Admin vs School Admin responsibility, sends an invite/magic-link email, and records the invitation. On first accepted invitation, the user completes profile data and sets their own password via the normal authenticated Auth API; `lao_complete_invitation()` then activates the approved membership.


### No manual period input
Academic year and term are source-controlled by LEC. The browser parser extracts them from the selected authoritative worksheet, and the server-side `lao_import_lec_students_auto()` derives the import period from source metadata before delegating to the core importer. The legacy RPC with caller-supplied year/term is not exposed to authenticated clients.


### First school bootstrap from LEC
A new school can enter LAO-EMS without pre-creating official master data. `lao_user_invitations` allows an unbound `platform_first_admin` invitation. After account activation it moves to `onboarding`. The invited School Admin is forced to the LEC importer. `lao_onboard_school_from_lec()` validates the invitation, derives the LGO/school identity from the LEC metadata, creates or reuses the LGO, creates/binds the school, grants the first School Admin membership, and performs the initial LEC import in one transaction. If import fails, the transaction rolls back so no half-created school remains.


### School readiness and user-invitation gate
`lao_school_settings` stores operational settings only; official school identity remains LEC-controlled. `lao_school_setup_status()` computes readiness from three independent facts: successful LEC binding, confirmed school settings, and a connected Google Drive record with a provisioned root folder ID. School Admin invitations are rejected server-side by `lao-invite-user` until all three are true.

The reserved Drive root is `/LAO-EMS/`. Future module folders are created beneath this root only when required. Google OAuth tokens must remain server-side; client code never stores provider secrets or refresh tokens.


### Google Drive activation status
The application-side readiness model, server-side invitation gate, Drive metadata schema, and reserved root-folder contract are implemented. The current `lao-drive-oauth` endpoint intentionally returns `configuration_required` until platform-level Google OAuth credentials are provisioned. No Google client secret or refresh token is stored in GitHub or browser code.


### School Admin invitation links and document verification
Platform-level School Admin application links are controlled by `lao_school_admin_invite_links` and can be independently opened or closed. Public submissions go through the `lao-school-admin-apply` Edge Function, which validates the active token and requires a PDF/JPG/PNG verification document before a pending application is created.

Verification documents are temporarily stored in a private onboarding bucket because no school Drive exists yet. Only Platform Admin can obtain a short-lived signed URL for review. Approval is performed through the server-side invitation function, which verifies a pending application/document and sends the Auth invitation only after review.

### Sensitive profile changes
Changing an account email or password requires immediate re-authentication with the current email and current password before `auth.updateUser()`. Ordinary profile data can be changed without re-entering the password.


### LEC template versioning
Do not treat the development workbook `Sheet1` layout as a permanent LEC contract. It is a legacy sample. The parser gives that layout a compatibility preference but still selects a valid worksheet by detected content. Source metadata records whether a batch matched the legacy sample or was detected from content. When a current LEC export becomes available, validate its structure before changing canonical mappings or database ownership rules.

-- 0054_central_subject_time_templates.sql
-- Central subject/activity time templates + school snapshot/override support.
-- Central values are reference defaults; school values remain independently editable.

begin;

create table if not exists public.lao_central_subject_time_templates(
  id uuid primary key default gen_random_uuid(),
  preset_item_id uuid not null unique references public.lao_curriculum_preset_items(id) on delete cascade,
  curriculum_version text not null default 'core_2551_2560',
  grade_code text not null,
  subject_code text not null,
  term_no smallint,
  period_scope text not null check(period_scope in ('annual','term')),
  annual_hours numeric,
  term_hours numeric,
  weekly_periods numeric,
  credits numeric,
  basis_weeks smallint not null,
  time_mode text not null default 'weekly' check(time_mode in ('weekly','integrated','flexible')),
  standard_kind text not null default 'minimum_reference',
  is_flexible boolean not null default false,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(term_no is null or term_no between 1 and 4),
  check(annual_hours is null or annual_hours>=0),
  check(term_hours is null or term_hours>=0),
  check(weekly_periods is null or weekly_periods>=0),
  check(credits is null or credits>=0),
  check(basis_weeks>0)
);
create index if not exists lao_central_subject_time_templates_grade_idx
  on public.lao_central_subject_time_templates(grade_code,term_no,subject_code);
alter table public.lao_central_subject_time_templates enable row level security;
revoke all on table public.lao_central_subject_time_templates from anon,authenticated;

alter table public.lao_curriculum_courses
  add column if not exists standard_time_template_id uuid references public.lao_central_subject_time_templates(id) on delete set null,
  add column if not exists standard_time_snapshot jsonb,
  add column if not exists time_customized boolean not null default false,
  add column if not exists time_customized_at timestamptz,
  add column if not exists time_customized_by uuid,
  add column if not exists time_override_note text;

with seed(
  grade_code,term_no,subject_code,period_scope,annual_hours,term_hours,
  weekly_periods,credits,basis_weeks,time_mode,is_flexible,note
) as (
  values
('P1',null,'ท11101','annual',200,null,5,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'ค11101','annual',200,null,5,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'ว11101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'ส11101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'ส11102','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'พ11101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'ศ11101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'ง11101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'อ11101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P1',null,'ก11901','annual',40,null,1,null,40,'weekly',false,'กิจกรรมแนะแนว'),
('P1',null,'ก11902','annual',40,null,1,null,40,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('P1',null,'ก11903','annual',30,null,1,null,40,'flexible',true,'มาตรฐานกลาง 30 ชม./ปี; สถานศึกษาอาจจัดตารางร่วมกับกิจกรรมเพื่อสังคมฯ ตามบริบท'),
('P1',null,'ก11904','annual',10,null,null,null,40,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('P2',null,'ท12101','annual',200,null,5,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'ค12101','annual',200,null,5,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'ว12101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'ส12101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'ส12102','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'พ12101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'ศ12101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'ง12101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'อ12101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P2',null,'ก12901','annual',40,null,1,null,40,'weekly',false,'กิจกรรมแนะแนว'),
('P2',null,'ก12902','annual',40,null,1,null,40,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('P2',null,'ก12903','annual',30,null,1,null,40,'flexible',true,'มาตรฐานกลาง 30 ชม./ปี; สถานศึกษาอาจจัดตารางร่วมกับกิจกรรมเพื่อสังคมฯ ตามบริบท'),
('P2',null,'ก12904','annual',10,null,null,null,40,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('P3',null,'ท13101','annual',200,null,5,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'ค13101','annual',200,null,5,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'ว13101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'ส13101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'ส13102','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'พ13101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'ศ13101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'ง13101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'อ13101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P3',null,'ก13901','annual',40,null,1,null,40,'weekly',false,'กิจกรรมแนะแนว'),
('P3',null,'ก13902','annual',40,null,1,null,40,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('P3',null,'ก13903','annual',30,null,1,null,40,'flexible',true,'มาตรฐานกลาง 30 ชม./ปี; สถานศึกษาอาจจัดตารางร่วมกับกิจกรรมเพื่อสังคมฯ ตามบริบท'),
('P3',null,'ก13904','annual',10,null,null,null,40,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('P4',null,'ท14101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'ค14101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'ว14101','annual',120,null,3,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'ส14101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'ส14102','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'พ14101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'ศ14101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'ง14101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'อ14101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P4',null,'ก14901','annual',40,null,1,null,40,'weekly',false,'กิจกรรมแนะแนว'),
('P4',null,'ก14902','annual',40,null,1,null,40,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('P4',null,'ก14903','annual',30,null,1,null,40,'flexible',true,'มาตรฐานกลาง 30 ชม./ปี; สถานศึกษาอาจจัดตารางร่วมกับกิจกรรมเพื่อสังคมฯ ตามบริบท'),
('P4',null,'ก14904','annual',10,null,null,null,40,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('P5',null,'ท15101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'ค15101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'ว15101','annual',120,null,3,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'ส15101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'ส15102','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'พ15101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'ศ15101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'ง15101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'อ15101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P5',null,'ก15901','annual',40,null,1,null,40,'weekly',false,'กิจกรรมแนะแนว'),
('P5',null,'ก15902','annual',40,null,1,null,40,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('P5',null,'ก15903','annual',30,null,1,null,40,'flexible',true,'มาตรฐานกลาง 30 ชม./ปี; สถานศึกษาอาจจัดตารางร่วมกับกิจกรรมเพื่อสังคมฯ ตามบริบท'),
('P5',null,'ก15904','annual',10,null,null,null,40,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('P6',null,'ท16101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'ค16101','annual',160,null,4,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'ว16101','annual',120,null,3,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'ส16101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'ส16102','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'พ16101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'ศ16101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'ง16101','annual',40,null,1,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'อ16101','annual',80,null,2,null,40,'weekly',false,'มาตรฐานกลางขั้นต่ำตามโครงสร้างรายปี'),
('P6',null,'ก16901','annual',40,null,1,null,40,'weekly',false,'กิจกรรมแนะแนว'),
('P6',null,'ก16902','annual',40,null,1,null,40,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('P6',null,'ก16903','annual',30,null,1,null,40,'flexible',true,'มาตรฐานกลาง 30 ชม./ปี; สถานศึกษาอาจจัดตารางร่วมกับกิจกรรมเพื่อสังคมฯ ตามบริบท'),
('P6',null,'ก16904','annual',10,null,null,null,40,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M1',1,'ท21101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'ค21101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'ว21101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'ส21101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'ส21102','term',null,20,1,0.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'พ21101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'ศ21101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'ง21101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'อ21101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',1,'ก21901','term',null,20,1,null,20,'weekly',false,'กิจกรรมแนะแนว'),
('M1',1,'ก21902','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('M1',1,'ก21903','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M1',1,'ก21904','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M1',2,'ท21102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'ค21102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'ว21102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'ส21103','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'ส21104','term',null,20,1,0.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'พ21102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'ศ21102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'ง21102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'อ21102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M1',2,'ก21905','term',null,20,1,null,20,'weekly',false,'กิจกรรมแนะแนว'),
('M1',2,'ก21906','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('M1',2,'ก21907','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M1',2,'ก21908','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M2',1,'ท22101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'ค22101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'ว22101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'ส22101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'ส22102','term',null,20,1,0.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'พ22101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'ศ22101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'ง22101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'อ22101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',1,'ก22901','term',null,20,1,null,20,'weekly',false,'กิจกรรมแนะแนว'),
('M2',1,'ก22902','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('M2',1,'ก22903','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M2',1,'ก22904','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M2',2,'ท22102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'ค22102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'ว22102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'ส22103','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'ส22104','term',null,20,1,0.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'พ22102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'ศ22102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'ง22102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'อ22102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M2',2,'ก22905','term',null,20,1,null,20,'weekly',false,'กิจกรรมแนะแนว'),
('M2',2,'ก22906','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('M2',2,'ก22907','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M2',2,'ก22908','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M3',1,'ท23101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'ค23101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'ว23101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'ส23101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'ส23102','term',null,20,1,0.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'พ23101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'ศ23101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'ง23101','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'อ23101','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',1,'ก23901','term',null,20,1,null,20,'weekly',false,'กิจกรรมแนะแนว'),
('M3',1,'ก23902','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('M3',1,'ก23903','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M3',1,'ก23904','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M3',2,'ท23102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'ค23102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'ว23102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'ส23103','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'ส23104','term',null,20,1,0.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'พ23102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'ศ23102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'ง23102','term',null,40,2,1,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'อ23102','term',null,60,3,1.5,20,'weekly',false,'มาตรฐานกลางขั้นต่ำรายภาคเรียน'),
('M3',2,'ก23905','term',null,20,1,null,20,'weekly',false,'กิจกรรมแนะแนว'),
('M3',2,'ก23906','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักเรียน เลือกรูปแบบตามบริบทสถานศึกษา'),
('M3',2,'ก23907','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M3',2,'ก23908','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M4',1,'ท31101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'ค31101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'ว31101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'ส31101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'ส31102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'พ31101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'ศ31101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'ง31101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'อ31101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',1,'ก31901','term',null,20,1,null,20,'weekly',true,'กิจกรรมแนะแนว'),
('M4',1,'ก31902','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักศึกษาวิชาทหาร / บำเพ็ญฯ / ยุวกาชาด ตามบริบทสถานศึกษา'),
('M4',1,'ก31903','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M4',1,'ก31904','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M4',2,'ท31102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'ค31102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'ว31102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'ส31103','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'ส31104','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'พ31102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'ศ31102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'ง31102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'อ31102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M4',2,'ก31905','term',null,20,1,null,20,'weekly',true,'กิจกรรมแนะแนว'),
('M4',2,'ก31906','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักศึกษาวิชาทหาร / บำเพ็ญฯ / ยุวกาชาด ตามบริบทสถานศึกษา'),
('M4',2,'ก31907','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M4',2,'ก31908','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M5',1,'ท32101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'ค32101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'ว32101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'ส32101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'ส32102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'พ32101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'ศ32101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'ง32101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'อ32101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',1,'ก32901','term',null,20,1,null,20,'weekly',true,'กิจกรรมแนะแนว'),
('M5',1,'ก32902','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักศึกษาวิชาทหาร / บำเพ็ญฯ / ยุวกาชาด ตามบริบทสถานศึกษา'),
('M5',1,'ก32903','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M5',1,'ก32904','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M5',2,'ท32102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'ค32102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'ว32102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'ส32103','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'ส32104','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'พ32102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'ศ32102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'ง32102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'อ32102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M5',2,'ก32905','term',null,20,1,null,20,'weekly',true,'กิจกรรมแนะแนว'),
('M5',2,'ก32906','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักศึกษาวิชาทหาร / บำเพ็ญฯ / ยุวกาชาด ตามบริบทสถานศึกษา'),
('M5',2,'ก32907','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M5',2,'ก32908','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M6',1,'ท33101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'ค33101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'ว33101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'ส33101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'ส33102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'พ33101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'ศ33101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'ง33101','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'อ33101','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',1,'ก33901','term',null,20,1,null,20,'weekly',true,'กิจกรรมแนะแนว'),
('M6',1,'ก33902','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักศึกษาวิชาทหาร / บำเพ็ญฯ / ยุวกาชาด ตามบริบทสถานศึกษา'),
('M6',1,'ก33903','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M6',1,'ก33904','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ'),
('M6',2,'ท33102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'ค33102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'ว33102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'ส33103','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'ส33104','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'พ33102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'ศ33102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'ง33102','term',null,20,1,0.5,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'อ33102','term',null,40,2,1,20,'weekly',true,'ค่าเริ่มต้นมาตรฐานกลาง ม.ปลาย; สถานศึกษาปรับการกระจายตามแผนการเรียนได้'),
('M6',2,'ก33905','term',null,20,1,null,20,'weekly',true,'กิจกรรมแนะแนว'),
('M6',2,'ก33906','term',null,20,1,null,20,'weekly',true,'กิจกรรมนักศึกษาวิชาทหาร / บำเพ็ญฯ / ยุวกาชาด ตามบริบทสถานศึกษา'),
('M6',2,'ก33907','term',null,15,1,null,20,'flexible',true,'กิจกรรมชุมนุม 15 ชม./ภาค; จัดตารางได้ตามบริบท'),
('M6',2,'ก33908','term',null,5,null,null,20,'integrated',true,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์แบบบูรณาการ')
)
insert into public.lao_central_subject_time_templates(
  preset_item_id,curriculum_version,grade_code,subject_code,term_no,period_scope,
  annual_hours,term_hours,weekly_periods,credits,basis_weeks,time_mode,standard_kind,is_flexible,note,is_active
)
select
  p.id,'core_2551_2560',s.grade_code,s.subject_code,s.term_no,s.period_scope,
  s.annual_hours,s.term_hours,s.weekly_periods,s.credits,s.basis_weeks,s.time_mode,
  'minimum_reference',s.is_flexible,nullif(s.note,''),true
from seed s
join public.lao_curriculum_preset_items p
  on p.preset_code='core_2551_2560'
 and p.grade_code=s.grade_code
 and lower(coalesce(p.subject_code,''))=lower(s.subject_code)
 and p.term_no is not distinct from s.term_no
 and ((p.subject_type='basic' and p.is_national_core) or p.subject_type='activity')
on conflict(preset_item_id) do update set
  curriculum_version=excluded.curriculum_version,
  grade_code=excluded.grade_code,
  subject_code=excluded.subject_code,
  term_no=excluded.term_no,
  period_scope=excluded.period_scope,
  annual_hours=excluded.annual_hours,
  term_hours=excluded.term_hours,
  weekly_periods=excluded.weekly_periods,
  credits=excluded.credits,
  basis_weeks=excluded.basis_weeks,
  time_mode=excluded.time_mode,
  standard_kind=excluded.standard_kind,
  is_flexible=excluded.is_flexible,
  note=excluded.note,
  is_active=true,
  updated_at=now();

-- Backward compatibility for functions/screens that still read time from preset items.
update public.lao_curriculum_preset_items p
set weekly_periods=t.weekly_periods,
    annual_hours=t.annual_hours
from public.lao_central_subject_time_templates t
where t.preset_item_id=p.id;

create or replace function public.lao_time_template_json(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $function$
  select case when t.id is null then null else jsonb_build_object(
    'id',t.id,
    'preset_item_id',t.preset_item_id,
    'curriculum_version',t.curriculum_version,
    'grade_code',t.grade_code,
    'subject_code',t.subject_code,
    'term_no',t.term_no,
    'period_scope',t.period_scope,
    'annual_hours',t.annual_hours,
    'term_hours',t.term_hours,
    'weekly_periods',t.weekly_periods,
    'credits',t.credits,
    'basis_weeks',t.basis_weeks,
    'time_mode',t.time_mode,
    'standard_kind',t.standard_kind,
    'is_flexible',t.is_flexible,
    'note',t.note
  ) end
  from public.lao_central_subject_time_templates t
  where t.id=p_template_id and t.is_active
$function$;
revoke all on function public.lao_time_template_json(uuid) from public,anon,authenticated;

create or replace function public.lao_apply_central_time_default_to_course(
  p_course_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_course public.lao_curriculum_courses%rowtype;
  v_subject public.lao_subjects%rowtype;
  v_template public.lao_central_subject_time_templates%rowtype;
  v_snapshot jsonb;
  v_term record;
begin
  select * into v_course from public.lao_curriculum_courses where id=p_course_id;
  if v_course.id is null then return null; end if;
  select * into v_subject from public.lao_subjects where id=v_course.subject_id;
  if v_subject.id is null then return null; end if;

  if v_course.standard_time_template_id is not null then
    select * into v_template
    from public.lao_central_subject_time_templates
    where id=v_course.standard_time_template_id and is_active;
  end if;

  if v_template.id is null then
    select t.* into v_template
    from public.lao_central_subject_time_templates t
    join public.lao_curriculum_preset_items p on p.id=t.preset_item_id
    where t.is_active
      and t.grade_code=v_course.grade_code
      and lower(t.subject_code)=lower(coalesce(v_subject.subject_code,''))
      and (
        p.subject_type<>'activity'
        or lower(btrim(p.subject_name))=lower(btrim(v_subject.name_th))
      )
    order by case when p.subject_type='activity' and lower(btrim(p.subject_name))=lower(btrim(v_subject.name_th)) then 0 else 1 end,
             coalesce(t.term_no,0)
    limit 1;
  end if;

  if v_template.id is null then return null; end if;
  v_snapshot:=public.lao_time_template_json(v_template.id);

  update public.lao_curriculum_courses
  set standard_time_template_id=v_template.id,
      standard_time_snapshot=v_snapshot,
      annual_hours=case when p_force then v_template.annual_hours else coalesce(annual_hours,v_template.annual_hours) end,
      credits=case when p_force then v_template.credits else coalesce(credits,v_template.credits) end,
      time_override_note=case when p_force then null else time_override_note end,
      updated_at=now()
  where id=p_course_id;

  if p_force then
    delete from public.lao_course_term_plans where course_id=p_course_id;
  end if;

  if v_template.period_scope='annual' then
    if v_template.weekly_periods is not null then
      for v_term in
        select id,term_no from public.lao_terms where academic_year_id=v_course.academic_year_id order by term_no
      loop
        insert into public.lao_course_term_plans(
          course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
        ) values(
          p_course_id,v_term.id,v_template.weekly_periods,null,
          'ค่าเริ่มต้นจากมาตรฐานกลาง · ปรับได้ในโครงสร้างของโรงเรียน',
          v_course.updated_by,v_course.updated_by
        )
        on conflict(course_id,term_id) do update set
          weekly_periods=case when p_force then excluded.weekly_periods else coalesce(public.lao_course_term_plans.weekly_periods,excluded.weekly_periods) end,
          updated_at=now();
      end loop;
    end if;
  elsif v_template.term_no is not null then
    select id,term_no into v_term
    from public.lao_terms
    where academic_year_id=v_course.academic_year_id and term_no=v_template.term_no
    limit 1;
    if v_term.id is not null and (v_template.weekly_periods is not null or v_template.term_hours is not null) then
      insert into public.lao_course_term_plans(
        course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
      ) values(
        p_course_id,v_term.id,v_template.weekly_periods,v_template.term_hours,
        'ค่าเริ่มต้นจากมาตรฐานกลาง · ปรับได้ในโครงสร้างของโรงเรียน',
        v_course.updated_by,v_course.updated_by
      )
      on conflict(course_id,term_id) do update set
        weekly_periods=case when p_force then excluded.weekly_periods else coalesce(public.lao_course_term_plans.weekly_periods,excluded.weekly_periods) end,
        term_hours=case when p_force then excluded.term_hours else coalesce(public.lao_course_term_plans.term_hours,excluded.term_hours) end,
        updated_at=now();
    end if;
  end if;

  return v_snapshot;
end;
$function$;
revoke all on function public.lao_apply_central_time_default_to_course(uuid,boolean) from public,anon,authenticated;

-- Backfill standard linkage and missing school values without overwriting existing school-entered time.
do $backfill$
declare r record;
begin
  for r in
    select c.id
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    where c.grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
      and s.subject_code is not null
      and exists(
        select 1
        from public.lao_central_subject_time_templates t
        join public.lao_curriculum_preset_items p on p.id=t.preset_item_id
        where t.grade_code=c.grade_code
          and lower(t.subject_code)=lower(s.subject_code)
          and (p.subject_type<>'activity' or lower(btrim(p.subject_name))=lower(btrim(s.name_th)))
      )
  loop
    perform public.lao_apply_central_time_default_to_course(r.id,false);
  end loop;
end
$backfill$;

-- Wrap the existing add function so every future central adoption receives a school-owned snapshot/default.
alter function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid)
  rename to lao_add_curriculum_library_item_base_v0193;
revoke all on function public.lao_add_curriculum_library_item_base_v0193(uuid,uuid,uuid,text,text,uuid)
  from public,anon,authenticated;

create function public.lao_add_curriculum_library_item(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text,
  p_source_kind text,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_result jsonb;
  v_template jsonb;
begin
  v_result:=public.lao_add_curriculum_library_item_base_v0193(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_source_kind,p_source_id
  );
  if v_result ? 'course_id' then
    v_template:=public.lao_apply_central_time_default_to_course((v_result->>'course_id')::uuid,false);
  end if;
  return v_result||jsonb_build_object(
    'standard_time_applied',v_template is not null,
    'standard_time',v_template
  );
end;
$function$;
revoke all on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) to authenticated;

-- Rebind catalog adoption to the wrapped add function.
create or replace function public.lao_adopt_subject_catalog_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_source_kind text,p_source_id uuid
) returns jsonb language plpgsql security definer set search_path='public' as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_item public.lao_shared_subject_catalog%rowtype;
  v_subject_id uuid;
  v_existing record;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_source_kind='official_central' then
    v_result:=public.lao_add_curriculum_library_item(p_school_id,p_academic_year_id,p_program_id,p_grade_code,'preset',p_source_id);
    v_subject_id:=(v_result->>'subject_id')::uuid;
    update public.lao_subjects set source_kind='official_central',source_catalog_item_id=p_source_id,
      source_shared_subject_id=null,curriculum_framework='core_2551_2560',updated_by=v_uid,updated_at=now()
    where id=v_subject_id and school_id=p_school_id;
    return v_result||jsonb_build_object('source_kind','official_central');
  elsif p_source_kind='school_library' then
    return public.lao_add_curriculum_library_item(p_school_id,p_academic_year_id,p_program_id,p_grade_code,'school',p_source_id)
      ||jsonb_build_object('source_kind','school_library');
  elsif p_source_kind<>'shared_catalog' then
    raise exception 'แหล่งรายวิชาไม่ถูกต้อง';
  end if;

  select * into v_item from public.lao_shared_subject_catalog where id=p_source_id and status in ('published','verified');
  if v_item.id is null then raise exception 'ไม่พบรายวิชาในคลังร่วม'; end if;
  if v_item.grade_code is not null and v_item.grade_code<>p_grade_code then raise exception 'รายวิชานี้ไม่ตรงกับระดับชั้นที่เลือก'; end if;

  if nullif(btrim(v_item.subject_code),'') is not null then
    if v_item.subject_type='activity' then
      select * into v_existing from public.lao_subjects where school_id=p_school_id and is_active
        and lower(coalesce(subject_code,''))=lower(v_item.subject_code) and lower(btrim(name_th))=lower(btrim(v_item.name_th)) limit 1;
    else
      select * into v_existing from public.lao_subjects where school_id=p_school_id and is_active
        and lower(coalesce(subject_code,''))=lower(v_item.subject_code) limit 1;
      if v_existing.id is not null and lower(btrim(v_existing.name_th))<>lower(btrim(v_item.name_th)) then
        raise exception 'รหัส % มีอยู่ในคลังโรงเรียนแล้วในชื่อ “%” กรุณาตรวจสอบก่อนเลือกใช้',v_item.subject_code,v_existing.name_th;
      end if;
    end if;
  else
    select * into v_existing from public.lao_subjects where school_id=p_school_id and is_active
      and subject_type=v_item.subject_type and lower(btrim(name_th))=lower(btrim(v_item.name_th)) limit 1;
  end if;

  v_subject_id:=v_existing.id;
  if v_subject_id is null then
    insert into public.lao_subjects(school_id,subject_code,name_th,name_en,learning_area,subject_type,subject_subtype,is_active,sort_order,
      source_kind,source_shared_subject_id,curriculum_framework,aliases,created_by,updated_by)
    values(p_school_id,upper(nullif(btrim(v_item.subject_code),'')),v_item.name_th,v_item.name_en,v_item.learning_area,v_item.subject_type,v_item.subject_subtype,
      true,0,'shared_catalog',v_item.id,v_item.curriculum_version,v_item.aliases,v_uid,v_uid)
    returning id into v_subject_id;
  else
    update public.lao_subjects set source_kind='shared_catalog',source_shared_subject_id=v_item.id,subject_subtype=v_item.subject_subtype,
      curriculum_framework=coalesce(v_item.curriculum_version,curriculum_framework),aliases=v_item.aliases,updated_by=v_uid,updated_at=now()
    where id=v_subject_id;
  end if;

  v_result:=public.lao_add_curriculum_library_item(p_school_id,p_academic_year_id,p_program_id,p_grade_code,'school',v_subject_id);
  perform public.lao_refresh_shared_subject_usage(v_item.id);
  return v_result||jsonb_build_object('source_kind','shared_catalog','shared_catalog_id',v_item.id);
end;
$function$;
revoke all on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) to authenticated;

create or replace function public.lao_central_time_templates(
  p_school_id uuid,
  p_grade_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  return jsonb_build_object(
    'curriculum_version','core_2551_2560',
    'label','มาตรฐานกลางขั้นต่ำ',
    'items',coalesce((
      select jsonb_agg(
        public.lao_time_template_json(t.id)
        order by case t.grade_code
          when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4 when 'P5' then 5 when 'P6' then 6
          when 'M1' then 11 when 'M2' then 12 when 'M3' then 13 when 'M4' then 14 when 'M5' then 15 when 'M6' then 16 else 99 end,
          coalesce(t.term_no,0),p.sort_order,p.subject_name
      )
      from public.lao_central_subject_time_templates t
      join public.lao_curriculum_preset_items p on p.id=t.preset_item_id
      where t.is_active and (p_grade_code is null or t.grade_code=p_grade_code)
    ),'[]'::jsonb)
  );
end;
$function$;
revoke all on function public.lao_central_time_templates(uuid,text) from public,anon;
grant execute on function public.lao_central_time_templates(uuid,text) to authenticated;

create or replace function public.lao_course_time_overview(
  p_school_id uuid,
  p_academic_year_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'course_id',c.id,
        'standard_time_template_id',c.standard_time_template_id,
        'standard_current',public.lao_time_template_json(c.standard_time_template_id),
        'standard_snapshot',c.standard_time_snapshot,
        'time_customized',c.time_customized,
        'time_customized_at',c.time_customized_at,
        'time_override_note',c.time_override_note,
        'school',jsonb_build_object(
          'annual_hours',c.annual_hours,
          'credits',c.credits,
          'term_plans',coalesce((
            select jsonb_agg(jsonb_build_object(
              'term_id',ctp.term_id,'term_no',t.term_no,
              'weekly_periods',ctp.weekly_periods,'term_hours',ctp.term_hours
            ) order by t.term_no)
            from public.lao_course_term_plans ctp
            join public.lao_terms t on t.id=ctp.term_id
            where ctp.course_id=c.id
          ),'[]'::jsonb)
        )
      ) order by c.sort_order,c.id)
      from public.lao_curriculum_courses c
      where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id and c.is_active
    ),'[]'::jsonb)
  );
end;
$function$;
revoke all on function public.lao_course_time_overview(uuid,uuid) from public,anon;
grant execute on function public.lao_course_time_overview(uuid,uuid) to authenticated;

create or replace function public.lao_recalculate_course_time_customized(p_course_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $function$
declare
  c public.lao_curriculum_courses%rowtype;
  s jsonb;
  v_scope text;
  v_term_no integer;
  v_annual numeric;
  v_term_hours numeric;
  v_weekly numeric;
  v_credits numeric;
  v_custom boolean:=false;
begin
  select * into c from public.lao_curriculum_courses where id=p_course_id;
  if c.id is null or c.standard_time_snapshot is null then return false; end if;
  s:=c.standard_time_snapshot;
  v_scope:=s->>'period_scope';
  v_term_no:=nullif(s->>'term_no','')::integer;
  v_annual:=nullif(s->>'annual_hours','')::numeric;
  v_term_hours:=nullif(s->>'term_hours','')::numeric;
  v_weekly:=nullif(s->>'weekly_periods','')::numeric;
  v_credits:=nullif(s->>'credits','')::numeric;

  if c.annual_hours is distinct from v_annual or c.credits is distinct from v_credits then
    v_custom:=true;
  end if;

  if v_scope='annual' then
    if v_weekly is null then
      if exists(select 1 from public.lao_course_term_plans p where p.course_id=c.id and (p.weekly_periods is not null or p.term_hours is not null)) then
        v_custom:=true;
      end if;
    else
      if exists(
        select 1 from public.lao_terms t
        where t.academic_year_id=c.academic_year_id
          and not exists(
            select 1 from public.lao_course_term_plans p
            where p.course_id=c.id and p.term_id=t.id
              and p.weekly_periods is not distinct from v_weekly
              and p.term_hours is null
          )
      ) then v_custom:=true; end if;
    end if;
  elsif v_scope='term' then
    if exists(
      select 1
      from public.lao_terms t
      left join public.lao_course_term_plans p on p.course_id=c.id and p.term_id=t.id
      where t.academic_year_id=c.academic_year_id and t.term_no=v_term_no
        and (
          p.id is null
          or p.weekly_periods is distinct from v_weekly
          or p.term_hours is distinct from v_term_hours
        )
    ) then v_custom:=true; end if;
    if exists(
      select 1 from public.lao_course_term_plans p
      join public.lao_terms t on t.id=p.term_id
      where p.course_id=c.id and t.term_no<>v_term_no
        and (p.weekly_periods is not null or p.term_hours is not null)
    ) then v_custom:=true; end if;
  end if;

  update public.lao_curriculum_courses
  set time_customized=v_custom,
      time_customized_at=case when v_custom then coalesce(time_customized_at,now()) else null end,
      time_customized_by=case when v_custom then coalesce(time_customized_by,(select auth.uid())) else null end
  where id=c.id;

  return v_custom;
end;
$function$;
revoke all on function public.lao_recalculate_course_time_customized(uuid) from public,anon,authenticated;

create or replace function public.lao_course_time_course_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  perform public.lao_recalculate_course_time_customized(new.id);
  return new;
end;
$function$;

drop trigger if exists trg_lao_course_time_course on public.lao_curriculum_courses;
create trigger trg_lao_course_time_course
after update of annual_hours,credits on public.lao_curriculum_courses
for each row
when (new.standard_time_snapshot is not null)
execute function public.lao_course_time_course_trigger();

create or replace function public.lao_course_time_plan_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  perform public.lao_recalculate_course_time_customized(coalesce(new.course_id,old.course_id));
  return coalesce(new,old);
end;
$function$;

drop trigger if exists trg_lao_course_time_plan on public.lao_course_term_plans;
create trigger trg_lao_course_time_plan
after insert or update of weekly_periods,term_hours or delete on public.lao_course_term_plans
for each row execute function public.lao_course_time_plan_trigger();

do $recalc$
declare r record;
begin
  for r in select id from public.lao_curriculum_courses where standard_time_snapshot is not null
  loop
    perform public.lao_recalculate_course_time_customized(r.id);
  end loop;
end
$recalc$;

create or replace function public.lao_update_course_time_override(
  p_school_id uuid,
  p_course_id uuid,
  p_annual_hours numeric default null,
  p_term_hours numeric default null,
  p_weekly_periods numeric default null,
  p_credits numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  c public.lao_curriculum_courses%rowtype;
  s jsonb;
  v_scope text;
  v_term_no integer;
  v_term record;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  select * into c from public.lao_curriculum_courses where id=p_course_id and school_id=p_school_id;
  if c.id is null then raise exception 'Course not found'; end if;
  if c.standard_time_snapshot is null then raise exception 'รายวิชานี้ไม่มีแม่แบบเวลาเรียนกลาง'; end if;
  if coalesce(p_annual_hours,0)<0 or coalesce(p_term_hours,0)<0 or coalesce(p_weekly_periods,0)<0 or coalesce(p_credits,0)<0 then
    raise exception 'ค่าเวลาเรียนต้องไม่ติดลบ';
  end if;

  s:=c.standard_time_snapshot;
  v_scope:=s->>'period_scope';
  v_term_no:=nullif(s->>'term_no','')::integer;

  update public.lao_curriculum_courses
  set annual_hours=case when v_scope='annual' then p_annual_hours else null end,
      credits=p_credits,
      time_override_note=nullif(btrim(p_note),''),
      updated_by=v_uid,
      updated_at=now()
  where id=c.id;

  delete from public.lao_course_term_plans where course_id=c.id;

  if v_scope='annual' then
    if p_weekly_periods is not null then
      for v_term in select id from public.lao_terms where academic_year_id=c.academic_year_id order by term_no
      loop
        insert into public.lao_course_term_plans(course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by)
        values(c.id,v_term.id,p_weekly_periods,null,'โรงเรียนปรับจากมาตรฐานกลาง',v_uid,v_uid);
      end loop;
    end if;
  else
    select id into v_term from public.lao_terms where academic_year_id=c.academic_year_id and term_no=v_term_no limit 1;
    if v_term.id is null then raise exception 'ไม่พบภาคเรียนที่ %',v_term_no; end if;
    if p_weekly_periods is not null or p_term_hours is not null then
      insert into public.lao_course_term_plans(course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by)
      values(c.id,v_term.id,p_weekly_periods,p_term_hours,'โรงเรียนปรับจากมาตรฐานกลาง',v_uid,v_uid);
    end if;
  end if;

  perform public.lao_recalculate_course_time_customized(c.id);
  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(v_org,p_school_id,v_uid,'curriculum_time_overridden','curriculum_course',c.id::text,
    jsonb_build_object('annual_hours',p_annual_hours,'term_hours',p_term_hours,'weekly_periods',p_weekly_periods,'credits',p_credits,'note',p_note));

  return (select x from jsonb_array_elements((public.lao_course_time_overview(p_school_id,c.academic_year_id)->'items')) x where x->>'course_id'=c.id::text limit 1);
end;
$function$;
revoke all on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text) to authenticated;

create or replace function public.lao_reset_course_time_to_standard(
  p_school_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  c public.lao_curriculum_courses%rowtype;
  v_org uuid;
  v_template jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  select * into c from public.lao_curriculum_courses where id=p_course_id and school_id=p_school_id;
  if c.id is null then raise exception 'Course not found'; end if;
  if c.standard_time_template_id is null then raise exception 'รายวิชานี้ไม่มีแม่แบบเวลาเรียนกลาง'; end if;

  v_template:=public.lao_apply_central_time_default_to_course(c.id,true);
  update public.lao_curriculum_courses
  set standard_time_snapshot=v_template,time_override_note=null,updated_by=v_uid,updated_at=now()
  where id=c.id;
  perform public.lao_recalculate_course_time_customized(c.id);

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(v_org,p_school_id,v_uid,'curriculum_time_reset_to_standard','curriculum_course',c.id::text,
    jsonb_build_object('standard_time',v_template));

  return (select x from jsonb_array_elements((public.lao_course_time_overview(p_school_id,c.academic_year_id)->'items')) x where x->>'course_id'=c.id::text limit 1);
end;
$function$;
revoke all on function public.lao_reset_course_time_to_standard(uuid,uuid) from public,anon;
grant execute on function public.lao_reset_course_time_to_standard(uuid,uuid) to authenticated;

commit;

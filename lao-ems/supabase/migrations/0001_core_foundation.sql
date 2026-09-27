-- LAO-EMS foundation schema
-- DRAFT: เก็บใน GitHub ก่อน ยังไม่ apply จนกว่า LAO-EMS Supabase project จะ Active
-- ห้ามใช้ migration นี้กับฐาน ISSQL/TAS โดยไม่ทบทวน

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name_th text not null,
  name_en text,
  organization_type text not null default 'local_government',
  phone text,
  email text,
  website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text,
  name_th text not null,
  name_en text,
  short_name text,
  education_levels text[] not null default '{}',
  phone text,
  email text,
  website_slug text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (website_slug)
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  year_be integer not null check (year_be between 2400 and 2800),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, year_be)
);

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  term_no smallint not null check (term_no between 1 and 4),
  name text,
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (academic_year_id, term_no)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefix text,
  first_name_th text,
  last_name_th text,
  display_name text,
  phone text,
  avatar_drive_file_id text,
  registration_status text not null default 'pending'
    check (registration_status in ('pending','active','suspended','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','active','suspended','rejected','ended')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  ended_at timestamptz,
  unique (user_id, organization_id, school_id)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_th text not null,
  description text,
  system_role boolean not null default false
);

insert into public.roles (code,name_th,description,system_role) values
 ('platform_admin','ผู้ดูแลแพลตฟอร์ม','ดูแลระบบส่วนกลาง',true),
 ('organization_admin','ผู้ดูแล อปท.','ดูแลสถานศึกษาในสังกัด',true),
 ('organization_viewer','ผู้ดูข้อมูลระดับ อปท.','ดูรายงานตามสิทธิ์',true),
 ('school_admin','ผู้ดูแลสถานศึกษา','จัดการข้อมูลพื้นฐานโรงเรียน',true),
 ('school_executive','ผู้บริหารสถานศึกษา','ดูและอนุมัติงานตามสิทธิ์',true),
 ('registrar','นายทะเบียน','งานทะเบียนและเอกสารการศึกษา',true),
 ('academic_officer','งานวิชาการ','จัดการโครงสร้างวิชาการ',true),
 ('teacher','ครู','ใช้งานข้อมูลตามภาระงาน',true),
 ('staff','บุคลากร','ใช้งานตามงานที่ได้รับมอบหมาย',true),
 ('student','นักเรียน','เข้าถึงข้อมูลของตน',true),
 ('guardian','ผู้ปกครอง','เข้าถึงข้อมูลบุตรหลานตามสิทธิ์',true)
on conflict (code) do nothing;

create table if not exists public.membership_roles (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  primary key (membership_id, role_id)
);

create table if not exists public.file_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  module text not null,
  record_type text,
  record_id uuid,
  drive_file_id text not null,
  drive_parent_id text,
  original_filename text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  visibility text not null default 'private'
    check (visibility in ('private','internal','public')),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (drive_file_id)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_school_idx on public.memberships(school_id);
create index if not exists file_objects_school_module_idx on public.file_objects(school_id,module);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type,entity_id);
create index if not exists audit_logs_school_created_idx on public.audit_logs(school_id,created_at desc);

alter table public.organizations enable row level security;
alter table public.schools enable row level security;
alter table public.academic_years enable row level security;
alter table public.terms enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.roles enable row level security;
alter table public.membership_roles enable row level security;
alter table public.file_objects enable row level security;
alter table public.audit_logs enable row level security;

-- Policies จะเพิ่มหลังยืนยัน registration flow และ admin bootstrap
-- เพื่อไม่เปิดสิทธิ์กว้างเกินไปในระยะเริ่มต้น

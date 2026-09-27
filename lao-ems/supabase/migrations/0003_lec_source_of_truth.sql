-- LAO-EMS: LEC is the authoritative source for school/student master data.
-- Manual editing of LEC-owned fields is disabled. Import history is retained.

alter table public.lao_schools
  add column if not exists source_system text not null default 'setup',
  add column if not exists lec_synced_at timestamptz,
  add column if not exists lec_source_file_name text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='lao_schools_source_system_chk') then
    alter table public.lao_schools
      add constraint lao_schools_source_system_chk
      check (source_system in ('setup','LEC'));
  end if;
end $$;

create table if not exists public.lao_lec_import_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete restrict,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete restrict,
  term_id uuid not null references public.lao_terms(id) on delete restrict,
  academic_year_be integer not null check (academic_year_be between 2400 and 2800),
  term_no smallint not null check (term_no between 1 and 4),
  source_system text not null default 'LEC' check (source_system='LEC'),
  source_report_code text not null default 'RPT318',
  source_file_name text not null,
  source_file_size bigint check (source_file_size is null or source_file_size>=0),
  source_file_sha256 text,
  source_sheet_name text,
  ignored_sheet_count integer not null default 0 check (ignored_sheet_count>=0),
  header_map jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  previous_batch_id uuid references public.lao_lec_import_batches(id) on delete set null,
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  source_row_count integer not null default 0,
  imported_row_count integer not null default 0,
  new_student_count integer not null default 0,
  updated_student_count integer not null default 0,
  missing_from_latest_count integer not null default 0,
  issue_count integer not null default 0,
  imported_by uuid not null references auth.users(id) on delete restrict,
  imported_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lao_lec_import_batches_school_time_idx
  on public.lao_lec_import_batches(school_id,imported_at desc);
create unique index if not exists lao_lec_import_batches_school_hash_uq
  on public.lao_lec_import_batches(school_id,source_file_sha256)
  where source_file_sha256 is not null and status='completed';

alter table public.lao_schools
  add column if not exists lec_last_batch_id uuid references public.lao_lec_import_batches(id) on delete set null;

create table if not exists public.lao_students (
  id uuid primary key default gen_random_uuid(),
  citizen_id text,
  prefix text,
  first_name_th text,
  last_name_th text,
  birth_date date,
  race text,
  nationality text,
  religion text,
  lec_first_seen_at timestamptz not null default now(),
  lec_last_seen_at timestamptz not null default now(),
  lec_last_batch_id uuid references public.lao_lec_import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lao_students_citizen_id_uq
  on public.lao_students(citizen_id) where citizen_id is not null;
create index if not exists lao_students_name_idx
  on public.lao_students(last_name_th,first_name_th);

create table if not exists public.lao_student_school_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.lao_students(id) on delete restrict,
  school_id uuid not null references public.lao_schools(id) on delete restrict,
  student_no text not null,
  admission_date date,
  lec_student_condition text,
  lec_presence_status text not null default 'present'
    check(lec_presence_status in ('present','not_in_latest_lec')),
  registry_status text not null default 'enrolled'
    check(registry_status in ('enrolled','transferred_out','graduated','withdrawn','deceased','other')),
  first_seen_batch_id uuid references public.lao_lec_import_batches(id) on delete set null,
  last_seen_batch_id uuid references public.lao_lec_import_batches(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,student_no),
  unique(school_id,student_id)
);
create index if not exists lao_student_school_records_student_idx
  on public.lao_student_school_records(student_id);
create index if not exists lao_student_school_records_school_presence_idx
  on public.lao_student_school_records(school_id,lec_presence_status);

create table if not exists public.lao_student_term_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.lao_students(id) on delete restrict,
  school_id uuid not null references public.lao_schools(id) on delete restrict,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete restrict,
  term_id uuid not null references public.lao_terms(id) on delete restrict,
  grade_level text,
  classroom text,
  lec_presence_status text not null default 'present'
    check(lec_presence_status in ('present','not_in_latest_lec')),
  source_batch_id uuid not null references public.lao_lec_import_batches(id) on delete restrict,
  source_row_no integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id,school_id,term_id)
);
create index if not exists lao_student_term_enrollments_school_term_idx
  on public.lao_student_term_enrollments(school_id,term_id,lec_presence_status);

create table if not exists public.lao_student_family_snapshots (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.lao_students(id) on delete restrict,
  school_id uuid not null references public.lao_schools(id) on delete restrict,
  batch_id uuid not null references public.lao_lec_import_batches(id) on delete cascade,
  source_row_no integer,
  relation_type text not null check(relation_type in ('father','mother','guardian')),
  prefix text, first_name text, last_name text, religion text, occupation text,
  monthly_income numeric(14,2), phone text, relationship_text text,
  created_at timestamptz not null default now(),
  unique(batch_id,student_id,relation_type)
);

create table if not exists public.lao_student_address_snapshots (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.lao_students(id) on delete restrict,
  school_id uuid not null references public.lao_schools(id) on delete restrict,
  batch_id uuid not null references public.lao_lec_import_batches(id) on delete cascade,
  source_row_no integer,
  address_type text not null check(address_type in ('registered','current')),
  house_no text, moo text, road text, subdistrict text, district text, province text, postal_code text,
  created_at timestamptz not null default now(),
  unique(batch_id,student_id,address_type)
);

create table if not exists public.lao_student_measurement_snapshots (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.lao_students(id) on delete restrict,
  school_id uuid not null references public.lao_schools(id) on delete restrict,
  batch_id uuid not null references public.lao_lec_import_batches(id) on delete cascade,
  source_row_no integer,
  height_cm numeric(6,2), weight_kg numeric(6,2),
  created_at timestamptz not null default now(),
  unique(batch_id,student_id)
);

create table if not exists public.lao_student_benefit_snapshots (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.lao_students(id) on delete restrict,
  school_id uuid not null references public.lao_schools(id) on delete restrict,
  batch_id uuid not null references public.lao_lec_import_batches(id) on delete cascade,
  source_row_no integer,
  tuition_reimbursement text, medical_reimbursement text, family_status text,
  created_at timestamptz not null default now(),
  unique(batch_id,student_id)
);

create table if not exists public.lao_lec_import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.lao_lec_import_batches(id) on delete cascade,
  source_row_no integer not null,
  raw_data jsonb not null,
  canonical_data jsonb not null default '{}'::jsonb,
  student_id uuid references public.lao_students(id) on delete set null,
  outcome text not null check(outcome in ('new','updated','error')),
  issue_message text,
  created_at timestamptz not null default now(),
  unique(batch_id,source_row_no)
);
create index if not exists lao_lec_import_rows_batch_outcome_idx
  on public.lao_lec_import_rows(batch_id,outcome);

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='lao_students_touch') then
    create trigger lao_students_touch before update on public.lao_students
    for each row execute function public.lao_touch_updated_at();
  end if;
  if not exists(select 1 from pg_trigger where tgname='lao_student_school_records_touch') then
    create trigger lao_student_school_records_touch before update on public.lao_student_school_records
    for each row execute function public.lao_touch_updated_at();
  end if;
  if not exists(select 1 from pg_trigger where tgname='lao_student_term_enrollments_touch') then
    create trigger lao_student_term_enrollments_touch before update on public.lao_student_term_enrollments
    for each row execute function public.lao_touch_updated_at();
  end if;
end $$;

create or replace function public.lao_parse_lec_date(p_text text)
returns date language plpgsql immutable set search_path=public as $$
declare v text:=nullif(btrim(p_text),''); a text[]; d integer; m integer; y integer; n integer;
begin
  if v is null then return null; end if;
  if v ~ '^\d{4}-\d{1,2}-\d{1,2}$' then
    a:=regexp_split_to_array(v,'-'); y:=a[1]::integer; m:=a[2]::integer; d:=a[3]::integer;
    if y>2400 then y:=y-543; end if; return make_date(y,m,d);
  elsif v ~ '^\d{1,2}/\d{1,2}/\d{4}$' then
    a:=regexp_split_to_array(v,'/'); d:=a[1]::integer; m:=a[2]::integer; y:=a[3]::integer;
    if y>2400 then y:=y-543; end if; return make_date(y,m,d);
  elsif v ~ '^\d{5}(\.0+)?$' then
    n:=split_part(v,'.',1)::integer;
    if n between 20000 and 80000 then return date '1899-12-30' + n; end if;
  end if;
  return null;
exception when others then return null;
end;
$$;

create or replace function public.lao_normalize_lec_citizen_id(p_text text)
returns text language sql immutable set search_path=public as $$
  select case when length(regexp_replace(coalesce(p_text,''),'\D','','g'))=13
    then regexp_replace(coalesce(p_text,''),'\D','','g') else null end;
$$;

create or replace function public.lao_lec_numeric(p_text text)
returns numeric language plpgsql immutable set search_path=public as $$
declare v text:=replace(nullif(btrim(p_text),''),',','');
begin
  if v is null or v !~ '^-?\d+(\.\d+)?$' then return null; end if;
  return v::numeric;
exception when others then return null;
end;
$$;

create or replace function public.lao_import_lec_students(
  p_school_id uuid,p_academic_year_be integer,p_term_no smallint,
  p_file_name text,p_file_size bigint,p_file_sha256 text,p_sheet_name text,
  p_ignored_sheet_count integer,p_header_map jsonb,p_metadata jsonb,p_rows jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=(select auth.uid());
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
  v_year_id uuid; v_term_id uuid; v_batch_id uuid; v_prev uuid;
  v_row jsonb; c jsonb; v_raw jsonb; v_row_no integer;
  v_student_id uuid; v_school_record_id uuid; v_student_no text; v_citizen text; v_is_new boolean;
  v_new_count integer:=0; v_updated_count integer:=0; v_imported integer:=0; v_issues integer:=0; v_missing integer:=0;
  v_f jsonb; v_a jsonb;
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  if not public.lao_is_local_school_admin(p_school_id) then raise exception 'Only this school administrator can import LEC data'; end if;
  if p_academic_year_be not between 2400 and 2800 then raise exception 'Invalid academic year'; end if;
  if p_term_no not between 1 and 4 then raise exception 'Invalid term'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'No LEC rows found'; end if;
  if jsonb_array_length(p_rows)>10000 then raise exception 'LEC file contains too many rows for one import'; end if;
  if p_file_sha256 is not null and exists(
    select 1 from public.lao_lec_import_batches
    where school_id=p_school_id and source_file_sha256=p_file_sha256 and status='completed'
  ) then raise exception 'This exact LEC file has already been imported'; end if;

  insert into public.lao_academic_years(school_id,year_be,is_current)
  values(p_school_id,p_academic_year_be,false)
  on conflict(school_id,year_be) do update set year_be=excluded.year_be
  returning id into v_year_id;

  insert into public.lao_terms(academic_year_id,term_no,name,is_current)
  values(v_year_id,p_term_no,'ภาคเรียนที่ '||p_term_no,false)
  on conflict(academic_year_id,term_no) do update set term_no=excluded.term_no
  returning id into v_term_id;

  select id into v_prev from public.lao_lec_import_batches
  where school_id=p_school_id and status='completed' order by imported_at desc limit 1;

  insert into public.lao_lec_import_batches(
    school_id,academic_year_id,term_id,academic_year_be,term_no,
    source_file_name,source_file_size,source_file_sha256,source_sheet_name,
    ignored_sheet_count,header_map,source_metadata,previous_batch_id,
    source_row_count,imported_by
  ) values(
    p_school_id,v_year_id,v_term_id,p_academic_year_be,p_term_no,
    p_file_name,p_file_size,p_file_sha256,p_sheet_name,greatest(coalesce(p_ignored_sheet_count,0),0),
    coalesce(p_header_map,'{}'::jsonb),coalesce(p_metadata,'{}'::jsonb),v_prev,jsonb_array_length(p_rows),v_uid
  ) returning id into v_batch_id;

  update public.lao_student_term_enrollments
  set lec_presence_status='not_in_latest_lec'
  where school_id=p_school_id and term_id=v_term_id;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    begin
      v_row_no:=coalesce((v_row->>'source_row_no')::integer,0);
      v_raw:=coalesce(v_row->'raw','{}'::jsonb);
      c:=coalesce(v_row->'canonical','{}'::jsonb);
      v_student_no:=nullif(btrim(c->>'student_no'),'');
      v_citizen:=public.lao_normalize_lec_citizen_id(c->>'citizen_id');
      v_student_id:=null; v_school_record_id:=null; v_is_new:=false;

      if v_student_no is null then raise exception 'Missing student number'; end if;
      if nullif(btrim(c->>'first_name_th'),'') is null and nullif(btrim(c->>'last_name_th'),'') is null then
        raise exception 'Missing student name';
      end if;

      if v_citizen is not null then select id into v_student_id from public.lao_students where citizen_id=v_citizen; end if;
      if v_student_id is null then
        select ss.student_id into v_student_id from public.lao_student_school_records ss
        where ss.school_id=p_school_id and ss.student_no=v_student_no;
      end if;

      if v_student_id is null then
        insert into public.lao_students(
          citizen_id,prefix,first_name_th,last_name_th,birth_date,race,nationality,religion,
          lec_first_seen_at,lec_last_seen_at,lec_last_batch_id
        ) values(
          v_citizen,nullif(btrim(c->>'prefix'),''),nullif(btrim(c->>'first_name_th'),''),
          nullif(btrim(c->>'last_name_th'),''),public.lao_parse_lec_date(c->>'birth_date'),
          nullif(btrim(c->>'race'),''),nullif(btrim(c->>'nationality'),''),
          nullif(btrim(c->>'religion'),''),now(),now(),v_batch_id
        ) returning id into v_student_id;
        v_is_new:=true; v_new_count:=v_new_count+1;
      else
        update public.lao_students s set
          citizen_id=case when c ? 'citizen_id' and v_citizen is not null then v_citizen else s.citizen_id end,
          prefix=case when c ? 'prefix' then nullif(btrim(c->>'prefix'),'') else s.prefix end,
          first_name_th=case when c ? 'first_name_th' then nullif(btrim(c->>'first_name_th'),'') else s.first_name_th end,
          last_name_th=case when c ? 'last_name_th' then nullif(btrim(c->>'last_name_th'),'') else s.last_name_th end,
          birth_date=case when c ? 'birth_date' then public.lao_parse_lec_date(c->>'birth_date') else s.birth_date end,
          race=case when c ? 'race' then nullif(btrim(c->>'race'),'') else s.race end,
          nationality=case when c ? 'nationality' then nullif(btrim(c->>'nationality'),'') else s.nationality end,
          religion=case when c ? 'religion' then nullif(btrim(c->>'religion'),'') else s.religion end,
          lec_last_seen_at=now(),lec_last_batch_id=v_batch_id
        where s.id=v_student_id;
        v_updated_count:=v_updated_count+1;
      end if;

      select id into v_school_record_id from public.lao_student_school_records
      where school_id=p_school_id and student_id=v_student_id;

      if v_school_record_id is null then
        insert into public.lao_student_school_records(
          student_id,school_id,student_no,admission_date,lec_student_condition,
          lec_presence_status,first_seen_batch_id,last_seen_batch_id,first_seen_at,last_seen_at
        ) values(
          v_student_id,p_school_id,v_student_no,public.lao_parse_lec_date(c->>'admission_date'),
          nullif(btrim(c->>'student_condition'),''),'present',v_batch_id,v_batch_id,now(),now()
        ) returning id into v_school_record_id;
      else
        update public.lao_student_school_records set
          student_no=v_student_no,
          admission_date=case when c ? 'admission_date' then public.lao_parse_lec_date(c->>'admission_date') else admission_date end,
          lec_student_condition=case when c ? 'student_condition' then nullif(btrim(c->>'student_condition'),'') else lec_student_condition end,
          lec_presence_status='present',last_seen_batch_id=v_batch_id,last_seen_at=now()
        where id=v_school_record_id;
      end if;

      insert into public.lao_student_term_enrollments(
        student_id,school_id,academic_year_id,term_id,grade_level,classroom,
        lec_presence_status,source_batch_id,source_row_no
      ) values(
        v_student_id,p_school_id,v_year_id,v_term_id,
        nullif(btrim(c->>'grade_level'),''),nullif(btrim(c->>'classroom'),''),
        'present',v_batch_id,v_row_no
      )
      on conflict(student_id,school_id,term_id) do update set
        academic_year_id=excluded.academic_year_id,grade_level=excluded.grade_level,classroom=excluded.classroom,
        lec_presence_status='present',source_batch_id=excluded.source_batch_id,source_row_no=excluded.source_row_no,updated_at=now();

      v_f:=c->'father';
      if v_f is not null and jsonb_typeof(v_f)='object' and v_f<>'{}'::jsonb then
        insert into public.lao_student_family_snapshots(
          student_id,school_id,batch_id,source_row_no,relation_type,prefix,first_name,last_name,
          religion,occupation,monthly_income,phone,relationship_text
        ) values(v_student_id,p_school_id,v_batch_id,v_row_no,'father',
          nullif(btrim(v_f->>'prefix'),''),nullif(btrim(v_f->>'first_name'),''),
          nullif(btrim(v_f->>'last_name'),''),nullif(btrim(v_f->>'religion'),''),
          nullif(btrim(v_f->>'occupation'),''),public.lao_lec_numeric(v_f->>'monthly_income'),
          nullif(btrim(v_f->>'phone'),''),null);
      end if;

      v_f:=c->'mother';
      if v_f is not null and jsonb_typeof(v_f)='object' and v_f<>'{}'::jsonb then
        insert into public.lao_student_family_snapshots(
          student_id,school_id,batch_id,source_row_no,relation_type,prefix,first_name,last_name,
          religion,occupation,monthly_income,phone,relationship_text
        ) values(v_student_id,p_school_id,v_batch_id,v_row_no,'mother',
          nullif(btrim(v_f->>'prefix'),''),nullif(btrim(v_f->>'first_name'),''),
          nullif(btrim(v_f->>'last_name'),''),nullif(btrim(v_f->>'religion'),''),
          nullif(btrim(v_f->>'occupation'),''),public.lao_lec_numeric(v_f->>'monthly_income'),
          nullif(btrim(v_f->>'phone'),''),null);
      end if;

      v_f:=c->'guardian';
      if v_f is not null and jsonb_typeof(v_f)='object' and v_f<>'{}'::jsonb then
        insert into public.lao_student_family_snapshots(
          student_id,school_id,batch_id,source_row_no,relation_type,prefix,first_name,last_name,
          religion,occupation,monthly_income,phone,relationship_text
        ) values(v_student_id,p_school_id,v_batch_id,v_row_no,'guardian',
          nullif(btrim(v_f->>'prefix'),''),nullif(btrim(v_f->>'first_name'),''),
          nullif(btrim(v_f->>'last_name'),''),nullif(btrim(v_f->>'religion'),''),
          nullif(btrim(v_f->>'occupation'),''),public.lao_lec_numeric(v_f->>'monthly_income'),
          nullif(btrim(v_f->>'phone'),''),nullif(btrim(v_f->>'relationship'),''));
      end if;

      v_a:=c->'registered_address';
      if v_a is not null and jsonb_typeof(v_a)='object' and v_a<>'{}'::jsonb then
        insert into public.lao_student_address_snapshots(
          student_id,school_id,batch_id,source_row_no,address_type,house_no,moo,road,subdistrict,district,province,postal_code
        ) values(v_student_id,p_school_id,v_batch_id,v_row_no,'registered',
          nullif(btrim(v_a->>'house_no'),''),nullif(btrim(v_a->>'moo'),''),
          nullif(btrim(v_a->>'road'),''),nullif(btrim(v_a->>'subdistrict'),''),
          nullif(btrim(v_a->>'district'),''),nullif(btrim(v_a->>'province'),''),
          nullif(btrim(v_a->>'postal_code'),''));
      end if;

      v_a:=c->'current_address';
      if v_a is not null and jsonb_typeof(v_a)='object' and v_a<>'{}'::jsonb then
        insert into public.lao_student_address_snapshots(
          student_id,school_id,batch_id,source_row_no,address_type,house_no,moo,road,subdistrict,district,province,postal_code
        ) values(v_student_id,p_school_id,v_batch_id,v_row_no,'current',
          nullif(btrim(v_a->>'house_no'),''),nullif(btrim(v_a->>'moo'),''),
          nullif(btrim(v_a->>'road'),''),nullif(btrim(v_a->>'subdistrict'),''),
          nullif(btrim(v_a->>'district'),''),nullif(btrim(v_a->>'province'),''),
          nullif(btrim(v_a->>'postal_code'),''));
      end if;

      if c ? 'height_cm' or c ? 'weight_kg' then
        insert into public.lao_student_measurement_snapshots(
          student_id,school_id,batch_id,source_row_no,height_cm,weight_kg
        ) values(v_student_id,p_school_id,v_batch_id,v_row_no,
          public.lao_lec_numeric(c->>'height_cm'),public.lao_lec_numeric(c->>'weight_kg'));
      end if;

      if c ? 'tuition_reimbursement' or c ? 'medical_reimbursement' or c ? 'family_status' then
        insert into public.lao_student_benefit_snapshots(
          student_id,school_id,batch_id,source_row_no,tuition_reimbursement,medical_reimbursement,family_status
        ) values(v_student_id,p_school_id,v_batch_id,v_row_no,
          nullif(btrim(c->>'tuition_reimbursement'),''),nullif(btrim(c->>'medical_reimbursement'),''),
          nullif(btrim(c->>'family_status'),''));
      end if;

      insert into public.lao_lec_import_rows(batch_id,source_row_no,raw_data,canonical_data,student_id,outcome)
      values(v_batch_id,v_row_no,v_raw,c,v_student_id,case when v_is_new then 'new' else 'updated' end);
      v_imported:=v_imported+1;
    exception when others then
      v_issues:=v_issues+1;
      insert into public.lao_lec_import_rows(batch_id,source_row_no,raw_data,canonical_data,outcome,issue_message)
      values(v_batch_id,coalesce(v_row_no,0),coalesce(v_raw,'{}'::jsonb),coalesce(c,'{}'::jsonb),'error',sqlerrm)
      on conflict(batch_id,source_row_no) do update set
        outcome='error',issue_message=excluded.issue_message,raw_data=excluded.raw_data,canonical_data=excluded.canonical_data;
    end;
  end loop;

  update public.lao_student_school_records ss set lec_presence_status='not_in_latest_lec'
  where ss.school_id=p_school_id and not exists(
    select 1 from public.lao_lec_import_rows ir
    where ir.batch_id=v_batch_id and ir.student_id=ss.student_id and ir.outcome in ('new','updated')
  );

  select count(*) into v_missing from public.lao_student_school_records
  where school_id=p_school_id and lec_presence_status='not_in_latest_lec';

  update public.lao_lec_import_batches set status='completed',imported_row_count=v_imported,
    new_student_count=v_new_count,updated_student_count=v_updated_count,
    missing_from_latest_count=v_missing,issue_count=v_issues,completed_at=now()
  where id=v_batch_id;

  update public.lao_schools s set
    source_system='LEC',lec_synced_at=now(),lec_last_batch_id=v_batch_id,lec_source_file_name=p_file_name,
    name_th=case when nullif(btrim(p_metadata->>'school_name_th'),'') is not null then btrim(p_metadata->>'school_name_th') else s.name_th end,
    code=case when nullif(btrim(p_metadata->>'school_code'),'') is not null then btrim(p_metadata->>'school_code') else s.code end
  where s.id=p_school_id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data,context
  )
  select s.organization_id,p_school_id,v_uid,'lec_import_completed','lec_import',v_batch_id::text,
    jsonb_build_object('academic_year_be',p_academic_year_be,'term_no',p_term_no,'rows',v_imported,
      'new_students',v_new_count,'updated_students',v_updated_count,'missing_from_latest',v_missing,'issues',v_issues),
    jsonb_build_object('source_file_name',p_file_name,'source_file_sha256',p_file_sha256,'source_sheet_name',p_sheet_name)
  from public.lao_schools s where s.id=p_school_id;

  return jsonb_build_object('batch_id',v_batch_id,'imported_rows',v_imported,'new_students',v_new_count,
    'updated_students',v_updated_count,'missing_from_latest',v_missing,'issues',v_issues);
end;
$$;

drop policy if exists "lao schools local admin update" on public.lao_schools;
drop policy if exists "lao schools school admin update" on public.lao_schools;
revoke update on public.lao_schools from authenticated;

revoke execute on function public.lao_propose_school_change(uuid,jsonb,text) from authenticated;
revoke execute on function public.lao_review_school_change(uuid,text,text) from authenticated;
revoke execute on function public.lao_emergency_update_school(uuid,jsonb,text) from authenticated;
revoke execute on function public.lao_school_admin_update_school(uuid,jsonb,text) from authenticated;

alter table public.lao_lec_import_batches enable row level security;
alter table public.lao_lec_import_rows enable row level security;
alter table public.lao_students enable row level security;
alter table public.lao_student_school_records enable row level security;
alter table public.lao_student_term_enrollments enable row level security;
alter table public.lao_student_family_snapshots enable row level security;
alter table public.lao_student_address_snapshots enable row level security;
alter table public.lao_student_measurement_snapshots enable row level security;
alter table public.lao_student_benefit_snapshots enable row level security;

grant select on public.lao_lec_import_batches,public.lao_lec_import_rows,
  public.lao_students,public.lao_student_school_records,public.lao_student_term_enrollments,
  public.lao_student_family_snapshots,public.lao_student_address_snapshots,
  public.lao_student_measurement_snapshots,public.lao_student_benefit_snapshots to authenticated;

revoke all on function public.lao_parse_lec_date(text) from public,anon,authenticated;
revoke all on function public.lao_normalize_lec_citizen_id(text) from public,anon,authenticated;
revoke all on function public.lao_lec_numeric(text) from public,anon,authenticated;
revoke all on function public.lao_import_lec_students(uuid,integer,smallint,text,bigint,text,text,integer,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.lao_import_lec_students(uuid,integer,smallint,text,bigint,text,text,integer,jsonb,jsonb,jsonb) to authenticated;

drop policy if exists "lao lec batches admin read" on public.lao_lec_import_batches;
create policy "lao lec batches admin read" on public.lao_lec_import_batches
for select to authenticated using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

drop policy if exists "lao lec rows admin read" on public.lao_lec_import_rows;
create policy "lao lec rows admin read" on public.lao_lec_import_rows
for select to authenticated using(exists(
  select 1 from public.lao_lec_import_batches b
  where b.id=batch_id and (public.lao_is_platform_admin() or public.lao_is_local_school_admin(b.school_id))
));

drop policy if exists "lao students admin read" on public.lao_students;
create policy "lao students admin read" on public.lao_students
for select to authenticated using(public.lao_is_platform_admin() or exists(
  select 1 from public.lao_student_school_records ss
  where ss.student_id=public.lao_students.id and public.lao_is_local_school_admin(ss.school_id)
));

drop policy if exists "lao student school records admin read" on public.lao_student_school_records;
create policy "lao student school records admin read" on public.lao_student_school_records
for select to authenticated using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

drop policy if exists "lao student term enrollments admin read" on public.lao_student_term_enrollments;
create policy "lao student term enrollments admin read" on public.lao_student_term_enrollments
for select to authenticated using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

drop policy if exists "lao student family snapshots admin read" on public.lao_student_family_snapshots;
create policy "lao student family snapshots admin read" on public.lao_student_family_snapshots
for select to authenticated using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

drop policy if exists "lao student address snapshots admin read" on public.lao_student_address_snapshots;
create policy "lao student address snapshots admin read" on public.lao_student_address_snapshots
for select to authenticated using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

drop policy if exists "lao student measurement snapshots admin read" on public.lao_student_measurement_snapshots;
create policy "lao student measurement snapshots admin read" on public.lao_student_measurement_snapshots
for select to authenticated using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

drop policy if exists "lao student benefit snapshots admin read" on public.lao_student_benefit_snapshots;
create policy "lao student benefit snapshots admin read" on public.lao_student_benefit_snapshots
for select to authenticated using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

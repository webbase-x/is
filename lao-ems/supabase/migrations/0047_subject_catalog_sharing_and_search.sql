-- 0047_subject_catalog_sharing_and_search.sql
-- Unified subject discovery: central catalog + shared school catalog + school library.

begin;

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.lao_shared_subject_catalog (
  id uuid primary key default gen_random_uuid(),
  source_school_id uuid not null references public.lao_schools(id) on delete restrict,
  grade_code text,
  subject_code text,
  name_th text not null,
  name_en text,
  learning_area text,
  subject_type text not null,
  subject_subtype text,
  aliases text[] not null default '{}'::text[],
  curriculum_version text,
  status text not null default 'published',
  version_no integer not null default 1,
  supersedes_id uuid references public.lao_shared_subject_catalog(id) on delete set null,
  usage_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint lao_shared_subject_catalog_type_check check(subject_type in ('additional','activity')),
  constraint lao_shared_subject_catalog_status_check check(status in ('draft','published','verified','retired')),
  constraint lao_shared_subject_catalog_grade_check check(grade_code is null or grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')),
  constraint lao_shared_subject_catalog_version_check check(version_no > 0),
  constraint lao_shared_subject_catalog_usage_check check(usage_count >= 0)
);

alter table public.lao_shared_subject_catalog enable row level security;
revoke all on table public.lao_shared_subject_catalog from anon, authenticated;

create unique index if not exists lao_shared_subject_catalog_code_unique
on public.lao_shared_subject_catalog(lower(subject_code),coalesce(grade_code,''),subject_type)
where subject_code is not null and subject_type <> 'activity' and status <> 'retired';

create unique index if not exists lao_shared_subject_catalog_activity_unique
on public.lao_shared_subject_catalog(lower(subject_code),lower(name_th),coalesce(grade_code,''))
where subject_code is not null and subject_type = 'activity' and status <> 'retired';

create unique index if not exists lao_shared_subject_catalog_name_unique
on public.lao_shared_subject_catalog(lower(name_th),coalesce(grade_code,''),subject_type)
where subject_code is null and status <> 'retired';

create index if not exists lao_shared_subject_catalog_search_idx
on public.lao_shared_subject_catalog using gin ((coalesce(subject_code,'')||' '||name_th||' '||coalesce(learning_area,'')) extensions.gin_trgm_ops);
create index if not exists lao_shared_subject_catalog_source_school_idx on public.lao_shared_subject_catalog(source_school_id);
create index if not exists lao_shared_subject_catalog_grade_idx on public.lao_shared_subject_catalog(grade_code,status);

alter table public.lao_subjects add column if not exists subject_subtype text;
alter table public.lao_subjects add column if not exists source_kind text not null default 'school_local';
alter table public.lao_subjects add column if not exists source_catalog_item_id uuid references public.lao_curriculum_preset_items(id) on delete set null;
alter table public.lao_subjects add column if not exists source_shared_subject_id uuid references public.lao_shared_subject_catalog(id) on delete set null;
alter table public.lao_subjects add column if not exists curriculum_framework text;
alter table public.lao_subjects add column if not exists aliases text[] not null default '{}'::text[];

alter table public.lao_subjects drop constraint if exists lao_subjects_source_kind_check;
alter table public.lao_subjects add constraint lao_subjects_source_kind_check
check(source_kind in ('official_central','shared_catalog','school_local','legacy'));

create index if not exists lao_subjects_source_catalog_item_idx on public.lao_subjects(source_catalog_item_id);
create index if not exists lao_subjects_source_shared_subject_idx on public.lao_subjects(source_shared_subject_id);
create index if not exists lao_subjects_search_idx
on public.lao_subjects using gin ((coalesce(subject_code,'')||' '||name_th||' '||coalesce(learning_area,'')) extensions.gin_trgm_ops);

create table if not exists public.lao_subject_recording_rules (
  rule_code text primary key,
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.lao_subject_recording_rules enable row level security;
revoke all on table public.lao_subject_recording_rules from anon, authenticated;

insert into public.lao_subject_recording_rules(rule_code,title,description,sort_order)
values
('search_before_create','ค้นหาก่อนสร้าง','ค้นหาจากคลังมาตรฐานกลาง คลังรายวิชาร่วม และคลังของโรงเรียนก่อนสร้างรายการใหม่',10),
('central_first','พื้นฐานใช้คลังมาตรฐาน','รายวิชาพื้นฐานให้เลือกจากคลังมาตรฐานกลาง ไม่สร้างรายการพื้นฐานใหม่ซ้ำในโรงเรียน',20),
('shared_reuse','ใช้คลังร่วมเมื่อมี','รายวิชาเพิ่มเติมหรือกิจกรรมที่มีในคลังร่วมให้เลือกใช้ได้ทันที โรงเรียนไม่ต้องพิมพ์ข้อมูลซ้ำ',30),
('school_usage_separate','แยกต้นแบบกับการใช้งานจริง','ตัววิชาเป็นรายการอ้างอิง ส่วนปี ระดับชั้น โปรแกรม ชั่วโมง และภาคเรียนบันทึกในโครงสร้างหลักสูตรของโรงเรียน',40),
('trace_source','เก็บที่มา','ทุกวิชาของโรงเรียนต้องเก็บ source_kind และรหัสอ้างอิงต้นทางเมื่อมาจากคลังกลางหรือคลังร่วม',50),
('preserve_history','ไม่ลบประวัติ','ยกเลิกใช้รายวิชาให้ปิดรายการในโครงสร้างปีนั้น ไม่ลบตัววิชาที่เคยใช้เพื่อรักษาข้อมูลย้อนหลังและ ปพ.',60),
('shared_revision','คลังร่วมใช้การออกรุ่น','รายการคลังร่วมที่มีโรงเรียนอื่นใช้แล้วห้ามแก้รหัสหรือชื่อทับเดิม ให้สร้าง revision ใหม่และเชื่อม supersedes_id',70)
on conflict(rule_code) do update set title=excluded.title,description=excluded.description,sort_order=excluded.sort_order,is_active=true,updated_at=now();

create or replace function public.lao_refresh_shared_subject_usage(p_shared_id uuid)
returns void language sql security definer set search_path='public' as $$
  update public.lao_shared_subject_catalog c
  set usage_count=(select count(distinct s.school_id)::int from public.lao_subjects s where s.source_shared_subject_id=c.id and s.is_active),
      updated_at=case when c.updated_at is null then now() else c.updated_at end
  where c.id=p_shared_id;
$$;
revoke all on function public.lao_refresh_shared_subject_usage(uuid) from public, anon, authenticated;

create or replace function public.lao_subject_shared_usage_trigger()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.source_shared_subject_id is not null then
    perform public.lao_refresh_shared_subject_usage(old.source_shared_subject_id);
  end if;
  if tg_op in ('INSERT','UPDATE') and new.source_shared_subject_id is not null then
    perform public.lao_refresh_shared_subject_usage(new.source_shared_subject_id);
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function public.lao_subject_shared_usage_trigger() from public, anon, authenticated;

drop trigger if exists lao_subject_shared_usage_trg on public.lao_subjects;
create trigger lao_subject_shared_usage_trg
after insert or update of source_shared_subject_id,is_active or delete on public.lao_subjects
for each row execute function public.lao_subject_shared_usage_trigger();

create or replace function public.lao_protect_shared_subject_identity()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if old.usage_count>0 and (
    new.subject_code is distinct from old.subject_code or
    new.name_th is distinct from old.name_th or
    new.subject_type is distinct from old.subject_type or
    new.grade_code is distinct from old.grade_code
  ) then
    raise exception 'รายการนี้มีโรงเรียนใช้งานแล้ว กรุณาสร้างรุ่นใหม่แทนการแก้รหัส ชื่อ ประเภท หรือระดับชั้นเดิม';
  end if;
  new.updated_at:=now();
  return new;
end;
$$;
revoke all on function public.lao_protect_shared_subject_identity() from public, anon, authenticated;

drop trigger if exists lao_protect_shared_subject_identity_trg on public.lao_shared_subject_catalog;
create trigger lao_protect_shared_subject_identity_trg
before update on public.lao_shared_subject_catalog
for each row execute function public.lao_protect_shared_subject_identity();

create or replace function public.lao_subject_recording_guidance(p_school_id uuid)
returns jsonb language plpgsql stable security definer set search_path='public' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('rule_code',rule_code,'title',title,'description',description) order by sort_order)
    from public.lao_subject_recording_rules where is_active),'[]'::jsonb);
end;
$$;
revoke all on function public.lao_subject_recording_guidance(uuid) from public, anon;
grant execute on function public.lao_subject_recording_guidance(uuid) to authenticated;

create or replace function public.lao_search_subject_catalog(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text,
  p_query text default '',
  p_subject_type text default null,
  p_subject_subtype text default null,
  p_limit integer default 30
) returns jsonb
language plpgsql stable security definer set search_path='public' as $$
declare
  v_q text:=lower(btrim(coalesce(p_query,'')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,30),60));
  v_results jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then raise exception 'Academic year not found'; end if;
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then raise exception 'ระดับชั้นไม่ถูกต้อง'; end if;

  if v_q='' then
    return jsonb_build_object('results','[]'::jsonb,'rules',public.lao_subject_recording_guidance(p_school_id));
  end if;

  with candidates as (
    select
      'official_central'::text source_kind,p.id source_id,p.subject_code,p.subject_name name_th,p.learning_area,p.subject_type,
      null::text subject_subtype,p.grade_code,null::text source_school_name,'verified'::text catalog_status,0::int usage_count,p.term_no,
      exists(select 1 from public.lao_subjects s where s.school_id=p_school_id and s.source_catalog_item_id=p.id and s.is_active) already_in_school,
      exists(select 1 from public.lao_curriculum_courses c join public.lao_subjects s on s.id=c.subject_id
        where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id and c.grade_code=p_grade_code and c.is_active
          and c.program_id is not distinct from p_program_id and s.source_catalog_item_id=p.id) already_in_curriculum,
      greatest(
        case when lower(coalesce(p.subject_code,''))=v_q then 100 else 0 end,
        case when lower(coalesce(p.subject_code,'')) like v_q||'%' then 92 else 0 end,
        case when lower(coalesce(p.subject_code,'')) like '%'||v_q||'%' then 82 else 0 end,
        case when lower(btrim(p.subject_name))=v_q then 96 else 0 end,
        case when lower(p.subject_name) like '%'||v_q||'%' then 80 else 0 end,
        round((extensions.similarity(lower(p.subject_name),v_q)*70)::numeric,2),
        case when lower(coalesce(p.learning_area,'')) like '%'||v_q||'%' then 55 else 0 end
      )::numeric match_score
    from public.lao_curriculum_preset_items p
    where p.preset_code='core_2551_2560' and p.grade_code=p_grade_code
      and ((p.subject_type='basic' and p.is_national_core) or p.subject_type='activity')
      and (p_subject_type is null or p.subject_type=p_subject_type)

    union all

    select
      'shared_catalog',c.id,c.subject_code,c.name_th,c.learning_area,c.subject_type,c.subject_subtype,c.grade_code,sch.name_th,c.status,c.usage_count,null::smallint,
      exists(select 1 from public.lao_subjects s where s.school_id=p_school_id and s.source_shared_subject_id=c.id and s.is_active),
      exists(select 1 from public.lao_curriculum_courses cc join public.lao_subjects s on s.id=cc.subject_id
        where cc.school_id=p_school_id and cc.academic_year_id=p_academic_year_id and cc.grade_code=p_grade_code and cc.is_active
          and cc.program_id is not distinct from p_program_id and s.source_shared_subject_id=c.id),
      greatest(
        case when lower(coalesce(c.subject_code,''))=v_q then 100 else 0 end,
        case when lower(coalesce(c.subject_code,'')) like v_q||'%' then 92 else 0 end,
        case when lower(coalesce(c.subject_code,'')) like '%'||v_q||'%' then 82 else 0 end,
        case when lower(btrim(c.name_th))=v_q then 96 else 0 end,
        case when lower(c.name_th) like '%'||v_q||'%' then 80 else 0 end,
        round((extensions.similarity(lower(c.name_th),v_q)*70)::numeric,2),
        case when exists(select 1 from unnest(c.aliases) a where lower(a) like '%'||v_q||'%') then 72 else 0 end,
        case when lower(coalesce(c.learning_area,'')) like '%'||v_q||'%' then 55 else 0 end
      )
    from public.lao_shared_subject_catalog c
    join public.lao_schools sch on sch.id=c.source_school_id
    where c.status in ('published','verified') and (c.grade_code is null or c.grade_code=p_grade_code)
      and (p_subject_type is null or c.subject_type=p_subject_type)
      and (p_subject_subtype is null or c.subject_subtype=p_subject_subtype)

    union all

    select
      'school_library',s.id,s.subject_code,s.name_th,s.learning_area,s.subject_type,s.subject_subtype,null::text,sch.name_th,
      case when s.is_active then 'active' else 'inactive' end,0::int,null::smallint,true,
      exists(select 1 from public.lao_curriculum_courses cc where cc.school_id=p_school_id and cc.academic_year_id=p_academic_year_id
        and cc.grade_code=p_grade_code and cc.program_id is not distinct from p_program_id and cc.subject_id=s.id and cc.is_active),
      greatest(
        case when lower(coalesce(s.subject_code,''))=v_q then 105 else 0 end,
        case when lower(coalesce(s.subject_code,'')) like v_q||'%' then 94 else 0 end,
        case when lower(coalesce(s.subject_code,'')) like '%'||v_q||'%' then 84 else 0 end,
        case when lower(btrim(s.name_th))=v_q then 100 else 0 end,
        case when lower(s.name_th) like '%'||v_q||'%' then 82 else 0 end,
        round((extensions.similarity(lower(s.name_th),v_q)*70)::numeric,2),
        case when exists(select 1 from unnest(s.aliases) a where lower(a) like '%'||v_q||'%') then 72 else 0 end,
        case when lower(coalesce(s.learning_area,'')) like '%'||v_q||'%' then 55 else 0 end
      )
    from public.lao_subjects s join public.lao_schools sch on sch.id=s.school_id
    where s.school_id=p_school_id and s.is_active
      and (p_subject_type is null or s.subject_type=p_subject_type)
      and (p_subject_subtype is null or s.subject_subtype=p_subject_subtype)
  ), filtered as (
    select * from candidates where match_score>=18
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'source_kind',source_kind,'source_id',source_id,'subject_code',subject_code,'name_th',name_th,
    'learning_area',learning_area,'subject_type',subject_type,'subject_subtype',subject_subtype,'grade_code',grade_code,
    'source_school_name',source_school_name,'catalog_status',catalog_status,'usage_count',usage_count,'term_no',term_no,
    'already_in_school',already_in_school,'already_in_curriculum',already_in_curriculum,'match_score',match_score,
    'exact_match',(lower(coalesce(subject_code,''))=v_q or lower(btrim(name_th))=v_q)
  ) order by match_score desc,
     case source_kind when 'school_library' then 1 when 'official_central' then 2 else 3 end,
     coalesce(subject_code,''),name_th),'[]'::jsonb)
  into v_results
  from (select * from filtered order by match_score desc limit v_limit) z;

  return jsonb_build_object('results',v_results,'rules',public.lao_subject_recording_guidance(p_school_id));
end;
$$;
revoke all on function public.lao_search_subject_catalog(uuid,uuid,uuid,text,text,text,text,integer) from public, anon;
grant execute on function public.lao_search_subject_catalog(uuid,uuid,uuid,text,text,text,text,integer) to authenticated;

create or replace function public.lao_adopt_subject_catalog_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_source_kind text,p_source_id uuid
) returns jsonb language plpgsql security definer set search_path='public' as $$
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
$$;
revoke all on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) from public, anon;
grant execute on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) to authenticated;

create or replace function public.lao_create_school_subject_and_add(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,
  p_subject_code text,p_subject_name text,p_learning_area text,p_subject_type text,
  p_subject_subtype text default null,p_aliases text[] default '{}'::text[],p_share_to_catalog boolean default true,
  p_curriculum_version text default null
) returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  v_uid uuid:=(select auth.uid());
  v_org uuid;
  v_code text:=upper(nullif(btrim(p_subject_code),''));
  v_name text:=nullif(btrim(p_subject_name),'');
  v_subject_id uuid;
  v_shared_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then raise exception 'Academic year not found'; end if;
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then raise exception 'ระดับชั้นไม่ถูกต้อง'; end if;
  if v_name is null then raise exception 'กรุณาระบุชื่อรายวิชา'; end if;
  if p_subject_type not in ('additional','activity') then raise exception 'สร้างใหม่ได้เฉพาะรายวิชาเพิ่มเติมหรือกิจกรรม ส่วนรายวิชาพื้นฐานให้เลือกจากคลังมาตรฐานกลาง'; end if;

  if v_code is not null then
    if p_subject_type='activity' then
      if exists(select 1 from public.lao_subjects where school_id=p_school_id and is_active and lower(coalesce(subject_code,''))=lower(v_code) and lower(btrim(name_th))=lower(v_name)) then
        raise exception 'พบรหัสและชื่อกิจกรรมนี้ในคลังโรงเรียนแล้ว กรุณาค้นหาแล้วเลือกใช้รายการเดิม';
      end if;
      if exists(select 1 from public.lao_curriculum_preset_items where preset_code='core_2551_2560' and grade_code=p_grade_code and subject_type='activity' and lower(coalesce(subject_code,''))=lower(v_code) and lower(btrim(subject_name))=lower(v_name)) then
        raise exception 'พบกิจกรรมนี้ในคลังมาตรฐานกลางแล้ว กรุณาค้นหาแล้วเลือกใช้รายการเดิม';
      end if;
      if exists(select 1 from public.lao_shared_subject_catalog where status in ('published','verified') and (grade_code is null or grade_code=p_grade_code) and subject_type='activity' and lower(coalesce(subject_code,''))=lower(v_code) and lower(btrim(name_th))=lower(v_name)) then
        raise exception 'พบกิจกรรมนี้ในคลังรายวิชาร่วมแล้ว กรุณาค้นหาแล้วเลือกใช้รายการเดิม';
      end if;
    else
      if exists(select 1 from public.lao_subjects where school_id=p_school_id and is_active and lower(coalesce(subject_code,''))=lower(v_code)) then
        raise exception 'รหัส % มีอยู่ในคลังโรงเรียนแล้ว กรุณาค้นหาแล้วเลือกใช้รายการเดิม',v_code;
      end if;
      if exists(select 1 from public.lao_curriculum_preset_items where preset_code='core_2551_2560' and grade_code=p_grade_code and lower(coalesce(subject_code,''))=lower(v_code)) then
        raise exception 'รหัส % มีอยู่ในคลังมาตรฐานกลางแล้ว กรุณาค้นหาแล้วเลือกใช้รายการเดิม',v_code;
      end if;
      if exists(select 1 from public.lao_shared_subject_catalog where status in ('published','verified') and (grade_code is null or grade_code=p_grade_code) and lower(coalesce(subject_code,''))=lower(v_code)) then
        raise exception 'รหัส % มีอยู่ในคลังรายวิชาร่วมแล้ว กรุณาค้นหาแล้วเลือกใช้รายการเดิม',v_code;
      end if;
    end if;
  else
    if exists(select 1 from public.lao_subjects where school_id=p_school_id and is_active and subject_type=p_subject_type and lower(btrim(name_th))=lower(v_name))
       or exists(select 1 from public.lao_shared_subject_catalog where status in ('published','verified') and (grade_code is null or grade_code=p_grade_code) and subject_type=p_subject_type and lower(btrim(name_th))=lower(v_name)) then
      raise exception 'พบชื่อรายการเดียวกันแล้ว กรุณาค้นหาแล้วเลือกใช้รายการเดิม';
    end if;
  end if;

  insert into public.lao_subjects(school_id,subject_code,name_th,learning_area,subject_type,subject_subtype,is_active,sort_order,
    source_kind,curriculum_framework,aliases,created_by,updated_by)
  values(p_school_id,v_code,v_name,nullif(btrim(p_learning_area),''),p_subject_type,nullif(btrim(p_subject_subtype),''),true,0,
    'school_local',nullif(btrim(p_curriculum_version),''),coalesce(p_aliases,'{}'::text[]),v_uid,v_uid)
  returning id into v_subject_id;

  if coalesce(p_share_to_catalog,true) then
    insert into public.lao_shared_subject_catalog(source_school_id,grade_code,subject_code,name_th,learning_area,subject_type,subject_subtype,aliases,
      curriculum_version,status,created_by,updated_by)
    values(p_school_id,p_grade_code,v_code,v_name,nullif(btrim(p_learning_area),''),p_subject_type,nullif(btrim(p_subject_subtype),''),coalesce(p_aliases,'{}'::text[]),
      nullif(btrim(p_curriculum_version),''),'published',v_uid,v_uid)
    returning id into v_shared_id;
    update public.lao_subjects set source_shared_subject_id=v_shared_id where id=v_subject_id;
  end if;

  v_result:=public.lao_add_curriculum_library_item(p_school_id,p_academic_year_id,p_program_id,p_grade_code,'school',v_subject_id);
  if v_shared_id is not null then perform public.lao_refresh_shared_subject_usage(v_shared_id); end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(v_org,p_school_id,v_uid,'school_subject_created','subject',v_subject_id::text,jsonb_build_object(
    'subject_code',v_code,'subject_name',v_name,'subject_type',p_subject_type,'subject_subtype',p_subject_subtype,
    'grade_code',p_grade_code,'program_id',p_program_id,'shared_catalog_id',v_shared_id));

  return v_result||jsonb_build_object('subject_id',v_subject_id,'source_kind','school_local','shared_catalog_id',v_shared_id);
end;
$$;
revoke all on function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) from public, anon;
grant execute on function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) to authenticated;

create or replace function public.lao_subject_workspace(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text)
returns jsonb language plpgsql stable security definer set search_path='public' as $$
declare
  v_uid uuid := (select auth.uid());
  v_status jsonb;
  v_groups jsonb;
  v_sources jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  v_status:=public.lao_curriculum_group_status(p_school_id,p_academic_year_id,p_program_id,p_grade_code);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'name',g.name,'weekly_periods',g.weekly_periods,
    'members',coalesce((select jsonb_agg(jsonb_build_object('course_id',c.id,'subject_id',s.id,'subject_code',s.subject_code,'subject_name',s.name_th,'subject_type',s.subject_type) order by c.sort_order,s.name_th)
      from public.lao_curriculum_parallel_group_courses gc join public.lao_curriculum_courses c on c.id=gc.course_id join public.lao_subjects s on s.id=c.subject_id where gc.group_id=g.id),'[]'::jsonb)
  ) order by g.created_at),'[]'::jsonb) into v_groups
  from public.lao_curriculum_parallel_groups g
  where g.school_id=p_school_id and g.academic_year_id=p_academic_year_id and g.program_id is not distinct from p_program_id and g.grade_code=p_grade_code;

  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'subject_id',s.id,'source_kind',s.source_kind,'subject_subtype',s.subject_subtype,
    'source_catalog_item_id',s.source_catalog_item_id,'source_shared_subject_id',s.source_shared_subject_id,
    'curriculum_framework',s.curriculum_framework,'aliases',s.aliases,
    'shared_status',sc.status,'shared_usage_count',sc.usage_count,'shared_source_school',src.name_th
  )),'[]'::jsonb) into v_sources
  from public.lao_curriculum_courses c
  join public.lao_subjects s on s.id=c.subject_id
  left join public.lao_shared_subject_catalog sc on sc.id=s.source_shared_subject_id
  left join public.lao_schools src on src.id=sc.source_school_id
  where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id and c.grade_code=p_grade_code and c.is_active
    and (c.program_id is not distinct from p_program_id or (p_program_id is not null and c.program_id is null and s.subject_type in ('basic','activity')));

  return jsonb_build_object('status',v_status,'parallel_groups',v_groups,'subject_sources',v_sources,
    'recording_rules',public.lao_subject_recording_guidance(p_school_id));
end;
$$;
revoke all on function public.lao_subject_workspace(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.lao_subject_workspace(uuid,uuid,uuid,text) to authenticated;

commit;
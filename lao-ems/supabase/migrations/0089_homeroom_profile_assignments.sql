-- 0089_homeroom_profile_assignments.sql
-- Homeroom/advisor assignments owned by personnel work, plus a read-only assignment summary for the user's profile.

begin;

create table if not exists public.lao_homeroom_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  class_section_id uuid not null references public.lao_class_sections(id) on delete cascade,
  personnel_id uuid not null references public.lao_personnel(id) on delete restrict,
  assignment_role text not null default 'homeroom'
    check (assignment_role in ('homeroom','advisor')),
  is_primary boolean not null default true,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(academic_year_id,class_section_id,personnel_id)
);

create index if not exists lao_homeroom_assignments_personnel_idx
  on public.lao_homeroom_assignments(school_id,academic_year_id,personnel_id,is_active);
create index if not exists lao_homeroom_assignments_class_idx
  on public.lao_homeroom_assignments(school_id,academic_year_id,class_section_id,is_active);
create unique index if not exists lao_homeroom_assignments_one_primary_idx
  on public.lao_homeroom_assignments(class_section_id)
  where is_primary and is_active;

drop trigger if exists lao_homeroom_assignments_touch on public.lao_homeroom_assignments;
create trigger lao_homeroom_assignments_touch
before update on public.lao_homeroom_assignments
for each row execute function public.lao_touch_updated_at();

alter table public.lao_homeroom_assignments enable row level security;
revoke all on table public.lao_homeroom_assignments from public,anon,authenticated;

create or replace function public.lao_homeroom_assignment_settings(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_year uuid;
  v_can_manage boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_personnel(p_school_id) then raise exception 'Access denied'; end if;

  v_can_manage:=public.lao_can_manage_personnel(p_school_id);

  select ay.id into v_year
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
    and (p_academic_year_id is null or ay.id=p_academic_year_id)
  order by
    case when p_academic_year_id is not null and ay.id=p_academic_year_id then 0 else 1 end,
    ay.is_current desc,
    ay.year_be desc
  limit 1;

  return jsonb_build_object(
    'selected_year_id',v_year,
    'can_manage',v_can_manage,
    'years',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ay.id,'year_be',ay.year_be,'is_current',ay.is_current
      ) order by ay.year_be desc)
      from public.lao_academic_years ay
      where ay.school_id=p_school_id
    ),'[]'::jsonb),
    'personnel',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'full_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
        'position_title',p.position_title,
        'personnel_type',p.personnel_type
      ) order by p.sort_order,concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th))
      from public.lao_personnel p
      where p.school_id=p_school_id
        and p.employment_status='active'
        and p.personnel_type in ('teacher','executive','educational_staff')
    ),'[]'::jsonb),
    'classes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'class_section_id',cs.id,
        'grade_code',cs.grade_code,
        'grade_label',cs.grade_label,
        'section_label',cs.section_label,
        'room_name',cs.room_name,
        'program_code',ap.code,
        'program_name',ap.name_th,
        'assignments',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',ha.id,
            'personnel_id',ha.personnel_id,
            'full_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
            'position_title',p.position_title,
            'assignment_role',ha.assignment_role,
            'is_primary',ha.is_primary,
            'starts_on',ha.starts_on,
            'ends_on',ha.ends_on,
            'is_active',ha.is_active
          ) order by ha.is_primary desc,p.sort_order,concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th))
          from public.lao_homeroom_assignments ha
          join public.lao_personnel p on p.id=ha.personnel_id
          where ha.school_id=p_school_id
            and ha.academic_year_id=v_year
            and ha.class_section_id=cs.id
            and ha.is_active
        ),'[]'::jsonb)
      ) order by cs.sort_order,cs.grade_code,cs.section_label)
      from public.lao_class_sections cs
      left join public.lao_academic_programs ap on ap.id=cs.program_id
      where cs.school_id=p_school_id
        and cs.academic_year_id=v_year
        and cs.is_active
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.lao_homeroom_assignment_settings(uuid,uuid) from public,anon;
grant execute on function public.lao_homeroom_assignment_settings(uuid,uuid) to authenticated;

create or replace function public.lao_save_homeroom_assignment(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_class_section_id uuid,
  p_personnel_id uuid,
  p_assignment_role text default 'homeroom',
  p_is_primary boolean default true,
  p_starts_on date default null,
  p_ends_on date default null,
  p_assignment_id uuid default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_saved public.lao_homeroom_assignments%rowtype;
  v_org uuid;
  v_class_name text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_personnel(p_school_id) then raise exception 'ไม่มีสิทธิ์มอบหมายครูประจำชั้น/ครูที่ปรึกษา'; end if;
  if p_assignment_role not in ('homeroom','advisor') then raise exception 'ประเภทการมอบหมายไม่ถูกต้อง'; end if;
  if p_ends_on is not null and p_starts_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น';
  end if;

  if not exists(
    select 1 from public.lao_academic_years ay
    where ay.id=p_academic_year_id and ay.school_id=p_school_id
  ) then raise exception 'ไม่พบปีการศึกษาที่เลือก'; end if;

  select concat_ws(' ',cs.grade_label,'ห้อง',cs.section_label)
  into v_class_name
  from public.lao_class_sections cs
  where cs.id=p_class_section_id
    and cs.school_id=p_school_id
    and cs.academic_year_id=p_academic_year_id
    and cs.is_active;
  if v_class_name is null then raise exception 'ไม่พบห้องเรียนที่เลือก'; end if;

  if not exists(
    select 1 from public.lao_personnel p
    where p.id=p_personnel_id
      and p.school_id=p_school_id
      and p.employment_status='active'
  ) then raise exception 'ไม่พบบุคลากรที่เลือกหรือไม่ได้อยู่ในสถานะปฏิบัติงาน'; end if;

  if p_is_primary and p_is_active then
    update public.lao_homeroom_assignments
    set is_primary=false,updated_by=v_uid,updated_at=now()
    where class_section_id=p_class_section_id
      and is_active
      and is_primary
      and (p_assignment_id is null or id<>p_assignment_id);
  end if;

  if p_assignment_id is null then
    insert into public.lao_homeroom_assignments(
      school_id,academic_year_id,class_section_id,personnel_id,
      assignment_role,is_primary,starts_on,ends_on,is_active,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_class_section_id,p_personnel_id,
      p_assignment_role,p_is_primary,p_starts_on,p_ends_on,p_is_active,v_uid,v_uid
    )
    on conflict(academic_year_id,class_section_id,personnel_id)
    do update set
      assignment_role=excluded.assignment_role,
      is_primary=excluded.is_primary,
      starts_on=excluded.starts_on,
      ends_on=excluded.ends_on,
      is_active=excluded.is_active,
      updated_by=v_uid,
      updated_at=now()
    returning * into v_saved;
  else
    update public.lao_homeroom_assignments
    set personnel_id=p_personnel_id,
        assignment_role=p_assignment_role,
        is_primary=p_is_primary,
        starts_on=p_starts_on,
        ends_on=p_ends_on,
        is_active=p_is_active,
        updated_by=v_uid,
        updated_at=now()
    where id=p_assignment_id
      and school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and class_section_id=p_class_section_id
    returning * into v_saved;
    if not found then raise exception 'ไม่พบรายการมอบหมายที่ต้องการแก้ไข'; end if;
  end if;

  select s.organization_id into v_org
  from public.lao_schools s where s.id=p_school_id;

  if v_saved.is_active then
    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    select pa.user_id,v_org,p_school_id,'homeroom_assignment',
      case when v_saved.assignment_role='advisor' then 'ได้รับมอบหมายเป็นครูที่ปรึกษา' else 'ได้รับมอบหมายเป็นครูประจำชั้น' end,
      v_class_name,
      'homeroom_assignment',v_saved.id::text
    from public.lao_personnel_accounts pa
    where pa.school_id=p_school_id
      and pa.personnel_id=v_saved.personnel_id
      and pa.user_id<>v_uid
      and not exists(
        select 1 from public.lao_notifications n
        where n.user_id=pa.user_id
          and n.notification_type='homeroom_assignment'
          and n.entity_type='homeroom_assignment'
          and n.entity_id=v_saved.id::text
          and n.read_at is null
      );
  end if;

  return jsonb_build_object(
    'id',v_saved.id,
    'is_active',v_saved.is_active,
    'is_primary',v_saved.is_primary,
    'assignment_role',v_saved.assignment_role,
    'updated_at',v_saved.updated_at
  );
end;
$function$;

revoke all on function public.lao_save_homeroom_assignment(uuid,uuid,uuid,uuid,text,boolean,date,date,uuid,boolean) from public,anon;
grant execute on function public.lao_save_homeroom_assignment(uuid,uuid,uuid,uuid,text,boolean,date,date,uuid,boolean) to authenticated;

create or replace function public.lao_my_profile_assignments(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_own uuid;
  v_year uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_personnel(p_school_id) then raise exception 'Access denied'; end if;

  v_own:=public.lao_my_personnel_id(p_school_id);

  select ay.id into v_year
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
  order by ay.is_current desc,ay.year_be desc
  limit 1;

  if v_own is null then
    return jsonb_build_object(
      'personnel_id',null,'academic_year_id',v_year,
      'year_be',(select ay.year_be from public.lao_academic_years ay where ay.id=v_year),
      'homerooms','[]'::jsonb,'teaching','[]'::jsonb,'subject_groups','[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'personnel_id',v_own,
    'academic_year_id',v_year,
    'year_be',(select ay.year_be from public.lao_academic_years ay where ay.id=v_year),
    'homerooms',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ha.id,
        'class_section_id',cs.id,
        'grade_label',cs.grade_label,
        'section_label',cs.section_label,
        'class_short',case
          when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
          when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
          when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
          else cs.grade_label||'/'||cs.section_label end,
        'program_code',ap.code,
        'assignment_role',ha.assignment_role,
        'is_primary',ha.is_primary,
        'starts_on',ha.starts_on,
        'ends_on',ha.ends_on
      ) order by ha.is_primary desc,cs.sort_order,cs.grade_code,cs.section_label)
      from public.lao_homeroom_assignments ha
      join public.lao_class_sections cs on cs.id=ha.class_section_id
      left join public.lao_academic_programs ap on ap.id=cs.program_id
      where ha.school_id=p_school_id
        and ha.academic_year_id=v_year
        and ha.personnel_id=v_own
        and ha.is_active
        and (ha.starts_on is null or ha.starts_on<=current_date)
        and (ha.ends_on is null or ha.ends_on>=current_date)
    ),'[]'::jsonb),
    'teaching',coalesce((
      select jsonb_agg(x.payload order by x.term_no,x.subject_name,x.class_short)
      from (
        select distinct
          t.term_no,
          s.name_th subject_name,
          case
            when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
            when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
            when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
            else cs.grade_label||'/'||cs.section_label end class_short,
          jsonb_build_object(
            'workload_item_id',wi.id,
            'course_id',c.id,
            'subject_code',s.subject_code,
            'subject_name',s.name_th,
            'learning_area',s.learning_area,
            'class_section_id',cs.id,
            'class_short',case
              when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
              when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
              when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
              else cs.grade_label||'/'||cs.section_label end,
            'program_code',ap.code,
            'term_no',t.term_no,
            'weekly_periods',wi.weekly_periods,
            'teaching_role',wi.teaching_role
          ) payload
        from public.lao_teaching_workloads w
        join public.lao_teaching_workload_items wi on wi.workload_id=w.id
        join public.lao_curriculum_courses c on c.id=wi.course_id
        join public.lao_subjects s on s.id=c.subject_id
        join public.lao_class_sections cs on cs.id=wi.class_section_id
        join public.lao_terms t on t.id=w.term_id
        left join public.lao_academic_programs ap on ap.id=cs.program_id
        where w.school_id=p_school_id
          and w.academic_year_id=v_year
          and w.personnel_id=v_own
          and w.status='approved'
      ) x
    ),'[]'::jsonb),
    'subject_groups',coalesce((
      with member_areas as (
        select distinct s.learning_area
        from public.lao_teaching_workloads w
        join public.lao_teaching_workload_items wi on wi.workload_id=w.id
        join public.lao_curriculum_courses c on c.id=wi.course_id
        join public.lao_subjects s on s.id=c.subject_id
        where w.school_id=p_school_id
          and w.academic_year_id=v_year
          and w.personnel_id=v_own
          and w.status='approved'
          and public.lao_subject_group_scope_code(s.learning_area) is not null
      ),
      authority_areas as (
        select distinct public.lao_subject_group_learning_area(a.scope_code) learning_area
        from public.lao_work_authorities a
        where a.school_id=p_school_id
          and a.user_id=v_uid
          and a.scope_code like 'academics.subject_groups.%'
          and a.scope_code<>'academics.subject_groups'
          and a.is_active
          and (a.starts_on is null or a.starts_on<=current_date)
          and (a.ends_on is null or a.ends_on>=current_date)
          and public.lao_subject_group_learning_area(a.scope_code) is not null
      ),
      all_areas as (
        select learning_area from member_areas
        union
        select learning_area from authority_areas
      )
      select jsonb_agg(jsonb_build_object(
        'learning_area',aa.learning_area,
        'is_member',public.lao_subject_group_is_member(p_school_id,v_year,aa.learning_area,v_own),
        'is_head',coalesce((public.lao_subject_group_explicit_authority(p_school_id,aa.learning_area)->>'is_head')::boolean,false),
        'can_delegate',coalesce((public.lao_subject_group_explicit_authority(p_school_id,aa.learning_area)->>'can_delegate')::boolean,false),
        'can_confirm',coalesce((public.lao_subject_group_explicit_authority(p_school_id,aa.learning_area)->>'can_approve')::boolean,false),
        'my_open_tasks',(
          select count(*) from public.lao_subject_group_tasks t
          where t.school_id=p_school_id
            and t.academic_year_id=v_year
            and t.learning_area=aa.learning_area
            and t.assigned_to=v_own
            and t.status in ('assigned','in_progress','returned')
        ),
        'pending_confirmations',(
          select count(*) from public.lao_subject_group_tasks t
          where t.school_id=p_school_id
            and t.academic_year_id=v_year
            and t.learning_area=aa.learning_area
            and t.status='submitted'
        )
      ) order by aa.learning_area)
      from all_areas aa
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.lao_my_profile_assignments(uuid) from public,anon;
grant execute on function public.lao_my_profile_assignments(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

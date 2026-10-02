-- 0045_student_activity_records.sql
-- Student-level activity assignment for PP.1/PP.5 source data.
-- A school may offer many activity names under the same code, but each learner has one active
-- activity name for that code in the same academic period.

begin;

create table if not exists public.lao_student_activity_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  term_id uuid references public.lao_terms(id) on delete cascade,
  student_id uuid not null references public.lao_students(id) on delete cascade,
  course_id uuid not null references public.lao_curriculum_courses(id) on delete restrict,
  grade_code text not null,
  activity_code text not null,
  activity_name text not null,
  status text not null default 'active' check(status in ('active','replaced','withdrawn')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lao_student_activity_enrollments_scope_idx
  on public.lao_student_activity_enrollments(school_id,academic_year_id,student_id,status);

create unique index if not exists lao_student_activity_enrollments_one_code_active_uq
  on public.lao_student_activity_enrollments(
    student_id,
    academic_year_id,
    coalesce(term_id,'00000000-0000-0000-0000-000000000000'::uuid),
    lower(activity_code)
  )
  where status='active';

drop trigger if exists lao_student_activity_enrollments_touch on public.lao_student_activity_enrollments;
create trigger lao_student_activity_enrollments_touch
before update on public.lao_student_activity_enrollments
for each row execute function public.lao_touch_updated_at();

alter table public.lao_student_activity_enrollments enable row level security;
revoke all on public.lao_student_activity_enrollments from anon,authenticated;

create or replace function public.lao_set_student_activity_enrollment(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_student_id uuid,
  p_course_id uuid,
  p_term_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_course record;
  v_term_id uuid := p_term_id;
  v_term_count integer:=0;
  v_id uuid;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  if not exists(
    select 1
    from public.lao_student_term_enrollments e
    where e.student_id=p_student_id
      and e.school_id=p_school_id
      and e.academic_year_id=p_academic_year_id
  ) then
    raise exception 'ไม่พบนักเรียนในปีการศึกษานี้';
  end if;

  select
    c.id,c.grade_code,c.academic_year_id,c.school_id,
    s.subject_code,s.name_th,s.subject_type
  into v_course
  from public.lao_curriculum_courses c
  join public.lao_subjects s on s.id=c.subject_id
  where c.id=p_course_id
    and c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.is_active
    and s.subject_type='activity'
    and s.is_active
  limit 1;

  if v_course.id is null then raise exception 'ไม่พบกิจกรรมที่เลือกในหลักสูตรของโรงเรียน'; end if;
  if nullif(btrim(v_course.subject_code),'') is null then raise exception 'กิจกรรมต้องมีรหัส'; end if;

  select count(*),min(tp.term_id)
  into v_term_count,v_term_id
  from public.lao_course_term_plans tp
  join public.lao_terms t on t.id=tp.term_id
  where tp.course_id=p_course_id
    and t.academic_year_id=p_academic_year_id
    and (p_term_id is null or tp.term_id=p_term_id);

  if exists(select 1 from public.lao_course_term_plans where course_id=p_course_id) then
    if p_term_id is not null then
      if v_term_count=0 then raise exception 'กิจกรรมนี้ไม่ได้เปิดในภาคเรียนที่เลือก'; end if;
      v_term_id:=p_term_id;
    elsif v_term_count=1 then
      null;
    else
      raise exception 'กรุณาระบุภาคเรียนของกิจกรรม';
    end if;
  else
    v_term_id:=null;
  end if;

  update public.lao_student_activity_enrollments
  set status='replaced',updated_by=v_uid,updated_at=now()
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and student_id=p_student_id
    and term_id is not distinct from v_term_id
    and lower(activity_code)=lower(v_course.subject_code)
    and status='active'
    and course_id<>p_course_id;

  select id into v_id
  from public.lao_student_activity_enrollments
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and student_id=p_student_id
    and term_id is not distinct from v_term_id
    and course_id=p_course_id
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.lao_student_activity_enrollments(
      school_id,academic_year_id,term_id,student_id,course_id,grade_code,
      activity_code,activity_name,status,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,v_term_id,p_student_id,p_course_id,v_course.grade_code,
      v_course.subject_code,v_course.name_th,'active',v_uid,v_uid
    ) returning id into v_id;
  else
    update public.lao_student_activity_enrollments
    set activity_code=v_course.subject_code,
        activity_name=v_course.name_th,
        grade_code=v_course.grade_code,
        status='active',
        updated_by=v_uid,
        updated_at=now()
    where id=v_id;
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'student_activity_enrollment_set','student_activity_enrollment',v_id::text,
    jsonb_build_object(
      'student_id',p_student_id,'academic_year_id',p_academic_year_id,'term_id',v_term_id,
      'course_id',p_course_id,'activity_code',v_course.subject_code,'activity_name',v_course.name_th
    )
  );

  return jsonb_build_object(
    'id',v_id,'student_id',p_student_id,'term_id',v_term_id,
    'course_id',p_course_id,'activity_code',v_course.subject_code,'activity_name',v_course.name_th
  );
end;
$function$;

revoke all on function public.lao_set_student_activity_enrollment(uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_set_student_activity_enrollment(uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.lao_student_activity_records(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_student_id uuid default null
)
returns table(
  student_id uuid,
  term_id uuid,
  term_no smallint,
  grade_code text,
  activity_code text,
  activity_name text,
  course_id uuid
)
language plpgsql
stable
security definer
set search_path=public
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  return query
  select
    e.student_id,
    e.term_id,
    t.term_no,
    e.grade_code,
    e.activity_code,
    e.activity_name,
    e.course_id
  from public.lao_student_activity_enrollments e
  left join public.lao_terms t on t.id=e.term_id
  where e.school_id=p_school_id
    and e.academic_year_id=p_academic_year_id
    and e.status='active'
    and (p_student_id is null or e.student_id=p_student_id)
  order by e.student_id,t.term_no nulls first,e.grade_code,e.activity_code,e.activity_name;
end;
$function$;

revoke all on function public.lao_student_activity_records(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_student_activity_records(uuid,uuid,uuid) to authenticated;

commit;

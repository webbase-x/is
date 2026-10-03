-- 0084_course_curriculum_teacher_workflow.sql
-- Teacher-authored course curriculum -> approved assessment structure -> student scores.

begin;

insert into public.lao_work_scopes(
  scope_code,department_code,work_code,section_code,title_th,parent_scope_code,route,sort_order,is_active
) values (
  'academics.course_curriculum','academics','learning','course_curriculum',
  'หลักสูตรรายวิชาและโครงสร้างรายวิชา','academics.learning','#/academics/my-courses',122,true
)
on conflict(scope_code) do update set
  department_code=excluded.department_code,
  work_code=excluded.work_code,
  section_code=excluded.section_code,
  title_th=excluded.title_th,
  parent_scope_code=excluded.parent_scope_code,
  route=excluded.route,
  sort_order=excluded.sort_order,
  is_active=true,
  updated_at=now();

update public.lao_work_scopes set sort_order=123,updated_at=now() where scope_code='academics.calendar';
update public.lao_work_scopes set sort_order=124,updated_at=now() where scope_code='academics.timetable';
update public.lao_work_scopes set sort_order=125,updated_at=now() where scope_code='academics.lesson_plans';
update public.lao_work_scopes set sort_order=126,updated_at=now() where scope_code='academics.active_learning';
update public.lao_work_scopes set sort_order=127,updated_at=now() where scope_code='academics.supervision';
update public.lao_work_scopes set sort_order=128,updated_at=now() where scope_code='academics.plc';

create table if not exists public.lao_course_curricula (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  course_id uuid not null references public.lao_curriculum_courses(id) on delete restrict,
  lead_personnel_id uuid references public.lao_personnel(id) on delete set null,
  status text not null default 'draft'
    check(status in ('draft','submitted','returned','approved','cancelled')),
  course_description text,
  key_concepts text,
  competencies text,
  desirable_characteristics text,
  outcomes jsonb not null default '[]'::jsonb check(jsonb_typeof(outcomes)='array'),
  units jsonb not null default '[]'::jsonb check(jsonb_typeof(units)='array'),
  assessment_plan jsonb not null default '[]'::jsonb check(jsonb_typeof(assessment_plan)='array'),
  revision_no integer not null default 1 check(revision_no>0),
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id)
);

create index if not exists lao_course_curricula_school_year_idx
  on public.lao_course_curricula(school_id,academic_year_id,status,course_id);
create index if not exists lao_course_curricula_lead_idx
  on public.lao_course_curricula(lead_personnel_id,academic_year_id,status);

drop trigger if exists lao_course_curricula_touch on public.lao_course_curricula;
create trigger lao_course_curricula_touch
before update on public.lao_course_curricula
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_course_curriculum_history (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.lao_course_curricula(id) on delete cascade,
  revision_no integer not null,
  action text not null check(action in ('submitted','returned','approved')),
  snapshot jsonb not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists lao_course_curriculum_history_curriculum_idx
  on public.lao_course_curriculum_history(curriculum_id,revision_no,created_at desc);

alter table public.lao_course_curricula enable row level security;
alter table public.lao_course_curriculum_history enable row level security;
revoke all on table public.lao_course_curricula from public,anon,authenticated;
revoke all on table public.lao_course_curriculum_history from public,anon,authenticated;

alter table public.lao_assessment_books
  add column if not exists course_curriculum_id uuid references public.lao_course_curricula(id) on delete restrict,
  add column if not exists course_curriculum_revision integer;

alter table public.lao_assessment_components
  add column if not exists source_plan_code text,
  add column if not exists component_category text,
  add column if not exists assessment_method text,
  add column if not exists evidence text,
  add column if not exists unit_no integer,
  add column if not exists course_curriculum_revision integer;

create or replace function public.lao_course_curriculum_validation(p_curriculum_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_cur public.lao_course_curricula%rowtype;
  v_target_hours numeric:=null;
  v_unit_hours numeric:=0;
  v_outcome_count integer:=0;
  v_unit_count integer:=0;
  v_assessment_count integer:=0;
  v_required_term_count integer:=0;
  v_issues jsonb:='[]'::jsonb;
  v_terms jsonb:='[]'::jsonb;
  v_term record;
  v_score numeric;
  v_term_unit_hours numeric;
  v_term_hours_target numeric;
  v_hours_ok boolean;
  v_score_ok boolean;
  v_ready boolean:=false;
begin
  select * into v_cur
  from public.lao_course_curricula
  where id=p_curriculum_id;

  if not found then
    return jsonb_build_object('ready',false,'issues',jsonb_build_array('ไม่พบหลักสูตรรายวิชา'));
  end if;

  select c.annual_hours into v_target_hours
  from public.lao_curriculum_courses c
  where c.id=v_cur.course_id;

  v_outcome_count:=jsonb_array_length(v_cur.outcomes);
  v_unit_count:=jsonb_array_length(v_cur.units);
  v_assessment_count:=jsonb_array_length(v_cur.assessment_plan);

  if btrim(coalesce(v_cur.course_description,''))='' then
    v_issues:=v_issues||jsonb_build_array('ยังไม่ได้ระบุคำอธิบายรายวิชา');
  end if;

  if v_outcome_count=0 then
    v_issues:=v_issues||jsonb_build_array('ยังไม่มีมาตรฐาน/ตัวชี้วัด/ผลการเรียนรู้');
  elsif exists(
    select 1
    from jsonb_array_elements(v_cur.outcomes) o
    where btrim(coalesce(o->>'code',''))=''
       or btrim(coalesce(o->>'description',''))=''
       or coalesce(o->>'type','') not in ('standard','indicator','learning_outcome')
  ) then
    v_issues:=v_issues||jsonb_build_array('มาตรฐาน/ตัวชี้วัดบางรายการยังไม่ครบ');
  elsif (
    select count(*) from (
      select lower(btrim(o->>'code')) code
      from jsonb_array_elements(v_cur.outcomes) o
      group by lower(btrim(o->>'code'))
      having count(*)>1
    ) d
  )>0 then
    v_issues:=v_issues||jsonb_build_array('รหัสมาตรฐาน/ตัวชี้วัดซ้ำกัน');
  end if;

  if v_unit_count=0 then
    v_issues:=v_issues||jsonb_build_array('ยังไม่มีโครงสร้างหน่วยการเรียนรู้');
  elsif exists(
    select 1
    from jsonb_array_elements(v_cur.units) u
    where btrim(coalesce(u->>'title',''))=''
       or coalesce(u->>'unit_no','') !~ '^[0-9]+$'
       or coalesce(u->>'term_no','') !~ '^[0-9]+$'
       or coalesce(u->>'hours','') !~ '^[0-9]+([.][0-9]+)?$'
       or (u->>'hours')::numeric<=0
       or jsonb_typeof(coalesce(u->'outcome_codes','[]'::jsonb))<>'array'
       or jsonb_array_length(coalesce(u->'outcome_codes','[]'::jsonb))=0
  ) then
    v_issues:=v_issues||jsonb_build_array('หน่วยการเรียนรู้บางหน่วยยังกรอกข้อมูลไม่ครบ');
  else
    if exists(
      select 1
      from jsonb_array_elements(v_cur.units) u
      cross join lateral jsonb_array_elements_text(coalesce(u->'outcome_codes','[]'::jsonb)) oc
      where not exists(
        select 1
        from jsonb_array_elements(v_cur.outcomes) o
        where lower(btrim(o->>'code'))=lower(btrim(oc.value))
      )
    ) then
      v_issues:=v_issues||jsonb_build_array('หน่วยการเรียนรู้มีตัวชี้วัดที่ไม่พบในหลักสูตรรายวิชา');
    end if;
  end if;

  select coalesce(sum(
    case when coalesce(u->>'hours','') ~ '^[0-9]+([.][0-9]+)?$'
      then (u->>'hours')::numeric else 0 end
  ),0)
  into v_unit_hours
  from jsonb_array_elements(v_cur.units) u;

  if coalesce(v_target_hours,0)>0 and abs(v_unit_hours-v_target_hours)>0.01 then
    v_issues:=v_issues||jsonb_build_array(
      'ชั่วโมงรวมของหน่วยเรียน ('||trim(to_char(v_unit_hours,'FM999999990.##'))||
      ') ไม่ตรงกับเวลาเรียนรายวิชา ('||trim(to_char(v_target_hours,'FM999999990.##'))||')'
    );
  end if;

  if v_assessment_count=0 then
    v_issues:=v_issues||jsonb_build_array('ยังไม่มีแผนการวัดและประเมินผล');
  elsif exists(
    select 1
    from jsonb_array_elements(v_cur.assessment_plan) a
    where btrim(coalesce(a->>'label',''))=''
       or coalesce(a->>'term_no','') !~ '^[0-9]+$'
       or coalesce(a->>'max_score','') !~ '^[0-9]+([.][0-9]+)?$'
       or (a->>'max_score')::numeric<=0
       or (a->>'max_score')::numeric>100
       or coalesce(a->>'category','') not in ('coursework','midterm','final','performance','activity','other')
  ) then
    v_issues:=v_issues||jsonb_build_array('รายการวัดและประเมินผลบางรายการยังไม่ครบหรือคะแนนไม่ถูกต้อง');
  end if;

  for v_term in
    with term_source as (
      select t.term_no::integer term_no,ctp.term_hours target_hours
      from public.lao_course_term_plans ctp
      join public.lao_terms t on t.id=ctp.term_id
      where ctp.course_id=v_cur.course_id
        and (ctp.term_hours is not null or ctp.weekly_periods is not null)
      union all
      select distinct t.term_no::integer,null::numeric
      from public.lao_teaching_workload_items wi
      join public.lao_teaching_workloads w on w.id=wi.workload_id
      join public.lao_terms t on t.id=w.term_id
      where wi.course_id=v_cur.course_id and w.status='approved'
      union all
      select distinct (u->>'term_no')::integer,null::numeric
      from jsonb_array_elements(v_cur.units) u
      where coalesce(u->>'term_no','') ~ '^[0-9]+$'
      union all
      select distinct (a->>'term_no')::integer,null::numeric
      from jsonb_array_elements(v_cur.assessment_plan) a
      where coalesce(a->>'term_no','') ~ '^[0-9]+$'
    )
    select term_no,max(target_hours) target_hours
    from term_source
    where term_no>0
    group by term_no
    order by term_no
  loop
    v_required_term_count:=v_required_term_count+1;
    v_term_hours_target:=v_term.target_hours;

    select coalesce(sum(
      case when coalesce(a->>'max_score','') ~ '^[0-9]+([.][0-9]+)?$'
        then (a->>'max_score')::numeric else 0 end
    ),0)
    into v_score
    from jsonb_array_elements(v_cur.assessment_plan) a
    where coalesce(a->>'term_no','') ~ '^[0-9]+$'
      and (a->>'term_no')::integer=v_term.term_no;

    select coalesce(sum(
      case when coalesce(u->>'hours','') ~ '^[0-9]+([.][0-9]+)?$'
        then (u->>'hours')::numeric else 0 end
    ),0)
    into v_term_unit_hours
    from jsonb_array_elements(v_cur.units) u
    where coalesce(u->>'term_no','') ~ '^[0-9]+$'
      and (u->>'term_no')::integer=v_term.term_no;

    v_score_ok:=abs(v_score-100)<=0.01;
    v_hours_ok:=v_term_hours_target is null
      or v_term_hours_target<=0
      or abs(v_term_unit_hours-v_term_hours_target)<=0.01;

    if not v_score_ok then
      v_issues:=v_issues||jsonb_build_array(
        'โครงสร้างคะแนนภาคเรียนที่ '||v_term.term_no||' รวม '||
        trim(to_char(v_score,'FM999999990.##'))||' คะแนน ต้องรวม 100 คะแนน'
      );
    end if;
    if not v_hours_ok then
      v_issues:=v_issues||jsonb_build_array(
        'ชั่วโมงหน่วยเรียนภาคเรียนที่ '||v_term.term_no||' รวม '||
        trim(to_char(v_term_unit_hours,'FM999999990.##'))||' ชม. ไม่ตรงกับกรอบ '||
        trim(to_char(v_term_hours_target,'FM999999990.##'))||' ชม.'
      );
    end if;

    v_terms:=v_terms||jsonb_build_array(jsonb_build_object(
      'term_no',v_term.term_no,
      'score_total',v_score,
      'score_ok',v_score_ok,
      'unit_hours',v_term_unit_hours,
      'target_hours',v_term_hours_target,
      'hours_ok',v_hours_ok
    ));
  end loop;

  if v_required_term_count=0 then
    v_issues:=v_issues||jsonb_build_array('ยังไม่พบภาคเรียนสำหรับรายวิชานี้');
  end if;

  v_ready:=jsonb_array_length(v_issues)=0;

  return jsonb_build_object(
    'ready',v_ready,
    'issues',v_issues,
    'outcome_count',v_outcome_count,
    'unit_count',v_unit_count,
    'assessment_count',v_assessment_count,
    'unit_hours_total',v_unit_hours,
    'target_hours',v_target_hours,
    'terms',v_terms
  );
end;
$function$;

revoke all on function public.lao_course_curriculum_validation(uuid) from public,anon,authenticated;

create or replace function public.lao_course_curriculum_page(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_course_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_own uuid;
  v_year uuid;
  v_can_view_all boolean:=false;
  v_can_edit_all boolean:=false;
  v_can_approve boolean:=false;
  v_courses jsonb:='[]'::jsonb;
  v_detail jsonb:=null;
  v_cc public.lao_course_curricula%rowtype;
  v_is_assigned boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_own:=public.lao_my_personnel_id(p_school_id);
  v_can_view_all:=public.lao_has_work_permission(p_school_id,'academics.course_curriculum','view')
    or public.lao_has_work_permission(p_school_id,'academics.course_curriculum','edit')
    or public.lao_has_work_permission(p_school_id,'academics.course_curriculum','approve');
  v_can_edit_all:=public.lao_has_work_permission(p_school_id,'academics.course_curriculum','edit');
  v_can_approve:=public.lao_has_work_permission(p_school_id,'academics.course_curriculum','approve');

  select ay.id into v_year
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
    and (p_academic_year_id is null or ay.id=p_academic_year_id)
  order by
    case when p_academic_year_id is not null and ay.id=p_academic_year_id then 0 else 1 end,
    ay.is_current desc,ay.year_be desc
  limit 1;

  if v_year is not null then
    select coalesce(jsonb_agg(x.payload order by x.subject_name,x.grade_label),'[]'::jsonb)
    into v_courses
    from (
      select
        s.name_th subject_name,
        c.grade_label,
        jsonb_build_object(
          'course_id',c.id,
          'subject_id',s.id,
          'subject_code',s.subject_code,
          'subject_name',s.name_th,
          'subject_type',s.subject_type,
          'learning_area',s.learning_area,
          'grade_code',c.grade_code,
          'grade_label',c.grade_label,
          'program_id',c.program_id,
          'program_code',ap.code,
          'program_name',ap.name_th,
          'annual_hours',c.annual_hours,
          'credits',c.credits,
          'curriculum_id',cc.id,
          'curriculum_status',coalesce(cc.status,'not_started'),
          'revision_no',cc.revision_no,
          'review_note',cc.review_note,
          'updated_at',cc.updated_at,
          'validation',case when cc.id is null then null else public.lao_course_curriculum_validation(cc.id) end,
          'classes',coalesce((
            select jsonb_agg(z.class_short order by z.class_short)
            from (
              select distinct case
                when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
                when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
                when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
                else cs.grade_label||'/'||cs.section_label end class_short
              from public.lao_teaching_workload_items wi
              join public.lao_teaching_workloads w on w.id=wi.workload_id
              join public.lao_class_sections cs on cs.id=wi.class_section_id
              where wi.course_id=c.id and w.status='approved'
                and (v_can_view_all or w.personnel_id=v_own)
            ) z
          ),'[]'::jsonb),
          'teachers',coalesce((
            select jsonb_agg(z.full_name order by z.full_name)
            from (
              select distinct concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th) full_name
              from public.lao_teaching_workload_items wi
              join public.lao_teaching_workloads w on w.id=wi.workload_id
              join public.lao_personnel p on p.id=w.personnel_id
              where wi.course_id=c.id and w.status='approved'
            ) z
          ),'[]'::jsonb)
        ) payload
      from public.lao_curriculum_courses c
      join public.lao_subjects s on s.id=c.subject_id
      left join public.lao_academic_programs ap on ap.id=c.program_id
      left join public.lao_course_curricula cc on cc.course_id=c.id and cc.status<>'cancelled'
      where c.school_id=p_school_id
        and c.academic_year_id=v_year
        and c.is_active
        and exists(
          select 1
          from public.lao_teaching_workload_items wi
          join public.lao_teaching_workloads w on w.id=wi.workload_id
          where wi.course_id=c.id
            and w.status='approved'
            and (v_can_view_all or w.personnel_id=v_own)
        )
    ) x;
  end if;

  if p_course_id is not null then
    select exists(
      select 1
      from public.lao_teaching_workload_items wi
      join public.lao_teaching_workloads w on w.id=wi.workload_id
      where wi.course_id=p_course_id and w.status='approved' and w.personnel_id=v_own
    ) into v_is_assigned;

    if not v_can_view_all and not v_is_assigned then
      raise exception 'Access denied';
    end if;

    if not exists(
      select 1 from public.lao_curriculum_courses c
      where c.id=p_course_id and c.school_id=p_school_id and c.academic_year_id=v_year
    ) then
      raise exception 'ไม่พบรายวิชาที่เลือก';
    end if;

    select * into v_cc
    from public.lao_course_curricula
    where course_id=p_course_id and status<>'cancelled'
    limit 1;

    select jsonb_build_object(
      'course',jsonb_build_object(
        'course_id',c.id,
        'subject_code',s.subject_code,
        'subject_name',s.name_th,
        'subject_type',s.subject_type,
        'learning_area',s.learning_area,
        'grade_code',c.grade_code,
        'grade_label',c.grade_label,
        'program_id',c.program_id,
        'program_code',ap.code,
        'program_name',ap.name_th,
        'annual_hours',c.annual_hours,
        'credits',c.credits
      ),
      'terms',coalesce((
        select jsonb_agg(jsonb_build_object(
          'term_id',t.id,'term_no',t.term_no,'name',coalesce(t.name,'ภาคเรียนที่ '||t.term_no),
          'target_hours',ctp.term_hours,'weekly_periods',ctp.weekly_periods
        ) order by t.term_no)
        from public.lao_terms t
        left join public.lao_course_term_plans ctp on ctp.term_id=t.id and ctp.course_id=c.id
        where t.academic_year_id=c.academic_year_id
      ),'[]'::jsonb),
      'assignments',coalesce((
        select jsonb_agg(z.payload order by z.personnel_name,z.class_short)
        from (
          select concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th) personnel_name,
            case
              when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
              when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
              when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
              else cs.grade_label||'/'||cs.section_label end class_short,
            jsonb_build_object(
              'personnel_id',p.id,
              'personnel_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
              'class_section_id',cs.id,
              'class_short',case
                when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
                when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
                when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
                else cs.grade_label||'/'||cs.section_label end,
              'term_no',t.term_no,
              'teaching_role',wi.teaching_role
            ) payload
          from public.lao_teaching_workload_items wi
          join public.lao_teaching_workloads w on w.id=wi.workload_id
          join public.lao_personnel p on p.id=w.personnel_id
          join public.lao_class_sections cs on cs.id=wi.class_section_id
          join public.lao_terms t on t.id=w.term_id
          where wi.course_id=c.id and w.status='approved'
        ) z
      ),'[]'::jsonb),
      'curriculum',case when v_cc.id is null then null else jsonb_build_object(
        'id',v_cc.id,
        'lead_personnel_id',v_cc.lead_personnel_id,
        'status',v_cc.status,
        'course_description',v_cc.course_description,
        'key_concepts',v_cc.key_concepts,
        'competencies',v_cc.competencies,
        'desirable_characteristics',v_cc.desirable_characteristics,
        'outcomes',v_cc.outcomes,
        'units',v_cc.units,
        'assessment_plan',v_cc.assessment_plan,
        'revision_no',v_cc.revision_no,
        'review_note',v_cc.review_note,
        'submitted_at',v_cc.submitted_at,
        'reviewed_at',v_cc.reviewed_at,
        'updated_at',v_cc.updated_at
      ) end,
      'validation',case when v_cc.id is null then jsonb_build_object(
        'ready',false,'issues',jsonb_build_array('ยังไม่ได้เริ่มจัดทำหลักสูตรรายวิชา'),
        'outcome_count',0,'unit_count',0,'assessment_count',0
      ) else public.lao_course_curriculum_validation(v_cc.id) end,
      'can_edit',(
        (v_is_assigned or v_can_edit_all)
        and (v_cc.id is null or v_cc.status in ('draft','returned'))
      ),
      'can_submit',(
        (v_is_assigned or v_can_edit_all)
        and (v_cc.id is null or v_cc.status in ('draft','returned'))
      ),
      'can_review',(v_can_approve and v_cc.status='submitted')
    ) into v_detail
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    left join public.lao_academic_programs ap on ap.id=c.program_id
    where c.id=p_course_id;
  end if;

  return jsonb_build_object(
    'selected_year_id',v_year,
    'years',coalesce((
      select jsonb_agg(jsonb_build_object('id',ay.id,'year_be',ay.year_be,'is_current',ay.is_current) order by ay.year_be desc)
      from public.lao_academic_years ay
      where ay.school_id=p_school_id
    ),'[]'::jsonb),
    'own_personnel_id',v_own,
    'can_view_all',v_can_view_all,
    'can_edit_all',v_can_edit_all,
    'can_approve',v_can_approve,
    'courses',v_courses,
    'detail',v_detail
  );
end;
$function$;

revoke all on function public.lao_course_curriculum_page(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_course_curriculum_page(uuid,uuid,uuid) to authenticated;

create or replace function public.lao_save_course_curriculum(
  p_school_id uuid,
  p_course_id uuid,
  p_payload jsonb,
  p_action text default 'draft',
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_own uuid;
  v_edit_all boolean:=false;
  v_assigned boolean:=false;
  v_course public.lao_curriculum_courses%rowtype;
  v_existing public.lao_course_curricula%rowtype;
  v_saved public.lao_course_curricula%rowtype;
  v_lead uuid;
  v_status_before text;
  v_validation jsonb;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_action not in ('draft','submit') then raise exception 'Invalid action'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'ข้อมูลหลักสูตรรายวิชาไม่ถูกต้อง'; end if;

  select * into v_course
  from public.lao_curriculum_courses
  where id=p_course_id and school_id=p_school_id and is_active;
  if not found then raise exception 'ไม่พบรายวิชาที่เลือก'; end if;

  v_own:=public.lao_my_personnel_id(p_school_id);
  v_edit_all:=public.lao_has_work_permission(p_school_id,'academics.course_curriculum','edit');

  select exists(
    select 1
    from public.lao_teaching_workload_items wi
    join public.lao_teaching_workloads w on w.id=wi.workload_id
    where wi.course_id=p_course_id and w.status='approved' and w.personnel_id=v_own
  ) into v_assigned;

  if not v_assigned and not v_edit_all then
    raise exception 'เฉพาะครูผู้สอนที่ได้รับอนุมัติภาระงาน หรือผู้ได้รับมอบหมายสิทธิ์เท่านั้น';
  end if;

  if jsonb_typeof(coalesce(p_payload->'outcomes','[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_payload->'units','[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_payload->'assessment_plan','[]'::jsonb))<>'array' then
    raise exception 'รูปแบบโครงสร้างหลักสูตรรายวิชาไม่ถูกต้อง';
  end if;

  select * into v_existing
  from public.lao_course_curricula
  where course_id=p_course_id
  for update;

  if found then
    v_status_before:=v_existing.status;
    if v_existing.status in ('submitted','approved') then
      raise exception 'หลักสูตรรายวิชาที่ส่งตรวจหรืออนุมัติแล้วถูกล็อกการแก้ไข';
    end if;
    if p_expected_updated_at is not null and v_existing.updated_at is distinct from p_expected_updated_at then
      raise exception 'มีผู้แก้ไขหลักสูตรรายวิชานี้หลังจากที่คุณเปิดหน้า กรุณารีเฟรชข้อมูลก่อนบันทึก';
    end if;
    v_lead:=coalesce(v_existing.lead_personnel_id,v_own);
  else
    v_status_before:=null;
    if v_assigned then
      v_lead:=v_own;
    else
      select w.personnel_id into v_lead
      from public.lao_teaching_workload_items wi
      join public.lao_teaching_workloads w on w.id=wi.workload_id
      where wi.course_id=p_course_id and w.status='approved'
      order by w.reviewed_at nulls last,w.created_at
      limit 1;
    end if;
  end if;

  insert into public.lao_course_curricula(
    school_id,academic_year_id,course_id,lead_personnel_id,status,
    course_description,key_concepts,competencies,desirable_characteristics,
    outcomes,units,assessment_plan,revision_no,review_note,
    submitted_at,reviewed_at,reviewed_by,created_by,updated_by
  ) values(
    p_school_id,v_course.academic_year_id,p_course_id,v_lead,
    case when p_action='submit' then 'submitted' else 'draft' end,
    nullif(btrim(coalesce(p_payload->>'course_description','')),''),
    nullif(btrim(coalesce(p_payload->>'key_concepts','')),''),
    nullif(btrim(coalesce(p_payload->>'competencies','')),''),
    nullif(btrim(coalesce(p_payload->>'desirable_characteristics','')),''),
    coalesce(p_payload->'outcomes','[]'::jsonb),
    coalesce(p_payload->'units','[]'::jsonb),
    coalesce(p_payload->'assessment_plan','[]'::jsonb),
    case when v_status_before='returned' and p_action='submit' then coalesce(v_existing.revision_no,1)+1 else coalesce(v_existing.revision_no,1) end,
    case when p_action='submit' then null else v_existing.review_note end,
    case when p_action='submit' then now() else v_existing.submitted_at end,
    case when p_action='submit' then null else v_existing.reviewed_at end,
    case when p_action='submit' then null else v_existing.reviewed_by end,
    v_uid,v_uid
  )
  on conflict(course_id) do update set
    lead_personnel_id=coalesce(public.lao_course_curricula.lead_personnel_id,excluded.lead_personnel_id),
    status=excluded.status,
    course_description=excluded.course_description,
    key_concepts=excluded.key_concepts,
    competencies=excluded.competencies,
    desirable_characteristics=excluded.desirable_characteristics,
    outcomes=excluded.outcomes,
    units=excluded.units,
    assessment_plan=excluded.assessment_plan,
    revision_no=excluded.revision_no,
    review_note=excluded.review_note,
    submitted_at=excluded.submitted_at,
    reviewed_at=excluded.reviewed_at,
    reviewed_by=excluded.reviewed_by,
    updated_by=v_uid,
    updated_at=now()
  returning * into v_saved;

  v_validation:=public.lao_course_curriculum_validation(v_saved.id);

  if p_action='submit' and coalesce((v_validation->>'ready')::boolean,false)=false then
    raise exception 'ยังส่งตรวจไม่ได้: %',
      coalesce((select string_agg(value,' · ') from jsonb_array_elements_text(v_validation->'issues')),'ข้อมูลยังไม่ครบ');
  end if;

  if p_action='submit' then
    insert into public.lao_course_curriculum_history(
      curriculum_id,revision_no,action,snapshot,actor_user_id
    ) values(
      v_saved.id,v_saved.revision_no,'submitted',to_jsonb(v_saved),v_uid
    );

    select organization_id into v_org from public.lao_schools where id=p_school_id;

    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    select distinct x.user_id,v_org,p_school_id,'course_curriculum_submitted',
      'มีหลักสูตรรายวิชารอตรวจสอบ',
      'ครูผู้สอนส่งหลักสูตรรายวิชาและโครงสร้างคะแนนให้ตรวจสอบ',
      'course_curriculum',v_saved.id::text
    from (
      select m.user_id
      from public.lao_memberships m
      join public.lao_membership_roles mr on mr.membership_id=m.id
      join public.lao_roles r on r.id=mr.role_id
      where m.school_id=p_school_id and m.status='active' and r.code='school_admin'
      union
      select a.user_id
      from public.lao_work_authorities a
      where a.school_id=p_school_id and a.is_active and a.can_approve
        and (a.starts_on is null or a.starts_on<=current_date)
        and (a.ends_on is null or a.ends_on>=current_date)
        and a.scope_code in ('academics','academics.learning','academics.course_curriculum')
    ) x
    where x.user_id<>v_uid
      and not exists(
        select 1 from public.lao_notifications n
        where n.user_id=x.user_id
          and n.notification_type='course_curriculum_submitted'
          and n.entity_type='course_curriculum'
          and n.entity_id=v_saved.id::text
          and n.read_at is null
      );
  end if;

  return jsonb_build_object(
    'id',v_saved.id,'status',v_saved.status,'revision_no',v_saved.revision_no,
    'updated_at',v_saved.updated_at,'validation',v_validation
  );
end;
$function$;

revoke all on function public.lao_save_course_curriculum(uuid,uuid,jsonb,text,timestamptz) from public,anon;
grant execute on function public.lao_save_course_curriculum(uuid,uuid,jsonb,text,timestamptz) to authenticated;

create or replace function public.lao_review_course_curriculum(
  p_curriculum_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_cur public.lao_course_curricula%rowtype;
  v_validation jsonb;
  v_org uuid;
  v_status text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approved','returned') then raise exception 'Invalid decision'; end if;

  select * into v_cur
  from public.lao_course_curricula
  where id=p_curriculum_id
  for update;
  if not found then raise exception 'ไม่พบหลักสูตรรายวิชา'; end if;
  if not public.lao_has_work_permission(v_cur.school_id,'academics.course_curriculum','approve') then
    raise exception 'ไม่มีสิทธิ์ตรวจ/อนุมัติหลักสูตรรายวิชา';
  end if;
  if v_cur.status<>'submitted' then
    raise exception 'ตรวจได้เฉพาะรายการที่ครูส่งตรวจแล้ว';
  end if;
  if p_decision='returned' and btrim(coalesce(p_review_note,''))='' then
    raise exception 'กรุณาระบุสิ่งที่ต้องแก้ไข';
  end if;

  v_validation:=public.lao_course_curriculum_validation(v_cur.id);
  if p_decision='approved' and coalesce((v_validation->>'ready')::boolean,false)=false then
    raise exception 'อนุมัติไม่ได้: %',
      coalesce((select string_agg(value,' · ') from jsonb_array_elements_text(v_validation->'issues')),'ข้อมูลยังไม่ครบ');
  end if;

  v_status:=p_decision;
  update public.lao_course_curricula
  set status=v_status,
      review_note=case when p_decision='returned' then btrim(p_review_note) else null end,
      reviewed_at=now(),reviewed_by=v_uid,updated_by=v_uid,updated_at=now()
  where id=v_cur.id
  returning * into v_cur;

  insert into public.lao_course_curriculum_history(
    curriculum_id,revision_no,action,snapshot,actor_user_id,note
  ) values(
    v_cur.id,v_cur.revision_no,p_decision,to_jsonb(v_cur),v_uid,
    nullif(btrim(coalesce(p_review_note,'')),'')
  );

  select organization_id into v_org from public.lao_schools where id=v_cur.school_id;

  insert into public.lao_notifications(
    user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
  )
  select distinct pa.user_id,v_org,v_cur.school_id,
    case when p_decision='approved' then 'course_curriculum_approved' else 'course_curriculum_returned' end,
    case when p_decision='approved' then 'หลักสูตรรายวิชาได้รับอนุมัติแล้ว' else 'หลักสูตรรายวิชาถูกส่งกลับให้แก้ไข' end,
    case when p_decision='approved' then 'สามารถใช้โครงสร้างคะแนนนี้ในการวัดผลได้แล้ว'
         else coalesce(nullif(btrim(p_review_note),''),'กรุณาตรวจและแก้ไขหลักสูตรรายวิชา') end,
    'course_curriculum',v_cur.id::text
  from public.lao_teaching_workload_items wi
  join public.lao_teaching_workloads w on w.id=wi.workload_id and w.status='approved'
  join public.lao_personnel_accounts pa on pa.personnel_id=w.personnel_id and pa.school_id=v_cur.school_id
  where wi.course_id=v_cur.course_id and pa.user_id<>v_uid;

  return jsonb_build_object(
    'id',v_cur.id,'status',v_cur.status,'revision_no',v_cur.revision_no,
    'review_note',v_cur.review_note,'validation',v_validation
  );
end;
$function$;

revoke all on function public.lao_review_course_curriculum(uuid,text,text) from public,anon;
grant execute on function public.lao_review_course_curriculum(uuid,text,text) to authenticated;

create or replace function public.lao_academic_group_access(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_own uuid;
  v_can_academic boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_can_academic:=public.lao_can_view_academic(p_school_id);
  if not v_can_academic then raise exception 'Access denied'; end if;
  v_own:=public.lao_my_personnel_id(p_school_id);

  return jsonb_build_object(
    'is_school_admin',public.lao_is_local_school_admin(p_school_id),
    'own_personnel_id',v_own,
    'can_use_own_workload',v_own is not null,
    'can_use_own_course_curriculum',v_own is not null,
    'can_use_own_assessment',v_own is not null,
    'scopes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'scope_code',s.scope_code,
        'title',s.title_th,
        'parent_scope_code',s.parent_scope_code,
        'route',s.route,
        'sort_order',s.sort_order,
        'can_view',public.lao_has_work_permission(p_school_id,s.scope_code,'view'),
        'can_edit',public.lao_has_work_permission(p_school_id,s.scope_code,'edit'),
        'can_approve',public.lao_has_work_permission(p_school_id,s.scope_code,'approve'),
        'can_delegate',public.lao_has_work_permission(p_school_id,s.scope_code,'delegate')
      ) order by s.sort_order,s.scope_code)
      from public.lao_work_scopes s
      where s.department_code='academics'
        and s.scope_code<>'academics'
        and s.is_active
        and (
          public.lao_has_work_permission(p_school_id,s.scope_code,'view')
          or public.lao_has_work_permission(p_school_id,s.scope_code,'edit')
          or public.lao_has_work_permission(p_school_id,s.scope_code,'approve')
          or public.lao_has_work_permission(p_school_id,s.scope_code,'delegate')
        )
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.lao_academic_group_access(uuid) from public,anon;
grant execute on function public.lao_academic_group_access(uuid) to authenticated;

create or replace function public.lao_academic_work_counts(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_manage boolean:=false;
  v_review_curriculum boolean:=false;
  v_own uuid;
  v_pending integer:=0;
  v_returned integer:=0;
  v_pending_curriculum integer:=0;
  v_returned_curriculum integer:=0;
begin
  if v_uid is null or p_school_id is null or not public.lao_can_view_academic(p_school_id) then
    return jsonb_build_object(
      'can_manage',false,
      'pending_teaching_workloads',0,
      'my_returned_workloads',0,
      'pending_course_curricula',0,
      'my_returned_course_curricula',0,
      'attention_count',0
    );
  end if;

  v_manage:=public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.workload','edit')
    or public.lao_has_work_permission(p_school_id,'academics.workload','approve');
  v_review_curriculum:=public.lao_has_work_permission(p_school_id,'academics.course_curriculum','approve');
  v_own:=public.lao_my_personnel_id(p_school_id);

  if v_manage then
    select count(*) into v_pending
    from public.lao_teaching_workloads
    where school_id=p_school_id and status='submitted';
  end if;

  if v_own is not null then
    select count(*) into v_returned
    from public.lao_teaching_workloads
    where school_id=p_school_id and personnel_id=v_own and status='returned';
  end if;

  if v_review_curriculum then
    select count(*) into v_pending_curriculum
    from public.lao_course_curricula
    where school_id=p_school_id and status='submitted';
  end if;

  if v_own is not null then
    select count(*) into v_returned_curriculum
    from public.lao_course_curricula cc
    where cc.school_id=p_school_id and cc.status='returned'
      and exists(
        select 1
        from public.lao_teaching_workload_items wi
        join public.lao_teaching_workloads w on w.id=wi.workload_id
        where wi.course_id=cc.course_id and w.status='approved' and w.personnel_id=v_own
      );
  end if;

  return jsonb_build_object(
    'can_manage',v_manage,
    'pending_teaching_workloads',v_pending,
    'my_returned_workloads',v_returned,
    'pending_course_curricula',v_pending_curriculum,
    'my_returned_course_curricula',v_returned_curriculum,
    'attention_count',v_pending+v_returned+v_pending_curriculum+v_returned_curriculum
  );
end;
$function$;

revoke all on function public.lao_academic_work_counts(uuid) from public,anon;
grant execute on function public.lao_academic_work_counts(uuid) to authenticated;

alter function public.lao_ensure_assessment_book(uuid,uuid)
  rename to lao_ensure_assessment_book_base_v01938;

revoke all on function public.lao_ensure_assessment_book_base_v01938(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_ensure_assessment_book(
  p_school_id uuid,
  p_workload_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_course_id uuid;
  v_term_no integer;
  v_cc public.lao_course_curricula%rowtype;
  v_existing_book uuid;
  v_result jsonb;
  v_book_id uuid;
  v_plan_count integer:=0;
  v_score_total numeric:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select wi.course_id,t.term_no
  into v_course_id,v_term_no
  from public.lao_teaching_workload_items wi
  join public.lao_teaching_workloads w on w.id=wi.workload_id
  join public.lao_terms t on t.id=w.term_id
  where wi.id=p_workload_item_id and w.school_id=p_school_id;

  if v_course_id is null then raise exception 'ไม่พบภาระงานสอนที่เลือก'; end if;

  select * into v_cc
  from public.lao_course_curricula
  where course_id=v_course_id and school_id=p_school_id and status='approved'
  limit 1;

  if not found then
    raise exception 'ต้องจัดทำหลักสูตรรายวิชา โครงสร้างรายวิชา และโครงสร้างคะแนนให้ได้รับอนุมัติก่อนเริ่มบันทึกคะแนน';
  end if;

  select count(*),coalesce(sum((a->>'max_score')::numeric),0)
  into v_plan_count,v_score_total
  from jsonb_array_elements(v_cc.assessment_plan) a
  where coalesce(a->>'term_no','') ~ '^[0-9]+$'
    and (a->>'term_no')::integer=v_term_no
    and coalesce(a->>'max_score','') ~ '^[0-9]+([.][0-9]+)?$';

  if v_plan_count=0 or abs(v_score_total-100)>0.01 then
    raise exception 'โครงสร้างคะแนนภาคเรียนที่ % ยังไม่พร้อมใช้งาน',v_term_no;
  end if;

  select b.id into v_existing_book
  from public.lao_assessment_books b
  where b.workload_item_id=p_workload_item_id
  limit 1;

  v_result:=public.lao_ensure_assessment_book_base_v01938(p_school_id,p_workload_item_id);
  v_book_id=nullif(v_result->>'id','')::uuid;

  if v_existing_book is null and v_book_id is not null then
    delete from public.lao_assessment_components
    where book_id=v_book_id;

    insert into public.lao_assessment_components(
      book_id,code,label,max_score,sort_order,
      source_plan_code,component_category,assessment_method,evidence,unit_no,
      course_curriculum_revision,created_by,updated_by
    )
    select
      v_book_id,
      coalesce(nullif(btrim(a->>'code'),''),'score_'||row_number() over(order by ordinality)),
      btrim(a->>'label'),
      (a->>'max_score')::numeric,
      row_number() over(order by ordinality),
      nullif(btrim(a->>'code'),''),
      nullif(btrim(a->>'category'),''),
      nullif(btrim(a->>'method'),''),
      nullif(btrim(a->>'evidence'),''),
      case when coalesce(a->>'unit_no','') ~ '^[0-9]+$' then (a->>'unit_no')::integer else null end,
      v_cc.revision_no,
      v_uid,v_uid
    from jsonb_array_elements(v_cc.assessment_plan) with ordinality x(a,ordinality)
    where coalesce(a->>'term_no','') ~ '^[0-9]+$'
      and (a->>'term_no')::integer=v_term_no
    order by ordinality;

    update public.lao_assessment_books
    set course_curriculum_id=v_cc.id,
        course_curriculum_revision=v_cc.revision_no,
        updated_by=v_uid,
        updated_at=now()
    where id=v_book_id;
  end if;

  return v_result||jsonb_build_object(
    'course_curriculum_id',v_cc.id,
    'course_curriculum_revision',v_cc.revision_no
  );
end;
$function$;

revoke all on function public.lao_ensure_assessment_book(uuid,uuid) from public,anon;
grant execute on function public.lao_ensure_assessment_book(uuid,uuid) to authenticated;

commit;

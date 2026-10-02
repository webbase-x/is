-- 0058_academic_year_setup_timeline.sql
-- Academic setup timeline is evaluated per academic year. Reusable school-level
-- data (special programs) is reviewed once for each year instead of recreated.

begin;

create table if not exists public.lao_academic_year_setup_progress(
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  step_code text not null,
  status text not null check(status in ('confirmed','skipped')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key(school_id,academic_year_id,step_code)
);
create index if not exists lao_academic_year_setup_progress_year_idx
  on public.lao_academic_year_setup_progress(academic_year_id,step_code);
alter table public.lao_academic_year_setup_progress enable row level security;
revoke all on table public.lao_academic_year_setup_progress from public,anon,authenticated;

create or replace function public.lao_academic_year_setup_timeline(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_can_manage boolean;
  v_year public.lao_academic_years%rowtype;
  v_prev_year public.lao_academic_years%rowtype;
  v_readiness jsonb;
  v_term_count int:=0;
  v_active_program_count int:=0;
  v_program_confirmed boolean:=false;
  v_class_count int:=0;
  v_workload_count int:=0;
  v_workload_approved int:=0;
  v_workload_attention int:=0;
  v_workload_skipped boolean:=false;
  v_periods_done boolean:=false;
  v_classes_done boolean:=false;
  v_subjects_done boolean:=false;
  v_curriculum_done boolean:=false;
  v_workload_done boolean:=false;
  v_prev_class_count int:=0;
  v_prev_program_count int:=0;
  v_current_program_count int:=0;
  v_subjects_added int:=0;
  v_subjects_removed int:=0;
  v_time_changed int:=0;
  v_steps jsonb:='[]'::jsonb;
  v_labeled jsonb:='[]'::jsonb;
  v_step jsonb;
  v_status text;
  v_first_unresolved int;
  v_applicable int:=0;
  v_completed int:=0;
  v_skipped int:=0;
  v_not_applicable int:=0;
  v_pct int:=0;
  v_next jsonb:=null;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  v_can_manage:=public.lao_can_manage_academic(p_school_id);

  if p_academic_year_id is not null then
    select * into v_year from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id;
  else
    select * into v_year from public.lao_academic_years
    where school_id=p_school_id
    order by is_current desc,year_be desc
    limit 1;
  end if;

  if v_year.id is null then
    return jsonb_build_object(
      'timeline_scope','academic_year',
      'department_code','academics',
      'department_name','งานวิชาการ',
      'academic_year_id',null,
      'year_be',null,
      'can_manage',v_can_manage,
      'is_complete',false,
      'completed_count',0,
      'resolved_count',0,
      'applicable_count',1,
      'total_count',6,
      'progress_percent',0,
      'next_step',jsonb_build_object(
        'step_code','periods','sequence_no',1,'title','ปีการศึกษาและภาคเรียน',
        'route','#/academics/periods','is_required',true
      ),
      'change_summary',jsonb_build_object('has_previous',false),
      'steps',jsonb_build_array(
        jsonb_build_object('step_code','periods','sequence_no',1,'title','ปีการศึกษาและภาคเรียน','description','สร้างปีการศึกษาและภาคเรียนสำหรับปีที่จะดำเนินงาน','route','#/academics/periods','is_required',true,'is_skippable',false,'status','current'),
        jsonb_build_object('step_code','programs','sequence_no',2,'title','โปรแกรมพิเศษ','description','ตรวจสอบโปรแกรมพิเศษของโรงเรียนสำหรับปีนี้','route','#/academics/programs','is_required',false,'is_skippable',true,'status','queued'),
        jsonb_build_object('step_code','classes','sequence_no',3,'title','ชั้น/ห้อง','description','นำเข้าชั้นและห้องของปีนี้จาก LEC','route','#/academics/classes','is_required',true,'is_skippable',false,'status','queued'),
        jsonb_build_object('step_code','subjects','sequence_no',4,'title','รายวิชา','description','ตรวจและจัดรายวิชาที่ใช้จริงในปีนี้','route','#/academics/subjects','is_required',true,'is_skippable',false,'status','queued'),
        jsonb_build_object('step_code','curriculum','sequence_no',5,'title','โครงสร้างเวลาเรียน','description','ตรวจเวลาเรียนและยืนยันโครงสร้างของปีนี้','route','#/academics/curriculum','is_required',true,'is_skippable',false,'status','queued'),
        jsonb_build_object('step_code','workload','sequence_no',6,'title','ภาระงานสอน','description','จัดและอนุมัติภาระงานสอนของปีนี้','route','#/academics/workload','is_required',false,'is_skippable',true,'status','queued')
      )
    );
  end if;

  select count(*)::int into v_term_count
  from public.lao_terms where academic_year_id=v_year.id;
  v_periods_done:=v_term_count>0;

  select count(*)::int into v_active_program_count
  from public.lao_academic_programs
  where school_id=p_school_id and is_active;

  select exists(
    select 1 from public.lao_academic_year_setup_progress
    where school_id=p_school_id and academic_year_id=v_year.id
      and step_code='programs' and status='confirmed'
  ) into v_program_confirmed;

  select count(*)::int into v_class_count
  from public.lao_class_sections
  where school_id=p_school_id and academic_year_id=v_year.id
    and is_active and source_type='lec';
  v_classes_done:=v_class_count>0;

  v_readiness:=public.lao_curriculum_readiness(p_school_id,v_year.id);
  v_subjects_done:=
    coalesce((v_readiness->>'total_groups')::int,0)>0
    and coalesce((v_readiness->>'groups_with_courses')::int,0)=coalesce((v_readiness->>'total_groups')::int,0);
  v_curriculum_done:=coalesce((v_readiness->>'is_complete')::boolean,false);

  select
    count(*) filter(where status<>'cancelled')::int,
    count(*) filter(where status='approved')::int,
    count(*) filter(where status in ('draft','submitted','returned'))::int
  into v_workload_count,v_workload_approved,v_workload_attention
  from public.lao_teaching_workloads
  where school_id=p_school_id and academic_year_id=v_year.id;
  v_workload_done:=v_workload_count>0 and v_workload_approved=v_workload_count;

  select exists(
    select 1 from public.lao_academic_year_setup_progress
    where school_id=p_school_id and academic_year_id=v_year.id
      and step_code='workload' and status='skipped'
  ) into v_workload_skipped;

  v_steps:=jsonb_build_array(
    jsonb_build_object(
      'step_code','periods','sequence_no',1,'title','ปีการศึกษาและภาคเรียน',
      'description','กำหนดปีการศึกษาและภาคเรียนของปีนี้',
      'route','#/academics/periods','is_required',true,'is_skippable',false,
      'base_status',case when v_periods_done then 'completed' else 'pending' end,
      'detail',jsonb_build_object('term_count',v_term_count)
    ),
    jsonb_build_object(
      'step_code','programs','sequence_no',2,'title','โปรแกรมพิเศษ',
      'description',case when v_active_program_count=0
        then 'โรงเรียนไม่มีโปรแกรมพิเศษที่ต้องใช้ในปีนี้'
        else 'ตรวจสอบโปรแกรมพิเศษเดิมของโรงเรียนและยืนยันใช้สำหรับปีนี้' end,
      'route','#/academics/programs','is_required',false,'is_skippable',false,
      'base_status',case
        when v_active_program_count=0 then 'not_applicable'
        when v_program_confirmed then 'reused'
        else 'pending'
      end,
      'detail',jsonb_build_object('active_program_count',v_active_program_count)
    ),
    jsonb_build_object(
      'step_code','classes','sequence_no',3,'title','ชั้น/ห้อง',
      'description','ตรวจชั้นและห้องจาก LEC ของปีการศึกษานี้',
      'route','#/academics/classes','is_required',true,'is_skippable',false,
      'base_status',case when v_classes_done then 'completed' else 'pending' end,
      'detail',jsonb_build_object('class_count',v_class_count)
    ),
    jsonb_build_object(
      'step_code','subjects','sequence_no',4,'title','รายวิชา',
      'description','ตรวจรายวิชาของทุกระดับชั้นและโปรแกรมที่เปิดจริงในปีนี้',
      'route','#/academics/subjects','is_required',true,'is_skippable',false,
      'base_status',case when v_subjects_done then 'completed' else 'pending' end,
      'detail',jsonb_build_object(
        'groups_with_courses',coalesce((v_readiness->>'groups_with_courses')::int,0),
        'total_groups',coalesce((v_readiness->>'total_groups')::int,0)
      )
    ),
    jsonb_build_object(
      'step_code','curriculum','sequence_no',5,'title','โครงสร้างเวลาเรียน',
      'description','ตรวจเวลาเรียนและยืนยันโครงสร้างของทุกระดับชั้น/โปรแกรมในปีนี้',
      'route','#/academics/curriculum','is_required',true,'is_skippable',false,
      'base_status',case when v_curriculum_done then 'completed' else 'pending' end,
      'detail',jsonb_build_object(
        'confirmed_groups',coalesce((v_readiness->>'confirmed_groups')::int,0),
        'total_groups',coalesce((v_readiness->>'total_groups')::int,0)
      )
    ),
    jsonb_build_object(
      'step_code','workload','sequence_no',6,'title','ภาระงานสอน',
      'description','จัดครูผู้สอนและอนุมัติภาระงานสอนของปีนี้',
      'route','#/academics/workload','is_required',false,'is_skippable',true,
      'base_status',case
        when v_workload_skipped then 'skipped'
        when v_workload_done then 'completed'
        when v_workload_count>0 then 'in_progress'
        else 'pending'
      end,
      'detail',jsonb_build_object(
        'workload_count',v_workload_count,
        'approved_count',v_workload_approved,
        'attention_count',v_workload_attention
      )
    )
  );

  select min((x->>'sequence_no')::int) into v_first_unresolved
  from jsonb_array_elements(v_steps) x
  where x->>'base_status' in ('pending','in_progress');

  for v_step in select value from jsonb_array_elements(v_steps)
  loop
    v_status:=v_step->>'base_status';
    if v_status in ('pending','in_progress') then
      if (v_step->>'sequence_no')::int=v_first_unresolved then
        v_status:='current';
      else
        v_status:='queued';
      end if;
    end if;

    if v_status='skipped' then
      v_skipped:=v_skipped+1;
    elsif v_status='not_applicable' then
      v_not_applicable:=v_not_applicable+1;
    else
      v_applicable:=v_applicable+1;
      if v_status in ('completed','reused') then v_completed:=v_completed+1; end if;
    end if;

    if v_next is null and v_status='current' then
      v_next:=jsonb_build_object(
        'step_code',v_step->>'step_code',
        'sequence_no',(v_step->>'sequence_no')::int,
        'title',v_step->>'title',
        'description',v_step->>'description',
        'route',v_step->>'route',
        'is_required',(v_step->>'is_required')::boolean
      );
    end if;

    v_labeled:=v_labeled||jsonb_build_array(
      (v_step-'base_status')||jsonb_build_object('status',v_status)
    );
  end loop;

  v_pct:=case when v_applicable=0 then 100 else round(v_completed*100.0/v_applicable)::int end;

  select * into v_prev_year
  from public.lao_academic_years
  where school_id=p_school_id and year_be<v_year.year_be
  order by year_be desc
  limit 1;

  if v_prev_year.id is not null then
    select count(*)::int into v_prev_class_count
    from public.lao_class_sections
    where school_id=p_school_id and academic_year_id=v_prev_year.id
      and is_active and source_type='lec';

    select count(distinct program_id)::int into v_prev_program_count
    from public.lao_class_sections
    where school_id=p_school_id and academic_year_id=v_prev_year.id
      and is_active and source_type='lec' and program_id is not null;

    select count(distinct program_id)::int into v_current_program_count
    from public.lao_class_sections
    where school_id=p_school_id and academic_year_id=v_year.id
      and is_active and source_type='lec' and program_id is not null;

    with cur as (
      select c.grade_code,c.program_id,s.subject_type,
             lower(coalesce(nullif(btrim(s.subject_code),''),btrim(s.name_th))) as subject_key,
             c.annual_hours,c.credits,
             (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=c.id) weekly_periods,
             (select sum(tp.term_hours) from public.lao_course_term_plans tp where tp.course_id=c.id) term_hours
      from public.lao_curriculum_courses c
      join public.lao_subjects s on s.id=c.subject_id
      where c.school_id=p_school_id and c.academic_year_id=v_year.id and c.is_active
    ),
    prv as (
      select c.grade_code,c.program_id,s.subject_type,
             lower(coalesce(nullif(btrim(s.subject_code),''),btrim(s.name_th))) as subject_key,
             c.annual_hours,c.credits,
             (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=c.id) weekly_periods,
             (select sum(tp.term_hours) from public.lao_course_term_plans tp where tp.course_id=c.id) term_hours
      from public.lao_curriculum_courses c
      join public.lao_subjects s on s.id=c.subject_id
      where c.school_id=p_school_id and c.academic_year_id=v_prev_year.id and c.is_active
    )
    select
      (select count(*) from cur c where not exists(
        select 1 from prv p where p.grade_code=c.grade_code
          and p.program_id is not distinct from c.program_id
          and p.subject_type=c.subject_type and p.subject_key=c.subject_key
      ))::int,
      (select count(*) from prv p where not exists(
        select 1 from cur c where c.grade_code=p.grade_code
          and c.program_id is not distinct from p.program_id
          and c.subject_type=p.subject_type and c.subject_key=p.subject_key
      ))::int,
      (select count(*) from cur c join prv p
        on p.grade_code=c.grade_code
       and p.program_id is not distinct from c.program_id
       and p.subject_type=c.subject_type and p.subject_key=c.subject_key
       where c.annual_hours is distinct from p.annual_hours
          or c.credits is distinct from p.credits
          or c.weekly_periods is distinct from p.weekly_periods
          or c.term_hours is distinct from p.term_hours
      )::int
    into v_subjects_added,v_subjects_removed,v_time_changed;
  end if;

  return jsonb_build_object(
    'timeline_scope','academic_year',
    'department_code','academics',
    'department_name','งานวิชาการ',
    'academic_year_id',v_year.id,
    'year_be',v_year.year_be,
    'can_manage',v_can_manage,
    'is_complete',(v_completed=v_applicable),
    'completed_count',v_completed,
    'skipped_count',v_skipped,
    'not_applicable_count',v_not_applicable,
    'resolved_count',v_completed+v_skipped+v_not_applicable,
    'applicable_count',v_applicable,
    'total_count',6,
    'progress_percent',v_pct,
    'next_step',v_next,
    'change_summary',case when v_prev_year.id is null
      then jsonb_build_object('has_previous',false)
      else jsonb_build_object(
        'has_previous',true,
        'previous_year_id',v_prev_year.id,
        'previous_year_be',v_prev_year.year_be,
        'rooms_current',v_class_count,
        'rooms_previous',v_prev_class_count,
        'rooms_delta',v_class_count-v_prev_class_count,
        'programs_current',v_current_program_count,
        'programs_previous',v_prev_program_count,
        'subjects_added',v_subjects_added,
        'subjects_removed',v_subjects_removed,
        'time_changed',v_time_changed
      )
    end,
    'steps',v_labeled
  );
end;
$function$;
revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid) to authenticated;

create or replace function public.lao_update_academic_year_setup_step(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_step_code text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_org uuid;
  v_active_programs int:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_step_code not in ('programs','workload') then
    raise exception 'ขั้นตอนนี้ตรวจจากข้อมูลจริงโดยอัตโนมัติ';
  end if;
  if p_action not in ('confirm','skip','resume') then raise exception 'Invalid action'; end if;

  if p_step_code='programs' then
    if p_action='skip' then raise exception 'ขั้นโปรแกรมพิเศษไม่ใช้การข้าม หากไม่มีโปรแกรมระบบจะไม่นับขั้นนี้อัตโนมัติ'; end if;
    select count(*)::int into v_active_programs
    from public.lao_academic_programs where school_id=p_school_id and is_active;
    if p_action='confirm' and v_active_programs=0 then
      raise exception 'ไม่มีโปรแกรมพิเศษที่ต้องยืนยันสำหรับปีนี้';
    end if;
  end if;

  if p_action='resume' then
    delete from public.lao_academic_year_setup_progress
    where school_id=p_school_id and academic_year_id=p_academic_year_id and step_code=p_step_code;
  else
    insert into public.lao_academic_year_setup_progress(
      school_id,academic_year_id,step_code,status,updated_by,updated_at
    ) values(
      p_school_id,p_academic_year_id,p_step_code,
      case when p_action='confirm' then 'confirmed' else 'skipped' end,
      v_uid,now()
    )
    on conflict(school_id,academic_year_id,step_code) do update set
      status=excluded.status,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case p_action
      when 'confirm' then 'academic_year_setup_step_confirmed'
      when 'skip' then 'academic_year_setup_step_skipped'
      else 'academic_year_setup_step_resumed'
    end,
    'academic_year_setup_step',
    p_academic_year_id::text||':'||p_step_code,
    jsonb_build_object('academic_year_id',p_academic_year_id,'step_code',p_step_code,'action',p_action)
  );

  return public.lao_academic_year_setup_timeline(p_school_id,p_academic_year_id);
end;
$function$;
revoke all on function public.lao_update_academic_year_setup_step(uuid,uuid,text,text) from public,anon;
grant execute on function public.lao_update_academic_year_setup_step(uuid,uuid,text,text) to authenticated;

create or replace function public.lao_academic_program_change_invalidate_year_review()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_school_id uuid:=coalesce(new.school_id,old.school_id);
begin
  delete from public.lao_academic_year_setup_progress
  where school_id=v_school_id and step_code='programs' and status='confirmed';
  return coalesce(new,old);
end;
$function$;
revoke all on function public.lao_academic_program_change_invalidate_year_review() from public,anon,authenticated;

drop trigger if exists trg_lao_academic_program_invalidate_year_review on public.lao_academic_programs;
create trigger trg_lao_academic_program_invalidate_year_review
after insert or update of code,name_th,name_en,is_active or delete on public.lao_academic_programs
for each row execute function public.lao_academic_program_change_invalidate_year_review();

commit;

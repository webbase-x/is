-- Department setup timelines with persistent skip/resume state.
-- Required steps are data-driven and cannot be skipped. Optional steps may be skipped
-- without blocking later work. The next unresolved step is returned as the resume point.

create table if not exists public.lao_department_setup_steps (
  department_code text not null,
  step_code text not null,
  sequence_no integer not null check(sequence_no > 0),
  title_th text not null,
  description_th text,
  route text not null,
  is_required boolean not null default true,
  completion_mode text not null default 'auto'
    check(completion_mode in ('auto','manual')),
  is_active boolean not null default true,
  primary key(department_code,step_code),
  unique(department_code,sequence_no)
);

create table if not exists public.lao_department_setup_progress (
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  department_code text not null,
  step_code text not null,
  override_status text
    check(override_status is null or override_status in ('completed','skipped')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(school_id,department_code,step_code),
  foreign key(department_code,step_code)
    references public.lao_department_setup_steps(department_code,step_code)
    on delete cascade
);

create index if not exists lao_department_setup_progress_school_idx
  on public.lao_department_setup_progress(school_id,department_code);

alter table public.lao_department_setup_steps enable row level security;
alter table public.lao_department_setup_progress enable row level security;
revoke all on public.lao_department_setup_steps from anon,authenticated;
revoke all on public.lao_department_setup_progress from anon,authenticated;

insert into public.lao_department_setup_steps(
  department_code,step_code,sequence_no,title_th,description_th,route,is_required,completion_mode,is_active
) values
  ('personnel','registry',1,'ตรวจทะเบียนบุคลากร','มีข้อมูลบุคลากรที่ปฏิบัติงานอย่างน้อย 1 คน และตรวจสอบชื่อ/ตำแหน่งให้ถูกต้อง','#/personnel/registry',true,'auto',true),
  ('personnel','authorities',2,'กำหนดผู้รับผิดชอบงานบุคลากร','แต่งตั้งหัวหน้างานหรือเจ้าหน้าที่งานบุคลากรเมื่อโรงเรียนต้องการมอบหมายให้ผู้อื่นดูแลแทน School Admin','#/personnel/authorities',false,'auto',true),
  ('personnel','intake',3,'เตรียมช่องทางรับบุคลากรเข้าระบบ','สร้างลิงก์รับสมัครสำหรับให้บุคลากรยืนยันอีเมลและส่งคำขอเข้าร่วม หากไม่ใช้วิธีนี้สามารถข้ามได้','#/personnel/intake',false,'auto',true),
  ('personnel','requests',4,'ตรวจคำขอเข้าร่วมที่ค้าง','คำขอที่ยืนยันอีเมลแล้วต้องได้รับการตรวจสอบให้หมดก่อนถือว่าขั้นตอนนี้เรียบร้อย','#/personnel/requests',true,'auto',true),

  ('academics','periods',1,'กำหนดปีการศึกษาและภาคเรียน','ต้องมีปีการศึกษาและอย่างน้อย 1 ภาคเรียนก่อนจึงจะจัดโครงสร้างวิชาการรายปีได้','#/academics/periods',true,'auto',true),
  ('academics','programs',2,'กำหนดหลักสูตร / โปรแกรมพิเศษ','ใช้เมื่อมี MEP, MLP หรือห้องพิเศษ หากใช้เฉพาะห้องทั่วไปสามารถข้ามขั้นตอนนี้ได้','#/academics/programs',false,'auto',true),
  ('academics','classes',3,'ตรวจระดับชั้นและห้องเรียน','ต้องมีชั้น/ห้องของปีการศึกษาปัจจุบัน โดยข้อมูลจาก LEC สามารถสร้างเป็นฐานให้อัตโนมัติ','#/academics/classes',true,'auto',true),
  ('academics','subjects',4,'จัดทะเบียนรายวิชา','ต้องมีรายวิชาต้นทางของโรงเรียน สามารถใช้ชุดวิชาหลักแล้วเพิ่มหรือแก้ไขวิชาที่ขาดได้','#/academics/subjects',true,'auto',true),
  ('academics','curriculum',5,'กำหนดโครงสร้างเวลาเรียน','ผูกรายวิชากับระดับชั้นและกำหนดชั่วโมง/ปีหรือคาบต่อสัปดาห์','#/academics/curriculum',true,'auto',true),
  ('academics','workload',6,'จัดภาระงานสอน','จัดครูผู้สอนให้รายวิชาและห้องเรียนเมื่อพร้อม หากยังไม่จัดในช่วงตั้งค่าแรกสามารถข้ามและกลับมาทำภายหลังได้','#/academics/workload',false,'auto',true),
  ('academics','workload_review',7,'ตรวจภาระงานสอนที่รออนุมัติ','หากมีครูส่งภาระงานสอนเข้ามา ต้องตรวจให้ไม่มีรายการค้าง','#/academics/workload',true,'auto',true)
on conflict(department_code,step_code) do update set
  sequence_no=excluded.sequence_no,
  title_th=excluded.title_th,
  description_th=excluded.description_th,
  route=excluded.route,
  is_required=excluded.is_required,
  completion_mode=excluded.completion_mode,
  is_active=excluded.is_active;

create or replace function public.lao_can_manage_department_setup(
  p_school_id uuid,
  p_department_code text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select case
    when p_department_code='personnel' then
      public.lao_can_manage_personnel(p_school_id)
      or public.lao_can_manage_personnel_intake(p_school_id)
    when p_department_code='academics' then
      public.lao_can_manage_academic(p_school_id)
    else public.lao_is_platform_admin() or public.lao_is_school_admin(p_school_id)
  end;
$$;

revoke all on function public.lao_can_manage_department_setup(uuid,text) from public,anon;
grant execute on function public.lao_can_manage_department_setup(uuid,text) to authenticated;

create or replace function public.lao_can_view_department_setup(
  p_school_id uuid,
  p_department_code text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select case
    when p_department_code='personnel' then public.lao_can_view_personnel(p_school_id)
    when p_department_code='academics' then public.lao_can_view_academic(p_school_id)
    else public.lao_is_platform_admin() or public.lao_is_school_admin(p_school_id)
  end;
$$;

revoke all on function public.lao_can_view_department_setup(uuid,text) from public,anon;
grant execute on function public.lao_can_view_department_setup(uuid,text) to authenticated;

create or replace function public.lao_department_setup_step_is_done(
  p_school_id uuid,
  p_department_code text,
  p_step_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_year_id uuid;
begin
  if p_department_code='personnel' then
    case p_step_code
      when 'registry' then
        return exists(
          select 1 from public.lao_personnel
          where school_id=p_school_id and employment_status='active'
        );
      when 'authorities' then
        return exists(
          select 1 from public.lao_personnel_authorities
          where school_id=p_school_id and is_active
            and (starts_on is null or starts_on<=current_date)
            and (ends_on is null or ends_on>=current_date)
        );
      when 'intake' then
        return exists(
          select 1 from public.lao_personnel_join_links
          where school_id=p_school_id
        );
      when 'requests' then
        return not exists(
          select 1 from public.lao_personnel_join_requests
          where school_id=p_school_id and status='pending_review'
        );
      else return false;
    end case;
  end if;

  if p_department_code='academics' then
    select ay.id into v_year_id
    from public.lao_academic_years ay
    where ay.school_id=p_school_id
    order by ay.is_current desc,ay.year_be desc
    limit 1;

    case p_step_code
      when 'periods' then
        return v_year_id is not null and exists(
          select 1 from public.lao_terms where academic_year_id=v_year_id
        );
      when 'programs' then
        return exists(
          select 1 from public.lao_academic_programs
          where school_id=p_school_id and is_active
        );
      when 'classes' then
        return v_year_id is not null and exists(
          select 1 from public.lao_class_sections
          where school_id=p_school_id and academic_year_id=v_year_id and is_active
        );
      when 'subjects' then
        return exists(
          select 1 from public.lao_subjects
          where school_id=p_school_id and is_active
        );
      when 'curriculum' then
        return v_year_id is not null and exists(
          select 1 from public.lao_curriculum_courses
          where school_id=p_school_id and academic_year_id=v_year_id and is_active
        );
      when 'workload' then
        return v_year_id is not null and exists(
          select 1 from public.lao_teaching_workloads
          where school_id=p_school_id and academic_year_id=v_year_id and status<>'cancelled'
        );
      when 'workload_review' then
        return v_year_id is null or not exists(
          select 1 from public.lao_teaching_workloads
          where school_id=p_school_id and academic_year_id=v_year_id and status='submitted'
        );
      else return false;
    end case;
  end if;

  return false;
end;
$$;

revoke all on function public.lao_department_setup_step_is_done(uuid,text,text) from public,anon;
grant execute on function public.lao_department_setup_step_is_done(uuid,text,text) to authenticated;

create or replace function public.lao_department_setup_timeline(
  p_school_id uuid,
  p_department_code text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_can_manage boolean;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_department_setup(p_school_id,p_department_code) then
    raise exception 'Access denied';
  end if;

  v_can_manage:=public.lao_can_manage_department_setup(p_school_id,p_department_code);

  with base as (
    select
      s.department_code,
      s.step_code,
      s.sequence_no,
      s.title_th,
      s.description_th,
      s.route,
      s.is_required,
      s.completion_mode,
      public.lao_department_setup_step_is_done(p_school_id,s.department_code,s.step_code) as auto_done,
      p.override_status,
      p.updated_at as progress_updated_at
    from public.lao_department_setup_steps s
    left join public.lao_department_setup_progress p
      on p.school_id=p_school_id
     and p.department_code=s.department_code
     and p.step_code=s.step_code
    where s.department_code=p_department_code
      and s.is_active
  ),
  effective as (
    select *,
      (
        auto_done
        or (completion_mode='manual' and override_status='completed')
      ) as is_done,
      (
        not is_required
        and override_status='skipped'
        and not auto_done
      ) as is_skipped
    from base
  ),
  next_seq as (
    select min(sequence_no) as sequence_no
    from effective
    where not is_done and not is_skipped
  ),
  labeled as (
    select e.*,
      case
        when e.is_done then 'completed'
        when e.is_skipped then 'skipped'
        when e.sequence_no=(select sequence_no from next_seq) then 'current'
        else 'queued'
      end as status
    from effective e
  )
  select jsonb_build_object(
    'department_code',p_department_code,
    'department_name',case p_department_code
      when 'personnel' then 'งานบุคลากร'
      when 'academics' then 'งานวิชาการ'
      else p_department_code
    end,
    'can_manage',v_can_manage,
    'is_complete',not exists(
      select 1 from labeled where status in ('current','queued')
    ),
    'completed_count',(select count(*) from labeled where status='completed'),
    'skipped_count',(select count(*) from labeled where status='skipped'),
    'resolved_count',(select count(*) from labeled where status in ('completed','skipped')),
    'total_count',(select count(*) from labeled),
    'next_step',(
      select jsonb_build_object(
        'step_code',l.step_code,
        'sequence_no',l.sequence_no,
        'title',l.title_th,
        'description',l.description_th,
        'route',l.route,
        'is_required',l.is_required
      )
      from labeled l where l.status='current'
      limit 1
    ),
    'steps',coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_code',l.step_code,
        'sequence_no',l.sequence_no,
        'title',l.title_th,
        'description',l.description_th,
        'route',l.route,
        'is_required',l.is_required,
        'is_skippable',not l.is_required,
        'completion_mode',l.completion_mode,
        'status',l.status,
        'auto_done',l.auto_done,
        'progress_updated_at',l.progress_updated_at
      ) order by l.sequence_no)
      from labeled l
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.lao_department_setup_timeline(uuid,text) from public,anon;
grant execute on function public.lao_department_setup_timeline(uuid,text) to authenticated;

create or replace function public.lao_update_department_setup_step(
  p_school_id uuid,
  p_department_code text,
  p_step_code text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_step public.lao_department_setup_steps;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_department_setup(p_school_id,p_department_code) then
    raise exception 'Access denied';
  end if;
  if p_action not in ('skip','resume','complete','reset') then
    raise exception 'Invalid action';
  end if;

  select * into v_step
  from public.lao_department_setup_steps
  where department_code=p_department_code and step_code=p_step_code and is_active;
  if not found then raise exception 'ไม่พบขั้นตอนที่เลือก'; end if;

  if p_action='skip' and v_step.is_required then
    raise exception 'ขั้นตอนนี้จำเป็นและไม่สามารถข้ามได้';
  end if;

  if p_action='complete' and v_step.completion_mode<>'manual' then
    raise exception 'ขั้นตอนนี้ตรวจสถานะจากข้อมูลจริงโดยอัตโนมัติ';
  end if;

  if p_action in ('resume','reset') then
    delete from public.lao_department_setup_progress
    where school_id=p_school_id
      and department_code=p_department_code
      and step_code=p_step_code;
  else
    insert into public.lao_department_setup_progress(
      school_id,department_code,step_code,override_status,updated_by,updated_at
    ) values(
      p_school_id,p_department_code,p_step_code,
      case when p_action='skip' then 'skipped' else 'completed' end,
      v_uid,now()
    )
    on conflict(school_id,department_code,step_code) do update set
      override_status=excluded.override_status,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case p_action
      when 'skip' then 'department_setup_step_skipped'
      when 'resume' then 'department_setup_step_resumed'
      when 'complete' then 'department_setup_step_completed'
      else 'department_setup_step_reset'
    end,
    'department_setup_step',
    p_department_code||':'||p_step_code,
    jsonb_build_object(
      'department_code',p_department_code,
      'step_code',p_step_code,
      'action',p_action
    )
  );

  return public.lao_department_setup_timeline(p_school_id,p_department_code);
end;
$$;

revoke all on function public.lao_update_department_setup_step(uuid,text,text,text) from public,anon;
grant execute on function public.lao_update_department_setup_step(uuid,text,text,text) to authenticated;

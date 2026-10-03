-- 0073_academic_timeline_scoped_permissions.sql
-- Make the annual academic workflow respect the exact delegated work scope.

begin;

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
  v_base jsonb;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
  v_code text;
  v_scope text;
  v_can_manage_step boolean;
  v_can_manage_any boolean:=false;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v01914(
    p_school_id,p_academic_year_id
  );

  for v_step in
    select value
    from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
    order by (value->>'sequence_no')::int
  loop
    v_code:=v_step->>'step_code';
    v_scope:=case v_code
      when 'periods' then 'academics.basic_settings'
      when 'programs' then 'academics.programs'
      when 'classes' then 'academics.classes'
      when 'subjects' then 'academics.subjects'
      when 'curriculum' then 'academics.subjects'
      when 'workload' then 'academics.workload'
      else 'academics'
    end;

    v_can_manage_step:=
      public.lao_has_work_permission(p_school_id,v_scope,'edit')
      or public.lao_has_work_permission(p_school_id,v_scope,'approve');
    v_can_manage_any:=v_can_manage_any or v_can_manage_step;

    if v_code='periods' then
      v_step:=v_step||jsonb_build_object(
        'title','ตั้งค่าพื้นฐานงานวิชาการประจำปี',
        'description','กำหนดปี/ภาคเรียน และกรอบเวลาเรียนเริ่มต้น รวมทั้งกรอบเฉพาะโปรแกรมหรือห้องพิเศษที่ใช้เวลาต่างกัน',
        'route','#/academics/periods'
      );
    elsif v_code='subjects' then
      v_step:=v_step||jsonb_build_object(
        'title','โครงสร้างหลักสูตรและเวลาเรียน',
        'description','ตรวจรายวิชา ชั่วโมง/คาบ และความจุเวลาเรียนของทุกระดับชั้น/โปรแกรมในหน้าเดียว',
        'route','#/academics/subjects'
      );
    end if;

    v_step:=v_step||jsonb_build_object(
      'scope_code',v_scope,
      'can_manage_step',v_can_manage_step
    );
    v_steps:=v_steps||jsonb_build_array(v_step);
  end loop;

  return (v_base-'steps'-'can_manage')
    ||jsonb_build_object(
      'steps',v_steps,
      'can_manage',v_can_manage_any,
      'can_manage_basic_settings',
        public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit'),
      'can_manage_programs',
        public.lao_has_work_permission(p_school_id,'academics.programs','edit'),
      'can_manage_classes',
        public.lao_has_work_permission(p_school_id,'academics.classes','edit'),
      'can_manage_subjects',
        public.lao_has_work_permission(p_school_id,'academics.subjects','edit'),
      'can_manage_workload',(
        public.lao_has_work_permission(p_school_id,'academics.workload','edit')
        or public.lao_has_work_permission(p_school_id,'academics.workload','approve')
      )
    );
end;
$function$;

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
  v_scope text;
  v_can_manage boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;

  if p_step_code not in ('programs','workload') then
    raise exception 'ขั้นตอนนี้ตรวจจากข้อมูลจริงโดยอัตโนมัติ';
  end if;
  if p_action not in ('confirm','skip','resume') then
    raise exception 'Invalid action';
  end if;

  v_scope:=case p_step_code
    when 'programs' then 'academics.programs'
    when 'workload' then 'academics.workload'
    else 'academics'
  end;
  v_can_manage:=
    public.lao_has_work_permission(p_school_id,v_scope,'edit')
    or public.lao_has_work_permission(p_school_id,v_scope,'approve');
  if not v_can_manage then
    raise exception 'ไม่มีสิทธิ์ดำเนินการขั้นตอนนี้';
  end if;

  if p_step_code='programs' then
    if p_action='skip' then
      raise exception 'ขั้นโปรแกรมพิเศษไม่ใช้การข้าม หากไม่มีโปรแกรมระบบจะไม่นับขั้นนี้อัตโนมัติ';
    end if;
    select count(*)::int into v_active_programs
    from public.lao_academic_programs
    where school_id=p_school_id and is_active;
    if p_action='confirm' and v_active_programs=0 then
      raise exception 'ไม่มีโปรแกรมพิเศษที่ต้องยืนยันสำหรับปีนี้';
    end if;
  end if;

  if p_action='resume' then
    delete from public.lao_academic_year_setup_progress
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and step_code=p_step_code;
  else
    insert into public.lao_academic_year_setup_progress(
      school_id,academic_year_id,step_code,status,updated_by,updated_at
    ) values(
      p_school_id,p_academic_year_id,p_step_code,
      case when p_action='confirm' then 'confirmed' else 'skipped' end,
      v_uid,now()
    )
    on conflict(school_id,academic_year_id,step_code) do update set
      status=excluded.status,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;
  end if;

  select organization_id into v_org
  from public.lao_schools where id=p_school_id;

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
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,
      'step_code',p_step_code,
      'scope_code',v_scope,
      'action',p_action
    )
  );

  return public.lao_academic_year_setup_timeline(
    p_school_id,p_academic_year_id
  );
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid)
  from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid)
  to authenticated;
revoke all on function public.lao_update_academic_year_setup_step(uuid,uuid,text,text)
  from public,anon;
grant execute on function public.lao_update_academic_year_setup_step(uuid,uuid,text,text)
  to authenticated;

commit;

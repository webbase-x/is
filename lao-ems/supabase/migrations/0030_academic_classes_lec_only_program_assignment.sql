-- Academic class sections are owned by student enrollment data imported from LEC.
-- Academic staff may only assign an existing LEC room to a school program.

create or replace function public.lao_assign_class_program(
  p_school_id uuid,
  p_class_section_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_row public.lao_class_sections%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select * into v_row
  from public.lao_class_sections
  where id=p_class_section_id and school_id=p_school_id;

  if v_row.id is null then raise exception 'ไม่พบชั้น/ห้อง'; end if;
  if v_row.source_type<>'lec' then
    raise exception 'ชั้น/ห้องต้องมาจากระบบนักเรียนที่นำเข้าจาก LEC';
  end if;

  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs
    where id=p_program_id and school_id=p_school_id and is_active
  ) then
    raise exception 'ไม่พบหลักสูตร/โครงการ/โปรแกรมที่เลือก';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;

  update public.lao_class_sections
  set program_id=p_program_id, updated_by=v_uid
  where id=p_class_section_id and school_id=p_school_id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'class_program_assigned','class_section',p_class_section_id::text,
    jsonb_build_object(
      'academic_year_id',v_row.academic_year_id,
      'grade_label',v_row.grade_label,
      'section_label',v_row.section_label,
      'program_id',p_program_id
    )
  );

  return jsonb_build_object('id',p_class_section_id,'program_id',p_program_id);
end;
$$;

revoke all on function public.lao_assign_class_program(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_assign_class_program(uuid,uuid,uuid) to authenticated;

create or replace function public.lao_save_class_section(
  p_school_id uuid,
  p_class_section_id uuid default null,
  p_academic_year_id uuid default null,
  p_program_id uuid default null,
  p_grade_code text default null,
  p_grade_label text default null,
  p_section_label text default null,
  p_room_name text default null,
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_class_section_id is null then
    raise exception 'ไม่อนุญาตให้สร้างชั้น/ห้องจากงานวิชาการ กรุณานำเข้าข้อมูลนักเรียนจาก LEC';
  end if;
  return public.lao_assign_class_program(p_school_id,p_class_section_id,p_program_id);
end;
$$;

revoke all on function public.lao_save_class_section(uuid,uuid,uuid,uuid,text,text,text,text,boolean,integer) from public,anon;
grant execute on function public.lao_save_class_section(uuid,uuid,uuid,uuid,text,text,text,text,boolean,integer) to authenticated;

create or replace function public.lao_sync_class_section_from_enrollment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_grade_code text;
  v_sort integer;
begin
  if nullif(btrim(new.grade_level),'') is null or nullif(btrim(new.classroom),'') is null then return new; end if;

  v_grade_code:=case
    when new.grade_level ~ '^อนุบาล[[:space:]]*1$' then 'K1'
    when new.grade_level ~ '^อนุบาล[[:space:]]*2$' then 'K2'
    when new.grade_level ~ '^อนุบาล[[:space:]]*3$' then 'K3'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*1$' then 'P1'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*2$' then 'P2'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*3$' then 'P3'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*4$' then 'P4'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*5$' then 'P5'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*6$' then 'P6'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*1$' then 'M1'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*2$' then 'M2'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*3$' then 'M3'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*4$' then 'M4'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*5$' then 'M5'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*6$' then 'M6'
    else null
  end;

  v_sort:=case
    when v_grade_code='K1' then 10 when v_grade_code='K2' then 20 when v_grade_code='K3' then 30
    when v_grade_code='P1' then 40 when v_grade_code='P2' then 50 when v_grade_code='P3' then 60
    when v_grade_code='P4' then 70 when v_grade_code='P5' then 80 when v_grade_code='P6' then 90
    when v_grade_code='M1' then 100 when v_grade_code='M2' then 110 when v_grade_code='M3' then 120
    when v_grade_code='M4' then 130 when v_grade_code='M5' then 140 when v_grade_code='M6' then 150
    else 900
  end;

  if not exists(
    select 1 from public.lao_class_sections c
    where c.school_id=new.school_id
      and c.academic_year_id=new.academic_year_id
      and lower(btrim(c.grade_label))=lower(btrim(new.grade_level))
      and lower(btrim(c.section_label))=lower(btrim(new.classroom))
  ) then
    insert into public.lao_class_sections(
      school_id,academic_year_id,program_id,grade_code,grade_label,section_label,source_type,is_active,sort_order
    )
    values(
      new.school_id,new.academic_year_id,null,v_grade_code,btrim(new.grade_level),btrim(new.classroom),'lec',true,v_sort
    );
  end if;

  return new;
end;
$$;

revoke all on function public.lao_sync_class_section_from_enrollment() from public,anon,authenticated;

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
      when 'registry' then return exists(select 1 from public.lao_personnel where school_id=p_school_id and employment_status='active');
      when 'authorities' then return exists(select 1 from public.lao_personnel_authorities where school_id=p_school_id and is_active and (starts_on is null or starts_on<=current_date) and (ends_on is null or ends_on>=current_date));
      when 'intake' then return exists(select 1 from public.lao_personnel_join_links where school_id=p_school_id);
      when 'requests' then return not exists(select 1 from public.lao_personnel_join_requests where school_id=p_school_id and status='pending_review');
      else return false;
    end case;
  end if;

  if p_department_code='academics' then
    select ay.id into v_year_id from public.lao_academic_years ay
    where ay.school_id=p_school_id order by ay.is_current desc,ay.year_be desc limit 1;

    case p_step_code
      when 'periods' then return v_year_id is not null and exists(select 1 from public.lao_terms where academic_year_id=v_year_id);
      when 'programs' then return exists(select 1 from public.lao_academic_programs where school_id=p_school_id and is_active);
      when 'classes' then return v_year_id is not null and exists(select 1 from public.lao_class_sections where school_id=p_school_id and academic_year_id=v_year_id and is_active and source_type='lec');
      when 'subjects' then return exists(select 1 from public.lao_subjects where school_id=p_school_id and is_active);
      when 'curriculum' then return v_year_id is not null and exists(select 1 from public.lao_curriculum_courses where school_id=p_school_id and academic_year_id=v_year_id and is_active);
      when 'workload' then return v_year_id is not null and exists(select 1 from public.lao_teaching_workloads where school_id=p_school_id and academic_year_id=v_year_id and status<>'cancelled');
      when 'workload_review' then return v_year_id is null or not exists(select 1 from public.lao_teaching_workloads where school_id=p_school_id and academic_year_id=v_year_id and status='submitted');
      else return false;
    end case;
  end if;
  return false;
end;
$$;

revoke all on function public.lao_department_setup_step_is_done(uuid,text,text) from public,anon;
grant execute on function public.lao_department_setup_step_is_done(uuid,text,text) to authenticated;

-- 0077_strict_edit_approve_permission_alignment.sql
-- Keep edit and approval responsibilities separate across Academic workflow.
-- School Admin remains allowed through lao_has_work_permission().

begin;

-- Normalize the legacy compatibility gate to the scoped permission model used
-- by the source migrations. Public wrappers must validate the exact scope first.
create or replace function public.lao_can_manage_academic(p_school_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_scope text:=nullif(current_setting('lao.work_scope_override',true),'');
begin
  if public.lao_is_local_school_admin(p_school_id) then
    return true;
  end if;
  if v_scope is null or (v_scope<>'academics' and v_scope not like 'academics.%') then
    return false;
  end if;
  return public.lao_has_work_permission(p_school_id,v_scope,'edit')
    or public.lao_has_work_permission(p_school_id,v_scope,'approve');
end;
$function$;

-- Curriculum confirmation is an approval action. Edit-only users can prepare
-- the structure but cannot confirm it.
create or replace function public.lao_confirm_curriculum_group(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(
    p_school_id,'academics.subjects','approve'
  ) then
    raise exception 'ไม่มีสิทธิ์ยืนยันโครงสร้างหลักสูตร';
  end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_confirm_curriculum_group_base_v01914(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
end;
$function$;

-- Timeline management (confirm reuse / skip / resume) changes annual setup
-- state and therefore requires edit authority, not approval-only authority.
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

    v_can_manage_step:=public.lao_has_work_permission(
      p_school_id,v_scope,'edit'
    );
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
      'can_manage_workload',
        public.lao_has_work_permission(p_school_id,'academics.workload','edit')
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

  if not public.lao_has_work_permission(p_school_id,v_scope,'edit') then
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

-- Viewing all teaching loads is allowed to School Admin, explicit workload
-- viewers/editors/approvers, school executives and registrars. It never grants
-- edit or approval by itself.
create or replace function public.lao_can_view_all_teaching_workload(
  p_school_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public
as $function$
  select public.lao_is_local_school_admin(p_school_id)
  or public.lao_has_work_permission(p_school_id,'academics.workload','view')
  or public.lao_has_work_permission(p_school_id,'academics.workload','edit')
  or public.lao_has_work_permission(p_school_id,'academics.workload','approve')
  or exists(
    select 1
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid())
      and m.status='active'
      and m.school_id=p_school_id
      and r.code in ('school_executive','registrar')
  );
$function$;

create or replace function public.lao_academic_work_counts(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_can_edit boolean:=false;
  v_can_approve boolean:=false;
  v_own uuid;
  v_pending integer:=0;
  v_returned integer:=0;
begin
  if v_uid is null or p_school_id is null or not public.lao_can_view_academic(p_school_id) then
    return jsonb_build_object(
      'can_manage',false,'can_approve',false,
      'pending_teaching_workloads',0,'my_returned_workloads',0,'attention_count',0
    );
  end if;

  v_can_edit:=public.lao_has_work_permission(
    p_school_id,'academics.workload','edit'
  );
  v_can_approve:=public.lao_has_work_permission(
    p_school_id,'academics.workload','approve'
  );
  v_own:=public.lao_my_personnel_id(p_school_id);

  if v_can_approve then
    select count(*) into v_pending
    from public.lao_teaching_workloads
    where school_id=p_school_id and status='submitted';
  end if;

  if v_own is not null then
    select count(*) into v_returned
    from public.lao_teaching_workloads
    where school_id=p_school_id
      and personnel_id=v_own
      and status='returned';
  end if;

  return jsonb_build_object(
    'can_manage',v_can_edit,
    'can_approve',v_can_approve,
    'pending_teaching_workloads',v_pending,
    'my_returned_workloads',v_returned,
    'attention_count',v_pending+v_returned
  );
end;
$function$;

create or replace function public.lao_teaching_workload_page(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_term_id uuid default null,
  p_status text default null,
  p_personnel_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $function$
declare
  v_can_edit boolean;
  v_can_approve boolean;
  v_can_view_all boolean;
  v_result jsonb;
begin
  v_can_edit:=public.lao_has_work_permission(
    p_school_id,'academics.workload','edit'
  );
  v_can_approve:=public.lao_has_work_permission(
    p_school_id,'academics.workload','approve'
  );
  v_can_view_all:=public.lao_can_view_all_teaching_workload(p_school_id);

  if v_can_edit or v_can_approve then
    perform set_config('lao.work_scope_override','academics.workload',true);
  end if;

  v_result:=public.lao_teaching_workload_page_base_v01914_scope(
    p_school_id,p_academic_year_id,p_term_id,p_status,p_personnel_id
  );

  return v_result||jsonb_build_object(
    'can_manage',v_can_edit,
    'can_approve',v_can_approve,
    'can_view_all',v_can_view_all
  );
end;
$function$;

create or replace function public.lao_save_teaching_workload(
  p_school_id uuid,
  p_workload_id uuid default null,
  p_personnel_id uuid default null,
  p_term_id uuid default null,
  p_note text default null,
  p_items jsonb default '[]'::jsonb,
  p_action text default 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_own uuid;
  v_can_edit boolean:=false;
  v_can_approve boolean:=false;
  v_result jsonb;
  v_id uuid;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  v_own:=public.lao_my_personnel_id(p_school_id);
  v_can_edit:=public.lao_has_work_permission(
    p_school_id,'academics.workload','edit'
  );
  v_can_approve:=public.lao_has_work_permission(
    p_school_id,'academics.workload','approve'
  );

  if p_action='approve' then
    if not v_can_approve then
      raise exception 'ไม่มีสิทธิ์อนุมัติภาระงานสอน';
    end if;
    perform set_config('lao.work_scope_override','academics.workload',true);
  elsif v_can_edit then
    perform set_config('lao.work_scope_override','academics.workload',true);
  elsif p_personnel_id is not null and p_personnel_id is distinct from v_own then
    raise exception 'ไม่มีสิทธิ์จัดภาระงานให้บุคลากรอื่น';
  end if;

  v_result:=public.lao_save_teaching_workload_base_v01914_scope(
    p_school_id,p_workload_id,p_personnel_id,p_term_id,p_note,p_items,p_action
  );

  if p_action='submit' then
    v_id:=nullif(v_result->>'id','')::uuid;
    select organization_id into v_org
    from public.lao_schools where id=p_school_id;

    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    select distinct
      a.user_id,v_org,p_school_id,'teaching_workload_submitted',
      'มีภาระงานสอนรอตรวจสอบ',
      'มีภาระงานสอนส่งเข้าระบบและรอการตรวจสอบ',
      'teaching_workload',v_id::text
    from public.lao_work_authorities a
    where a.school_id=p_school_id
      and a.is_active
      and a.user_id<>v_uid
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
      and a.can_approve
      and (a.scope_code='academics' or a.scope_code='academics.workload')
      and exists(
        select 1 from public.lao_memberships m
        where m.user_id=a.user_id
          and m.school_id=p_school_id
          and m.status='active'
      )
      and not exists(
        select 1 from public.lao_notifications n
        where n.user_id=a.user_id
          and n.notification_type='teaching_workload_submitted'
          and n.entity_type='teaching_workload'
          and n.entity_id=v_id::text
      );
  end if;

  return v_result;
end;
$function$;

create or replace function public.lao_review_teaching_workload(
  p_workload_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id
  from public.lao_teaching_workloads
  where id=p_workload_id;

  if v_school_id is null then raise exception 'ไม่พบภาระงานสอน'; end if;
  if not public.lao_has_work_permission(
    v_school_id,'academics.workload','approve'
  ) then
    raise exception 'ไม่มีสิทธิ์อนุมัติ/ส่งกลับภาระงานสอน';
  end if;

  perform set_config('lao.work_scope_override','academics.workload',true);
  return public.lao_review_teaching_workload_base_v01914_scope(
    p_workload_id,p_decision,p_review_note
  );
end;
$function$;

revoke all on function public.lao_can_manage_academic(uuid) from public,anon;
grant execute on function public.lao_can_manage_academic(uuid) to authenticated;
revoke all on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid) to authenticated;
revoke all on function public.lao_update_academic_year_setup_step(uuid,uuid,text,text) from public,anon;
grant execute on function public.lao_update_academic_year_setup_step(uuid,uuid,text,text) to authenticated;
revoke all on function public.lao_can_view_all_teaching_workload(uuid) from public,anon;
grant execute on function public.lao_can_view_all_teaching_workload(uuid) to authenticated;
revoke all on function public.lao_academic_work_counts(uuid) from public,anon;
grant execute on function public.lao_academic_work_counts(uuid) to authenticated;
revoke all on function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid) to authenticated;
revoke all on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) from public,anon;
grant execute on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) to authenticated;
revoke all on function public.lao_review_teaching_workload(uuid,text,text) from public,anon;
grant execute on function public.lao_review_teaching_workload(uuid,text,text) to authenticated;

commit;

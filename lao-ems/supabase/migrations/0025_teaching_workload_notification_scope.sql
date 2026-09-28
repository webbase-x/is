-- Align teaching workload submission notifications with school-level reviewers only.\n\ncreate or replace function public.lao_save_teaching_workload(
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
as $$
declare
  v_uid uuid := (select auth.uid());
  v_manage boolean;
  v_own uuid;
  v_personnel uuid;
  v_year uuid;
  v_org uuid;
  v_id uuid;
  v_status text;
  v_existing_status text;
  v_source text;
  v_item jsonb;
  v_course uuid;
  v_class uuid;
  v_periods numeric;
  v_role text;
  v_order integer := 0;
  v_name text;
  v_target_user uuid;
  v_subject text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_action not in ('draft','submit','approve') then raise exception 'Invalid action'; end if;

  v_manage:=public.lao_can_manage_academic(p_school_id);
  v_own:=public.lao_my_personnel_id(p_school_id);
  v_personnel:=coalesce(p_personnel_id,v_own);

  if v_personnel is null then
    raise exception 'ยังไม่พบบัญชีที่เชื่อมกับทะเบียนบุคลากร กรุณาติดต่อฝ่ายบุคลากร';
  end if;

  if not v_manage and v_personnel is distinct from v_own then
    raise exception 'Access denied';
  end if;

  if p_action='approve' and not v_manage then
    raise exception 'เฉพาะ School Admin หรือฝ่ายวิชาการเท่านั้นที่จัดภาระงานโดยตรงได้';
  end if;

  select p.id,concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),pa.user_id
  into v_personnel,v_name,v_target_user
  from public.lao_personnel p
  left join public.lao_personnel_accounts pa on pa.personnel_id=p.id
  where p.id=v_personnel and p.school_id=p_school_id and p.employment_status='active';
  if v_personnel is null then raise exception 'ไม่พบบุคลากรที่ใช้งานอยู่ในโรงเรียนนี้'; end if;

  select ay.id,s.organization_id into v_year,v_org
  from public.lao_terms t
  join public.lao_academic_years ay on ay.id=t.academic_year_id
  join public.lao_schools s on s.id=ay.school_id
  where t.id=p_term_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'ไม่พบภาคเรียนที่เลือก'; end if;

  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then
    raise exception 'กรุณาเพิ่มภาระงานสอนอย่างน้อย 1 รายการ';
  end if;

  if p_workload_id is not null then
    select w.id,w.status,w.source_type into v_id,v_existing_status,v_source
    from public.lao_teaching_workloads w
    where w.id=p_workload_id and w.school_id=p_school_id and w.term_id=p_term_id and w.personnel_id=v_personnel
    for update;
    if v_id is null then raise exception 'ไม่พบรายการภาระงานสอน'; end if;
  else
    select w.id,w.status,w.source_type into v_id,v_existing_status,v_source
    from public.lao_teaching_workloads w
    where w.school_id=p_school_id and w.term_id=p_term_id and w.personnel_id=v_personnel
    for update;
  end if;

  if not v_manage and v_id is not null and v_existing_status not in ('draft','returned') then
    raise exception 'รายการที่ส่งตรวจหรืออนุมัติแล้วไม่สามารถแก้ไขได้';
  end if;

  v_status:=case p_action when 'submit' then 'submitted' when 'approve' then 'approved' else 'draft' end;

  if v_id is null then
    v_source:=case when v_manage and p_action='approve' then 'academic_assignment' else 'teacher_proposal' end;
    insert into public.lao_teaching_workloads(
      school_id,academic_year_id,term_id,personnel_id,source_type,status,note,
      submitted_at,reviewed_at,reviewed_by,created_by,updated_by
    ) values(
      p_school_id,v_year,p_term_id,v_personnel,v_source,v_status,nullif(btrim(p_note),''),
      case when p_action='submit' then now() else null end,
      case when p_action='approve' then now() else null end,
      case when p_action='approve' then v_uid else null end,
      v_uid,v_uid
    ) returning id into v_id;
  else
    if v_manage and p_action='approve' and v_existing_status in ('draft','returned') and v_source='teacher_proposal' then
      v_source:='teacher_proposal';
    elsif v_manage and p_action='approve' and v_source is null then
      v_source:='academic_assignment';
    end if;

    update public.lao_teaching_workloads
    set academic_year_id=v_year,
        source_type=v_source,
        status=v_status,
        note=nullif(btrim(p_note),''),
        review_note=case when p_action in ('submit','approve') then null else review_note end,
        submitted_at=case when p_action='submit' then now() else submitted_at end,
        reviewed_at=case when p_action='approve' then now() when p_action='submit' then null else reviewed_at end,
        reviewed_by=case when p_action='approve' then v_uid when p_action='submit' then null else reviewed_by end,
        updated_by=v_uid
    where id=v_id;
  end if;

  delete from public.lao_teaching_workload_items where workload_id=v_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_order:=v_order+1;
    v_course:=nullif(v_item->>'course_id','')::uuid;
    v_class:=nullif(v_item->>'class_section_id','')::uuid;
    v_periods:=nullif(v_item->>'weekly_periods','')::numeric;
    v_role:=coalesce(nullif(v_item->>'teaching_role',''),'main');

    if v_course is null or v_class is null then raise exception 'ข้อมูลรายวิชาหรือชั้นเรียนไม่ครบ'; end if;
    if v_periods is null or v_periods<=0 then raise exception 'คาบต่อสัปดาห์ต้องมากกว่า 0'; end if;
    if v_role not in ('main','co_teacher','support') then raise exception 'บทบาทการสอนไม่ถูกต้อง'; end if;

    select s.name_th into v_subject
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    join public.lao_class_sections cs on cs.id=v_class
    where c.id=v_course
      and c.school_id=p_school_id and c.academic_year_id=v_year and c.is_active
      and cs.school_id=p_school_id and cs.academic_year_id=v_year and cs.is_active
      and lower(btrim(c.grade_label))=lower(btrim(cs.grade_label))
      and (c.program_id is null or c.program_id=cs.program_id);
    if v_subject is null then
      raise exception 'รายวิชาและชั้นเรียนที่เลือกไม่ตรงกับโครงสร้างวิชาการ';
    end if;

    insert into public.lao_teaching_workload_items(
      workload_id,course_id,class_section_id,weekly_periods,teaching_role,notes,sort_order,created_by,updated_by
    ) values(
      v_id,v_course,v_class,v_periods,v_role,nullif(btrim(v_item->>'notes'),''),v_order,v_uid,v_uid
    );
  end loop;

  if p_action='submit' then
    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    select distinct recipient,v_org,p_school_id,'teaching_workload_submitted',
      'มีภาระงานสอนรอตรวจสอบ',
      v_name||' ส่งภาระงานสอนเพื่อรอการตรวจสอบ',
      'teaching_workload',v_id::text
    from (
      select m.user_id as recipient
      from public.lao_memberships m
      join public.lao_membership_roles mr on mr.membership_id=m.id
      join public.lao_roles r on r.id=mr.role_id
      where m.school_id=p_school_id and m.status='active'
        and r.code in ('school_admin','academic_officer')
    ) x;
  elsif p_action='approve' and v_target_user is not null and v_target_user<>v_uid then
    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    ) values(
      v_target_user,v_org,p_school_id,'teaching_workload_approved',
      'ภาระงานสอนได้รับการอนุมัติแล้ว',
      'ฝ่ายวิชาการบันทึก/อนุมัติภาระงานสอนของคุณเรียบร้อยแล้ว',
      'teaching_workload',v_id::text
    );
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case p_action when 'submit' then 'teaching_workload_submitted' when 'approve' then 'teaching_workload_approved' else 'teaching_workload_saved' end,
    'teaching_workload',v_id::text,
    jsonb_build_object(
      'personnel_id',v_personnel,'term_id',p_term_id,'status',v_status,'source_type',v_source,
      'item_count',jsonb_array_length(p_items)
    )
  );

  return jsonb_build_object('id',v_id,'status',v_status,'personnel_id',v_personnel,'term_id',p_term_id);
exception
  when unique_violation then
    raise exception 'มีรายวิชาและชั้นเรียนซ้ำในภาระงานสอน กรุณาตรวจรายการอีกครั้ง';
end;
$$;

revoke all on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) from public,anon;
grant execute on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) to authenticated;\n
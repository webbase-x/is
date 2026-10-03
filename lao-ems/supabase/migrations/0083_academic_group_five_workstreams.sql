-- 0083_academic_group_five_workstreams.sql
-- Organize the existing academic permission model into five work groups without
-- introducing a second membership/permission source.

begin;

-- The department stays "academics"; only the presentation title becomes the
-- school-facing name used throughout My Workspace.
update public.lao_work_scopes
set title_th='กลุ่มบริหารงานวิชาการ',
    route='#/academic-group',
    updated_at=now()
where scope_code='academics';

insert into public.lao_work_scopes(
  scope_code,department_code,work_code,section_code,title_th,parent_scope_code,route,sort_order,is_active
) values
  ('academics.curriculum','academics','curriculum',null,'งานบริหารและพัฒนาหลักสูตรสถานศึกษา','academics',null,110,true),
  ('academics.curriculum.review','academics','curriculum','review','ประเมินและปรับปรุงการใช้หลักสูตร','academics.curriculum',null,115,true),

  ('academics.learning','academics','learning',null,'งานจัดการเรียนรู้และการนิเทศ','academics',null,120,true),
  ('academics.calendar','academics','learning','calendar','ปฏิทินวิชาการ','academics.learning',null,122,true),
  ('academics.timetable','academics','learning','timetable','ตารางสอน','academics.learning',null,123,true),
  ('academics.lesson_plans','academics','learning','lesson_plans','แผนการจัดการเรียนรู้','academics.learning',null,124,true),
  ('academics.active_learning','academics','learning','active_learning','Active Learning','academics.learning',null,125,true),
  ('academics.supervision','academics','learning','supervision','นิเทศภายใน / สังเกตชั้นเรียน','academics.learning',null,126,true),
  ('academics.plc','academics','learning','plc','PLC','academics.learning',null,127,true),

  ('academics.media','academics','media',null,'งานสื่อ นวัตกรรม และเทคโนโลยีทางการศึกษา','academics',null,130,true),
  ('academics.media.resources','academics','media','resources','สื่อการเรียนรู้','academics.media',null,131,true),
  ('academics.media.innovation','academics','media','innovation','นวัตกรรม / Gamification / Web Application','academics.media',null,132,true),
  ('academics.media.quality','academics','media','quality','การประเมินคุณภาพสื่อ','academics.media',null,133,true),
  ('academics.media.textbooks','academics','media','textbooks','หนังสือเรียน','academics.media',null,134,true),
  ('academics.media.library_labs','academics','media','library_labs','ห้องสมุด / ห้องปฏิบัติการ','academics.media',null,135,true),
  ('academics.media.local_sources','academics','media','local_sources','แหล่งเรียนรู้และภูมิปัญญาท้องถิ่น','academics.media',null,136,true),

  ('academics.assessment.rules','academics','assessment','rules','ระเบียบและเกณฑ์วัดผล','academics.assessment',null,141,true),
  ('academics.assessment.scores','academics','assessment','scores','คะแนน / ผลการเรียน','academics.assessment',null,142,true),
  ('academics.assessment.exams','academics','assessment','exams','สอบกลางภาค / ปลายภาค','academics.assessment',null,143,true),
  ('academics.assessment.promotion','academics','assessment','promotion','เลื่อนชั้น / จบการศึกษา','academics.assessment',null,144,true),
  ('academics.assessment.pp','academics','assessment','pp','ปพ.1–ปพ.9','academics.assessment',null,145,true),
  ('academics.assessment.records','academics','assessment','records','ระเบียนผลการเรียน','academics.assessment',null,146,true),
  ('academics.assessment.transfer','academics','assessment','transfer','เทียบโอนผลการเรียน','academics.assessment',null,147,true),

  ('academics.research','academics','research',null,'งานวิจัยและประเมินคุณภาพการศึกษา','academics',null,150,true),
  ('academics.research.classroom','academics','research','classroom','วิจัยในชั้นเรียน','academics.research',null,151,true),
  ('academics.research.innovation','academics','research','innovation','นวัตกรรมเพื่อแก้ปัญหาผู้เรียน','academics.research',null,152,true),
  ('academics.research.national_tests','academics','research','national_tests','วิเคราะห์ RT / NT / O-NET','academics.research',null,153,true),
  ('academics.research.statistics','academics','research','statistics','วิเคราะห์สถิติผลสัมฤทธิ์','academics.research',null,154,true),
  ('academics.research.strengths','academics','research','strengths','สรุปจุดแข็ง/จุดที่ต้องพัฒนา','academics.research',null,155,true),
  ('academics.research.planning','academics','research','planning','ใช้ข้อมูลเพื่อวางแผนปีการศึกษาถัดไป','academics.research',null,156,true)
on conflict(scope_code) do update set
  department_code=excluded.department_code,
  work_code=excluded.work_code,
  section_code=excluded.section_code,
  title_th=excluded.title_th,
  parent_scope_code=excluded.parent_scope_code,
  route=coalesce(excluded.route,lao_work_scopes.route),
  sort_order=excluded.sort_order,
  is_active=excluded.is_active,
  updated_at=now();

-- Existing operational scopes remain the same codes so current RPCs and data
-- keep working; only their parent work group changes.
update public.lao_work_scopes
set parent_scope_code='academics.curriculum', sort_order=111, updated_at=now()
where scope_code='academics.basic_settings';

update public.lao_work_scopes
set parent_scope_code='academics.curriculum', sort_order=112, updated_at=now()
where scope_code='academics.programs';

update public.lao_work_scopes
set parent_scope_code='academics.curriculum', sort_order=113, updated_at=now()
where scope_code='academics.classes';

update public.lao_work_scopes
set parent_scope_code='academics.curriculum', sort_order=114, updated_at=now()
where scope_code='academics.subjects';

update public.lao_work_scopes
set parent_scope_code='academics.learning', sort_order=121, updated_at=now()
where scope_code='academics.workload';

update public.lao_work_scopes
set title_th='งานวัดผล ประเมินผล และงานทะเบียน',
    parent_scope_code='academics',
    sort_order=140,
    route='#/assessment',
    updated_at=now()
where scope_code='academics.assessment';

-- Permission inheritance follows the stored scope hierarchy. This keeps all
-- existing scope codes valid while allowing a work head to be assigned once at
-- a work-group node and delegate only within descendants of that node.
create or replace function public.lao_has_work_permission(
  p_school_id uuid,
  p_scope_code text,
  p_permission text default 'view'
)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
begin
  if v_uid is null or p_school_id is null or nullif(btrim(p_scope_code),'') is null then
    return false;
  end if;
  if p_permission not in ('view','edit','approve','delegate') then
    return false;
  end if;

  if public.lao_is_local_school_admin(p_school_id) then
    return true;
  end if;

  return exists(
    with recursive lineage(scope_code,parent_scope_code) as (
      select s.scope_code,s.parent_scope_code
      from public.lao_work_scopes s
      where s.scope_code=p_scope_code
      union all
      select p.scope_code,p.parent_scope_code
      from public.lao_work_scopes p
      join lineage c on c.parent_scope_code=p.scope_code
    )
    select 1
    from public.lao_work_authorities a
    where a.school_id=p_school_id
      and a.user_id=v_uid
      and a.is_active
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
      and (
        a.scope_code in (select scope_code from lineage)
        or p_scope_code like a.scope_code||'.%'
      )
      and case p_permission
        when 'view' then a.can_view
        when 'edit' then a.can_edit
        when 'approve' then a.can_approve
        when 'delegate' then a.can_delegate
        else false
      end
  );
end;
$function$;

revoke all on function public.lao_has_work_permission(uuid,text,text) from public,anon;
grant execute on function public.lao_has_work_permission(uuid,text,text) to authenticated;

-- Expose the current user's visible academic scopes for the group landing page.
-- This reads from the same delegation source used everywhere else.
create or replace function public.lao_academic_group_access(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
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

-- Tighten the existing delegation write path: every permission flag, including
-- view, must be inside the delegator's own effective scope.
create or replace function public.lao_save_work_authority(
  p_school_id uuid,
  p_personnel_id uuid,
  p_scope_code text,
  p_authority_role text default 'delegate',
  p_can_view boolean default true,
  p_can_edit boolean default false,
  p_can_approve boolean default false,
  p_can_delegate boolean default false,
  p_starts_on date default null,
  p_ends_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_target_user uuid;
  v_org uuid;
  v_local_admin boolean:=false;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_authority_role not in ('department_head','work_head','delegate') then
    raise exception 'รูปแบบผู้รับผิดชอบไม่ถูกต้อง';
  end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;
  if not exists(select 1 from public.lao_work_scopes where scope_code=p_scope_code and is_active) then
    raise exception 'ไม่พบส่วนงานที่เลือก';
  end if;

  select pa.user_id into v_target_user
  from public.lao_personnel p
  join public.lao_personnel_accounts pa on pa.personnel_id=p.id and pa.school_id=p_school_id
  where p.id=p_personnel_id and p.school_id=p_school_id and p.employment_status='active';
  if v_target_user is null then
    raise exception 'บุคลากรต้องเชื่อมบัญชีผู้ใช้ก่อนจึงจะมอบหมายสิทธิ์ได้';
  end if;

  v_local_admin:=public.lao_is_local_school_admin(p_school_id);
  if not v_local_admin then
    if not public.lao_has_work_permission(p_school_id,p_scope_code,'delegate') then
      raise exception 'ไม่มีสิทธิ์มอบหมายส่วนงานนี้';
    end if;
    if p_authority_role='department_head' then
      raise exception 'หัวหน้ากลุ่มต้องแต่งตั้งโดย School Admin';
    end if;
    if coalesce(p_can_view,true) and not public.lao_has_work_permission(p_school_id,p_scope_code,'view') then
      raise exception 'ไม่สามารถมอบสิทธิ์ดูเกินกว่าสิทธิ์ของตนเอง';
    end if;
    if coalesce(p_can_edit,false) and not public.lao_has_work_permission(p_school_id,p_scope_code,'edit') then
      raise exception 'ไม่สามารถมอบสิทธิ์แก้ไขเกินกว่าสิทธิ์ของตนเอง';
    end if;
    if coalesce(p_can_approve,false) and not public.lao_has_work_permission(p_school_id,p_scope_code,'approve') then
      raise exception 'ไม่สามารถมอบสิทธิ์อนุมัติเกินกว่าสิทธิ์ของตนเอง';
    end if;
    if coalesce(p_can_delegate,false) and not public.lao_has_work_permission(p_school_id,p_scope_code,'delegate') then
      raise exception 'ไม่สามารถมอบสิทธิ์มอบหมายต่อเกินกว่าสิทธิ์ของตนเอง';
    end if;
  end if;

  insert into public.lao_work_authorities(
    school_id,personnel_id,user_id,scope_code,authority_role,
    can_view,can_edit,can_approve,can_delegate,is_active,
    starts_on,ends_on,assigned_by
  ) values(
    p_school_id,p_personnel_id,v_target_user,p_scope_code,p_authority_role,
    coalesce(p_can_view,true),coalesce(p_can_edit,false),coalesce(p_can_approve,false),coalesce(p_can_delegate,false),true,
    p_starts_on,p_ends_on,v_uid
  )
  on conflict(school_id,user_id,scope_code) do update set
    personnel_id=excluded.personnel_id,
    authority_role=excluded.authority_role,
    can_view=excluded.can_view,
    can_edit=excluded.can_edit,
    can_approve=excluded.can_approve,
    can_delegate=excluded.can_delegate,
    is_active=true,
    starts_on=excluded.starts_on,
    ends_on=excluded.ends_on,
    assigned_by=v_uid,
    updated_at=now()
  returning id into v_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'work_authority_saved','work_authority',v_id::text,
    jsonb_build_object(
      'personnel_id',p_personnel_id,'user_id',v_target_user,'scope_code',p_scope_code,
      'authority_role',p_authority_role,'can_view',p_can_view,'can_edit',p_can_edit,
      'can_approve',p_can_approve,'can_delegate',p_can_delegate,
      'starts_on',p_starts_on,'ends_on',p_ends_on
    )
  );

  return jsonb_build_object('id',v_id,'scope_code',p_scope_code,'user_id',v_target_user);
end;
$function$;

revoke all on function public.lao_save_work_authority(uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date) from public,anon;
grant execute on function public.lao_save_work_authority(uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date) to authenticated;

commit;

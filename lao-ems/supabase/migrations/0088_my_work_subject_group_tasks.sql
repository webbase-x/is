-- 0088_my_work_subject_group_tasks.sql
-- General-user "My Work": subject-group membership from approved teaching workload,
-- subject-group heads from existing scoped authorities, and auditable member task workflow.

begin;

insert into public.lao_work_scopes(
  scope_code,department_code,work_code,section_code,title_th,parent_scope_code,route,sort_order,is_active
) values
  ('academics.subject_groups','academics','subject_groups',null,'งานกลุ่มสาระการเรียนรู้','academics','#/teacher-work/subject-group',140,true),
  ('academics.subject_groups.thai','academics','subject_groups','thai','กลุ่มสาระการเรียนรู้ภาษาไทย','academics.subject_groups','#/teacher-work/subject-group',141,true),
  ('academics.subject_groups.math','academics','subject_groups','math','กลุ่มสาระการเรียนรู้คณิตศาสตร์','academics.subject_groups','#/teacher-work/subject-group',142,true),
  ('academics.subject_groups.science','academics','subject_groups','science','กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี','academics.subject_groups','#/teacher-work/subject-group',143,true),
  ('academics.subject_groups.social','academics','subject_groups','social','กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม','academics.subject_groups','#/teacher-work/subject-group',144,true),
  ('academics.subject_groups.health_pe','academics','subject_groups','health_pe','กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา','academics.subject_groups','#/teacher-work/subject-group',145,true),
  ('academics.subject_groups.arts','academics','subject_groups','arts','กลุ่มสาระการเรียนรู้ศิลปะ','academics.subject_groups','#/teacher-work/subject-group',146,true),
  ('academics.subject_groups.career','academics','subject_groups','career','กลุ่มสาระการเรียนรู้การงานอาชีพ','academics.subject_groups','#/teacher-work/subject-group',147,true),
  ('academics.subject_groups.foreign_language','academics','subject_groups','foreign_language','กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ','academics.subject_groups','#/teacher-work/subject-group',148,true),
  ('academics.subject_groups.learner_activities','academics','subject_groups','learner_activities','กิจกรรมพัฒนาผู้เรียน','academics.subject_groups','#/teacher-work/subject-group',149,true)
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

create table if not exists public.lao_subject_group_tasks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  learning_area text not null,
  title text not null,
  details text,
  assigned_to uuid not null references public.lao_personnel(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  due_on date,
  status text not null default 'assigned'
    check(status in ('assigned','in_progress','submitted','returned','confirmed','cancelled')),
  submission_note text,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lao_subject_group_tasks_area_idx
  on public.lao_subject_group_tasks(school_id,academic_year_id,learning_area,status,due_on);
create index if not exists lao_subject_group_tasks_assigned_idx
  on public.lao_subject_group_tasks(assigned_to,status,due_on);

drop trigger if exists lao_subject_group_tasks_touch on public.lao_subject_group_tasks;
create trigger lao_subject_group_tasks_touch
before update on public.lao_subject_group_tasks
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_subject_group_task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.lao_subject_group_tasks(id) on delete cascade,
  action text not null
    check(action in ('assigned','reassigned','started','submitted','returned','confirmed','cancelled')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  note text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists lao_subject_group_task_history_task_idx
  on public.lao_subject_group_task_history(task_id,created_at desc);

alter table public.lao_subject_group_tasks enable row level security;
alter table public.lao_subject_group_task_history enable row level security;

revoke all on table public.lao_subject_group_tasks from public,anon,authenticated;
revoke all on table public.lao_subject_group_task_history from public,anon,authenticated;

create or replace function public.lao_subject_group_scope_code(p_learning_area text)
returns text
language sql
immutable
security invoker
set search_path=''
as $function$
  select case btrim(coalesce(p_learning_area,''))
    when 'ภาษาไทย' then 'academics.subject_groups.thai'
    when 'คณิตศาสตร์' then 'academics.subject_groups.math'
    when 'วิทยาศาสตร์และเทคโนโลยี' then 'academics.subject_groups.science'
    when 'สังคมศึกษา ศาสนา และวัฒนธรรม' then 'academics.subject_groups.social'
    when 'สุขศึกษาและพลศึกษา' then 'academics.subject_groups.health_pe'
    when 'ศิลปะ' then 'academics.subject_groups.arts'
    when 'การงานอาชีพ' then 'academics.subject_groups.career'
    when 'ภาษาต่างประเทศ' then 'academics.subject_groups.foreign_language'
    when 'กิจกรรมพัฒนาผู้เรียน' then 'academics.subject_groups.learner_activities'
    else null
  end;
$function$;

revoke all on function public.lao_subject_group_scope_code(text) from public,anon,authenticated;

create or replace function public.lao_subject_group_learning_area(p_scope_code text)
returns text
language sql
immutable
security invoker
set search_path=''
as $function$
  select case btrim(coalesce(p_scope_code,''))
    when 'academics.subject_groups.thai' then 'ภาษาไทย'
    when 'academics.subject_groups.math' then 'คณิตศาสตร์'
    when 'academics.subject_groups.science' then 'วิทยาศาสตร์และเทคโนโลยี'
    when 'academics.subject_groups.social' then 'สังคมศึกษา ศาสนา และวัฒนธรรม'
    when 'academics.subject_groups.health_pe' then 'สุขศึกษาและพลศึกษา'
    when 'academics.subject_groups.arts' then 'ศิลปะ'
    when 'academics.subject_groups.career' then 'การงานอาชีพ'
    when 'academics.subject_groups.foreign_language' then 'ภาษาต่างประเทศ'
    when 'academics.subject_groups.learner_activities' then 'กิจกรรมพัฒนาผู้เรียน'
    else null
  end;
$function$;

revoke all on function public.lao_subject_group_learning_area(text) from public,anon,authenticated;

create or replace function public.lao_subject_group_explicit_authority(
  p_school_id uuid,
  p_learning_area text
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  with x as (
    select
      coalesce(bool_or(a.authority_role='work_head'),false) as is_head,
      coalesce(bool_or(a.can_view),false) as can_view,
      coalesce(bool_or(a.can_edit),false) as can_edit,
      coalesce(bool_or(a.can_approve),false) as can_approve,
      coalesce(bool_or(a.can_delegate),false) as can_delegate
    from public.lao_work_authorities a
    where a.school_id=p_school_id
      and a.user_id=(select auth.uid())
      and a.scope_code=public.lao_subject_group_scope_code(p_learning_area)
      and a.is_active
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
  )
  select jsonb_build_object(
    'is_head',x.is_head,
    'can_view',x.can_view,
    'can_edit',x.can_edit,
    'can_approve',x.can_approve,
    'can_delegate',x.can_delegate
  )
  from x;
$function$;

revoke all on function public.lao_subject_group_explicit_authority(uuid,text) from public,anon,authenticated;

create or replace function public.lao_subject_group_is_member(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_learning_area text,
  p_personnel_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1
    from public.lao_teaching_workloads w
    join public.lao_teaching_workload_items wi on wi.workload_id=w.id
    join public.lao_curriculum_courses c on c.id=wi.course_id
    join public.lao_subjects s on s.id=c.subject_id
    where w.school_id=p_school_id
      and w.academic_year_id=p_academic_year_id
      and w.personnel_id=p_personnel_id
      and w.status='approved'
      and s.learning_area=p_learning_area
  );
$function$;

revoke all on function public.lao_subject_group_is_member(uuid,uuid,text,uuid) from public,anon,authenticated;

create or replace function public.lao_my_subject_group_workspace(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_learning_area text default null
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
  v_selected text;
  v_groups jsonb:='[]'::jsonb;
  v_detail jsonb:=null;
  v_auth jsonb;
  v_is_member boolean:=false;
  v_explicit_access boolean:=false;
  v_can_manage boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_own:=public.lao_my_personnel_id(p_school_id);
  if v_own is null then
    return jsonb_build_object(
      'selected_year_id',null,'years','[]'::jsonb,'groups','[]'::jsonb,'detail',null
    );
  end if;

  select ay.id into v_year
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
    and (p_academic_year_id is null or ay.id=p_academic_year_id)
  order by
    case when p_academic_year_id is not null and ay.id=p_academic_year_id then 0 else 1 end,
    ay.is_current desc,ay.year_be desc
  limit 1;

  if v_year is null then
    return jsonb_build_object(
      'selected_year_id',null,
      'years',coalesce((
        select jsonb_agg(jsonb_build_object('id',ay.id,'year_be',ay.year_be,'is_current',ay.is_current) order by ay.year_be desc)
        from public.lao_academic_years ay where ay.school_id=p_school_id
      ),'[]'::jsonb),
      'groups','[]'::jsonb,'detail',null
    );
  end if;

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
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'learning_area',aa.learning_area,
      'scope_code',public.lao_subject_group_scope_code(aa.learning_area),
      'is_member',public.lao_subject_group_is_member(p_school_id,v_year,aa.learning_area,v_own),
      'is_head',coalesce((public.lao_subject_group_explicit_authority(p_school_id,aa.learning_area)->>'is_head')::boolean,false),
      'can_delegate',coalesce((public.lao_subject_group_explicit_authority(p_school_id,aa.learning_area)->>'can_delegate')::boolean,false),
      'can_confirm',coalesce((public.lao_subject_group_explicit_authority(p_school_id,aa.learning_area)->>'can_approve')::boolean,false)
        or coalesce((public.lao_subject_group_explicit_authority(p_school_id,aa.learning_area)->>'is_head')::boolean,false),
      'member_count',(
        select count(distinct w.personnel_id)
        from public.lao_teaching_workloads w
        join public.lao_teaching_workload_items wi on wi.workload_id=w.id
        join public.lao_curriculum_courses c on c.id=wi.course_id
        join public.lao_subjects s on s.id=c.subject_id
        where w.school_id=p_school_id and w.academic_year_id=v_year
          and w.status='approved' and s.learning_area=aa.learning_area
      ),
      'pending_confirmations',(
        select count(*)
        from public.lao_subject_group_tasks t
        where t.school_id=p_school_id and t.academic_year_id=v_year
          and t.learning_area=aa.learning_area and t.status='submitted'
      ),
      'my_open_tasks',(
        select count(*)
        from public.lao_subject_group_tasks t
        where t.school_id=p_school_id and t.academic_year_id=v_year
          and t.learning_area=aa.learning_area and t.assigned_to=v_own
          and t.status in ('assigned','in_progress','returned')
      )
    )
    order by aa.learning_area
  ),'[]'::jsonb)
  into v_groups
  from all_areas aa;

  if p_learning_area is not null and exists(
    select 1 from jsonb_array_elements(v_groups) g where g->>'learning_area'=p_learning_area
  ) then
    v_selected:=p_learning_area;
  else
    select g->>'learning_area' into v_selected
    from jsonb_array_elements(v_groups) g
    order by
      case when coalesce((g->>'is_head')::boolean,false) then 0 else 1 end,
      g->>'learning_area'
    limit 1;
  end if;

  if v_selected is not null then
    v_auth:=public.lao_subject_group_explicit_authority(p_school_id,v_selected);
    v_is_member:=public.lao_subject_group_is_member(p_school_id,v_year,v_selected,v_own);
    v_explicit_access:=coalesce((v_auth->>'can_view')::boolean,false)
      or coalesce((v_auth->>'is_head')::boolean,false);
    v_can_manage:=coalesce((v_auth->>'can_delegate')::boolean,false)
      or coalesce((v_auth->>'is_head')::boolean,false)
      or public.lao_is_local_school_admin(p_school_id);

    if not v_is_member and not v_explicit_access then
      raise exception 'Access denied';
    end if;

    select jsonb_build_object(
      'learning_area',v_selected,
      'scope_code',public.lao_subject_group_scope_code(v_selected),
      'is_member',v_is_member,
      'is_head',coalesce((v_auth->>'is_head')::boolean,false),
      'can_delegate',v_can_manage,
      'can_confirm',coalesce((v_auth->>'can_approve')::boolean,false)
        or coalesce((v_auth->>'is_head')::boolean,false)
        or public.lao_is_local_school_admin(p_school_id),
      'members',coalesce((
        select jsonb_agg(m.payload order by m.full_name)
        from (
          select
            concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th) full_name,
            jsonb_build_object(
              'personnel_id',p.id,
              'full_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
              'position_title',p.position_title,
              'subject_count',count(distinct c.id),
              'class_count',count(distinct wi.class_section_id),
              'open_task_count',(
                select count(*) from public.lao_subject_group_tasks t
                where t.school_id=p_school_id and t.academic_year_id=v_year
                  and t.learning_area=v_selected and t.assigned_to=p.id
                  and t.status in ('assigned','in_progress','returned')
              ),
              'submitted_task_count',(
                select count(*) from public.lao_subject_group_tasks t
                where t.school_id=p_school_id and t.academic_year_id=v_year
                  and t.learning_area=v_selected and t.assigned_to=p.id
                  and t.status='submitted'
              )
            ) payload
          from public.lao_teaching_workloads w
          join public.lao_teaching_workload_items wi on wi.workload_id=w.id
          join public.lao_curriculum_courses c on c.id=wi.course_id
          join public.lao_subjects s on s.id=c.subject_id
          join public.lao_personnel p on p.id=w.personnel_id
          where w.school_id=p_school_id and w.academic_year_id=v_year
            and w.status='approved' and s.learning_area=v_selected
          group by p.id,p.prefix,p.first_name_th,p.last_name_th,p.position_title
        ) m
      ),'[]'::jsonb),
      'tasks',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',t.id,
          'title',t.title,
          'details',t.details,
          'assigned_to',t.assigned_to,
          'assigned_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
          'due_on',t.due_on,
          'status',t.status,
          'submission_note',t.submission_note,
          'review_note',t.review_note,
          'submitted_at',t.submitted_at,
          'reviewed_at',t.reviewed_at,
          'created_at',t.created_at,
          'is_mine',t.assigned_to=v_own
        ) order by
          case t.status when 'submitted' then 0 when 'returned' then 1 when 'assigned' then 2 when 'in_progress' then 3 when 'confirmed' then 4 else 5 end,
          t.due_on nulls last,t.created_at desc)
        from public.lao_subject_group_tasks t
        join public.lao_personnel p on p.id=t.assigned_to
        where t.school_id=p_school_id and t.academic_year_id=v_year
          and t.learning_area=v_selected
          and (v_can_manage or t.assigned_to=v_own)
          and t.status<>'cancelled'
      ),'[]'::jsonb),
      'stats',jsonb_build_object(
        'member_count',(
          select count(distinct w.personnel_id)
          from public.lao_teaching_workloads w
          join public.lao_teaching_workload_items wi on wi.workload_id=w.id
          join public.lao_curriculum_courses c on c.id=wi.course_id
          join public.lao_subjects s on s.id=c.subject_id
          where w.school_id=p_school_id and w.academic_year_id=v_year
            and w.status='approved' and s.learning_area=v_selected
        ),
        'submitted_count',(
          select count(*) from public.lao_subject_group_tasks t
          where t.school_id=p_school_id and t.academic_year_id=v_year
            and t.learning_area=v_selected and t.status='submitted'
        ),
        'my_open_count',(
          select count(*) from public.lao_subject_group_tasks t
          where t.school_id=p_school_id and t.academic_year_id=v_year
            and t.learning_area=v_selected and t.assigned_to=v_own
            and t.status in ('assigned','in_progress','returned')
        ),
        'confirmed_count',(
          select count(*) from public.lao_subject_group_tasks t
          where t.school_id=p_school_id and t.academic_year_id=v_year
            and t.learning_area=v_selected and t.status='confirmed'
        )
      )
    ) into v_detail;
  end if;

  return jsonb_build_object(
    'selected_year_id',v_year,
    'selected_learning_area',v_selected,
    'own_personnel_id',v_own,
    'years',coalesce((
      select jsonb_agg(jsonb_build_object('id',ay.id,'year_be',ay.year_be,'is_current',ay.is_current) order by ay.year_be desc)
      from public.lao_academic_years ay
      where ay.school_id=p_school_id
    ),'[]'::jsonb),
    'groups',v_groups,
    'detail',v_detail
  );
end;
$function$;

revoke all on function public.lao_my_subject_group_workspace(uuid,uuid,text) from public,anon;
grant execute on function public.lao_my_subject_group_workspace(uuid,uuid,text) to authenticated;

create or replace function public.lao_save_subject_group_task(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_learning_area text,
  p_assigned_to uuid,
  p_title text,
  p_details text default null,
  p_due_on date default null,
  p_task_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_scope text;
  v_auth jsonb;
  v_can_manage boolean:=false;
  v_task public.lao_subject_group_tasks%rowtype;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if btrim(coalesce(p_title,''))='' then raise exception 'กรุณาระบุชื่องาน'; end if;

  if not exists(
    select 1 from public.lao_academic_years ay
    where ay.id=p_academic_year_id and ay.school_id=p_school_id
  ) then raise exception 'ไม่พบปีการศึกษาที่เลือก'; end if;

  v_scope:=public.lao_subject_group_scope_code(p_learning_area);
  if v_scope is null then raise exception 'ไม่พบกลุ่มสาระที่เลือก'; end if;

  v_auth:=public.lao_subject_group_explicit_authority(p_school_id,p_learning_area);
  v_can_manage:=coalesce((v_auth->>'can_delegate')::boolean,false)
    or coalesce((v_auth->>'is_head')::boolean,false)
    or public.lao_is_local_school_admin(p_school_id);

  if not v_can_manage then raise exception 'เฉพาะหัวหน้ากลุ่มสาระหรือผู้มีสิทธิ์มอบหมายเท่านั้น'; end if;

  if not public.lao_subject_group_is_member(p_school_id,p_academic_year_id,p_learning_area,p_assigned_to) then
    raise exception 'บุคลากรที่เลือกไม่ได้เป็นสมาชิกกลุ่มสาระในปีการศึกษานี้';
  end if;

  if p_task_id is null then
    insert into public.lao_subject_group_tasks(
      school_id,academic_year_id,learning_area,title,details,assigned_to,assigned_by,due_on,status
    ) values(
      p_school_id,p_academic_year_id,p_learning_area,btrim(p_title),
      nullif(btrim(coalesce(p_details,'')),''),
      p_assigned_to,v_uid,p_due_on,'assigned'
    )
    returning * into v_task;

    insert into public.lao_subject_group_task_history(task_id,action,actor_user_id,note,snapshot)
    values(v_task.id,'assigned',v_uid,null,to_jsonb(v_task));
  else
    select * into v_task
    from public.lao_subject_group_tasks
    where id=p_task_id and school_id=p_school_id
    for update;

    if not found then raise exception 'ไม่พบงานที่เลือก'; end if;
    if v_task.learning_area<>p_learning_area or v_task.academic_year_id<>p_academic_year_id then
      raise exception 'ขอบเขตงานไม่ตรงกับกลุ่มสาระ/ปีการศึกษาที่เลือก';
    end if;
    if v_task.status not in ('assigned','returned') then
      raise exception 'แก้ไขได้เฉพาะงานที่ยังไม่ส่งตรวจหรือถูกส่งกลับ';
    end if;

    update public.lao_subject_group_tasks
    set title=btrim(p_title),
        details=nullif(btrim(coalesce(p_details,'')),''),
        assigned_to=p_assigned_to,
        due_on=p_due_on,
        status='assigned',
        review_note=null,
        submission_note=null,
        submitted_at=null,
        reviewed_at=null,
        reviewed_by=null
    where id=v_task.id
    returning * into v_task;

    insert into public.lao_subject_group_task_history(task_id,action,actor_user_id,note,snapshot)
    values(v_task.id,'reassigned',v_uid,null,to_jsonb(v_task));
  end if;

  select s.organization_id into v_org
  from public.lao_schools s where s.id=p_school_id;

  insert into public.lao_notifications(
    user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
  )
  select pa.user_id,v_org,p_school_id,'subject_group_task_assigned',
    'มีงานกลุ่มสาระที่ได้รับมอบหมาย',
    p_learning_area||' · '||v_task.title,
    'subject_group_task',v_task.id::text
  from public.lao_personnel_accounts pa
  where pa.school_id=p_school_id and pa.personnel_id=p_assigned_to
    and pa.user_id<>v_uid
    and not exists(
      select 1 from public.lao_notifications n
      where n.user_id=pa.user_id
        and n.notification_type='subject_group_task_assigned'
        and n.entity_type='subject_group_task'
        and n.entity_id=v_task.id::text
        and n.read_at is null
    );

  return jsonb_build_object('id',v_task.id,'status',v_task.status,'updated_at',v_task.updated_at);
end;
$function$;

revoke all on function public.lao_save_subject_group_task(uuid,uuid,text,uuid,text,text,date,uuid) from public,anon;
grant execute on function public.lao_save_subject_group_task(uuid,uuid,text,uuid,text,text,date,uuid) to authenticated;

create or replace function public.lao_subject_group_task_action(
  p_task_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_own uuid;
  v_task public.lao_subject_group_tasks%rowtype;
  v_auth jsonb;
  v_is_head boolean:=false;
  v_is_assignee boolean:=false;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_action not in ('start','submit','return','confirm','cancel') then raise exception 'Invalid action'; end if;

  select * into v_task
  from public.lao_subject_group_tasks
  where id=p_task_id
  for update;

  if not found then raise exception 'ไม่พบงานที่เลือก'; end if;

  v_own:=public.lao_my_personnel_id(v_task.school_id);
  v_auth:=public.lao_subject_group_explicit_authority(v_task.school_id,v_task.learning_area);
  v_is_head:=coalesce((v_auth->>'can_approve')::boolean,false)
    or coalesce((v_auth->>'can_delegate')::boolean,false)
    or coalesce((v_auth->>'is_head')::boolean,false)
    or public.lao_is_local_school_admin(v_task.school_id);
  v_is_assignee:=v_own is not null and v_task.assigned_to=v_own;

  if p_action='start' then
    if not v_is_assignee then raise exception 'เฉพาะผู้ได้รับมอบหมายเท่านั้น'; end if;
    if v_task.status not in ('assigned','returned') then raise exception 'สถานะงานไม่รองรับการเริ่มทำ'; end if;
    update public.lao_subject_group_tasks
    set status='in_progress',review_note=case when status='returned' then review_note else null end
    where id=v_task.id returning * into v_task;
    insert into public.lao_subject_group_task_history(task_id,action,actor_user_id,note,snapshot)
    values(v_task.id,'started',v_uid,null,to_jsonb(v_task));

  elsif p_action='submit' then
    if not v_is_assignee then raise exception 'เฉพาะผู้ได้รับมอบหมายเท่านั้น'; end if;
    if v_task.status not in ('assigned','in_progress','returned') then raise exception 'สถานะงานไม่รองรับการส่งตรวจ'; end if;
    update public.lao_subject_group_tasks
    set status='submitted',
        submission_note=nullif(btrim(coalesce(p_note,'')),''),
        review_note=null,
        submitted_at=now(),
        reviewed_at=null,reviewed_by=null
    where id=v_task.id returning * into v_task;
    insert into public.lao_subject_group_task_history(task_id,action,actor_user_id,note,snapshot)
    values(v_task.id,'submitted',v_uid,nullif(btrim(coalesce(p_note,'')),''),to_jsonb(v_task));

  elsif p_action='return' then
    if not v_is_head then raise exception 'เฉพาะหัวหน้ากลุ่มสาระหรือผู้มีสิทธิ์ตรวจยืนยันเท่านั้น'; end if;
    if v_task.status<>'submitted' then raise exception 'ส่งกลับได้เฉพาะงานที่สมาชิกส่งตรวจแล้ว'; end if;
    if btrim(coalesce(p_note,''))='' then raise exception 'กรุณาระบุสิ่งที่ต้องแก้ไข'; end if;
    update public.lao_subject_group_tasks
    set status='returned',review_note=btrim(p_note),reviewed_at=now(),reviewed_by=v_uid
    where id=v_task.id returning * into v_task;
    insert into public.lao_subject_group_task_history(task_id,action,actor_user_id,note,snapshot)
    values(v_task.id,'returned',v_uid,btrim(p_note),to_jsonb(v_task));

  elsif p_action='confirm' then
    if not v_is_head then raise exception 'เฉพาะหัวหน้ากลุ่มสาระหรือผู้มีสิทธิ์ตรวจยืนยันเท่านั้น'; end if;
    if v_task.status<>'submitted' then raise exception 'ยืนยันได้เฉพาะงานที่สมาชิกส่งตรวจแล้ว'; end if;
    update public.lao_subject_group_tasks
    set status='confirmed',review_note=nullif(btrim(coalesce(p_note,'')),''),
        reviewed_at=now(),reviewed_by=v_uid
    where id=v_task.id returning * into v_task;
    insert into public.lao_subject_group_task_history(task_id,action,actor_user_id,note,snapshot)
    values(v_task.id,'confirmed',v_uid,nullif(btrim(coalesce(p_note,'')),''),to_jsonb(v_task));

  else
    if not v_is_head then raise exception 'เฉพาะหัวหน้ากลุ่มสาระหรือผู้มีสิทธิ์มอบหมายเท่านั้น'; end if;
    if v_task.status='confirmed' then raise exception 'งานที่ยืนยันแล้วไม่สามารถยกเลิกจากขั้นตอนนี้'; end if;
    update public.lao_subject_group_tasks
    set status='cancelled',review_note=nullif(btrim(coalesce(p_note,'')),''),
        reviewed_at=now(),reviewed_by=v_uid
    where id=v_task.id returning * into v_task;
    insert into public.lao_subject_group_task_history(task_id,action,actor_user_id,note,snapshot)
    values(v_task.id,'cancelled',v_uid,nullif(btrim(coalesce(p_note,'')),''),to_jsonb(v_task));
  end if;

  select s.organization_id into v_org
  from public.lao_schools s where s.id=v_task.school_id;

  if p_action='submit' then
    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    select distinct a.user_id,v_org,v_task.school_id,'subject_group_task_submitted',
      'มีงานกลุ่มสาระรอตรวจยืนยัน',
      v_task.learning_area||' · '||v_task.title,
      'subject_group_task',v_task.id::text
    from public.lao_work_authorities a
    where a.school_id=v_task.school_id
      and a.scope_code=public.lao_subject_group_scope_code(v_task.learning_area)
      and a.is_active
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
      and (a.authority_role='work_head' or a.can_approve or a.can_delegate)
      and a.user_id<>v_uid
      and not exists(
        select 1 from public.lao_notifications n
        where n.user_id=a.user_id
          and n.notification_type='subject_group_task_submitted'
          and n.entity_type='subject_group_task'
          and n.entity_id=v_task.id::text
          and n.read_at is null
      );
  elsif p_action in ('return','confirm') then
    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    select pa.user_id,v_org,v_task.school_id,
      case when p_action='confirm' then 'subject_group_task_confirmed' else 'subject_group_task_returned' end,
      case when p_action='confirm' then 'งานกลุ่มสาระได้รับการยืนยันแล้ว' else 'งานกลุ่มสารถูกส่งกลับให้แก้ไข' end,
      case when p_action='confirm'
        then v_task.learning_area||' · '||v_task.title
        else coalesce(nullif(btrim(p_note),''),'กรุณาตรวจและแก้ไขงาน') end,
      'subject_group_task',v_task.id::text
    from public.lao_personnel_accounts pa
    where pa.school_id=v_task.school_id and pa.personnel_id=v_task.assigned_to
      and pa.user_id<>v_uid;
  end if;

  return jsonb_build_object(
    'id',v_task.id,'status',v_task.status,'review_note',v_task.review_note,
    'submitted_at',v_task.submitted_at,'reviewed_at',v_task.reviewed_at
  );
end;
$function$;

revoke all on function public.lao_subject_group_task_action(uuid,text,text) from public,anon;
grant execute on function public.lao_subject_group_task_action(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';

commit;

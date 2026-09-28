-- Teaching workload workflow: teacher proposal, academic review and direct assignment.

create table if not exists public.lao_teaching_workloads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  term_id uuid not null references public.lao_terms(id) on delete cascade,
  personnel_id uuid not null references public.lao_personnel(id) on delete restrict,
  source_type text not null default 'teacher_proposal'
    check(source_type in ('teacher_proposal','academic_assignment')),
  status text not null default 'draft'
    check(status in ('draft','submitted','approved','returned','cancelled')),
  note text,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,term_id,personnel_id)
);

create index if not exists lao_teaching_workloads_school_term_idx
  on public.lao_teaching_workloads(school_id,term_id,status,personnel_id);

create index if not exists lao_teaching_workloads_personnel_idx
  on public.lao_teaching_workloads(personnel_id,term_id);

drop trigger if exists lao_teaching_workloads_touch on public.lao_teaching_workloads;
create trigger lao_teaching_workloads_touch
before update on public.lao_teaching_workloads
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_teaching_workload_items (
  id uuid primary key default gen_random_uuid(),
  workload_id uuid not null references public.lao_teaching_workloads(id) on delete cascade,
  course_id uuid not null references public.lao_curriculum_courses(id) on delete restrict,
  class_section_id uuid not null references public.lao_class_sections(id) on delete restrict,
  weekly_periods numeric(5,2) not null check(weekly_periods > 0),
  teaching_role text not null default 'main'
    check(teaching_role in ('main','co_teacher','support')),
  notes text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workload_id,course_id,class_section_id)
);

create index if not exists lao_teaching_workload_items_workload_idx
  on public.lao_teaching_workload_items(workload_id,sort_order);

drop trigger if exists lao_teaching_workload_items_touch on public.lao_teaching_workload_items;
create trigger lao_teaching_workload_items_touch
before update on public.lao_teaching_workload_items
for each row execute function public.lao_touch_updated_at();

alter table public.lao_teaching_workloads enable row level security;
alter table public.lao_teaching_workload_items enable row level security;
revoke all on public.lao_teaching_workloads from anon,authenticated;
revoke all on public.lao_teaching_workload_items from anon,authenticated;

create or replace function public.lao_my_personnel_id(p_school_id uuid)
returns uuid
language sql
stable
security definer
set search_path=public
as $$
  select pa.personnel_id
  from public.lao_personnel_accounts pa
  join public.lao_personnel p on p.id=pa.personnel_id
  where pa.school_id=p_school_id
    and pa.user_id=(select auth.uid())
    and p.school_id=p_school_id
    and p.employment_status='active'
  limit 1;
$$;

revoke all on function public.lao_my_personnel_id(uuid) from public,anon;
grant execute on function public.lao_my_personnel_id(uuid) to authenticated;

create or replace function public.lao_can_view_all_teaching_workload(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_platform_admin()
  or exists(
    select 1
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid())
      and m.status='active'
      and m.school_id=p_school_id
      and r.code in ('school_admin','school_executive','registrar','academic_officer')
  )
  or exists(
    select 1
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    join public.lao_schools s on s.organization_id=m.organization_id
    where m.user_id=(select auth.uid())
      and m.status='active'
      and m.school_id is null
      and s.id=p_school_id
      and r.code in ('organization_admin','organization_viewer')
  );
$$;

revoke all on function public.lao_can_view_all_teaching_workload(uuid) from public,anon;
grant execute on function public.lao_can_view_all_teaching_workload(uuid) to authenticated;

create or replace function public.lao_academic_work_counts(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_manage boolean := false;
  v_own uuid;
  v_pending integer := 0;
  v_returned integer := 0;
begin
  if v_uid is null or p_school_id is null or not public.lao_can_view_academic(p_school_id) then
    return jsonb_build_object(
      'can_manage',false,
      'pending_teaching_workloads',0,
      'my_returned_workloads',0,
      'attention_count',0
    );
  end if;

  v_manage:=public.lao_can_manage_academic(p_school_id);
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

  return jsonb_build_object(
    'can_manage',v_manage,
    'pending_teaching_workloads',v_pending,
    'my_returned_workloads',v_returned,
    'attention_count',v_pending+v_returned
  );
end;
$$;

revoke all on function public.lao_academic_work_counts(uuid) from public,anon;
grant execute on function public.lao_academic_work_counts(uuid) to authenticated;

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
as $$
declare
  v_uid uuid := (select auth.uid());
  v_year_id uuid;
  v_term_id uuid;
  v_own uuid;
  v_can_manage boolean;
  v_can_view_all boolean;
  v_target_personnel uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_can_manage:=public.lao_can_manage_academic(p_school_id);
  v_can_view_all:=public.lao_can_view_all_teaching_workload(p_school_id);
  v_own:=public.lao_my_personnel_id(p_school_id);

  select ay.id into v_year_id
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
    and (p_academic_year_id is null or ay.id=p_academic_year_id)
  order by
    case when p_academic_year_id is not null and ay.id=p_academic_year_id then 0 else 1 end,
    ay.is_current desc,
    ay.year_be desc
  limit 1;

  if v_year_id is not null then
    select t.id into v_term_id
    from public.lao_terms t
    where t.academic_year_id=v_year_id
      and (p_term_id is null or t.id=p_term_id)
    order by
      case when p_term_id is not null and t.id=p_term_id then 0 else 1 end,
      t.is_current desc,
      t.term_no asc
    limit 1;
  end if;

  if v_can_view_all then
    v_target_personnel:=p_personnel_id;
  else
    v_target_personnel:=v_own;
  end if;

  select jsonb_build_object(
    'can_manage',v_can_manage,
    'can_view_all',v_can_view_all,
    'own_personnel_id',v_own,
    'selected_year_id',v_year_id,
    'selected_term_id',v_term_id,
    'years',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ay.id,
        'year_be',ay.year_be,
        'is_current',ay.is_current,
        'terms',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',t.id,'term_no',t.term_no,'name',coalesce(t.name,'ภาคเรียนที่ '||t.term_no),
            'is_current',t.is_current
          ) order by t.term_no)
          from public.lao_terms t where t.academic_year_id=ay.id
        ),'[]'::jsonb)
      ) order by ay.year_be desc)
      from public.lao_academic_years ay
      where ay.school_id=p_school_id
    ),'[]'::jsonb),
    'personnel',case when v_can_manage then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'full_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
        'personnel_type',p.personnel_type,
        'position_title',p.position_title,
        'academic_standing',p.academic_standing,
        'account_linked',pa.user_id is not null
      ) order by
        case p.personnel_type when 'teacher' then 0 when 'executive' then 1 when 'educational_staff' then 2 else 3 end,
        p.first_name_th,p.last_name_th)
      from public.lao_personnel p
      left join public.lao_personnel_accounts pa on pa.personnel_id=p.id
      where p.school_id=p_school_id and p.employment_status='active'
    ),'[]'::jsonb) else '[]'::jsonb end,
    'own_personnel',case when v_own is null then null else (
      select jsonb_build_object(
        'id',p.id,
        'full_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
        'personnel_type',p.personnel_type,
        'position_title',p.position_title,
        'academic_standing',p.academic_standing
      )
      from public.lao_personnel p where p.id=v_own
    ) end,
    'offerings',case when v_year_id is null or v_term_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'key',c.id::text||'|'||cs.id::text,
        'course_id',c.id,
        'class_section_id',cs.id,
        'grade_label',c.grade_label,
        'class_label',cs.section_label,
        'class_short',case
          when c.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(c.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
          when c.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(c.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
          when c.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(c.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
          else c.grade_label||'/'||cs.section_label
        end,
        'program_id',cs.program_id,
        'program_name',ap.name_th,
        'subject_id',s.id,
        'subject_code',s.subject_code,
        'subject_name',s.name_th,
        'learning_area',s.learning_area,
        'subject_type',s.subject_type,
        'suggested_weekly_periods',ctp.weekly_periods,
        'term_hours',ctp.term_hours
      ) order by c.sort_order,c.grade_label,cs.sort_order,cs.section_label,coalesce(s.subject_code,''),s.name_th)
      from public.lao_curriculum_courses c
      join public.lao_subjects s on s.id=c.subject_id
      join public.lao_class_sections cs
        on cs.school_id=c.school_id
       and cs.academic_year_id=c.academic_year_id
       and lower(btrim(cs.grade_label))=lower(btrim(c.grade_label))
       and cs.is_active
       and (c.program_id is null or c.program_id=cs.program_id)
      left join public.lao_academic_programs ap on ap.id=cs.program_id
      left join public.lao_course_term_plans ctp on ctp.course_id=c.id and ctp.term_id=v_term_id
      where c.school_id=p_school_id
        and c.academic_year_id=v_year_id
        and c.is_active
        and s.is_active
    ),'[]'::jsonb) end,
    'workloads',case
      when v_term_id is null then '[]'::jsonb
      when not v_can_view_all and v_own is null then '[]'::jsonb
      else coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',w.id,
          'personnel_id',w.personnel_id,
          'personnel_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
          'position_title',p.position_title,
          'academic_standing',p.academic_standing,
          'source_type',w.source_type,
          'status',w.status,
          'note',w.note,
          'review_note',w.review_note,
          'submitted_at',w.submitted_at,
          'reviewed_at',w.reviewed_at,
          'reviewed_by',w.reviewed_by,
          'updated_at',w.updated_at,
          'total_weekly_periods',coalesce((
            select sum(i.weekly_periods) from public.lao_teaching_workload_items i where i.workload_id=w.id
          ),0),
          'items',coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',i.id,
              'course_id',i.course_id,
              'class_section_id',i.class_section_id,
              'weekly_periods',i.weekly_periods,
              'teaching_role',i.teaching_role,
              'notes',i.notes,
              'subject_code',s.subject_code,
              'subject_name',s.name_th,
              'grade_label',cs.grade_label,
              'class_label',cs.section_label,
              'class_short',case
                when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
                when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
                when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
                else cs.grade_label||'/'||cs.section_label
              end,
              'program_name',ap.name_th
            ) order by i.sort_order,s.name_th,cs.section_label)
            from public.lao_teaching_workload_items i
            join public.lao_curriculum_courses c on c.id=i.course_id
            join public.lao_subjects s on s.id=c.subject_id
            join public.lao_class_sections cs on cs.id=i.class_section_id
            left join public.lao_academic_programs ap on ap.id=cs.program_id
            where i.workload_id=w.id
          ),'[]'::jsonb)
        ) order by
          case w.status when 'submitted' then 0 when 'returned' then 1 when 'draft' then 2 when 'approved' then 3 else 4 end,
          p.first_name_th,p.last_name_th)
        from public.lao_teaching_workloads w
        join public.lao_personnel p on p.id=w.personnel_id
        where w.school_id=p_school_id
          and w.term_id=v_term_id
          and (p_status is null or p_status='' or w.status=p_status)
          and (
            (v_can_view_all and (v_target_personnel is null or w.personnel_id=v_target_personnel))
            or (not v_can_view_all and w.personnel_id=v_own)
          )
      ),'[]'::jsonb)
    end,
    'stats',jsonb_build_object(
      'submitted',case when v_can_view_all and v_term_id is not null then (
        select count(*) from public.lao_teaching_workloads where school_id=p_school_id and term_id=v_term_id and status='submitted'
      ) else 0 end,
      'approved',case when v_can_view_all and v_term_id is not null then (
        select count(*) from public.lao_teaching_workloads where school_id=p_school_id and term_id=v_term_id and status='approved'
      ) else 0 end,
      'personnel_with_workload',case when v_can_view_all and v_term_id is not null then (
        select count(*) from public.lao_teaching_workloads where school_id=p_school_id and term_id=v_term_id and status<>'cancelled'
      ) else 0 end
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid) to authenticated;

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
grant execute on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) to authenticated;

create or replace function public.lao_review_teaching_workload(
  p_workload_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid := (select auth.uid());
  v_work public.lao_teaching_workloads;
  v_org uuid;
  v_target_user uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approved','returned') then raise exception 'Invalid decision'; end if;

  select * into v_work
  from public.lao_teaching_workloads
  where id=p_workload_id
  for update;
  if not found then raise exception 'ไม่พบภาระงานสอน'; end if;

  if not public.lao_can_manage_academic(v_work.school_id) then raise exception 'Access denied'; end if;
  if v_work.status not in ('submitted','approved') then
    raise exception 'รายการนี้ยังไม่อยู่ในสถานะที่ตรวจสอบได้';
  end if;
  if p_decision='returned' and nullif(btrim(p_review_note),'') is null then
    raise exception 'กรุณาระบุสิ่งที่ต้องแก้ไขก่อนส่งกลับ';
  end if;

  select s.organization_id,concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),pa.user_id
  into v_org,v_name,v_target_user
  from public.lao_schools s
  join public.lao_personnel p on p.id=v_work.personnel_id
  left join public.lao_personnel_accounts pa on pa.personnel_id=p.id
  where s.id=v_work.school_id;

  update public.lao_teaching_workloads
  set status=p_decision,
      review_note=nullif(btrim(p_review_note),''),
      reviewed_at=now(),
      reviewed_by=v_uid,
      updated_by=v_uid
  where id=v_work.id;

  if v_target_user is not null and v_target_user<>v_uid then
    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    ) values(
      v_target_user,v_org,v_work.school_id,
      case when p_decision='approved' then 'teaching_workload_approved' else 'teaching_workload_returned' end,
      case when p_decision='approved' then 'ภาระงานสอนได้รับการอนุมัติแล้ว' else 'ภาระงานสอนถูกส่งกลับให้แก้ไข' end,
      case when p_decision='approved'
        then 'ฝ่ายวิชาการอนุมัติภาระงานสอนของคุณแล้ว'
        else btrim(p_review_note)
      end,
      'teaching_workload',v_work.id::text
    );
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  ) values(
    v_org,v_work.school_id,v_uid,
    case when p_decision='approved' then 'teaching_workload_approved' else 'teaching_workload_returned' end,
    'teaching_workload',v_work.id::text,
    jsonb_build_object('status',v_work.status),
    jsonb_build_object('status',p_decision,'review_note',nullif(btrim(p_review_note),''))
  );

  return jsonb_build_object('id',v_work.id,'status',p_decision);
end;
$$;

revoke all on function public.lao_review_teaching_workload(uuid,text,text) from public,anon;
grant execute on function public.lao_review_teaching_workload(uuid,text,text) to authenticated;

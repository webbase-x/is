-- Subject library workspace, program exclusions, and curriculum readiness confirmation.

create table if not exists public.lao_curriculum_default_initializations(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  grade_code text not null,
  initialized_at timestamptz not null default now(),
  initialized_by uuid,
  unique(school_id,academic_year_id,grade_code)
);
alter table public.lao_curriculum_default_initializations enable row level security;
revoke all on table public.lao_curriculum_default_initializations from public,anon,authenticated;

create table if not exists public.lao_curriculum_program_exclusions(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid not null references public.lao_academic_programs(id) on delete cascade,
  grade_code text not null,
  subject_id uuid not null references public.lao_subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid
);
create unique index if not exists lao_curriculum_program_exclusions_uq
  on public.lao_curriculum_program_exclusions(school_id,academic_year_id,program_id,grade_code,subject_id);
alter table public.lao_curriculum_program_exclusions enable row level security;
revoke all on table public.lao_curriculum_program_exclusions from public,anon,authenticated;

create table if not exists public.lao_curriculum_structure_confirmations(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid null references public.lao_academic_programs(id) on delete cascade,
  grade_code text not null,
  fingerprint text not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid
);
create unique index if not exists lao_curriculum_structure_confirmations_uq
  on public.lao_curriculum_structure_confirmations(
    school_id,academic_year_id,coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid),grade_code
  );
alter table public.lao_curriculum_structure_confirmations enable row level security;
revoke all on table public.lao_curriculum_structure_confirmations from public,anon,authenticated;

update public.lao_department_setup_steps
set title_th='จัดรายวิชาของสถานศึกษา',
    description_th='เลือกรายวิชาที่ใช้จริงตามระดับชั้นและโปรแกรมจากคลังรายวิชา โรงเรียนเพิ่มหรือนำออกได้โดยไม่ลบฐานกลาง'
where department_code='academics' and step_code='subjects';

update public.lao_department_setup_steps
set title_th='ตรวจและยืนยันโครงสร้างเวลาเรียน',
    description_th='ตรวจรายวิชาและเวลาเรียนทุกระดับชั้น/โปรแกรม แล้วให้ฝ่ายวิชาการยืนยันว่าครบตามหลักสูตรสถานศึกษา'
where department_code='academics' and step_code='curriculum';

CREATE OR REPLACE FUNCTION public.lao_add_subject_to_curriculum(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text, p_subject_id uuid DEFAULT NULL::uuid, p_subject_code text DEFAULT NULL::text, p_subject_name text DEFAULT NULL::text, p_learning_area text DEFAULT NULL::text, p_subject_type text DEFAULT 'basic'::text, p_weekly_periods numeric DEFAULT NULL::numeric, p_annual_hours numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_grade_label text;
  v_subject_id uuid:=p_subject_id;
  v_course_id uuid;
  v_term record;
  v_sort integer;
  v_inherited boolean:=false;
  v_subject_created boolean:=false;
  v_subject_type text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then
    raise exception 'ระดับชั้นไม่ถูกต้อง';
  end if;
  if p_subject_type not in ('basic','additional','activity','other') then
    raise exception 'ประเภทรายวิชาไม่ถูกต้อง';
  end if;
  if p_weekly_periods is not null and p_weekly_periods<=0 then raise exception 'ชั่วโมง/สัปดาห์ต้องมากกว่า 0'; end if;
  if p_annual_hours is not null and p_annual_hours<=0 then raise exception 'ชั่วโมง/ปีต้องมากกว่า 0'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs
    where id=p_program_id and school_id=p_school_id and is_active
  ) then raise exception 'Program not found'; end if;

  select min(c.grade_label) into v_grade_label
  from public.lao_class_sections c
  where c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.grade_code=p_grade_code
    and c.is_active
    and c.source_type='lec';

  if v_grade_label is null then raise exception 'ไม่พบระดับชั้นนี้จาก LEC'; end if;

  if v_subject_id is not null then
    select subject_type into v_subject_type
    from public.lao_subjects
    where id=v_subject_id and school_id=p_school_id;
    if v_subject_type is null then raise exception 'Subject not found'; end if;
  else
    if nullif(btrim(p_subject_name),'') is null then raise exception 'กรุณาระบุชื่อรายวิชา'; end if;

    if nullif(btrim(p_subject_code),'') is not null then
      if p_subject_type='activity' then
        select id into v_subject_id
        from public.lao_subjects
        where school_id=p_school_id
          and subject_type='activity'
          and lower(coalesce(subject_code,''))=lower(btrim(p_subject_code))
          and lower(btrim(name_th))=lower(btrim(p_subject_name))
        limit 1;
      else
        select id into v_subject_id
        from public.lao_subjects
        where school_id=p_school_id
          and subject_type<>'activity'
          and lower(coalesce(subject_code,''))=lower(btrim(p_subject_code))
        limit 1;
      end if;
    else
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(btrim(name_th))=lower(btrim(p_subject_name))
        and subject_type=p_subject_type
      order by is_active desc,created_at
      limit 1;
    end if;

    if v_subject_id is null then
      insert into public.lao_subjects(
        school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,upper(nullif(btrim(p_subject_code),'')),btrim(p_subject_name),
        nullif(btrim(p_learning_area),''),p_subject_type,true,0,v_uid,v_uid
      ) returning id into v_subject_id;
      v_subject_created:=true;
    end if;

    select subject_type into v_subject_type
    from public.lao_subjects where id=v_subject_id;
  end if;

  if p_program_id is not null then
    delete from public.lao_curriculum_program_exclusions
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and program_id=p_program_id
      and grade_code=p_grade_code
      and subject_id=v_subject_id;

    if v_subject_type in ('basic','activity') and exists(
      select 1 from public.lao_curriculum_courses c
      where c.school_id=p_school_id
        and c.academic_year_id=p_academic_year_id
        and c.program_id is null
        and c.grade_code=p_grade_code
        and c.subject_id=v_subject_id
        and c.is_active
    ) then
      v_inherited:=true;
      select c.id into v_course_id
      from public.lao_curriculum_courses c
      where c.school_id=p_school_id
        and c.academic_year_id=p_academic_year_id
        and c.program_id is null
        and c.grade_code=p_grade_code
        and c.subject_id=v_subject_id
        and c.is_active
      limit 1;
    end if;
  end if;

  if not v_inherited then
    select id into v_course_id
    from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and program_id is not distinct from p_program_id
      and grade_code=p_grade_code
      and subject_id=v_subject_id
    limit 1;

    if v_course_id is null then
      select coalesce(max(sort_order),0)+1 into v_sort
      from public.lao_curriculum_courses
      where school_id=p_school_id
        and academic_year_id=p_academic_year_id
        and program_id is not distinct from p_program_id
        and grade_code=p_grade_code;

      insert into public.lao_curriculum_courses(
        school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
        annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_grade_label,v_subject_id,
        p_annual_hours,null,'เพิ่มจากคลังรายวิชา',true,v_sort,v_uid,v_uid
      ) returning id into v_course_id;
    else
      update public.lao_curriculum_courses
      set is_active=true,
          annual_hours=coalesce(annual_hours,p_annual_hours),
          updated_by=v_uid,
          updated_at=now()
      where id=v_course_id;
    end if;

    if p_weekly_periods is not null then
      for v_term in
        select id from public.lao_terms
        where academic_year_id=p_academic_year_id
        order by term_no
      loop
        insert into public.lao_course_term_plans(
          course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
        ) values(
          v_course_id,v_term.id,p_weekly_periods,null,'เพิ่มจากคลังรายวิชา',v_uid,v_uid
        )
        on conflict(course_id,term_id) do update
          set weekly_periods=coalesce(public.lao_course_term_plans.weekly_periods,excluded.weekly_periods),
              updated_by=v_uid,
              updated_at=now();
      end loop;
    end if;
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_subject_added','curriculum_course',coalesce(v_course_id::text,v_subject_id::text),
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,'program_id',p_program_id,'grade_code',p_grade_code,
      'subject_id',v_subject_id,'subject_created',v_subject_created,'inherited',v_inherited
    )
  );

  return jsonb_build_object(
    'subject_id',v_subject_id,'course_id',v_course_id,
    'subject_created',v_subject_created,'inherited',v_inherited
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_confirm_curriculum_structure(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_status jsonb;
  v_fp text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_status:=public.lao_curriculum_group_status(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );

  if coalesce((v_status->>'course_count')::int,0)=0 then
    raise exception 'ยังไม่มีรายวิชาในโครงสร้างนี้';
  end if;
  if coalesce((v_status->>'basic_count')::int,0)=0 then
    raise exception 'ยังไม่มีรายวิชาพื้นฐาน';
  end if;
  if coalesce((v_status->>'activity_count')::int,0)=0 then
    raise exception 'ยังไม่มีกิจกรรมพัฒนาผู้เรียน';
  end if;
  if coalesce((v_status->>'missing_time_count')::int,0)>0 then
    raise exception 'ยังมีรายวิชาที่ไม่ได้กำหนดเวลาเรียน';
  end if;

  v_fp:=v_status->>'fingerprint';

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id
    and grade_code=p_grade_code;

  insert into public.lao_curriculum_structure_confirmations(
    school_id,academic_year_id,program_id,grade_code,fingerprint,confirmed_by
  ) values(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_fp,v_uid
  );

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_structure_confirmed','academic_year',p_academic_year_id::text,
    jsonb_build_object(
      'program_id',p_program_id,'grade_code',p_grade_code,'fingerprint',v_fp
    )
  );

  return public.lao_curriculum_group_status(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_curriculum_group_status(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_course_count integer:=0;
  v_basic_count integer:=0;
  v_activity_count integer:=0;
  v_additional_count integer:=0;
  v_other_count integer:=0;
  v_missing_time integer:=0;
  v_core_missing integer:=0;
  v_activity_missing integer:=0;
  v_total_hours numeric:=0;
  v_fingerprint text:='';
  v_confirmed_at timestamptz;
  v_confirmed boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  with eligible as (
    select
      c.id,c.subject_id,c.program_id,c.annual_hours,c.sort_order,c.updated_at as course_updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,s.updated_at as subject_updated_at,
      case
        when s.subject_type='activity' and nullif(btrim(s.subject_code),'') is not null
          then 'activity|'||lower(btrim(s.subject_code))||'|'||lower(btrim(s.name_th))
        when nullif(btrim(s.subject_code),'') is not null
          then 'code|'||lower(btrim(s.subject_code))
        else 'name|'||s.subject_type||'|'||lower(btrim(s.name_th))
      end as subject_key,
      case when p_program_id is not null and c.program_id=p_program_id then 2 else 1 end as priority
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.grade_code=p_grade_code
      and c.is_active
      and (
        (p_program_id is null and c.program_id is null)
        or
        (p_program_id is not null and (
          c.program_id=p_program_id
          or (
            c.program_id is null
            and s.subject_type in ('basic','activity')
            and not exists(
              select 1 from public.lao_curriculum_program_exclusions x
              where x.school_id=p_school_id
                and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id
                and x.grade_code=p_grade_code
                and x.subject_id=c.subject_id
            )
          )
        ))
      )
  ),
  ranked as (
    select e.*,row_number() over(partition by e.subject_key order by e.priority desc,e.course_updated_at desc,e.id) as rn
    from eligible e
  ),
  eff as (
    select * from ranked where rn=1
  ),
  stats as (
    select
      count(*)::int as course_count,
      count(*) filter(where subject_type='basic')::int as basic_count,
      count(*) filter(where subject_type='activity')::int as activity_count,
      count(*) filter(where subject_type='additional')::int as additional_count,
      count(*) filter(where subject_type='other')::int as other_count,
      count(*) filter(
        where annual_hours is null
          and not exists(
            select 1 from public.lao_course_term_plans tp
            where tp.course_id=eff.id
              and (tp.weekly_periods is not null or tp.term_hours is not null)
          )
      )::int as missing_time_count,
      coalesce(sum(annual_hours),0) as total_hours,
      md5(coalesce(string_agg(
        concat_ws('|',
          subject_key,subject_id::text,id::text,coalesce(subject_code,''),coalesce(subject_name,''),
          coalesce(subject_type,''),coalesce(annual_hours::text,''),course_updated_at::text,subject_updated_at::text,
          coalesce((
            select string_agg(
              concat_ws(':',tp.term_id::text,coalesce(tp.weekly_periods::text,''),coalesce(tp.term_hours::text,''),tp.updated_at::text),
              '~' order by tp.term_id::text
            )
            from public.lao_course_term_plans tp where tp.course_id=eff.id
          ),'')
        ),
        '||' order by subject_key
      ),'')) as fingerprint
    from eff
  )
  select course_count,basic_count,activity_count,additional_count,other_count,
         missing_time_count,total_hours,fingerprint
  into v_course_count,v_basic_count,v_activity_count,v_additional_count,v_other_count,
       v_missing_time,v_total_hours,v_fingerprint
  from stats;

  with effective_subjects as (
    select distinct s.subject_code,s.name_th,s.subject_type
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.grade_code=p_grade_code
      and c.is_active
      and (
        (p_program_id is null and c.program_id is null)
        or
        (p_program_id is not null and (
          c.program_id=p_program_id
          or (
            c.program_id is null
            and s.subject_type in ('basic','activity')
            and not exists(
              select 1 from public.lao_curriculum_program_exclusions x
              where x.school_id=p_school_id
                and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id
                and x.grade_code=p_grade_code
                and x.subject_id=c.subject_id
            )
          )
        ))
      )
  )
  select
    count(*) filter(
      where coalesce(p.is_national_core,false)
        and not exists(
          select 1 from effective_subjects e
          where (p.subject_code is not null and lower(coalesce(e.subject_code,''))=lower(p.subject_code))
             or (p.subject_code is null and lower(btrim(e.name_th))=lower(btrim(p.subject_name)) and e.subject_type=p.subject_type)
        )
    )::int,
    count(*) filter(
      where p.subject_type='activity' and coalesce(p.auto_apply,true)
        and not exists(
          select 1 from effective_subjects e
          where (p.subject_code is not null and lower(coalesce(e.subject_code,''))=lower(p.subject_code))
             or (p.subject_code is null and lower(btrim(e.name_th))=lower(btrim(p.subject_name)) and e.subject_type='activity')
        )
    )::int
  into v_core_missing,v_activity_missing
  from public.lao_curriculum_preset_items p
  where p.preset_code='normal_primary_example' and p.grade_code=p_grade_code;

  select c.confirmed_at
  into v_confirmed_at
  from public.lao_curriculum_structure_confirmations c
  where c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.program_id is not distinct from p_program_id
    and c.grade_code=p_grade_code
    and c.fingerprint=v_fingerprint
  order by c.confirmed_at desc
  limit 1;

  v_confirmed:=v_confirmed_at is not null;

  return jsonb_build_object(
    'course_count',v_course_count,
    'basic_count',v_basic_count,
    'activity_count',v_activity_count,
    'additional_count',v_additional_count,
    'other_count',v_other_count,
    'missing_time_count',v_missing_time,
    'central_core_missing_count',v_core_missing,
    'default_activity_missing_count',v_activity_missing,
    'annual_hours_total',v_total_hours,
    'fingerprint',v_fingerprint,
    'is_confirmed',v_confirmed,
    'confirmed_at',v_confirmed_at,
    'is_ready_to_confirm',(v_course_count>0 and v_basic_count>0 and v_activity_count>0 and v_missing_time=0),
    'status',case
      when v_confirmed then 'confirmed'
      when v_course_count=0 then 'empty'
      when v_basic_count=0 or v_activity_count=0 then 'needs_subjects'
      when v_missing_time>0 then 'needs_time'
      else 'ready_to_confirm'
    end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_curriculum_readiness(p_school_id uuid, p_academic_year_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_groups jsonb:='[]'::jsonb;
  v_group record;
  v_status jsonb;
  v_total integer:=0;
  v_confirmed integer:=0;
  v_with_courses integer:=0;
  v_issue integer:=0;
  v_program_name text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;

  for v_group in
    select
      c.grade_code,
      min(c.grade_label) as grade_label,
      c.program_id,
      count(*)::int as room_count
    from public.lao_class_sections c
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.is_active
      and c.source_type='lec'
      and c.grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
    group by c.grade_code,c.program_id
    order by min(c.sort_order),c.grade_code,c.program_id nulls first
  loop
    v_total:=v_total+1;
    v_status:=public.lao_curriculum_group_status(
      p_school_id,p_academic_year_id,v_group.program_id,v_group.grade_code
    );

    if coalesce((v_status->>'course_count')::int,0)>0 then
      v_with_courses:=v_with_courses+1;
    end if;
    if coalesce((v_status->>'is_confirmed')::boolean,false) then
      v_confirmed:=v_confirmed+1;
    end if;
    if coalesce(v_status->>'status','') in ('empty','needs_subjects','needs_time') then
      v_issue:=v_issue+1;
    end if;

    select p.name_th into v_program_name
    from public.lao_academic_programs p
    where p.id=v_group.program_id;

    v_groups:=v_groups||jsonb_build_array(
      v_status||jsonb_build_object(
        'grade_code',v_group.grade_code,
        'grade_label',v_group.grade_label,
        'program_id',v_group.program_id,
        'program_name',v_program_name,
        'room_count',v_group.room_count
      )
    );
  end loop;

  return jsonb_build_object(
    'total_groups',v_total,
    'groups_with_courses',v_with_courses,
    'confirmed_groups',v_confirmed,
    'issue_groups',v_issue,
    'is_complete',(v_total>0 and v_confirmed=v_total),
    'groups',v_groups,
    'exclusions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'program_id',x.program_id,
        'grade_code',x.grade_code,
        'subject_id',x.subject_id
      ))
      from public.lao_curriculum_program_exclusions x
      where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id
    ),'[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_department_setup_step_is_done(p_school_id uuid, p_department_code text, p_step_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_year_id uuid;
  v_ready jsonb;
begin
  if p_department_code='personnel' then
    case p_step_code
      when 'registry' then
        return exists(select 1 from public.lao_personnel where school_id=p_school_id and employment_status='active');
      when 'authorities' then
        return exists(select 1 from public.lao_personnel_authorities where school_id=p_school_id and is_active and (starts_on is null or starts_on<=current_date) and (ends_on is null or ends_on>=current_date));
      when 'intake' then
        return exists(select 1 from public.lao_personnel_join_links where school_id=p_school_id);
      when 'requests' then
        return not exists(select 1 from public.lao_personnel_join_requests where school_id=p_school_id and status='pending_review');
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
        return v_year_id is not null and exists(select 1 from public.lao_terms where academic_year_id=v_year_id);
      when 'programs' then
        return exists(select 1 from public.lao_academic_programs where school_id=p_school_id and is_active);
      when 'classes' then
        return v_year_id is not null and exists(
          select 1 from public.lao_class_sections
          where school_id=p_school_id and academic_year_id=v_year_id and is_active and source_type='lec'
        );
      when 'subjects' then
        if v_year_id is null then return false; end if;
        v_ready:=public.lao_curriculum_readiness(p_school_id,v_year_id);
        return coalesce((v_ready->>'total_groups')::int,0)>0
          and coalesce((v_ready->>'groups_with_courses')::int,0)=coalesce((v_ready->>'total_groups')::int,0);
      when 'curriculum' then
        if v_year_id is null then return false; end if;
        v_ready:=public.lao_curriculum_readiness(p_school_id,v_year_id);
        return coalesce((v_ready->>'is_complete')::boolean,false);
      when 'workload' then
        return v_year_id is not null and exists(select 1 from public.lao_teaching_workloads where school_id=p_school_id and academic_year_id=v_year_id and status<>'cancelled');
      when 'workload_review' then
        return v_year_id is null or not exists(select 1 from public.lao_teaching_workloads where school_id=p_school_id and academic_year_id=v_year_id and status='submitted');
      else return false;
    end case;
  end if;

  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_ensure_required_curriculum_defaults(p_school_id uuid, p_academic_year_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_grade record;
  v_core jsonb;
  v_activity jsonb;
  v_grade_count integer := 0;
  v_initialized integer := 0;
  v_added_subjects integer := 0;
  v_added_courses integer := 0;
  v_added_term_plans integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;

  for v_grade in
    select distinct grade_code
    from public.lao_class_sections
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and is_active
      and source_type='lec'
      and grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
    order by grade_code
  loop
    v_grade_count:=v_grade_count+1;

    if not exists(
      select 1 from public.lao_curriculum_default_initializations
      where school_id=p_school_id
        and academic_year_id=p_academic_year_id
        and grade_code=v_grade.grade_code
    ) then
      v_core:=public.lao_import_curriculum_catalog(
        p_school_id,p_academic_year_id,v_grade.grade_code,'core',null
      );
      v_activity:=public.lao_import_curriculum_catalog(
        p_school_id,p_academic_year_id,v_grade.grade_code,'activity',null
      );

      insert into public.lao_curriculum_default_initializations(
        school_id,academic_year_id,grade_code,initialized_by
      ) values(p_school_id,p_academic_year_id,v_grade.grade_code,v_uid)
      on conflict do nothing;

      v_initialized:=v_initialized+1;
      v_added_subjects:=v_added_subjects
        +coalesce((v_core->>'added_subjects')::integer,0)
        +coalesce((v_activity->>'added_subjects')::integer,0);
      v_added_courses:=v_added_courses
        +coalesce((v_core->>'added_courses')::integer,0)
        +coalesce((v_activity->>'added_courses')::integer,0);
      v_added_term_plans:=v_added_term_plans
        +coalesce((v_core->>'added_term_plans')::integer,0)
        +coalesce((v_activity->>'added_term_plans')::integer,0);
    end if;
  end loop;

  return jsonb_build_object(
    'grade_count',v_grade_count,
    'initialized_grades',v_initialized,
    'added_subjects',v_added_subjects,
    'added_courses',v_added_courses,
    'added_activity_courses',0,
    'added_term_plans',v_added_term_plans
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_remove_subject_from_curriculum(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text, p_subject_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_subject record;
  v_removed_count integer:=0;
  v_excluded_count integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select * into v_subject
  from public.lao_subjects
  where id=p_subject_id and school_id=p_school_id;
  if v_subject.id is null then raise exception 'Subject not found'; end if;

  if p_program_id is null then
    with matching_subjects as (
      select s.id
      from public.lao_subjects s
      where s.school_id=p_school_id
        and (
          (
            v_subject.subject_type='activity'
            and nullif(btrim(v_subject.subject_code),'') is not null
            and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
            and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
          )
          or (
            v_subject.subject_type<>'activity'
            and nullif(btrim(v_subject.subject_code),'') is not null
            and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
          )
          or (
            nullif(btrim(v_subject.subject_code),'') is null
            and s.subject_type=v_subject.subject_type
            and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
          )
        )
    )
    update public.lao_curriculum_courses c
    set is_active=false,updated_by=v_uid,updated_at=now()
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.program_id is null
      and c.grade_code=p_grade_code
      and c.is_active
      and c.subject_id in (select id from matching_subjects);
    get diagnostics v_removed_count=row_count;
  else
    with matching_subjects as (
      select s.id
      from public.lao_subjects s
      where s.school_id=p_school_id
        and (
          (
            v_subject.subject_type='activity'
            and nullif(btrim(v_subject.subject_code),'') is not null
            and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
            and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
          )
          or (
            v_subject.subject_type<>'activity'
            and nullif(btrim(v_subject.subject_code),'') is not null
            and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
          )
          or (
            nullif(btrim(v_subject.subject_code),'') is null
            and s.subject_type=v_subject.subject_type
            and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
          )
        )
    )
    update public.lao_curriculum_courses c
    set is_active=false,updated_by=v_uid,updated_at=now()
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.program_id=p_program_id
      and c.grade_code=p_grade_code
      and c.is_active
      and c.subject_id in (select id from matching_subjects);
    get diagnostics v_removed_count=row_count;

    if v_subject.subject_type in ('basic','activity') then
      with matching_subjects as (
        select s.id
        from public.lao_subjects s
        where s.school_id=p_school_id
          and (
            (
              v_subject.subject_type='activity'
              and nullif(btrim(v_subject.subject_code),'') is not null
              and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
              and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
            )
            or (
              v_subject.subject_type<>'activity'
              and nullif(btrim(v_subject.subject_code),'') is not null
              and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
            )
            or (
              nullif(btrim(v_subject.subject_code),'') is null
              and s.subject_type=v_subject.subject_type
              and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
            )
          )
      ),
      ins as (
        insert into public.lao_curriculum_program_exclusions(
          school_id,academic_year_id,program_id,grade_code,subject_id,created_by
        )
        select p_school_id,p_academic_year_id,p_program_id,p_grade_code,c.subject_id,v_uid
        from public.lao_curriculum_courses c
        where c.school_id=p_school_id
          and c.academic_year_id=p_academic_year_id
          and c.program_id is null
          and c.grade_code=p_grade_code
          and c.is_active
          and c.subject_id in (select id from matching_subjects)
        on conflict do nothing
        returning 1
      )
      select count(*) into v_excluded_count from ins;
    end if;
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_subject_removed','subject',p_subject_id::text,
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,'program_id',p_program_id,'grade_code',p_grade_code,
      'subject_id',p_subject_id,'course_deactivated_count',v_removed_count,'program_exclusion_count',v_excluded_count
    )
  );

  return jsonb_build_object(
    'subject_id',p_subject_id,'course_deactivated_count',v_removed_count,'program_exclusion_count',v_excluded_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_select_student_activity(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_choice_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_row record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select * into v_row
  from public.lao_curriculum_preset_items
  where preset_code='normal_primary_example'
    and grade_code=p_grade_code
    and subject_type='activity'
    and choice_group='student_activity'
    and choice_key=p_choice_key
  limit 1;

  if v_row.subject_name is null then raise exception 'ไม่พบกิจกรรมที่เลือก'; end if;

  return public.lao_add_subject_to_curriculum(
    p_school_id,p_academic_year_id,null,p_grade_code,null,
    v_row.subject_code,v_row.subject_name,v_row.learning_area,v_row.subject_type,
    v_row.weekly_periods,v_row.annual_hours
  );
end;
$function$;

revoke all on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_curriculum_readiness(uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_readiness(uuid,uuid) to authenticated;
revoke all on function public.lao_confirm_curriculum_structure(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_confirm_curriculum_structure(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_add_subject_to_curriculum(uuid,uuid,uuid,text,uuid,text,text,text,text,numeric,numeric) from public,anon;
grant execute on function public.lao_add_subject_to_curriculum(uuid,uuid,uuid,text,uuid,text,text,text,text,numeric,numeric) to authenticated;
revoke all on function public.lao_remove_subject_from_curriculum(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_remove_subject_from_curriculum(uuid,uuid,uuid,text,uuid) to authenticated;
revoke all on function public.lao_select_student_activity(uuid,uuid,text,text) from public,anon;
grant execute on function public.lao_select_student_activity(uuid,uuid,text,text) to authenticated;
revoke all on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) from public,anon;
grant execute on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) to authenticated;
revoke all on function public.lao_department_setup_step_is_done(uuid,text,text) from public,anon;
grant execute on function public.lao_department_setup_step_is_done(uuid,text,text) to authenticated;

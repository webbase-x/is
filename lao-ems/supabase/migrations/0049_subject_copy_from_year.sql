-- 0049_subject_copy_from_year.sql
-- Copy one grade/program curriculum group from a prior academic year into the selected year.

create or replace function public.lao_copy_curriculum_group_from_year(
  p_school_id uuid,
  p_source_academic_year_id uuid,
  p_target_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_source_year integer;
  v_target_year integer;
  v_course record;
  v_target_course_id uuid;
  v_plan record;
  v_group record;
  v_target_group_id uuid;
  v_source_group_members integer;
  v_available_group_members integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_plan_count integer := 0;
  v_exclusion_count integer := 0;
  v_group_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.lao_can_manage_academic(p_school_id) then
    raise exception 'Access denied';
  end if;

  if p_source_academic_year_id is null or p_target_academic_year_id is null then
    raise exception 'กรุณาเลือกปีการศึกษาต้นทางและปีการศึกษาปลายทาง';
  end if;

  if p_source_academic_year_id = p_target_academic_year_id then
    raise exception 'ปีการศึกษาต้นทางและปลายทางต้องไม่เป็นปีเดียวกัน';
  end if;

  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then
    raise exception 'ระดับชั้นไม่ถูกต้อง';
  end if;

  select year_be into v_source_year
  from public.lao_academic_years
  where id=p_source_academic_year_id and school_id=p_school_id;

  if v_source_year is null then
    raise exception 'ไม่พบปีการศึกษาต้นทาง';
  end if;

  select year_be into v_target_year
  from public.lao_academic_years
  where id=p_target_academic_year_id and school_id=p_school_id;

  if v_target_year is null then
    raise exception 'ไม่พบปีการศึกษาปลายทาง';
  end if;

  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs
    where id=p_program_id and school_id=p_school_id
  ) then
    raise exception 'ไม่พบหลักสูตร/โปรแกรมที่เลือก';
  end if;

  for v_course in
    select c.*
    from public.lao_curriculum_courses c
    where c.school_id=p_school_id
      and c.academic_year_id=p_source_academic_year_id
      and c.program_id is not distinct from p_program_id
      and c.grade_code=p_grade_code
      and c.is_active
    order by c.sort_order,c.created_at
  loop
    select c.id into v_target_course_id
    from public.lao_curriculum_courses c
    where c.school_id=p_school_id
      and c.academic_year_id=p_target_academic_year_id
      and c.program_id is not distinct from p_program_id
      and c.grade_code=p_grade_code
      and c.subject_id=v_course.subject_id
    limit 1;

    if v_target_course_id is null then
      insert into public.lao_curriculum_courses(
        school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
        annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,p_target_academic_year_id,p_program_id,p_grade_code,
        v_course.grade_label,v_course.subject_id,
        v_course.annual_hours,v_course.credits,
        case
          when nullif(btrim(v_course.notes),'') is null
            then 'คัดลอกจากปีการศึกษา '||v_source_year
          else v_course.notes||' · คัดลอกจากปีการศึกษา '||v_source_year
        end,
        true,v_course.sort_order,v_uid,v_uid
      )
      returning id into v_target_course_id;
      v_inserted:=v_inserted+1;
    else
      update public.lao_curriculum_courses
      set grade_label=v_course.grade_label,
          annual_hours=v_course.annual_hours,
          credits=v_course.credits,
          notes=case
            when nullif(btrim(v_course.notes),'') is null
              then 'คัดลอกจากปีการศึกษา '||v_source_year
            else v_course.notes||' · คัดลอกจากปีการศึกษา '||v_source_year
          end,
          is_active=true,
          sort_order=v_course.sort_order,
          updated_by=v_uid,
          updated_at=now()
      where id=v_target_course_id;
      v_updated:=v_updated+1;
    end if;

    for v_plan in
      select sp.weekly_periods,sp.term_hours,sp.notes,st.term_no,tt.id as target_term_id
      from public.lao_course_term_plans sp
      join public.lao_terms st on st.id=sp.term_id
      left join public.lao_terms tt
        on tt.academic_year_id=p_target_academic_year_id
       and tt.term_no=st.term_no
      where sp.course_id=v_course.id
    loop
      if v_plan.target_term_id is not null then
        insert into public.lao_course_term_plans(
          course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
        ) values(
          v_target_course_id,v_plan.target_term_id,
          v_plan.weekly_periods,v_plan.term_hours,
          case
            when nullif(btrim(v_plan.notes),'') is null
              then 'คัดลอกจากปีการศึกษา '||v_source_year
            else v_plan.notes||' · คัดลอกจากปีการศึกษา '||v_source_year
          end,
          v_uid,v_uid
        )
        on conflict(course_id,term_id) do update set
          weekly_periods=excluded.weekly_periods,
          term_hours=excluded.term_hours,
          notes=excluded.notes,
          updated_by=v_uid,
          updated_at=now();
        v_plan_count:=v_plan_count+1;
      end if;
    end loop;
  end loop;

  if p_program_id is not null then
    insert into public.lao_curriculum_program_exclusions(
      school_id,academic_year_id,program_id,grade_code,subject_id,created_by
    )
    select
      p_school_id,p_target_academic_year_id,p_program_id,p_grade_code,e.subject_id,v_uid
    from public.lao_curriculum_program_exclusions e
    where e.school_id=p_school_id
      and e.academic_year_id=p_source_academic_year_id
      and e.program_id=p_program_id
      and e.grade_code=p_grade_code
    on conflict do nothing;

    get diagnostics v_exclusion_count = row_count;
  end if;

  for v_group in
    select g.*
    from public.lao_curriculum_parallel_groups g
    where g.school_id=p_school_id
      and g.academic_year_id=p_source_academic_year_id
      and g.program_id is not distinct from p_program_id
      and g.grade_code=p_grade_code
    order by g.created_at
  loop
    if exists(
      select 1 from public.lao_curriculum_parallel_groups tg
      where tg.school_id=p_school_id
        and tg.academic_year_id=p_target_academic_year_id
        and tg.program_id is not distinct from p_program_id
        and tg.grade_code=p_grade_code
        and lower(btrim(tg.name))=lower(btrim(v_group.name))
    ) then
      continue;
    end if;

    select count(*) into v_source_group_members
    from public.lao_curriculum_parallel_group_courses sgc
    where sgc.group_id=v_group.id;

    select count(*) into v_available_group_members
    from public.lao_curriculum_parallel_group_courses sgc
    join public.lao_curriculum_courses sc on sc.id=sgc.course_id
    join public.lao_curriculum_courses tc
      on tc.school_id=p_school_id
     and tc.academic_year_id=p_target_academic_year_id
     and tc.program_id is not distinct from p_program_id
     and tc.grade_code=p_grade_code
     and tc.subject_id=sc.subject_id
     and tc.is_active
    where sgc.group_id=v_group.id
      and not exists(
        select 1 from public.lao_curriculum_parallel_group_courses existing
        where existing.course_id=tc.id
      );

    if v_source_group_members>=2 and v_available_group_members=v_source_group_members then
      insert into public.lao_curriculum_parallel_groups(
        school_id,academic_year_id,program_id,grade_code,name,weekly_periods,created_by,updated_by
      ) values(
        p_school_id,p_target_academic_year_id,p_program_id,p_grade_code,
        v_group.name,v_group.weekly_periods,v_uid,v_uid
      )
      returning id into v_target_group_id;

      insert into public.lao_curriculum_parallel_group_courses(group_id,course_id)
      select v_target_group_id,tc.id
      from public.lao_curriculum_parallel_group_courses sgc
      join public.lao_curriculum_courses sc on sc.id=sgc.course_id
      join public.lao_curriculum_courses tc
        on tc.school_id=p_school_id
       and tc.academic_year_id=p_target_academic_year_id
       and tc.program_id is not distinct from p_program_id
       and tc.grade_code=p_grade_code
       and tc.subject_id=sc.subject_id
       and tc.is_active
      where sgc.group_id=v_group.id;

      v_group_count:=v_group_count+1;
    end if;
  end loop;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id
    and academic_year_id=p_target_academic_year_id
    and program_id is not distinct from p_program_id
    and grade_code=p_grade_code;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    'curriculum_group_copied_from_year','curriculum_group',
    p_target_academic_year_id::text||':'||coalesce(p_program_id::text,'general')||':'||p_grade_code,
    jsonb_build_object(
      'source_academic_year_id',p_source_academic_year_id,
      'source_year_be',v_source_year,
      'target_academic_year_id',p_target_academic_year_id,
      'target_year_be',v_target_year,
      'program_id',p_program_id,
      'grade_code',p_grade_code,
      'inserted_courses',v_inserted,
      'updated_courses',v_updated,
      'term_plans_copied',v_plan_count,
      'exclusions_copied',v_exclusion_count,
      'parallel_groups_copied',v_group_count
    )
  );

  return jsonb_build_object(
    'source_year_be',v_source_year,
    'target_year_be',v_target_year,
    'grade_code',p_grade_code,
    'program_id',p_program_id,
    'inserted_courses',v_inserted,
    'updated_courses',v_updated,
    'term_plans_copied',v_plan_count,
    'exclusions_copied',v_exclusion_count,
    'parallel_groups_copied',v_group_count
  );
end;
$function$;

revoke execute on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) from public;
revoke execute on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) from anon;
grant execute on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) to authenticated;

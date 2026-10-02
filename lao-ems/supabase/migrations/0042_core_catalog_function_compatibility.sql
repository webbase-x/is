-- 0042_core_catalog_function_compatibility.sql
-- Point legacy curriculum helpers/readiness checks at the rebuilt central core catalog.

begin;

CREATE OR REPLACE FUNCTION public.lao_add_catalog_item_to_curriculum(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_catalog_sort_order integer, p_program_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_row record;
  v_subject_id uuid;
  v_course_id uuid;
  v_term record;
  v_reactivated boolean := false;
  v_created_subject boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;

  select * into v_row
  from public.lao_curriculum_preset_items
  where preset_code='core_2551_2560'
    and grade_code=p_grade_code
    and sort_order=p_catalog_sort_order
  limit 1;
  if v_row.subject_name is null then raise exception 'ไม่พบรายการในฐานกลาง'; end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;

  if nullif(btrim(v_row.subject_code),'') is not null then
    if v_row.subject_type='activity' then
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(coalesce(subject_code,''))=lower(v_row.subject_code)
        and lower(btrim(name_th))=lower(btrim(v_row.subject_name))
      limit 1;
    else
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(coalesce(subject_code,''))=lower(v_row.subject_code)
      limit 1;
    end if;
  else
    select id into v_subject_id
    from public.lao_subjects
    where school_id=p_school_id
      and lower(btrim(name_th))=lower(btrim(v_row.subject_name))
      and subject_type=v_row.subject_type
    order by is_active desc,created_at
    limit 1;
  end if;

  if v_subject_id is null then
    insert into public.lao_subjects(
      school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,v_row.subject_code,v_row.subject_name,v_row.learning_area,v_row.subject_type,
      true,v_row.sort_order,v_uid,v_uid
    ) returning id into v_subject_id;
    v_created_subject:=true;
  end if;

  select id,is_active into v_course_id,v_reactivated
  from public.lao_curriculum_courses
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and grade_code=p_grade_code
    and program_id is not distinct from p_program_id
    and subject_id=v_subject_id
  limit 1;

  if v_course_id is null then
    insert into public.lao_curriculum_courses(
      school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
      annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_row.grade_label,v_subject_id,
      v_row.annual_hours,null,'เพิ่มจากคลังรายวิชากลาง',true,v_row.sort_order,v_uid,v_uid
    ) returning id into v_course_id;
    v_reactivated:=false;
  else
    update public.lao_curriculum_courses
    set is_active=true,
        updated_by=v_uid,
        updated_at=now()
    where id=v_course_id;
    v_reactivated:=not v_reactivated;
  end if;

  if v_row.weekly_periods is not null then
    for v_term in select id from public.lao_terms where academic_year_id=p_academic_year_id order by term_no
    loop
      insert into public.lao_course_term_plans(
        course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
      ) values(
        v_course_id,v_term.id,v_row.weekly_periods,null,'ค่าเริ่มต้นจากคลังรายวิชา',v_uid,v_uid
      ) on conflict (course_id,term_id) do nothing;
    end loop;
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_catalog_item_added','curriculum_course',v_course_id::text,
    jsonb_build_object(
      'grade_code',p_grade_code,'program_id',p_program_id,'subject_id',v_subject_id,
      'subject_code',v_row.subject_code,'subject_name',v_row.subject_name,
      'created_subject',v_created_subject,'reactivated',v_reactivated
    )
  );

  return jsonb_build_object(
    'course_id',v_course_id,'subject_id',v_subject_id,
    'subject_code',v_row.subject_code,'subject_name',v_row.subject_name
  );
end;
$function$


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
  v_weekly_periods numeric:=0;
  v_schedule_slot_count integer:=0;
  v_parallel_variant_count integer:=0;
  v_parallel_group_count integer:=0;
  v_parallel_mismatch_count integer:=0;
  v_days smallint;
  v_periods_day numeric;
  v_minutes smallint;
  v_weeks numeric;
  v_capacity numeric:=0;
  v_period_gap numeric:=0;
  v_schedule_configured boolean:=false;
  v_fingerprint text:='';
  v_confirmed_at timestamptz;
  v_confirmed boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  select school_days_per_week,periods_per_day,minutes_per_period,instructional_weeks_per_year
  into v_days,v_periods_day,v_minutes,v_weeks
  from public.lao_academic_schedule_settings
  where school_id=p_school_id and academic_year_id=p_academic_year_id;

  v_schedule_configured:=v_days is not null and v_periods_day is not null and v_minutes is not null and v_weeks is not null;
  if v_schedule_configured then v_capacity:=v_days*v_periods_day; end if;

  with eligible as (
    select
      c.id,c.subject_id,c.program_id,c.annual_hours,c.sort_order,c.updated_at as course_updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,s.updated_at as subject_updated_at,
      pg.id as parallel_group_id,pg.name as parallel_group_name,pg.weekly_periods as parallel_weekly_periods,
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
    left join public.lao_curriculum_parallel_group_courses pgc on pgc.course_id=c.id
    left join public.lao_curriculum_parallel_groups pg on pg.id=pgc.group_id
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
              where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id and x.grade_code=p_grade_code and x.subject_id=c.subject_id
            )
          )
        ))
      )
  ),
  ranked as (
    select e.*,row_number() over(partition by e.subject_key order by e.priority desc,e.course_updated_at desc,e.id) as rn
    from eligible e
  ),
  eff0 as (
    select * from ranked where rn=1
  ),
  eff as (
    select e.*,
      (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id) as course_weekly_periods,
      exists(
        select 1 from public.lao_course_term_plans tp
        where tp.course_id=e.id and (tp.weekly_periods is not null or tp.term_hours is not null)
      ) as has_term_time,
      coalesce(
        e.annual_hours,
        case when v_schedule_configured then
          (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id)
          * v_minutes::numeric / 60 * v_weeks
        end
      ) as effective_annual_hours
    from eff0 e
  ),
  slots0 as (
    select
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end as schedule_key,
      (array_agg(parallel_group_id) filter (where parallel_group_id is not null))[1] as parallel_group_id,
      max(parallel_weekly_periods) as parallel_weekly_periods,
      max(course_weekly_periods) as course_weekly_periods,
      max(effective_annual_hours) as annual_hours,
      count(*)::int as variant_count,
      count(*) filter(where course_weekly_periods is null and not has_term_time and annual_hours is null)::int as missing_variants,
      count(distinct course_weekly_periods) filter(where course_weekly_periods is not null)::int as distinct_weekly_values,
      bool_or(course_weekly_periods is null) and bool_or(course_weekly_periods is not null) as partial_weekly,
      bool_or(
        parallel_group_id is not null and course_weekly_periods is not null
        and abs(course_weekly_periods-parallel_weekly_periods)>0.001
      ) as group_time_mismatch
    from eff
    group by
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end
  ),
  slots as (
    select *,
      coalesce(parallel_weekly_periods,course_weekly_periods) as weekly_periods,
      case
        when parallel_weekly_periods is not null and v_schedule_configured
          then parallel_weekly_periods*v_minutes::numeric/60*v_weeks
        else annual_hours
      end as effective_slot_annual_hours
    from slots0
  ),
  stats as (
    select
      (select count(*)::int from eff) as course_count,
      (select count(*) filter(where subject_type='basic')::int from eff) as basic_count,
      (select count(*) filter(where subject_type='activity')::int from eff) as activity_count,
      (select count(*) filter(where subject_type='additional')::int from eff) as additional_count,
      (select count(*) filter(where subject_type='other')::int from eff) as other_count,
      (select count(*)::int from slots) as schedule_slot_count,
      (select count(distinct parallel_group_id)::int from slots where parallel_group_id is not null) as parallel_group_count,
      (select coalesce(sum(greatest(variant_count-1,0)),0)::int from slots) as parallel_variant_count,
      (select count(*)::int from slots
        where group_time_mismatch or
          (parallel_group_id is null and (distinct_weekly_values>1 or partial_weekly))
      ) as parallel_mismatch_count,
      (select count(*)::int from slots where weekly_periods is null and coalesce(effective_slot_annual_hours,0)=0) as missing_time_count,
      (select coalesce(sum(weekly_periods),0) from slots) as weekly_periods_total,
      (select coalesce(sum(effective_slot_annual_hours),0) from slots) as annual_hours_total,
      md5(
        coalesce((select string_agg(
          concat_ws('|',subject_key,subject_id::text,id::text,coalesce(subject_code,''),coalesce(subject_name,''),
            coalesce(subject_type,''),coalesce(annual_hours::text,''),coalesce(course_weekly_periods::text,''),
            coalesce(parallel_group_id::text,''),coalesce(parallel_weekly_periods::text,''),
            course_updated_at::text,subject_updated_at::text
          ),
          '||' order by subject_key
        ) from eff),'')||
        concat_ws('|','schedule',coalesce(v_days::text,''),coalesce(v_periods_day::text,''),coalesce(v_minutes::text,''),coalesce(v_weeks::text,''))
      ) as fingerprint
  )
  select course_count,basic_count,activity_count,additional_count,other_count,
         schedule_slot_count,parallel_group_count,parallel_variant_count,parallel_mismatch_count,
         missing_time_count,weekly_periods_total,annual_hours_total,fingerprint
  into v_course_count,v_basic_count,v_activity_count,v_additional_count,v_other_count,
       v_schedule_slot_count,v_parallel_group_count,v_parallel_variant_count,v_parallel_mismatch_count,
       v_missing_time,v_weekly_periods,v_total_hours,v_fingerprint
  from stats;

  if v_schedule_configured then v_period_gap:=v_capacity-v_weekly_periods; end if;

  with effective_subjects as (
    select distinct s.subject_code,s.name_th,s.subject_type
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
      and c.grade_code=p_grade_code and c.is_active
      and (
        (p_program_id is null and c.program_id is null)
        or
        (p_program_id is not null and (
          c.program_id=p_program_id
          or (
            c.program_id is null and s.subject_type in ('basic','activity')
            and not exists(
              select 1 from public.lao_curriculum_program_exclusions x
              where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id and x.grade_code=p_grade_code and x.subject_id=c.subject_id
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
          where (
            p.subject_code is not null
            and lower(coalesce(e.subject_code,''))=lower(p.subject_code)
            and (p.choice_group is null or lower(btrim(e.name_th))=lower(btrim(p.subject_name)))
          )
          or (
            p.subject_code is null and lower(btrim(e.name_th))=lower(btrim(p.subject_name)) and e.subject_type='activity'
          )
        )
    )::int
  into v_core_missing,v_activity_missing
  from public.lao_curriculum_preset_items p
  where p.preset_code='core_2551_2560' and p.grade_code=p_grade_code;

  select c.confirmed_at
  into v_confirmed_at
  from public.lao_curriculum_structure_confirmations c
  where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
    and c.program_id is not distinct from p_program_id and c.grade_code=p_grade_code
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
    'schedule_slot_count',v_schedule_slot_count,
    'parallel_group_count',v_parallel_group_count,
    'parallel_variant_count',v_parallel_variant_count,
    'parallel_mismatch_count',v_parallel_mismatch_count,
    'missing_time_count',v_missing_time,
    'central_core_missing_count',v_core_missing,
    'default_activity_missing_count',v_activity_missing,
    'weekly_periods_total',v_weekly_periods,
    'periods_per_week_capacity',case when v_schedule_configured then v_capacity else null end,
    'periods_per_week_gap',case when v_schedule_configured then v_period_gap else null end,
    'annual_hours_total',v_total_hours,
    'schedule_configured',v_schedule_configured,
    'school_days_per_week',v_days,
    'periods_per_day',v_periods_day,
    'minutes_per_period',v_minutes,
    'instructional_weeks_per_year',v_weeks,
    'fingerprint',v_fingerprint,
    'is_confirmed',v_confirmed,
    'confirmed_at',v_confirmed_at,
    'is_ready_to_confirm',(
      v_course_count>0 and v_schedule_configured and v_missing_time=0
      and v_parallel_mismatch_count=0 and abs(v_period_gap)<0.001
    ),
    'status',case
      when v_confirmed then 'confirmed'
      when v_course_count=0 then 'empty'
      when not v_schedule_configured then 'needs_schedule_settings'
      when v_missing_time>0 then 'needs_time'
      when v_parallel_mismatch_count>0 then 'parallel_time_mismatch'
      when v_period_gap>0.001 then 'needs_periods'
      when v_period_gap< -0.001 then 'over_periods'
      else 'ready_to_confirm'
    end
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.lao_import_curriculum_catalog(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_scope text DEFAULT 'core'::text, p_program_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_row record;
  v_subject_id uuid;
  v_course_id uuid;
  v_term record;
  v_added_subjects integer := 0;
  v_added_courses integer := 0;
  v_added_term_plans integer := 0;
  v_existing_courses integer := 0;
  v_total integer := 0;
  v_grade_label text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then
    raise exception 'ฐานกลางรองรับระดับ ป.1–ม.6';
  end if;
  if p_scope not in ('core','additional','activity','all') then
    raise exception 'ประเภทชุดรายวิชาไม่ถูกต้อง';
  end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;

  for v_row in
    select *
    from public.lao_curriculum_preset_items
    where preset_code='core_2551_2560'
      and grade_code=p_grade_code
      and coalesce(auto_apply,true)
      and (
        p_scope='all'
        or (p_scope='core' and coalesce(is_national_core,false))
        or (p_scope='additional' and subject_type='additional' and not coalesce(is_national_core,false))
        or (p_scope='activity' and subject_type='activity')
      )
    order by sort_order
  loop
    v_total:=v_total+1;
    v_grade_label:=v_row.grade_label;
    v_subject_id:=null;
    v_course_id:=null;

    if v_row.subject_code is not null then
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(coalesce(subject_code,''))=lower(v_row.subject_code)
      limit 1;
    else
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(btrim(name_th))=lower(btrim(v_row.subject_name))
        and subject_type=v_row.subject_type
      order by is_active desc,created_at
      limit 1;
    end if;

    if v_subject_id is null then
      insert into public.lao_subjects(
        school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,v_row.subject_code,v_row.subject_name,v_row.learning_area,
        v_row.subject_type,true,v_row.sort_order,v_uid,v_uid
      ) returning id into v_subject_id;
      v_added_subjects:=v_added_subjects+1;
    end if;

    select id into v_course_id
    from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and lower(btrim(grade_label))=lower(btrim(v_row.grade_label))
      and program_id is not distinct from p_program_id
      and subject_id=v_subject_id
    limit 1;

    if v_course_id is null then
      insert into public.lao_curriculum_courses(
        school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
        annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,p_academic_year_id,p_program_id,v_row.grade_code,v_row.grade_label,v_subject_id,
        v_row.annual_hours,null,
        case
          when p_scope='core' then 'นำเข้าจากฐานกลางรายวิชาพื้นฐาน'
          when p_scope='additional' then 'นำเข้าจากฐานกลางตัวอย่างรายวิชาเพิ่มเติม'
          when p_scope='activity' then 'ค่าพื้นฐานกลางกิจกรรมพัฒนาผู้เรียน'
          else 'นำเข้าจากฐานกลางรายวิชา'
        end,
        true,v_row.sort_order,v_uid,v_uid
      ) returning id into v_course_id;
      v_added_courses:=v_added_courses+1;
    else
      v_existing_courses:=v_existing_courses+1;
    end if;

    if v_row.weekly_periods is not null then
      for v_term in select id from public.lao_terms where academic_year_id=p_academic_year_id order by term_no
      loop
        if not exists(select 1 from public.lao_course_term_plans where course_id=v_course_id and term_id=v_term.id) then
          insert into public.lao_course_term_plans(
            course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
          ) values(
            v_course_id,v_term.id,v_row.weekly_periods,null,'ค่าเริ่มต้นจากฐานกลาง แก้ไขได้ตามบริบทสถานศึกษา',v_uid,v_uid
          );
          v_added_term_plans:=v_added_term_plans+1;
        end if;
      end loop;
    end if;
  end loop;

  if v_added_subjects>0 or v_added_courses>0 or v_added_term_plans>0 then
    insert into public.lao_audit_logs(
      organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
    ) values(
      v_org,p_school_id,v_uid,'curriculum_catalog_imported','academic_year',p_academic_year_id::text,
      jsonb_build_object(
        'grade_code',p_grade_code,'grade_label',v_grade_label,'scope',p_scope,'program_id',p_program_id,
        'template_items',v_total,'added_subjects',v_added_subjects,'added_courses',v_added_courses,
        'existing_courses',v_existing_courses,'added_term_plans',v_added_term_plans
      )
    );
  end if;

  return jsonb_build_object(
    'grade_code',p_grade_code,'grade_label',v_grade_label,'scope',p_scope,
    'template_items',v_total,'added_subjects',v_added_subjects,'added_courses',v_added_courses,
    'existing_courses',v_existing_courses,'added_term_plans',v_added_term_plans
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.lao_select_student_activity(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_choice_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select id into v_item_id
  from public.lao_curriculum_preset_items
  where preset_code='core_2551_2560'
    and grade_code=p_grade_code
    and subject_type='activity'
    and choice_group='student_activity'
    and choice_key=p_choice_key
  limit 1;

  if v_item_id is null then raise exception 'ไม่พบตัวเลือกกิจกรรมนักเรียน'; end if;

  return public.lao_add_curriculum_library_item(
    p_school_id,p_academic_year_id,null,p_grade_code,'preset',v_item_id
  );
end;
$function$


commit;

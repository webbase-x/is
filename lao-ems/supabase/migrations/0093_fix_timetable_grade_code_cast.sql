-- 0093_fix_timetable_grade_code_cast.sql
-- Fix timetable grade sorting for alphanumeric grade codes such as K1, P4 and M3.
-- Use a digit allow-list instead of a backslash escape pattern, avoiding P4 -> integer cast failures.

begin;

create or replace function public.lao_timetable_scope(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_term_id uuid default null,
  p_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_year uuid;
  v_term uuid;
  v_version uuid;
  v_selected text[] := '{}'::text[];
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (
    public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.timetable','view')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','edit')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','approve')
  ) then raise exception 'ไม่มีสิทธิ์ดูตารางสอน'; end if;

  select ay.id into v_year
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
  order by case when ay.id=p_academic_year_id then 0 when ay.is_current then 1 else 2 end,ay.year_be desc
  limit 1;

  if v_year is not null then
    select t.id into v_term
    from public.lao_terms t
    where t.academic_year_id=v_year
    order by case when t.id=p_term_id then 0 when t.is_current then 1 else 2 end,t.term_no
    limit 1;
  end if;

  if v_term is not null then
    select tv.id,tv.selected_grade_codes into v_version,v_selected
    from public.lao_timetable_versions tv
    where tv.school_id=p_school_id and tv.term_id=v_term
    order by case when tv.id=p_version_id then 0 when tv.status='active' then 1 else 2 end,
             tv.version_date desc,tv.version_no desc,tv.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'selected_year_id',v_year,
    'selected_term_id',v_term,
    'selected_version_id',v_version,
    'selected_grade_codes',coalesce(to_jsonb(v_selected),'[]'::jsonb),
    'source_summary',jsonb_build_object(
      'personnel_count',(
        select count(*) from public.lao_personnel p
        where p.school_id=p_school_id and p.employment_status='active'
      ),
      'class_count',(
        select count(*) from public.lao_class_sections c
        where c.school_id=p_school_id and c.academic_year_id=v_year and c.source_type='lec' and c.is_active
      ),
      'curriculum_course_count',(
        select count(*) from public.lao_curriculum_courses c
        where c.school_id=p_school_id and c.academic_year_id=v_year and c.is_active
      ),
      'approved_workload_count',(
        select count(*) from public.lao_teaching_workloads w
        where w.school_id=p_school_id and w.academic_year_id=v_year
          and (v_term is null or w.term_id=v_term) and w.status='approved'
      ),
      'approved_offering_count',(
        select count(*)
        from public.lao_teaching_workloads w
        join public.lao_teaching_workload_items wi on wi.workload_id=w.id
        where w.school_id=p_school_id and w.academic_year_id=v_year
          and (v_term is null or w.term_id=v_term) and w.status='approved'
      )
    ),
    'grades',coalesce((
      with grades as (
        select distinct c.grade_code,c.grade_label
        from public.lao_class_sections c
        where c.school_id=p_school_id and c.academic_year_id=v_year
          and c.source_type='lec' and c.is_active and nullif(c.grade_code,'') is not null
      )
      select jsonb_agg(jsonb_build_object(
        'grade_code',g.grade_code,
        'grade_label',g.grade_label,
        'class_count',(
          select count(*) from public.lao_class_sections c
          where c.school_id=p_school_id and c.academic_year_id=v_year and c.source_type='lec' and c.is_active
            and c.grade_code=g.grade_code
        ),
        'curriculum_course_count',(
          select count(*) from public.lao_curriculum_courses cc
          where cc.school_id=p_school_id and cc.academic_year_id=v_year and cc.is_active
            and (cc.grade_code=g.grade_code or (cc.grade_code is null and cc.grade_label=g.grade_label))
        ),
        'approved_assignment_count',(
          select count(*)
          from public.lao_teaching_workloads w
          join public.lao_teaching_workload_items wi on wi.workload_id=w.id
          join public.lao_class_sections cls on cls.id=wi.class_section_id
          where w.school_id=p_school_id and w.academic_year_id=v_year
            and (v_term is null or w.term_id=v_term) and w.status='approved'
            and cls.grade_code=g.grade_code and cls.is_active
        ),
        'teacher_count',(
          select count(distinct w.personnel_id)
          from public.lao_teaching_workloads w
          join public.lao_teaching_workload_items wi on wi.workload_id=w.id
          join public.lao_class_sections cls on cls.id=wi.class_section_id
          where w.school_id=p_school_id and w.academic_year_id=v_year
            and (v_term is null or w.term_id=v_term) and w.status='approved'
            and cls.grade_code=g.grade_code and cls.is_active
        ),
        'target_periods',coalesce((
          select sum(wi.weekly_periods)
          from public.lao_teaching_workloads w
          join public.lao_teaching_workload_items wi on wi.workload_id=w.id
          join public.lao_class_sections cls on cls.id=wi.class_section_id
          where w.school_id=p_school_id and w.academic_year_id=v_year
            and (v_term is null or w.term_id=v_term) and w.status='approved'
            and cls.grade_code=g.grade_code and cls.is_active
        ),0),
        'ready',(
          exists(
            select 1 from public.lao_curriculum_courses cc
            where cc.school_id=p_school_id and cc.academic_year_id=v_year and cc.is_active
              and (cc.grade_code=g.grade_code or (cc.grade_code is null and cc.grade_label=g.grade_label))
          )
          and exists(
            select 1
            from public.lao_teaching_workloads w
            join public.lao_teaching_workload_items wi on wi.workload_id=w.id
            join public.lao_class_sections cls on cls.id=wi.class_section_id
            where w.school_id=p_school_id and w.academic_year_id=v_year
              and (v_term is null or w.term_id=v_term) and w.status='approved'
              and cls.grade_code=g.grade_code and cls.is_active
          )
        )
      ) order by
        case when g.grade_code like 'K%' then 0 when g.grade_code like 'P%' then 100 when g.grade_code like 'M%' then 200 else 900 end
        + coalesce(nullif(regexp_replace(g.grade_code,'[^0-9]','','g'),''),'0')::int
      )
      from grades g
    ),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.lao_save_timetable_version_v2(
  p_school_id uuid,
  p_term_id uuid,
  p_version_id uuid default null,
  p_version_date date default current_date,
  p_title text default null,
  p_note text default null,
  p_entries jsonb default '[]'::jsonb,
  p_activate boolean default false,
  p_grade_codes text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_year uuid;
  v_codes text[];
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (
    public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.timetable','edit')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','approve')
  ) then raise exception 'ไม่มีสิทธิ์แก้ไขตารางสอน'; end if;

  select ay.id into v_year
  from public.lao_terms t
  join public.lao_academic_years ay on ay.id=t.academic_year_id
  where t.id=p_term_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'ไม่พบภาคเรียนที่เลือก'; end if;

  select coalesce(array_agg(x.code order by x.grade_sort),'{}'::text[]) into v_codes
  from (
    select distinct upper(btrim(g.code)) as code,
      case when upper(btrim(g.code)) like 'K%' then 0
           when upper(btrim(g.code)) like 'P%' then 100
           when upper(btrim(g.code)) like 'M%' then 200 else 900 end
      + coalesce(nullif(regexp_replace(upper(btrim(g.code)),'[^0-9]','','g'),''),'0')::int as grade_sort
    from unnest(coalesce(p_grade_codes,'{}'::text[])) as g(code)
    where nullif(btrim(g.code),'') is not null
  ) x;

  if coalesce(array_length(v_codes,1),0)=0 then
    select coalesce(array_agg(x.grade_code order by x.grade_sort),'{}'::text[]) into v_codes
    from (
      select distinct cls.grade_code,
        case when cls.grade_code like 'K%' then 0 when cls.grade_code like 'P%' then 100
             when cls.grade_code like 'M%' then 200 else 900 end
        + coalesce(nullif(regexp_replace(cls.grade_code,'[^0-9]','','g'),''),'0')::int as grade_sort
      from public.lao_teaching_workloads w
      join public.lao_teaching_workload_items wi on wi.workload_id=w.id
      join public.lao_class_sections cls on cls.id=wi.class_section_id
      where w.school_id=p_school_id and w.academic_year_id=v_year and w.term_id=p_term_id
        and w.status='approved' and cls.is_active and nullif(cls.grade_code,'') is not null
    ) x;
  end if;

  if coalesce(array_length(v_codes,1),0)=0 then
    raise exception 'ยังไม่มีระดับชั้นที่มีภาระงานสอนอนุมัติสำหรับจัดตาราง';
  end if;

  if exists(
    select 1 from unnest(v_codes) code
    where not exists(
      select 1 from public.lao_class_sections cls
      where cls.school_id=p_school_id and cls.academic_year_id=v_year and cls.is_active
        and cls.source_type='lec' and upper(cls.grade_code)=code
    )
  ) then raise exception 'พบระดับชั้นที่ไม่อยู่ในโครงสร้างชั้นเรียนของปีการศึกษานี้'; end if;

  if p_entries is not null and jsonb_typeof(p_entries)='array' and exists(
    select 1
    from jsonb_array_elements(p_entries) e
    join public.lao_class_sections cls on cls.id=(e->>'class_section_id')::uuid
    where not (upper(cls.grade_code)=any(v_codes))
  ) then
    raise exception 'ยังมีคาบของระดับชั้นที่ถูกนำออกจากขอบเขต กรุณาลบคาบของระดับนั้นก่อนบันทึก';
  end if;

  v_result:=public.lao_save_timetable_version(
    p_school_id,p_term_id,p_version_id,p_version_date,p_title,p_note,p_entries,p_activate
  );

  update public.lao_timetable_versions tv
  set selected_grade_codes=v_codes,updated_by=v_uid
  where tv.id=(v_result->>'id')::uuid and tv.school_id=p_school_id;

  return v_result || jsonb_build_object('selected_grade_codes',to_jsonb(v_codes));
end;
$function$;


revoke all on function public.lao_timetable_scope(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.lao_save_timetable_version_v2(uuid,uuid,uuid,date,text,text,jsonb,boolean,text[]) from public,anon;
grant execute on function public.lao_timetable_scope(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.lao_save_timetable_version_v2(uuid,uuid,uuid,date,text,text,jsonb,boolean,text[]) to authenticated;

notify pgrst,'reload schema';
commit;

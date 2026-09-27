-- Student roster grouped/sorted by class with boys before girls, then student number.

create or replace function public.lao_student_directory(
  p_school_id uuid,
  p_search text default null,
  p_year_be integer default null,
  p_term_no smallint default null,
  p_grade_level text default null,
  p_classroom text default null,
  p_presence text default null,
  p_limit integer default 1000,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_year integer;
  v_term smallint;
  v_search text := nullif(btrim(p_search),'');
  v_digits text := regexp_replace(coalesce(p_search,''),'\D','','g');
  v_limit integer := greatest(1,least(coalesce(p_limit,1000),2000));
  v_offset integer := greatest(0,coalesce(p_offset,0));
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_can_view_student_directory(p_school_id) then
    raise exception 'Access denied';
  end if;

  select coalesce(
    p_year_be,
    (select max(ay.year_be) from public.lao_academic_years ay where ay.school_id=p_school_id)
  ) into v_year;

  if v_year is null then
    return jsonb_build_object(
      'selected_year',null,'selected_term',null,
      'stats',jsonb_build_object('school_total',0,'period_total',0,'present',0,'not_in_latest',0),
      'filters',jsonb_build_object('years','[]'::jsonb,'terms','[]'::jsonb,'grades','[]'::jsonb,'classrooms','[]'::jsonb),
      'total',0,'items','[]'::jsonb
    );
  end if;

  select coalesce(
    p_term_no,
    (
      select max(t.term_no)
      from public.lao_terms t
      join public.lao_academic_years ay on ay.id=t.academic_year_id
      where ay.school_id=p_school_id and ay.year_be=v_year
    )
  ) into v_term;

  with period_rows as (
    select
      st.id as student_id,
      sr.student_no,
      st.prefix,
      st.first_name_th,
      st.last_name_th,
      concat_ws('',st.prefix,st.first_name_th,' ',st.last_name_th) as full_name,
      st.citizen_id,
      st.birth_date,
      e.grade_level,
      e.classroom,
      coalesce(
        nullif(lr.canonical_data->>'gender',''),
        nullif(lr.raw_data->>'LEC คอลัมน์ 7',''),
        case
          when st.prefix in ('เด็กชาย','นาย') or coalesce(st.prefix,'') like '%ชาย%' then 'ชาย'
          when st.prefix in ('เด็กหญิง','นางสาว','นาง') or coalesce(st.prefix,'') like '%หญิง%' then 'หญิง'
          else 'ไม่ระบุ'
        end
      ) as gender,
      e.lec_presence_status,
      sr.registry_status,
      sr.lec_student_condition
    from public.lao_student_term_enrollments e
    join public.lao_students st on st.id=e.student_id
    join public.lao_student_school_records sr
      on sr.student_id=st.id and sr.school_id=e.school_id
    join public.lao_academic_years ay on ay.id=e.academic_year_id
    join public.lao_terms t on t.id=e.term_id
    left join public.lao_lec_import_rows lr
      on lr.batch_id=e.source_batch_id
     and lr.source_row_no=e.source_row_no
    where e.school_id=p_school_id
      and ay.year_be=v_year
      and t.term_no=v_term
  ),
  filtered as (
    select *,
      case
        when grade_level like 'อนุบาล%' then 0
        when grade_level like 'ประถมศึกษาปีที่%' then 1
        when grade_level like 'มัธยมศึกษาปีที่%' then 2
        else 9
      end as grade_group,
      coalesce(nullif(regexp_replace(coalesce(grade_level,''),'\D','','g'),''),'999')::integer as grade_number,
      coalesce(nullif(regexp_replace(coalesce(classroom,''),'\D','','g'),''),'999')::integer as classroom_number,
      case when gender='ชาย' then 0 when gender='หญิง' then 1 else 2 end as gender_order,
      case when student_no ~ '^\d+$' then student_no::bigint else null end as student_no_number
    from period_rows r
    where (p_grade_level is null or p_grade_level='' or r.grade_level=p_grade_level)
      and (p_classroom is null or p_classroom='' or r.classroom=p_classroom)
      and (p_presence is null or p_presence='' or r.lec_presence_status=p_presence)
      and (
        v_search is null
        or coalesce(r.student_no,'') ilike '%'||v_search||'%'
        or coalesce(r.first_name_th,'') ilike '%'||v_search||'%'
        or coalesce(r.last_name_th,'') ilike '%'||v_search||'%'
        or coalesce(r.full_name,'') ilike '%'||v_search||'%'
        or (length(v_digits)>0 and coalesce(r.citizen_id,'') like '%'||v_digits||'%')
      )
  ),
  page_rows as (
    select *
    from filtered
    order by
      grade_group,
      grade_number,
      grade_level,
      classroom_number,
      classroom,
      gender_order,
      student_no_number nulls last,
      student_no,
      first_name_th,
      last_name_th
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'selected_year',v_year,
    'selected_term',v_term,
    'stats',jsonb_build_object(
      'school_total',(select count(*) from public.lao_student_school_records sr where sr.school_id=p_school_id),
      'period_total',(select count(*) from period_rows),
      'present',(select count(*) from period_rows where lec_presence_status='present'),
      'not_in_latest',(select count(*) from period_rows where lec_presence_status='not_in_latest_lec')
    ),
    'filters',jsonb_build_object(
      'years',coalesce((
        select jsonb_agg(y.year_be order by y.year_be desc)
        from (select distinct ay.year_be from public.lao_academic_years ay where ay.school_id=p_school_id) y
      ),'[]'::jsonb),
      'terms',coalesce((
        select jsonb_agg(x.term_no order by x.term_no)
        from (
          select distinct t.term_no
          from public.lao_terms t
          join public.lao_academic_years ay on ay.id=t.academic_year_id
          where ay.school_id=p_school_id and ay.year_be=v_year
        ) x
      ),'[]'::jsonb),
      'grades',coalesce((
        select jsonb_agg(x.grade_level order by
          case when x.grade_level like 'อนุบาล%' then 0 when x.grade_level like 'ประถมศึกษาปีที่%' then 1 when x.grade_level like 'มัธยมศึกษาปีที่%' then 2 else 9 end,
          coalesce(nullif(regexp_replace(x.grade_level,'\D','','g'),''),'999')::integer,
          x.grade_level
        )
        from (select distinct grade_level from period_rows where grade_level is not null and grade_level<>'') x
      ),'[]'::jsonb),
      'classrooms',coalesce((
        select jsonb_agg(x.classroom order by
          coalesce(nullif(regexp_replace(x.classroom,'\D','','g'),''),'999')::integer,
          x.classroom
        )
        from (select distinct classroom from period_rows where classroom is not null and classroom<>'') x
      ),'[]'::jsonb)
    ),
    'total',(select count(*) from filtered),
    'offset',v_offset,
    'limit',v_limit,
    'items',coalesce((
      select jsonb_agg(
        to_jsonb(p)
          - 'citizen_id'
          - 'grade_group'
          - 'grade_number'
          - 'classroom_number'
          - 'gender_order'
          - 'student_no_number'
        order by
          p.grade_group,p.grade_number,p.grade_level,
          p.classroom_number,p.classroom,
          p.gender_order,p.student_no_number nulls last,p.student_no,p.first_name_th,p.last_name_th
      )
      from page_rows p
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.lao_student_directory(uuid,text,integer,smallint,text,text,text,integer,integer) from public, anon;
grant execute on function public.lao_student_directory(uuid,text,integer,smallint,text,text,text,integer,integer) to authenticated;

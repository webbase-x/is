-- Harden student directory access so student/guardian memberships cannot enumerate the school roster.

create or replace function public.lao_can_view_student_directory(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_platform_admin()
  or exists(
    select 1
    from public.lao_schools s
    join public.lao_memberships m
      on m.organization_id=s.organization_id
      and (m.school_id is null or m.school_id=s.id)
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where s.id=p_school_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and r.code in (
        'organization_admin','organization_viewer',
        'school_admin','school_executive','registrar','academic_officer','teacher','staff'
      )
  );
$$;

revoke all on function public.lao_can_view_student_directory(uuid) from public, anon;
grant execute on function public.lao_can_view_student_directory(uuid) to authenticated;

create or replace function public.lao_student_directory(
  p_school_id uuid,
  p_search text default null,
  p_year_be integer default null,
  p_term_no smallint default null,
  p_grade_level text default null,
  p_classroom text default null,
  p_presence text default null,
  p_limit integer default 100,
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
  v_limit integer := greatest(1,least(coalesce(p_limit,100),200));
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
      e.lec_presence_status,
      sr.registry_status,
      sr.lec_student_condition
    from public.lao_student_term_enrollments e
    join public.lao_students st on st.id=e.student_id
    join public.lao_student_school_records sr
      on sr.student_id=st.id and sr.school_id=e.school_id
    join public.lao_academic_years ay on ay.id=e.academic_year_id
    join public.lao_terms t on t.id=e.term_id
    where e.school_id=p_school_id
      and ay.year_be=v_year
      and t.term_no=v_term
  ),
  filtered as (
    select *
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
    select
      student_id,
      student_no,
      prefix,
      first_name_th,
      last_name_th,
      full_name,
      birth_date,
      grade_level,
      classroom,
      lec_presence_status,
      registry_status,
      lec_student_condition
    from filtered
    order by
      case
        when grade_level like 'อนุบาล%' then 0
        when grade_level like 'ประถมศึกษาปีที่%' then 1
        else 2
      end,
      grade_level,
      nullif(regexp_replace(coalesce(classroom,''),'\D','','g'),'')::integer nulls last,
      classroom,
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
        select jsonb_agg(x.grade_level order by x.grade_level)
        from (select distinct grade_level from period_rows where grade_level is not null and grade_level<>'') x
      ),'[]'::jsonb),
      'classrooms',coalesce((
        select jsonb_agg(x.classroom order by x.classroom)
        from (select distinct classroom from period_rows where classroom is not null and classroom<>'') x
      ),'[]'::jsonb)
    ),
    'total',(select count(*) from filtered),
    'offset',v_offset,
    'limit',v_limit,
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.grade_level,p.classroom,p.student_no,p.first_name_th,p.last_name_th) from page_rows p),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.lao_student_detail(
  p_school_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_can_view_student_directory(p_school_id) then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'student_id',st.id,
    'student_no',sr.student_no,
    'prefix',st.prefix,
    'first_name_th',st.first_name_th,
    'last_name_th',st.last_name_th,
    'full_name',concat_ws('',st.prefix,st.first_name_th,' ',st.last_name_th),
    'citizen_id_masked',case
      when st.citizen_id is null then null
      else repeat('•',greatest(length(st.citizen_id)-4,0))||right(st.citizen_id,4)
    end,
    'birth_date',st.birth_date,
    'race',st.race,
    'nationality',st.nationality,
    'religion',st.religion,
    'admission_date',sr.admission_date,
    'student_condition',sr.lec_student_condition,
    'presence_status',sr.lec_presence_status,
    'registry_status',sr.registry_status,
    'source','LEC',
    'last_seen_at',sr.last_seen_at,
    'enrollments',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'year_be',ay.year_be,
          'term_no',t.term_no,
          'grade_level',e.grade_level,
          'classroom',e.classroom,
          'presence_status',e.lec_presence_status
        )
        order by ay.year_be desc,t.term_no desc
      )
      from public.lao_student_term_enrollments e
      join public.lao_academic_years ay on ay.id=e.academic_year_id
      join public.lao_terms t on t.id=e.term_id
      where e.school_id=p_school_id and e.student_id=st.id
    ),'[]'::jsonb)
  )
  into v_result
  from public.lao_students st
  join public.lao_student_school_records sr on sr.student_id=st.id
  where st.id=p_student_id and sr.school_id=p_school_id;

  if v_result is null then raise exception 'Student not found'; end if;
  return v_result;
end;
$$;

revoke all on function public.lao_student_directory(uuid,text,integer,smallint,text,text,text,integer,integer) from public, anon;
grant execute on function public.lao_student_directory(uuid,text,integer,smallint,text,text,text,integer,integer) to authenticated;
revoke all on function public.lao_student_detail(uuid,uuid) from public, anon;
grant execute on function public.lao_student_detail(uuid,uuid) to authenticated;

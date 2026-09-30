create or replace function public.lao_ensure_required_curriculum_defaults(
  p_school_id uuid,
  p_academic_year_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_grade record;
  v_row record;
  v_term record;
  v_subject_id uuid;
  v_course_id uuid;
  v_added_subjects integer := 0;
  v_added_courses integer := 0;
  v_added_term_plans integer := 0;
  v_activity_courses integer := 0;
  v_grade_count integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  for v_grade in
    select distinct
      coalesce(
        nullif(c.grade_code,''),
        case
          when lower(c.grade_label) like '%ประถมศึกษาปีที่ 1%' or lower(c.grade_label) in ('ป.1','p1') then 'P1'
          when lower(c.grade_label) like '%ประถมศึกษาปีที่ 2%' or lower(c.grade_label) in ('ป.2','p2') then 'P2'
          when lower(c.grade_label) like '%ประถมศึกษาปีที่ 3%' or lower(c.grade_label) in ('ป.3','p3') then 'P3'
          when lower(c.grade_label) like '%ประถมศึกษาปีที่ 4%' or lower(c.grade_label) in ('ป.4','p4') then 'P4'
          when lower(c.grade_label) like '%ประถมศึกษาปีที่ 5%' or lower(c.grade_label) in ('ป.5','p5') then 'P5'
          when lower(c.grade_label) like '%ประถมศึกษาปีที่ 6%' or lower(c.grade_label) in ('ป.6','p6') then 'P6'
          when lower(c.grade_label) like '%มัธยมศึกษาปีที่ 1%' or lower(c.grade_label) in ('ม.1','m1') then 'M1'
          when lower(c.grade_label) like '%มัธยมศึกษาปีที่ 2%' or lower(c.grade_label) in ('ม.2','m2') then 'M2'
          when lower(c.grade_label) like '%มัธยมศึกษาปีที่ 3%' or lower(c.grade_label) in ('ม.3','m3') then 'M3'
          when lower(c.grade_label) like '%มัธยมศึกษาปีที่ 4%' or lower(c.grade_label) in ('ม.4','m4') then 'M4'
          when lower(c.grade_label) like '%มัธยมศึกษาปีที่ 5%' or lower(c.grade_label) in ('ม.5','m5') then 'M5'
          when lower(c.grade_label) like '%มัธยมศึกษาปีที่ 6%' or lower(c.grade_label) in ('ม.6','m6') then 'M6'
        end
      ) as grade_code,
      c.grade_label
    from public.lao_class_sections c
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.is_active
      and c.source_type='lec'
  loop
    if v_grade.grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then
      continue;
    end if;
    v_grade_count:=v_grade_count+1;

    for v_row in
      select *
      from public.lao_curriculum_preset_items
      where preset_code='normal_primary_example'
        and grade_code=v_grade.grade_code
        and coalesce(is_national_core,false)
      order by sort_order
    loop
      v_subject_id:=null;
      v_course_id:=null;

      if v_row.subject_code is not null then
        select id into v_subject_id
        from public.lao_subjects
        where school_id=p_school_id
          and lower(coalesce(subject_code,''))=lower(v_row.subject_code)
        limit 1;
      end if;

      if v_subject_id is null then
        select id into v_subject_id
        from public.lao_subjects
        where school_id=p_school_id
          and lower(btrim(name_th))=lower(btrim(v_row.subject_name))
          and subject_type='basic'
        order by is_active desc,created_at
        limit 1;
      end if;

      if v_subject_id is null then
        insert into public.lao_subjects(
          school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
        ) values(
          p_school_id,v_row.subject_code,v_row.subject_name,v_row.learning_area,'basic',
          true,v_row.sort_order,v_uid,v_uid
        ) returning id into v_subject_id;
        v_added_subjects:=v_added_subjects+1;
      end if;

      select id into v_course_id
      from public.lao_curriculum_courses
      where school_id=p_school_id
        and academic_year_id=p_academic_year_id
        and program_id is null
        and grade_code=v_grade.grade_code
        and subject_id=v_subject_id
      limit 1;

      if v_course_id is null then
        insert into public.lao_curriculum_courses(
          school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
          annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
        ) values(
          p_school_id,p_academic_year_id,null,v_grade.grade_code,v_row.grade_label,v_subject_id,
          v_row.annual_hours,null,'ค่าพื้นฐานกลางอัตโนมัติ · โรงเรียนปรับรายละเอียดได้ตามกรอบหลักสูตร',
          true,v_row.sort_order,v_uid,v_uid
        ) returning id into v_course_id;
        v_added_courses:=v_added_courses+1;
      end if;

      if v_row.weekly_periods is not null then
        for v_term in
          select id from public.lao_terms
          where academic_year_id=p_academic_year_id
          order by term_no
        loop
          if not exists(
            select 1 from public.lao_course_term_plans
            where course_id=v_course_id and term_id=v_term.id
          ) then
            insert into public.lao_course_term_plans(
              course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
            ) values(
              v_course_id,v_term.id,v_row.weekly_periods,null,
              'ค่าเริ่มต้นกลางอัตโนมัติ · ปรับได้ตามบริบทสถานศึกษา',
              v_uid,v_uid
            );
            v_added_term_plans:=v_added_term_plans+1;
          end if;
        end loop;
      end if;
    end loop;

    if not exists(
      select 1
      from public.lao_curriculum_courses c
      join public.lao_subjects s on s.id=c.subject_id
      where c.school_id=p_school_id
        and c.academic_year_id=p_academic_year_id
        and c.program_id is null
        and c.grade_code=v_grade.grade_code
        and c.is_active
        and s.subject_type='activity'
    ) then
      v_subject_id:=null;
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(btrim(name_th))=lower('กิจกรรมพัฒนาผู้เรียน')
        and subject_type='activity'
      order by is_active desc,created_at
      limit 1;

      if v_subject_id is null then
        insert into public.lao_subjects(
          school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
        ) values(
          p_school_id,null,'กิจกรรมพัฒนาผู้เรียน','กิจกรรมพัฒนาผู้เรียน','activity',
          true,900,v_uid,v_uid
        ) returning id into v_subject_id;
        v_added_subjects:=v_added_subjects+1;
      end if;

      insert into public.lao_curriculum_courses(
        school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
        annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,p_academic_year_id,null,v_grade.grade_code,
        case v_grade.grade_code
          when 'P1' then 'ประถมศึกษาปีที่ 1' when 'P2' then 'ประถมศึกษาปีที่ 2'
          when 'P3' then 'ประถมศึกษาปีที่ 3' when 'P4' then 'ประถมศึกษาปีที่ 4'
          when 'P5' then 'ประถมศึกษาปีที่ 5' when 'P6' then 'ประถมศึกษาปีที่ 6'
          when 'M1' then 'มัธยมศึกษาปีที่ 1' when 'M2' then 'มัธยมศึกษาปีที่ 2'
          when 'M3' then 'มัธยมศึกษาปีที่ 3' when 'M4' then 'มัธยมศึกษาปีที่ 4'
          when 'M5' then 'มัธยมศึกษาปีที่ 5' when 'M6' then 'มัธยมศึกษาปีที่ 6'
        end,
        v_subject_id,120,null,
        case when v_grade.grade_code in ('M4','M5','M6')
          then 'ค่าพื้นฐานกิจกรรมพัฒนาผู้เรียน 120 ชม./ปี (ค่าเฉลี่ยจากกรอบรวม 360 ชม. ม.4-6) · ปรับการกระจายเวลาได้'
          else 'ค่าพื้นฐานกิจกรรมพัฒนาผู้เรียน 120 ชม./ปี · แยกกิจกรรมแนะแนว กิจกรรมนักเรียน และกิจกรรมเพื่อสังคมฯ ได้ตามบริบท'
        end,
        true,900,v_uid,v_uid
      ) returning id into v_course_id;

      v_added_courses:=v_added_courses+1;
      v_activity_courses:=v_activity_courses+1;

      for v_term in
        select id from public.lao_terms
        where academic_year_id=p_academic_year_id
        order by term_no
      loop
        insert into public.lao_course_term_plans(
          course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
        ) values(
          v_course_id,v_term.id,3,null,
          'ค่าเริ่มต้น 3 ชม./สัปดาห์ · โรงเรียนปรับการจัดกิจกรรมได้',
          v_uid,v_uid
        ) on conflict do nothing;
        v_added_term_plans:=v_added_term_plans+1;
      end loop;
    end if;
  end loop;

  if v_added_courses>0 or v_added_subjects>0 or v_added_term_plans>0 then
    insert into public.lao_audit_logs(
      organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
    ) values(
      v_org,p_school_id,v_uid,'required_curriculum_defaults_ensured',
      'academic_year',p_academic_year_id::text,
      jsonb_build_object(
        'grade_count',v_grade_count,'added_subjects',v_added_subjects,
        'added_courses',v_added_courses,'added_activity_courses',v_activity_courses,
        'added_term_plans',v_added_term_plans
      )
    );
  end if;

  return jsonb_build_object(
    'grade_count',v_grade_count,'added_subjects',v_added_subjects,
    'added_courses',v_added_courses,'added_activity_courses',v_activity_courses,
    'added_term_plans',v_added_term_plans
  );
end;
$$;

revoke all on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) from public,anon;
grant execute on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) to authenticated;

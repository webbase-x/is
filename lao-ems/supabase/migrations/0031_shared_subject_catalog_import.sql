create or replace function public.lao_import_curriculum_catalog(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_grade_code text,
  p_scope text default 'core',
  p_program_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
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
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then raise exception 'ฐานกลางรองรับระดับ ป.1–ม.6'; end if;
  if p_scope not in ('core','additional','activity','all') then raise exception 'ประเภทชุดรายวิชาไม่ถูกต้อง'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then raise exception 'Academic year not found'; end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then raise exception 'Program not found'; end if;
  select organization_id into v_org from public.lao_schools where id=p_school_id;

  for v_row in
    select * from public.lao_curriculum_preset_items
    where preset_code='normal_primary_example' and grade_code=p_grade_code
      and (p_scope='all'
        or (p_scope='core' and coalesce(is_national_core,false))
        or (p_scope='additional' and subject_type='additional' and not coalesce(is_national_core,false))
        or (p_scope='activity' and subject_type='activity'))
    order by sort_order
  loop
    v_total:=v_total+1; v_grade_label:=v_row.grade_label; v_subject_id:=null; v_course_id:=null;
    if v_row.subject_code is not null then
      select id into v_subject_id from public.lao_subjects
      where school_id=p_school_id and lower(coalesce(subject_code,''))=lower(v_row.subject_code) limit 1;
    else
      select id into v_subject_id from public.lao_subjects
      where school_id=p_school_id and lower(btrim(name_th))=lower(btrim(v_row.subject_name)) and subject_type=v_row.subject_type
      order by is_active desc,created_at limit 1;
    end if;
    if v_subject_id is null then
      insert into public.lao_subjects(school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by)
      values(p_school_id,v_row.subject_code,v_row.subject_name,v_row.learning_area,v_row.subject_type,true,v_row.sort_order,v_uid,v_uid)
      returning id into v_subject_id;
      v_added_subjects:=v_added_subjects+1;
    end if;
    select id into v_course_id from public.lao_curriculum_courses
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and lower(btrim(grade_label))=lower(btrim(v_row.grade_label))
      and program_id is not distinct from p_program_id and subject_id=v_subject_id limit 1;
    if v_course_id is null then
      insert into public.lao_curriculum_courses(
        school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,p_academic_year_id,p_program_id,v_row.grade_code,v_row.grade_label,v_subject_id,v_row.annual_hours,null,
        case when p_scope='core' then 'นำเข้าจากฐานกลางรายวิชาพื้นฐาน'
             when p_scope='additional' then 'นำเข้าจากฐานกลางตัวอย่างรายวิชาเพิ่มเติม'
             when p_scope='activity' then 'นำเข้าจากฐานกลางกิจกรรมพัฒนาผู้เรียน'
             else 'นำเข้าจากฐานกลางรายวิชา' end,
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
          insert into public.lao_course_term_plans(course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by)
          values(v_course_id,v_term.id,v_row.weekly_periods,null,'ค่าเริ่มต้นจากฐานกลาง แก้ไขได้ตามบริบทสถานศึกษา',v_uid,v_uid);
          v_added_term_plans:=v_added_term_plans+1;
        end if;
      end loop;
    end if;
  end loop;

  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(v_org,p_school_id,v_uid,'curriculum_catalog_imported','academic_year',p_academic_year_id::text,
    jsonb_build_object('grade_code',p_grade_code,'grade_label',v_grade_label,'scope',p_scope,'program_id',p_program_id,
      'template_items',v_total,'added_subjects',v_added_subjects,'added_courses',v_added_courses,
      'existing_courses',v_existing_courses,'added_term_plans',v_added_term_plans));

  return jsonb_build_object('grade_code',p_grade_code,'grade_label',v_grade_label,'scope',p_scope,
    'template_items',v_total,'added_subjects',v_added_subjects,'added_courses',v_added_courses,
    'existing_courses',v_existing_courses,'added_term_plans',v_added_term_plans);
end;
$$;

revoke all on function public.lao_import_curriculum_catalog(uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.lao_import_curriculum_catalog(uuid,uuid,text,text,uuid) to authenticated;

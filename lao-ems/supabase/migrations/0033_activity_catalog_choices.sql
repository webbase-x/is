begin;

alter table public.lao_curriculum_preset_items
  add column if not exists choice_group text,
  add column if not exists choice_key text,
  add column if not exists auto_apply boolean not null default true;

delete from public.lao_curriculum_preset_items
where preset_code='normal_primary_example'
  and grade_code in ('P1','P2','P3','P4','P5','P6')
  and subject_type='activity';

insert into public.lao_curriculum_preset_items(
  preset_code,grade_code,grade_label,program_label,sort_order,
  subject_code,subject_name,weekly_periods,annual_hours,subject_type,learning_area,is_national_core,
  choice_group,choice_key,auto_apply
)
select 'normal_primary_example',v.grade_code,v.grade_label,'ห้องปกติ',v.sort_order,
       v.subject_code,v.subject_name,v.weekly_periods,v.annual_hours,'activity','กิจกรรมพัฒนาผู้เรียน',false,
       v.choice_group,v.choice_key,v.auto_apply
from (values
  ('P1','ประถมศึกษาปีที่ 1',900,'ก11901','กิจกรรมแนะแนว',1,40,null,null,true),
  ('P1','ประถมศึกษาปีที่ 1',901,'ก11902','ลูกเสือ/เนตรนารี',0.75,30,'student_activity','scout_guide',false),
  ('P1','ประถมศึกษาปีที่ 1',902,'ก11902','ลูกเสือ/ยุวกาชาด',0.75,30,'student_activity','red_cross_youth',false),
  ('P1','ประถมศึกษาปีที่ 1',903,'ก11903','ชุมนุม',1,40,null,null,true),
  ('P1','ประถมศึกษาปีที่ 1',904,'ก11904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,null,null,true),
  ('P2','ประถมศึกษาปีที่ 2',900,'ก12901','กิจกรรมแนะแนว',1,40,null,null,true),
  ('P2','ประถมศึกษาปีที่ 2',901,'ก12902','ลูกเสือ/เนตรนารี',0.75,30,'student_activity','scout_guide',false),
  ('P2','ประถมศึกษาปีที่ 2',902,'ก12902','ลูกเสือ/ยุวกาชาด',0.75,30,'student_activity','red_cross_youth',false),
  ('P2','ประถมศึกษาปีที่ 2',903,'ก12903','ชุมนุม',1,40,null,null,true),
  ('P2','ประถมศึกษาปีที่ 2',904,'ก12904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,null,null,true),
  ('P3','ประถมศึกษาปีที่ 3',900,'ก13901','กิจกรรมแนะแนว',1,40,null,null,true),
  ('P3','ประถมศึกษาปีที่ 3',901,'ก13902','ลูกเสือ/เนตรนารี',0.75,30,'student_activity','scout_guide',false),
  ('P3','ประถมศึกษาปีที่ 3',902,'ก13902','ลูกเสือ/ยุวกาชาด',0.75,30,'student_activity','red_cross_youth',false),
  ('P3','ประถมศึกษาปีที่ 3',903,'ก13903','ชุมนุม',1,40,null,null,true),
  ('P3','ประถมศึกษาปีที่ 3',904,'ก13904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,null,null,true),
  ('P4','ประถมศึกษาปีที่ 4',900,'ก14901','กิจกรรมแนะแนว',1,40,null,null,true),
  ('P4','ประถมศึกษาปีที่ 4',901,'ก14902','ลูกเสือ/เนตรนารี',0.75,30,'student_activity','scout_guide',false),
  ('P4','ประถมศึกษาปีที่ 4',902,'ก14902','ลูกเสือ/ยุวกาชาด',0.75,30,'student_activity','red_cross_youth',false),
  ('P4','ประถมศึกษาปีที่ 4',903,'ก14903','ชุมนุม',1,40,null,null,true),
  ('P4','ประถมศึกษาปีที่ 4',904,'ก14904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,null,null,true),
  ('P5','ประถมศึกษาปีที่ 5',900,'ก15901','กิจกรรมแนะแนว',1,40,null,null,true),
  ('P5','ประถมศึกษาปีที่ 5',901,'ก15902','ลูกเสือ/เนตรนารี',0.75,30,'student_activity','scout_guide',false),
  ('P5','ประถมศึกษาปีที่ 5',902,'ก15902','ลูกเสือ/ยุวกาชาด',0.75,30,'student_activity','red_cross_youth',false),
  ('P5','ประถมศึกษาปีที่ 5',903,'ก15903','ชุมนุม',1,40,null,null,true),
  ('P5','ประถมศึกษาปีที่ 5',904,'ก15904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,null,null,true),
  ('P6','ประถมศึกษาปีที่ 6',900,'ก16901','กิจกรรมแนะแนว',1,40,null,null,true),
  ('P6','ประถมศึกษาปีที่ 6',901,'ก16902','ลูกเสือ/เนตรนารี',0.75,30,'student_activity','scout_guide',false),
  ('P6','ประถมศึกษาปีที่ 6',902,'ก16902','ลูกเสือ/ยุวกาชาด',0.75,30,'student_activity','red_cross_youth',false),
  ('P6','ประถมศึกษาปีที่ 6',903,'ก16903','ชุมนุม',1,40,null,null,true),
  ('P6','ประถมศึกษาปีที่ 6',904,'ก16904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,null,null,true)
) as v(grade_code,grade_label,sort_order,subject_code,subject_name,weekly_periods,annual_hours,choice_group,choice_key,auto_apply);

delete from public.lao_course_term_plans
where course_id in (
  select c.id
  from public.lao_curriculum_courses c
  join public.lao_subjects s on s.id=c.subject_id
  where s.subject_type='activity'
    and s.name_th='ลูกเสือ/เนตรนารี/ยุวกาชาด'
);

delete from public.lao_curriculum_courses
where subject_id in (
  select id from public.lao_subjects
  where subject_type='activity'
    and name_th='ลูกเสือ/เนตรนารี/ยุวกาชาด'
);

delete from public.lao_subjects s
where s.subject_type='activity'
  and s.name_th='ลูกเสือ/เนตรนารี/ยุวกาชาด'
  and not exists(select 1 from public.lao_curriculum_courses c where c.subject_id=s.id);

CREATE OR REPLACE FUNCTION public.lao_apply_curriculum_preset(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_program_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return public.lao_import_curriculum_catalog(
    p_school_id,p_academic_year_id,p_grade_code,'all',p_program_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_curriculum_preset(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs
    where id=p_program_id and school_id=p_school_id
  ) then raise exception 'Program not found'; end if;

  select jsonb_build_object(
    'preset_code','normal_primary_example',
    'preset_name','ชุดหลักแผนปกติ · รายวิชาพื้นฐานกลาง ป.1–ม.6',
    'supported_grades',coalesce((
      select jsonb_agg(jsonb_build_object(
        'grade_code',x.grade_code,
        'grade_label',x.grade_label,
        'subject_count',x.subject_count,
        'weekly_total',x.weekly_total,
        'annual_total',x.annual_total,
        'hour_defined_count',x.hour_defined_count,
        'present_count',x.present_count
      ) order by x.grade_order)
      from (
        select
          p.grade_code,
          min(p.grade_label) as grade_label,
          case p.grade_code
            when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4
            when 'P5' then 5 when 'P6' then 6
            when 'M1' then 11 when 'M2' then 12 when 'M3' then 13
            when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
            else 99 end as grade_order,
          count(*) as subject_count,
          sum(p.weekly_periods) as weekly_total,
          sum(p.annual_hours) as annual_total,
          count(p.annual_hours) as hour_defined_count,
          count(*) filter(where exists(
            select 1
            from public.lao_curriculum_courses c
            join public.lao_subjects s on s.id=c.subject_id
            where c.school_id=p_school_id
              and c.academic_year_id=p_academic_year_id
              and lower(btrim(c.grade_label))=lower(btrim(p.grade_label))
              and c.program_id is not distinct from p_program_id
              and (
                (
                  p.choice_group is not null
                  and p.subject_code is not null
                  and lower(coalesce(s.subject_code,''))=lower(p.subject_code)
                  and lower(btrim(s.name_th))=lower(btrim(p.subject_name))
                )
                or
                (
                  p.choice_group is null
                  and (
                    (p.subject_code is not null and lower(coalesce(s.subject_code,''))=lower(p.subject_code))
                    or
                    (p.subject_code is null and lower(btrim(s.name_th))=lower(btrim(p.subject_name)) and s.subject_type=p.subject_type)
                  )
                )
              )
          )) as present_count
        from public.lao_curriculum_preset_items p
        where p.preset_code='normal_primary_example'
        group by p.grade_code
      ) x
    ),'[]'::jsonb),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'grade_code',p.grade_code,
        'grade_label',p.grade_label,
        'program_label',p.program_label,
        'sort_order',p.sort_order,
        'subject_code',p.subject_code,
        'subject_name',p.subject_name,
        'learning_area',p.learning_area,
        'weekly_periods',p.weekly_periods,
        'annual_hours',p.annual_hours,
        'subject_type',p.subject_type,
        'is_national_core',p.is_national_core,
        'choice_group',p.choice_group,
        'choice_key',p.choice_key,
        'auto_apply',p.auto_apply,
        'present',exists(
          select 1
          from public.lao_curriculum_courses c
          join public.lao_subjects s on s.id=c.subject_id
          where c.school_id=p_school_id
            and c.academic_year_id=p_academic_year_id
            and lower(btrim(c.grade_label))=lower(btrim(p.grade_label))
            and c.program_id is not distinct from p_program_id
            and (
              (
                p.choice_group is not null
                and p.subject_code is not null
                and lower(coalesce(s.subject_code,''))=lower(p.subject_code)
                and lower(btrim(s.name_th))=lower(btrim(p.subject_name))
              )
              or
              (
                p.choice_group is null
                and (
                  (p.subject_code is not null and lower(coalesce(s.subject_code,''))=lower(p.subject_code))
                  or
                  (p.subject_code is null and lower(btrim(s.name_th))=lower(btrim(p.subject_name)) and s.subject_type=p.subject_type)
                )
              )
            )
        )
      ) order by
        case p.grade_code
          when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4
          when 'P5' then 5 when 'P6' then 6
          when 'M1' then 11 when 'M2' then 12 when 'M3' then 13
          when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
          else 99 end,
        p.sort_order)
      from public.lao_curriculum_preset_items p
      where p.preset_code='normal_primary_example'
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
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
  v_added_subjects integer := 0;
  v_added_courses integer := 0;
  v_added_term_plans integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;

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
    v_core:=public.lao_import_curriculum_catalog(
      p_school_id,p_academic_year_id,v_grade.grade_code,'core',null
    );
    v_activity:=public.lao_import_curriculum_catalog(
      p_school_id,p_academic_year_id,v_grade.grade_code,'activity',null
    );
    v_added_subjects:=v_added_subjects
      +coalesce((v_core->>'added_subjects')::integer,0)
      +coalesce((v_activity->>'added_subjects')::integer,0);
    v_added_courses:=v_added_courses
      +coalesce((v_core->>'added_courses')::integer,0)
      +coalesce((v_activity->>'added_courses')::integer,0);
    v_added_term_plans:=v_added_term_plans
      +coalesce((v_core->>'added_term_plans')::integer,0)
      +coalesce((v_activity->>'added_term_plans')::integer,0);
  end loop;

  return jsonb_build_object(
    'grade_count',v_grade_count,
    'added_subjects',v_added_subjects,
    'added_courses',v_added_courses,
    'added_activity_courses',0,
    'added_term_plans',v_added_term_plans
  );
end;
$function$;

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
    where preset_code='normal_primary_example'
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
$function$;

CREATE OR REPLACE FUNCTION public.lao_select_student_activity(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_choice_key text)
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
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6') then
    raise exception 'กิจกรรมนักเรียนแบบเลือกใช้รองรับระดับ ป.1–ป.6';
  end if;
  if p_choice_key not in ('scout_guide','red_cross_youth') then
    raise exception 'ตัวเลือกกิจกรรมนักเรียนไม่ถูกต้อง';
  end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if not exists(
    select 1 from public.lao_class_sections
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and is_active
      and source_type='lec'
      and grade_code=p_grade_code
  ) then raise exception 'ไม่พบระดับชั้นนี้จาก LEC'; end if;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  select * into v_row
  from public.lao_curriculum_preset_items
  where preset_code='normal_primary_example'
    and grade_code=p_grade_code
    and subject_type='activity'
    and choice_group='student_activity'
    and choice_key=p_choice_key
  limit 1;

  if v_row.subject_code is null then
    raise exception 'ไม่พบตัวเลือกกิจกรรมนักเรียนในฐานกลาง';
  end if;

  select id into v_subject_id
  from public.lao_subjects
  where school_id=p_school_id
    and lower(coalesce(subject_code,''))=lower(v_row.subject_code)
  limit 1;

  if v_subject_id is null then
    insert into public.lao_subjects(
      school_id,subject_code,name_th,learning_area,subject_type,
      is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,v_row.subject_code,v_row.subject_name,'กิจกรรมพัฒนาผู้เรียน','activity',
      true,v_row.sort_order,v_uid,v_uid
    )
    returning id into v_subject_id;
  else
    update public.lao_subjects
    set name_th=v_row.subject_name,
        learning_area='กิจกรรมพัฒนาผู้เรียน',
        subject_type='activity',
        is_active=true,
        sort_order=v_row.sort_order,
        updated_by=v_uid,
        updated_at=now()
    where id=v_subject_id;
  end if;

  select id into v_course_id
  from public.lao_curriculum_courses
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and program_id is null
    and grade_code=p_grade_code
    and subject_id=v_subject_id
  limit 1;

  if v_course_id is null then
    insert into public.lao_curriculum_courses(
      school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
      annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,null,p_grade_code,v_row.grade_label,v_subject_id,
      v_row.annual_hours,null,
      'กิจกรรมนักเรียน · โรงเรียนเลือกจากฐานกลางกิจกรรมพัฒนาผู้เรียน',
      true,v_row.sort_order,v_uid,v_uid
    )
    returning id into v_course_id;
  else
    update public.lao_curriculum_courses
    set annual_hours=coalesce(annual_hours,v_row.annual_hours),
        notes='กิจกรรมนักเรียน · โรงเรียนเลือกจากฐานกลางกิจกรรมพัฒนาผู้เรียน',
        is_active=true,
        sort_order=v_row.sort_order,
        updated_by=v_uid,
        updated_at=now()
    where id=v_course_id;
  end if;

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
        'ค่าพื้นฐานกิจกรรมนักเรียน · โรงเรียนปรับเวลาได้ตามหลักสูตรสถานศึกษา',
        v_uid,v_uid
      );
    end if;
  end loop;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'student_activity_selected','academic_year',p_academic_year_id::text,
    jsonb_build_object(
      'grade_code',p_grade_code,
      'choice_key',p_choice_key,
      'subject_code',v_row.subject_code,
      'subject_name',v_row.subject_name
    )
  );

  return jsonb_build_object(
    'grade_code',p_grade_code,
    'choice_key',p_choice_key,
    'subject_code',v_row.subject_code,
    'subject_name',v_row.subject_name,
    'course_id',v_course_id
  );
end;
$function$;

revoke all on function public.lao_curriculum_preset(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_preset(uuid,uuid,uuid) to authenticated;
revoke all on function public.lao_import_curriculum_catalog(uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.lao_import_curriculum_catalog(uuid,uuid,text,text,uuid) to authenticated;
revoke all on function public.lao_apply_curriculum_preset(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_apply_curriculum_preset(uuid,uuid,text,uuid) to authenticated;
revoke all on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) from public,anon;
grant execute on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) to authenticated;
revoke all on function public.lao_select_student_activity(uuid,uuid,text,text) from public,anon;
grant execute on function public.lao_select_student_activity(uuid,uuid,text,text) to authenticated;

commit;

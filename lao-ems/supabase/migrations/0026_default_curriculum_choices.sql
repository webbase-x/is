-- Default curriculum choices based on the user-provided normal-program example (P1-P4).
-- The preset is non-destructive: applying it only adds missing subjects/courses/term plans.

create table if not exists public.lao_curriculum_preset_items (
  preset_code text not null,
  grade_code text not null,
  grade_label text not null,
  program_label text not null default 'ปกติ',
  sort_order integer not null,
  subject_code text,
  subject_name text not null,
  weekly_periods numeric(5,2) not null check(weekly_periods > 0),
  annual_hours numeric(8,2) not null check(annual_hours > 0),
  subject_type text not null check(subject_type in ('basic','additional','activity','other')),
  primary key(preset_code,grade_code,sort_order)
);

revoke all on public.lao_curriculum_preset_items from anon,authenticated;

delete from public.lao_curriculum_preset_items
where preset_code='normal_primary_example';

insert into public.lao_curriculum_preset_items(
  preset_code,grade_code,grade_label,program_label,sort_order,
  subject_code,subject_name,weekly_periods,annual_hours,subject_type
) values
-- ป.1
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',1,'ท11101','ภาษาไทย',5,200,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',2,'ค11101','คณิตศาสตร์',5,200,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',3,'ว11101','วิทยาศาสตร์และเทคโนโลยี',2,80,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',4,'ส11101','สังคมศึกษา ศาสนา และวัฒนธรรม',2,80,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',5,'ส11102','ประวัติศาสตร์',1,40,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',6,'พ11101','สุขศึกษาและพลศึกษา',2,80,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',7,'ศ11101','ศิลปะ',2,80,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',8,'ง11101','การงานอาชีพ',1,40,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',9,'อ11101','ภาษาต่างประเทศ',1,40,'basic'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',10,null,'เสริมทักษะภาษาไทย',1,40,'additional'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',11,'ส11201','นครนอกศึกษา',1,40,'additional'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',12,'ส12231','หน้าที่พลเมือง',1,40,'additional'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',13,'อ11213','เสริมทักษะภาษาอังกฤษ',2,80,'additional'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',14,'อ11212','English in daily life',1,40,'additional'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',15,null,'กิจกรรมแนะแนว',1,40,'activity'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',16,null,'ลูกเสือ/ยุวกาชาด',0.75,30,'activity'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',17,null,'ชุมนุม',1,40,'activity'),
('normal_primary_example','P1','ประถมศึกษาปีที่ 1','ปกติ',18,null,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,'activity'),
-- ป.2
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',1,'ท12101','ภาษาไทย',5,200,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',2,'ค12101','คณิตศาสตร์',5,200,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',3,'ว12101','วิทยาศาสตร์และเทคโนโลยี',2,80,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',4,'ส12101','สังคมศึกษา ศาสนา และวัฒนธรรม',2,80,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',5,'ส12102','ประวัติศาสตร์',1,40,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',6,'พ12101','สุขศึกษาและพลศึกษา',2,80,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',7,'ศ12101','ศิลปะ',2,80,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',8,'ง12101','การงานอาชีพ',1,40,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',9,'อ12101','ภาษาต่างประเทศ',1,40,'basic'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',10,null,'เสริมทักษะภาษาไทย',1,40,'additional'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',11,'ส12201','นครนอกศึกษา',1,40,'additional'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',12,'ส12232','หน้าที่พลเมือง',1,40,'additional'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',13,'อ12213','เสริมทักษะภาษาอังกฤษ',2,80,'additional'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',14,'อ12212','English in daily life',1,40,'additional'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',15,null,'กิจกรรมแนะแนว',1,40,'activity'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',16,null,'ลูกเสือ/ยุวกาชาด',0.75,30,'activity'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',17,null,'ชุมนุม',1,40,'activity'),
('normal_primary_example','P2','ประถมศึกษาปีที่ 2','ปกติ',18,null,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,'activity'),
-- ป.3
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',1,'ท13101','ภาษาไทย',5,200,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',2,'ค13101','คณิตศาสตร์',5,200,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',3,'ว13101','วิทยาศาสตร์และเทคโนโลยี',2,80,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',4,'ส13101','สังคมศึกษา ศาสนา และวัฒนธรรม',2,80,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',5,'ส13102','ประวัติศาสตร์',1,40,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',6,'พ13101','สุขศึกษาและพลศึกษา',2,80,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',7,'ศ13101','ศิลปะ',2,80,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',8,'ง13101','การงานอาชีพ',1,40,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',9,'อ13101','ภาษาต่างประเทศ',1,40,'basic'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',10,null,'เสริมทักษะภาษาไทย',1,40,'additional'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',11,'ส13201','นครนอกศึกษา',1,40,'additional'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',12,'ส12233','หน้าที่พลเมือง',1,40,'additional'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',13,'อ11213','เสริมทักษะภาษาอังกฤษ',2,80,'additional'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',14,'อ13212','English in daily life',1,40,'additional'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',15,null,'กิจกรรมแนะแนว',1,40,'activity'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',16,null,'ลูกเสือ/ยุวกาชาด',0.75,30,'activity'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',17,null,'ชุมนุม',1,40,'activity'),
('normal_primary_example','P3','ประถมศึกษาปีที่ 3','ปกติ',18,null,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,'activity'),
-- ป.4
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',1,'ท14101','ภาษาไทย',4,160,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',2,'ค14101','คณิตศาสตร์',4,160,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',3,'ว14101','วิทยาศาสตร์และเทคโนโลยี',3,120,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',4,'ส14101','สังคมศึกษา ศาสนา และวัฒนธรรม',2,80,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',5,'ส14102','ประวัติศาสตร์',1,40,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',6,'พ14101','สุขศึกษาและพลศึกษา',2,80,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',7,'ศ14101','ศิลปะ',2,80,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',8,'ง14101','การงานอาชีพ',1,40,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',9,'อ14101','ภาษาต่างประเทศ',2,80,'basic'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',10,'ว14202','เทคโนโลยีดิจิทัศ',1,40,'additional'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',11,'ส14201','นครนอกศึกษา',1,40,'additional'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',12,'ส12234','หน้าที่พลเมือง',1,40,'additional'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',13,'อ14212','English in daily life',2,80,'additional'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',14,'พ14201','ฟุตซอล',1,40,'additional'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',15,null,'อูคูเลเล่',1,40,'additional'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',16,null,'นาฏศิลป์สร้างสรรค์',1,40,'additional'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',17,null,'กิจกรรมแนะแนว',1,40,'activity'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',18,null,'ลูกเสือ/ยุวกาชาด',1,40,'activity'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',19,null,'ชุมนุม',0.75,30,'activity'),
('normal_primary_example','P4','ประถมศึกษาปีที่ 4','ปกติ',20,null,'กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25,10,'activity');

create or replace function public.lao_curriculum_preset(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
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
    'preset_name','ชุดวิชาหลักตามตัวอย่าง · แผนปกติ',
    'supported_grades',coalesce((
      select jsonb_agg(jsonb_build_object(
        'grade_code',x.grade_code,
        'grade_label',x.grade_label,
        'subject_count',x.subject_count,
        'weekly_total',x.weekly_total,
        'annual_total',x.annual_total,
        'present_count',x.present_count
      ) order by x.grade_order)
      from (
        select
          p.grade_code,
          min(p.grade_label) as grade_label,
          case p.grade_code when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4 else 99 end as grade_order,
          count(*) as subject_count,
          sum(p.weekly_periods) as weekly_total,
          sum(p.annual_hours) as annual_total,
          count(*) filter(where exists(
            select 1
            from public.lao_curriculum_courses c
            join public.lao_subjects s on s.id=c.subject_id
            where c.school_id=p_school_id
              and c.academic_year_id=p_academic_year_id
              and lower(btrim(c.grade_label))=lower(btrim(p.grade_label))
              and c.program_id is not distinct from p_program_id
              and (
                (p.subject_code is not null and lower(coalesce(s.subject_code,''))=lower(p.subject_code))
                or
                (p.subject_code is null and lower(btrim(s.name_th))=lower(btrim(p.subject_name)) and s.subject_type=p.subject_type)
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
        'weekly_periods',p.weekly_periods,
        'annual_hours',p.annual_hours,
        'subject_type',p.subject_type,
        'present',exists(
          select 1
          from public.lao_curriculum_courses c
          join public.lao_subjects s on s.id=c.subject_id
          where c.school_id=p_school_id
            and c.academic_year_id=p_academic_year_id
            and lower(btrim(c.grade_label))=lower(btrim(p.grade_label))
            and c.program_id is not distinct from p_program_id
            and (
              (p.subject_code is not null and lower(coalesce(s.subject_code,''))=lower(p.subject_code))
              or
              (p.subject_code is null and lower(btrim(s.name_th))=lower(btrim(p.subject_name)) and s.subject_type=p.subject_type)
            )
        )
      ) order by
        case p.grade_code when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4 else 99 end,
        p.sort_order)
      from public.lao_curriculum_preset_items p
      where p.preset_code='normal_primary_example'
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.lao_curriculum_preset(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_preset(uuid,uuid,uuid) to authenticated;

create or replace function public.lao_apply_curriculum_preset(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_grade_code text,
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
  if p_grade_code not in ('P1','P2','P3','P4') then
    raise exception 'ชุดตัวอย่างนี้มีข้อมูลเฉพาะ ป.1–ป.4';
  end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs
    where id=p_program_id and school_id=p_school_id
  ) then raise exception 'Program not found'; end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;

  for v_row in
    select *
    from public.lao_curriculum_preset_items
    where preset_code='normal_primary_example' and grade_code=p_grade_code
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
        school_id,subject_code,name_th,subject_type,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,v_row.subject_code,v_row.subject_name,v_row.subject_type,true,v_row.sort_order,v_uid,v_uid
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
        v_row.annual_hours,null,'เพิ่มจากชุดวิชาหลักตามตัวอย่าง',true,v_row.sort_order,v_uid,v_uid
      ) returning id into v_course_id;
      v_added_courses:=v_added_courses+1;
    else
      v_existing_courses:=v_existing_courses+1;
    end if;

    for v_term in
      select id from public.lao_terms where academic_year_id=p_academic_year_id order by term_no
    loop
      if not exists(
        select 1 from public.lao_course_term_plans
        where course_id=v_course_id and term_id=v_term.id
      ) then
        insert into public.lao_course_term_plans(
          course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
        ) values(
          v_course_id,v_term.id,v_row.weekly_periods,null,'คาบ/สัปดาห์จากชุดวิชาหลักตามตัวอย่าง',v_uid,v_uid
        );
        v_added_term_plans:=v_added_term_plans+1;
      end if;
    end loop;
  end loop;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_preset_applied','academic_year',p_academic_year_id::text,
    jsonb_build_object(
      'preset_code','normal_primary_example',
      'grade_code',p_grade_code,
      'grade_label',v_grade_label,
      'program_id',p_program_id,
      'template_items',v_total,
      'added_subjects',v_added_subjects,
      'added_courses',v_added_courses,
      'existing_courses',v_existing_courses,
      'added_term_plans',v_added_term_plans
    )
  );

  return jsonb_build_object(
    'grade_code',p_grade_code,
    'grade_label',v_grade_label,
    'template_items',v_total,
    'added_subjects',v_added_subjects,
    'added_courses',v_added_courses,
    'existing_courses',v_existing_courses,
    'added_term_plans',v_added_term_plans
  );
end;
$$;

revoke all on function public.lao_apply_curriculum_preset(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_apply_curriculum_preset(uuid,uuid,text,uuid) to authenticated;

create or replace function public.lao_quick_add_curriculum_subject(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid default null,
  p_grade_label text default null,
  p_subject_code text default null,
  p_subject_name text default null,
  p_learning_area text default null,
  p_subject_type text default 'basic',
  p_weekly_periods numeric default null,
  p_annual_hours numeric default null,
  p_sort_order integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_subject_id uuid;
  v_course_id uuid;
  v_term record;
  v_grade_code text;
  v_sort integer;
  v_subject_created boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if nullif(btrim(p_grade_label),'') is null then raise exception 'กรุณาเลือกระดับชั้น'; end if;
  if nullif(btrim(p_subject_name),'') is null then raise exception 'กรุณาระบุชื่อรายวิชา'; end if;
  if p_subject_type not in ('basic','additional','activity','other') then raise exception 'ประเภทรายวิชาไม่ถูกต้อง'; end if;
  if p_weekly_periods is not null and p_weekly_periods<=0 then raise exception 'คาบ/สัปดาห์ต้องมากกว่า 0'; end if;
  if p_annual_hours is not null and p_annual_hours<=0 then raise exception 'ชั่วโมง/ปีต้องมากกว่า 0'; end if;
  if not exists(
    select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id
  ) then raise exception 'Program not found'; end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;

  v_grade_code:=case
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*1$' then 'P1'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*2$' then 'P2'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*3$' then 'P3'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*4$' then 'P4'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*5$' then 'P5'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*6$' then 'P6'
    when btrim(p_grade_label) ~ '^อนุบาล[[:space:]]*1$' then 'K1'
    when btrim(p_grade_label) ~ '^อนุบาล[[:space:]]*2$' then 'K2'
    when btrim(p_grade_label) ~ '^อนุบาล[[:space:]]*3$' then 'K3'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*1$' then 'M1'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*2$' then 'M2'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*3$' then 'M3'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*4$' then 'M4'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*5$' then 'M5'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*6$' then 'M6'
    else null
  end;

  if nullif(btrim(p_subject_code),'') is not null then
    select id into v_subject_id
    from public.lao_subjects
    where school_id=p_school_id and lower(coalesce(subject_code,''))=lower(btrim(p_subject_code))
    limit 1;
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
      nullif(btrim(p_learning_area),''),p_subject_type,true,coalesce(p_sort_order,0),v_uid,v_uid
    ) returning id into v_subject_id;
    v_subject_created:=true;
  end if;

  if exists(
    select 1 from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and program_id is not distinct from p_program_id
      and lower(btrim(grade_label))=lower(btrim(p_grade_label))
      and subject_id=v_subject_id
  ) then
    raise exception 'รายวิชานี้มีอยู่แล้วในระดับชั้น/โปรแกรมที่เลือก';
  end if;

  if p_sort_order is null then
    select coalesce(max(sort_order),0)+1 into v_sort
    from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and program_id is not distinct from p_program_id
      and lower(btrim(grade_label))=lower(btrim(p_grade_label));
  else
    v_sort:=p_sort_order;
  end if;

  insert into public.lao_curriculum_courses(
    school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
    annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
  ) values(
    p_school_id,p_academic_year_id,p_program_id,v_grade_code,btrim(p_grade_label),v_subject_id,
    p_annual_hours,null,'เพิ่มรายวิชาจากหน้าโครงสร้างเวลาเรียน',true,v_sort,v_uid,v_uid
  ) returning id into v_course_id;

  if p_weekly_periods is not null then
    for v_term in
      select id from public.lao_terms where academic_year_id=p_academic_year_id order by term_no
    loop
      insert into public.lao_course_term_plans(
        course_id,term_id,weekly_periods,term_hours,created_by,updated_by
      ) values(v_course_id,v_term.id,p_weekly_periods,null,v_uid,v_uid);
    end loop;
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_subject_quick_added','curriculum_course',v_course_id::text,
    jsonb_build_object(
      'subject_id',v_subject_id,'subject_created',v_subject_created,
      'subject_code',upper(nullif(btrim(p_subject_code),'')),
      'subject_name',btrim(p_subject_name),'grade_label',btrim(p_grade_label),
      'program_id',p_program_id,'weekly_periods',p_weekly_periods,
      'annual_hours',p_annual_hours,'sort_order',v_sort
    )
  );

  return jsonb_build_object(
    'subject_id',v_subject_id,'course_id',v_course_id,
    'subject_created',v_subject_created,'sort_order',v_sort
  );
end;
$$;

revoke all on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) from public,anon;
grant execute on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) to authenticated;

create or replace function public.lao_move_curriculum_course(
  p_school_id uuid,
  p_course_id uuid,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_course public.lao_curriculum_courses;
  v_adjacent uuid;
  v_current_sort integer;
  v_adjacent_sort integer;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_direction not in ('up','down') then raise exception 'Invalid direction'; end if;

  select * into v_course
  from public.lao_curriculum_courses
  where id=p_course_id and school_id=p_school_id
  for update;
  if not found then raise exception 'ไม่พบโครงสร้างรายวิชา'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  -- Normalize the current grade/program ordering first so old zero/duplicate values remain movable.
  with ranked as (
    select id,row_number() over(order by sort_order,created_at,id)*10 as new_sort
    from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=v_course.academic_year_id
      and lower(btrim(grade_label))=lower(btrim(v_course.grade_label))
      and program_id is not distinct from v_course.program_id
      and is_active
  )
  update public.lao_curriculum_courses c
  set sort_order=ranked.new_sort,updated_by=v_uid
  from ranked
  where c.id=ranked.id;

  select sort_order into v_current_sort from public.lao_curriculum_courses where id=p_course_id;

  if p_direction='up' then
    select id,sort_order into v_adjacent,v_adjacent_sort
    from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=v_course.academic_year_id
      and lower(btrim(grade_label))=lower(btrim(v_course.grade_label))
      and program_id is not distinct from v_course.program_id
      and is_active and sort_order<v_current_sort
    order by sort_order desc limit 1;
  else
    select id,sort_order into v_adjacent,v_adjacent_sort
    from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=v_course.academic_year_id
      and lower(btrim(grade_label))=lower(btrim(v_course.grade_label))
      and program_id is not distinct from v_course.program_id
      and is_active and sort_order>v_current_sort
    order by sort_order asc limit 1;
  end if;

  if v_adjacent is null then
    return jsonb_build_object('moved',false,'course_id',p_course_id);
  end if;

  update public.lao_curriculum_courses set sort_order=-1000000,updated_by=v_uid where id=v_adjacent;
  update public.lao_curriculum_courses set sort_order=v_adjacent_sort,updated_by=v_uid where id=p_course_id;
  update public.lao_curriculum_courses set sort_order=v_current_sort,updated_by=v_uid where id=v_adjacent;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_course_reordered','curriculum_course',p_course_id::text,
    jsonb_build_object('direction',p_direction,'adjacent_course_id',v_adjacent)
  );

  return jsonb_build_object('moved',true,'course_id',p_course_id,'direction',p_direction);
end;
$$;

revoke all on function public.lao_move_curriculum_course(uuid,uuid,text) from public,anon;
grant execute on function public.lao_move_curriculum_course(uuid,uuid,text) to authenticated;

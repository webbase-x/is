-- Expand the primary curriculum choice set with nationwide basic subjects through M.6.
-- Existing P.1-P.4 example rows remain intact; only missing higher grades are seeded.
-- Codes and hours are editable school defaults, not immutable national identifiers.

alter table public.lao_curriculum_preset_items
  add column if not exists learning_area text;

alter table public.lao_curriculum_preset_items
  add column if not exists is_national_core boolean not null default false;

alter table public.lao_curriculum_preset_items
  alter column weekly_periods drop not null;

alter table public.lao_curriculum_preset_items
  alter column annual_hours drop not null;

update public.lao_curriculum_preset_items
set is_national_core=true
where preset_code='normal_primary_example'
  and subject_type='basic';

update public.lao_curriculum_preset_items
set learning_area=case
  when subject_name='ภาษาไทย' then 'ภาษาไทย'
  when subject_name='คณิตศาสตร์' then 'คณิตศาสตร์'
  when subject_name in ('วิทยาศาสตร์และเทคโนโลยี','เทคโนโลยีดิจิทัศ','เทคโนโลยีดิจิทัล') then 'วิทยาศาสตร์และเทคโนโลยี'
  when subject_name in ('สังคมศึกษา ศาสนา และวัฒนธรรม','ประวัติศาสตร์','นครนอกศึกษา','หน้าที่พลเมือง') then 'สังคมศึกษา ศาสนา และวัฒนธรรม'
  when subject_name in ('สุขศึกษาและพลศึกษา','ฟุตซอล') then 'สุขศึกษาและพลศึกษา'
  when subject_name in ('ศิลปะ','อูคูเลเล่','นาฏศิลป์สร้างสรรค์') then 'ศิลปะ'
  when subject_name='การงานอาชีพ' then 'การงานอาชีพ'
  when subject_name in ('ภาษาต่างประเทศ','เสริมทักษะภาษาอังกฤษ','English in daily life') then 'ภาษาต่างประเทศ'
  when subject_type='activity' then 'กิจกรรมพัฒนาผู้เรียน'
  else learning_area
end
where preset_code='normal_primary_example';

update public.lao_curriculum_preset_items
set subject_name='เทคโนโลยีดิจิทัล'
where preset_code='normal_primary_example'
  and subject_name='เทคโนโลยีดิจิทัศ';

insert into public.lao_curriculum_preset_items(
  preset_code,grade_code,grade_label,program_label,sort_order,
  subject_code,subject_name,learning_area,weekly_periods,annual_hours,subject_type,is_national_core
) values
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',1,'ท15101','ภาษาไทย','ภาษาไทย',4,160,'basic',true),
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',2,'ค15101','คณิตศาสตร์','คณิตศาสตร์',4,160,'basic',true),
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',3,'ว15101','วิทยาศาสตร์และเทคโนโลยี','วิทยาศาสตร์และเทคโนโลยี',3,120,'basic',true),
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',4,'ส15101','สังคมศึกษา ศาสนา และวัฒนธรรม','สังคมศึกษา ศาสนา และวัฒนธรรม',2,80,'basic',true),
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',5,'ส15102','ประวัติศาสตร์','สังคมศึกษา ศาสนา และวัฒนธรรม',1,40,'basic',true),
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',6,'พ15101','สุขศึกษาและพลศึกษา','สุขศึกษาและพลศึกษา',2,80,'basic',true),
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',7,'ศ15101','ศิลปะ','ศิลปะ',2,80,'basic',true),
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',8,'ง15101','การงานอาชีพ','การงานอาชีพ',1,40,'basic',true),
('normal_primary_example','P5','ประถมศึกษาปีที่ 5','ปกติ',9,'อ15101','ภาษาต่างประเทศ','ภาษาต่างประเทศ',2,80,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',1,'ท16101','ภาษาไทย','ภาษาไทย',4,160,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',2,'ค16101','คณิตศาสตร์','คณิตศาสตร์',4,160,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',3,'ว16101','วิทยาศาสตร์และเทคโนโลยี','วิทยาศาสตร์และเทคโนโลยี',3,120,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',4,'ส16101','สังคมศึกษา ศาสนา และวัฒนธรรม','สังคมศึกษา ศาสนา และวัฒนธรรม',2,80,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',5,'ส16102','ประวัติศาสตร์','สังคมศึกษา ศาสนา และวัฒนธรรม',1,40,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',6,'พ16101','สุขศึกษาและพลศึกษา','สุขศึกษาและพลศึกษา',2,80,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',7,'ศ16101','ศิลปะ','ศิลปะ',2,80,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',8,'ง16101','การงานอาชีพ','การงานอาชีพ',1,40,'basic',true),
('normal_primary_example','P6','ประถมศึกษาปีที่ 6','ปกติ',9,'อ16101','ภาษาต่างประเทศ','ภาษาต่างประเทศ',2,80,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',1,'ท21101','ภาษาไทย','ภาษาไทย',3,120,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',2,'ค21101','คณิตศาสตร์','คณิตศาสตร์',3,120,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',3,'ว21101','วิทยาศาสตร์และเทคโนโลยี','วิทยาศาสตร์และเทคโนโลยี',3,120,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',4,'ส21101','สังคมศึกษา ศาสนา และวัฒนธรรม','สังคมศึกษา ศาสนา และวัฒนธรรม',3,120,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',5,'ส21102','ประวัติศาสตร์','สังคมศึกษา ศาสนา และวัฒนธรรม',1,40,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',6,'พ21101','สุขศึกษาและพลศึกษา','สุขศึกษาและพลศึกษา',2,80,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',7,'ศ21101','ศิลปะ','ศิลปะ',2,80,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',8,'ง21101','การงานอาชีพ','การงานอาชีพ',2,80,'basic',true),
('normal_primary_example','M1','มัธยมศึกษาปีที่ 1','ปกติ',9,'อ21101','ภาษาต่างประเทศ','ภาษาต่างประเทศ',3,120,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',1,'ท22101','ภาษาไทย','ภาษาไทย',3,120,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',2,'ค22101','คณิตศาสตร์','คณิตศาสตร์',3,120,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',3,'ว22101','วิทยาศาสตร์และเทคโนโลยี','วิทยาศาสตร์และเทคโนโลยี',3,120,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',4,'ส22101','สังคมศึกษา ศาสนา และวัฒนธรรม','สังคมศึกษา ศาสนา และวัฒนธรรม',3,120,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',5,'ส22102','ประวัติศาสตร์','สังคมศึกษา ศาสนา และวัฒนธรรม',1,40,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',6,'พ22101','สุขศึกษาและพลศึกษา','สุขศึกษาและพลศึกษา',2,80,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',7,'ศ22101','ศิลปะ','ศิลปะ',2,80,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',8,'ง22101','การงานอาชีพ','การงานอาชีพ',2,80,'basic',true),
('normal_primary_example','M2','มัธยมศึกษาปีที่ 2','ปกติ',9,'อ22101','ภาษาต่างประเทศ','ภาษาต่างประเทศ',3,120,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',1,'ท23101','ภาษาไทย','ภาษาไทย',3,120,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',2,'ค23101','คณิตศาสตร์','คณิตศาสตร์',3,120,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',3,'ว23101','วิทยาศาสตร์และเทคโนโลยี','วิทยาศาสตร์และเทคโนโลยี',3,120,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',4,'ส23101','สังคมศึกษา ศาสนา และวัฒนธรรม','สังคมศึกษา ศาสนา และวัฒนธรรม',3,120,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',5,'ส23102','ประวัติศาสตร์','สังคมศึกษา ศาสนา และวัฒนธรรม',1,40,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',6,'พ23101','สุขศึกษาและพลศึกษา','สุขศึกษาและพลศึกษา',2,80,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',7,'ศ23101','ศิลปะ','ศิลปะ',2,80,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',8,'ง23101','การงานอาชีพ','การงานอาชีพ',2,80,'basic',true),
('normal_primary_example','M3','มัธยมศึกษาปีที่ 3','ปกติ',9,'อ23101','ภาษาต่างประเทศ','ภาษาต่างประเทศ',3,120,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',1,'ท31101','ภาษาไทย','ภาษาไทย',null,null,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',2,'ค31101','คณิตศาสตร์','คณิตศาสตร์',null,null,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',3,'ว31101','วิทยาศาสตร์และเทคโนโลยี','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',4,'ส31101','สังคมศึกษา ศาสนา และวัฒนธรรม','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',5,'ส31102','ประวัติศาสตร์','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',6,'พ31101','สุขศึกษาและพลศึกษา','สุขศึกษาและพลศึกษา',null,null,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',7,'ศ31101','ศิลปะ','ศิลปะ',null,null,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',8,'ง31101','การงานอาชีพ','การงานอาชีพ',null,null,'basic',true),
('normal_primary_example','M4','มัธยมศึกษาปีที่ 4','ปกติ',9,'อ31101','ภาษาต่างประเทศ','ภาษาต่างประเทศ',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',1,'ท32101','ภาษาไทย','ภาษาไทย',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',2,'ค32101','คณิตศาสตร์','คณิตศาสตร์',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',3,'ว32101','วิทยาศาสตร์และเทคโนโลยี','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',4,'ส32101','สังคมศึกษา ศาสนา และวัฒนธรรม','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',5,'ส32102','ประวัติศาสตร์','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',6,'พ32101','สุขศึกษาและพลศึกษา','สุขศึกษาและพลศึกษา',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',7,'ศ32101','ศิลปะ','ศิลปะ',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',8,'ง32101','การงานอาชีพ','การงานอาชีพ',null,null,'basic',true),
('normal_primary_example','M5','มัธยมศึกษาปีที่ 5','ปกติ',9,'อ32101','ภาษาต่างประเทศ','ภาษาต่างประเทศ',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',1,'ท33101','ภาษาไทย','ภาษาไทย',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',2,'ค33101','คณิตศาสตร์','คณิตศาสตร์',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',3,'ว33101','วิทยาศาสตร์และเทคโนโลยี','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',4,'ส33101','สังคมศึกษา ศาสนา และวัฒนธรรม','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',5,'ส33102','ประวัติศาสตร์','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',6,'พ33101','สุขศึกษาและพลศึกษา','สุขศึกษาและพลศึกษา',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',7,'ศ33101','ศิลปะ','ศิลปะ',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',8,'ง33101','การงานอาชีพ','การงานอาชีพ',null,null,'basic',true),
('normal_primary_example','M6','มัธยมศึกษาปีที่ 6','ปกติ',9,'อ33101','ภาษาต่างประเทศ','ภาษาต่างประเทศ',null,null,'basic',true)
on conflict (preset_code,grade_code,sort_order) do update set
  grade_label=excluded.grade_label,
  program_label=excluded.program_label,
  subject_code=excluded.subject_code,
  subject_name=excluded.subject_name,
  learning_area=excluded.learning_area,
  weekly_periods=excluded.weekly_periods,
  annual_hours=excluded.annual_hours,
  subject_type=excluded.subject_type,
  is_national_core=excluded.is_national_core;

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
        'learning_area',p.learning_area,
        'weekly_periods',p.weekly_periods,
        'annual_hours',p.annual_hours,
        'subject_type',p.subject_type,
        'is_national_core',p.is_national_core,
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
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then
    raise exception 'ชุดหลักรองรับระดับ ป.1–ม.6';
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
        school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,v_row.subject_code,v_row.subject_name,v_row.learning_area,
        v_row.subject_type,true,v_row.sort_order,v_uid,v_uid
      ) returning id into v_subject_id;
      v_added_subjects:=v_added_subjects+1;
    elsif nullif(btrim(coalesce(v_row.learning_area,'')),'') is not null then
      update public.lao_subjects
      set learning_area=coalesce(nullif(btrim(learning_area),''),v_row.learning_area),
          updated_by=v_uid
      where id=v_subject_id;
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
        v_row.annual_hours,null,'เพิ่มจากชุดหลักแผนปกติ',true,v_row.sort_order,v_uid,v_uid
      ) returning id into v_course_id;
      v_added_courses:=v_added_courses+1;
    else
      v_existing_courses:=v_existing_courses+1;
    end if;

    if v_row.weekly_periods is not null then
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
            v_course_id,v_term.id,v_row.weekly_periods,null,'คาบ/สัปดาห์จากชุดหลักแผนปกติ',v_uid,v_uid
          );
          v_added_term_plans:=v_added_term_plans+1;
        end if;
      end loop;
    end if;
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

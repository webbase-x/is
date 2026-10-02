-- 0041_reset_core_subject_catalog_and_academic_years.sql
-- Rebuild the central basic-subject template and allow academic setup before current-year LEC arrives.

begin;

alter table public.lao_curriculum_preset_items
  add column if not exists term_no smallint;

alter table public.lao_curriculum_preset_items
  drop constraint if exists lao_curriculum_preset_items_term_no_check;

alter table public.lao_curriculum_preset_items
  add constraint lao_curriculum_preset_items_term_no_check
  check (term_no is null or term_no between 1 and 4);

-- User-requested clean reset of all school subject/curriculum data.
delete from public.lao_teaching_workload_items;
delete from public.lao_curriculum_parallel_groups;
delete from public.lao_curriculum_structure_confirmations;
delete from public.lao_curriculum_default_initializations;
delete from public.lao_curriculum_grade_initializations;
delete from public.lao_curriculum_courses;
delete from public.lao_subjects;

-- Rebuild the shared central catalog from zero.
delete from public.lao_curriculum_preset_items;

insert into public.lao_curriculum_preset_items(
  preset_code,grade_code,grade_label,program_label,sort_order,
  subject_code,subject_name,weekly_periods,annual_hours,subject_type,
  learning_area,is_national_core,choice_group,choice_key,auto_apply,term_no
) values
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท11101','ภาษาไทย',null,null,'basic','ภาษาไทย',true,null,null,true,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค11101','คณิตศาสตร์',null,null,'basic','คณิตศาสตร์',true,null,null,true,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว11101','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส11101','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส11102','ประวัติศาสตร์',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ11101','สุขศึกษาและพลศึกษา',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ11101','ศิลปะ',null,null,'basic','ศิลปะ',true,null,null,true,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง11101','การงานอาชีพ',null,null,'basic','การงานอาชีพ',true,null,null,true,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ11101','ภาษาอังกฤษ',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท12101','ภาษาไทย',null,null,'basic','ภาษาไทย',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค12101','คณิตศาสตร์',null,null,'basic','คณิตศาสตร์',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว12101','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส12101','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส12102','ประวัติศาสตร์',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ12101','สุขศึกษาและพลศึกษา',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ12101','ศิลปะ',null,null,'basic','ศิลปะ',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง12101','การงานอาชีพ',null,null,'basic','การงานอาชีพ',true,null,null,true,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ12101','ภาษาอังกฤษ',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท13101','ภาษาไทย',null,null,'basic','ภาษาไทย',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค13101','คณิตศาสตร์',null,null,'basic','คณิตศาสตร์',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว13101','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส13101','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส13102','ประวัติศาสตร์',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ13101','สุขศึกษาและพลศึกษา',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ13101','ศิลปะ',null,null,'basic','ศิลปะ',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง13101','การงานอาชีพ',null,null,'basic','การงานอาชีพ',true,null,null,true,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ13101','ภาษาอังกฤษ',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท14101','ภาษาไทย',null,null,'basic','ภาษาไทย',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค14101','คณิตศาสตร์',null,null,'basic','คณิตศาสตร์',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว14101','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส14101','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส14102','ประวัติศาสตร์',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ14101','สุขศึกษาและพลศึกษา',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ14101','ศิลปะ',null,null,'basic','ศิลปะ',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง14101','การงานอาชีพ',null,null,'basic','การงานอาชีพ',true,null,null,true,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ14101','ภาษาอังกฤษ',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท15101','ภาษาไทย',null,null,'basic','ภาษาไทย',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค15101','คณิตศาสตร์',null,null,'basic','คณิตศาสตร์',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว15101','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส15101','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส15102','ประวัติศาสตร์',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ15101','สุขศึกษาและพลศึกษา',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ15101','ศิลปะ',null,null,'basic','ศิลปะ',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง15101','การงานอาชีพ',null,null,'basic','การงานอาชีพ',true,null,null,true,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ15101','ภาษาอังกฤษ',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท16101','ภาษาไทย',null,null,'basic','ภาษาไทย',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค16101','คณิตศาสตร์',null,null,'basic','คณิตศาสตร์',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว16101','วิทยาศาสตร์และเทคโนโลยี',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส16101','สังคมศึกษา ศาสนา และวัฒนธรรม',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส16102','ประวัติศาสตร์',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ16101','สุขศึกษาและพลศึกษา',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ16101','ศิลปะ',null,null,'basic','ศิลปะ',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง16101','การงานอาชีพ',null,null,'basic','การงานอาชีพ',true,null,null,true,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ16101','ภาษาอังกฤษ',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,null),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท21101','ภาษาไทย 1',null,null,'basic','ภาษาไทย',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค21101','คณิตศาสตร์ 1',null,null,'basic','คณิตศาสตร์',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว21101','วิทยาศาสตร์และเทคโนโลยี 1',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส21101','สังคมศึกษา 1',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส21102','ประวัติศาสตร์ 1',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ21101','สุขศึกษาและพลศึกษา 1',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ21101','ศิลปะ 1',null,null,'basic','ศิลปะ',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง21101','การงานอาชีพ 1',null,null,'basic','การงานอาชีพ',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ21101','ภาษาอังกฤษ 1',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',10,'ท21102','ภาษาไทย 2',null,null,'basic','ภาษาไทย',true,null,null,true,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',11,'ค21102','คณิตศาสตร์ 2',null,null,'basic','คณิตศาสตร์',true,null,null,true,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',12,'ว21102','วิทยาศาสตร์และเทคโนโลยี 2',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',13,'ส21103','สังคมศึกษา 2',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',14,'ส21104','ประวัติศาสตร์ 2',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',15,'พ21102','สุขศึกษาและพลศึกษา 2',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',16,'ศ21102','ศิลปะ 2',null,null,'basic','ศิลปะ',true,null,null,true,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',17,'ง21102','การงานอาชีพ 2',null,null,'basic','การงานอาชีพ',true,null,null,true,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',18,'อ21102','ภาษาอังกฤษ 2',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท22101','ภาษาไทย 3',null,null,'basic','ภาษาไทย',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค22101','คณิตศาสตร์ 3',null,null,'basic','คณิตศาสตร์',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว22101','วิทยาศาสตร์และเทคโนโลยี 3',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส22101','สังคมศึกษา 3',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส22102','ประวัติศาสตร์ 3',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ22101','สุขศึกษาและพลศึกษา 3',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ22101','ศิลปะ 3',null,null,'basic','ศิลปะ',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง22101','การงานอาชีพ 3',null,null,'basic','การงานอาชีพ',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ22101','ภาษาอังกฤษ 3',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',10,'ท22102','ภาษาไทย 4',null,null,'basic','ภาษาไทย',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',11,'ค22102','คณิตศาสตร์ 4',null,null,'basic','คณิตศาสตร์',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',12,'ว22102','วิทยาศาสตร์และเทคโนโลยี 4',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',13,'ส22103','สังคมศึกษา 4',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',14,'ส22104','ประวัติศาสตร์ 4',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',15,'พ22102','สุขศึกษาและพลศึกษา 4',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',16,'ศ22102','ศิลปะ 4',null,null,'basic','ศิลปะ',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',17,'ง22102','การงานอาชีพ 4',null,null,'basic','การงานอาชีพ',true,null,null,true,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',18,'อ22102','ภาษาอังกฤษ 4',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท23101','ภาษาไทย 5',null,null,'basic','ภาษาไทย',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค23101','คณิตศาสตร์ 5',null,null,'basic','คณิตศาสตร์',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว23101','วิทยาศาสตร์และเทคโนโลยี 5',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส23101','สังคมศึกษา 5',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส23102','ประวัติศาสตร์ 5',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ23101','สุขศึกษาและพลศึกษา 5',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ23101','ศิลปะ 5',null,null,'basic','ศิลปะ',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง23101','การงานอาชีพ 5',null,null,'basic','การงานอาชีพ',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ23101','ภาษาอังกฤษ 5',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',10,'ท23102','ภาษาไทย 6',null,null,'basic','ภาษาไทย',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',11,'ค23102','คณิตศาสตร์ 6',null,null,'basic','คณิตศาสตร์',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',12,'ว23102','วิทยาศาสตร์และเทคโนโลยี 6',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',13,'ส23103','สังคมศึกษา 6',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',14,'ส23104','ประวัติศาสตร์ 6',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',15,'พ23102','สุขศึกษาและพลศึกษา 6',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',16,'ศ23102','ศิลปะ 6',null,null,'basic','ศิลปะ',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',17,'ง23102','การงานอาชีพ 6',null,null,'basic','การงานอาชีพ',true,null,null,true,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',18,'อ23102','ภาษาอังกฤษ 6',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท31101','ภาษาไทย 1',null,null,'basic','ภาษาไทย',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค31101','คณิตศาสตร์ 1',null,null,'basic','คณิตศาสตร์',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว31101','วิทยาศาสตร์และเทคโนโลยี 1',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส31101','สังคมศึกษา 1',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส31102','ประวัติศาสตร์ 1',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ31101','สุขศึกษาและพลศึกษา 1',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ31101','ศิลปะ 1',null,null,'basic','ศิลปะ',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง31101','การงานอาชีพ 1',null,null,'basic','การงานอาชีพ',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ31101','ภาษาอังกฤษ 1',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',10,'ท31102','ภาษาไทย 2',null,null,'basic','ภาษาไทย',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',11,'ค31102','คณิตศาสตร์ 2',null,null,'basic','คณิตศาสตร์',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',12,'ว31102','วิทยาศาสตร์และเทคโนโลยี 2',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',13,'ส31103','สังคมศึกษา 2',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',14,'ส31104','ประวัติศาสตร์ 2',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',15,'พ31102','สุขศึกษาและพลศึกษา 2',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',16,'ศ31102','ศิลปะ 2',null,null,'basic','ศิลปะ',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',17,'ง31102','การงานอาชีพ 2',null,null,'basic','การงานอาชีพ',true,null,null,true,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',18,'อ31102','ภาษาอังกฤษ 2',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท32101','ภาษาไทย 3',null,null,'basic','ภาษาไทย',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค32101','คณิตศาสตร์ 3',null,null,'basic','คณิตศาสตร์',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว32101','วิทยาศาสตร์และเทคโนโลยี 3',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส32101','สังคมศึกษา 3',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส32102','ประวัติศาสตร์ 3',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ32101','สุขศึกษาและพลศึกษา 3',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ32101','ศิลปะ 3',null,null,'basic','ศิลปะ',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง32101','การงานอาชีพ 3',null,null,'basic','การงานอาชีพ',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ32101','ภาษาอังกฤษ 3',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',10,'ท32102','ภาษาไทย 4',null,null,'basic','ภาษาไทย',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',11,'ค32102','คณิตศาสตร์ 4',null,null,'basic','คณิตศาสตร์',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',12,'ว32102','วิทยาศาสตร์และเทคโนโลยี 4',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',13,'ส32103','สังคมศึกษา 4',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',14,'ส32104','ประวัติศาสตร์ 4',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',15,'พ32102','สุขศึกษาและพลศึกษา 4',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',16,'ศ32102','ศิลปะ 4',null,null,'basic','ศิลปะ',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',17,'ง32102','การงานอาชีพ 4',null,null,'basic','การงานอาชีพ',true,null,null,true,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',18,'อ32102','ภาษาอังกฤษ 4',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1,'ท33101','ภาษาไทย 5',null,null,'basic','ภาษาไทย',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',2,'ค33101','คณิตศาสตร์ 5',null,null,'basic','คณิตศาสตร์',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',3,'ว33101','วิทยาศาสตร์และเทคโนโลยี 5',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',4,'ส33101','สังคมศึกษา 5',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',5,'ส33102','ประวัติศาสตร์ 5',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',6,'พ33101','สุขศึกษาและพลศึกษา 5',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',7,'ศ33101','ศิลปะ 5',null,null,'basic','ศิลปะ',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',8,'ง33101','การงานอาชีพ 5',null,null,'basic','การงานอาชีพ',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',9,'อ33101','ภาษาอังกฤษ 5',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',10,'ท33102','ภาษาไทย 6',null,null,'basic','ภาษาไทย',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',11,'ค33102','คณิตศาสตร์ 6',null,null,'basic','คณิตศาสตร์',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',12,'ว33102','วิทยาศาสตร์และเทคโนโลยี 6',null,null,'basic','วิทยาศาสตร์และเทคโนโลยี',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',13,'ส33103','สังคมศึกษา 6',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',14,'ส33104','ประวัติศาสตร์ 6',null,null,'basic','สังคมศึกษา ศาสนา และวัฒนธรรม',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',15,'พ33102','สุขศึกษาและพลศึกษา 6',null,null,'basic','สุขศึกษาและพลศึกษา',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',16,'ศ33102','ศิลปะ 6',null,null,'basic','ศิลปะ',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',17,'ง33102','การงานอาชีพ 6',null,null,'basic','การงานอาชีพ',true,null,null,true,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',18,'อ33102','ภาษาอังกฤษ 6',null,null,'basic','ภาษาต่างประเทศ',true,null,null,true,2);

create or replace function public.lao_save_academic_year(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_year_be integer default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_is_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
  v_starts_on date := p_starts_on;
  v_ends_on date := p_ends_on;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_year_be is null or p_year_be<2400 or p_year_be>2800 then raise exception 'ปีการศึกษาไม่ถูกต้อง'; end if;

  -- When a start date is supplied but no end date is supplied, use the 200th weekday
  -- (Mon-Fri, including the start day when it is a weekday) as an editable initial value.
  if v_starts_on is not null and v_ends_on is null then
    select d::date into v_ends_on
    from generate_series(v_starts_on::timestamp,(v_starts_on+interval '420 days')::timestamp,interval '1 day') d
    where extract(isodow from d) between 1 and 5
    order by d
    offset 199 limit 1;
  end if;

  if v_starts_on is not null and v_ends_on is not null and v_ends_on<v_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  if v_org is null then raise exception 'School not found'; end if;

  if p_is_current then
    update public.lao_academic_years set is_current=false,updated_at=now()
    where school_id=p_school_id and (p_academic_year_id is null or id<>p_academic_year_id) and is_current;
  end if;

  if p_academic_year_id is null then
    insert into public.lao_academic_years(school_id,year_be,starts_on,ends_on,is_current)
    values(p_school_id,p_year_be,v_starts_on,v_ends_on,p_is_current)
    returning id into v_id;

    insert into public.lao_terms(academic_year_id,term_no,name,is_current)
    values
      (v_id,1,'ภาคเรียนที่ 1',false),
      (v_id,2,'ภาคเรียนที่ 2',false)
    on conflict(academic_year_id,term_no) do nothing;
    v_action:='academic_year_created';
  else
    update public.lao_academic_years
    set year_be=p_year_be,starts_on=v_starts_on,ends_on=v_ends_on,is_current=p_is_current,updated_at=now()
    where id=p_academic_year_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Academic year not found'; end if;
    v_action:='academic_year_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'academic_year',v_id::text,
    jsonb_build_object(
      'year_be',p_year_be,'starts_on',v_starts_on,'ends_on',v_ends_on,
      'is_current',p_is_current,'default_instructional_days',200
    )
  );

  return jsonb_build_object(
    'id',v_id,'year_be',p_year_be,'starts_on',v_starts_on,'ends_on',v_ends_on,
    'default_instructional_days',200
  );
exception
  when unique_violation then
    raise exception 'มีปีการศึกษา % อยู่แล้ว',p_year_be;
end;
$function$;

revoke all on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) from public,anon;
grant execute on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) to authenticated;

create or replace function public.lao_curriculum_preset(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_result jsonb;
  v_scope_year_id uuid;
  v_scope_source text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;

  if exists(
    select 1 from public.lao_class_sections
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and source_type='lec' and is_active and grade_code is not null
  ) then
    v_scope_year_id:=p_academic_year_id;
    v_scope_source:='selected_year_lec';
  else
    select ay.id into v_scope_year_id
    from public.lao_academic_years ay
    where ay.school_id=p_school_id
      and exists(
        select 1 from public.lao_class_sections c
        where c.academic_year_id=ay.id and c.school_id=p_school_id
          and c.source_type='lec' and c.is_active and c.grade_code is not null
      )
    order by ay.year_be desc
    limit 1;
    v_scope_source:=case when v_scope_year_id is null then 'all_basic_grades_no_lec' else 'latest_school_lec_fallback' end;
  end if;

  select jsonb_build_object(
    'preset_code','core_2551_2560',
    'preset_name','แม่แบบมาตรฐานกลาง 2551/ปรับปรุง 2560',
    'grade_scope',v_scope_source,
    'school_grade_codes',coalesce((
      select jsonb_agg(x.grade_code order by x.grade_order)
      from (
        select distinct p.grade_code,
          case p.grade_code
            when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4 when 'P5' then 5 when 'P6' then 6
            when 'M1' then 11 when 'M2' then 12 when 'M3' then 13 when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
            else 99 end as grade_order
        from public.lao_curriculum_preset_items p
        where p.preset_code='core_2551_2560'
          and (
            v_scope_year_id is null
            or exists(
              select 1 from public.lao_class_sections c
              where c.school_id=p_school_id and c.academic_year_id=v_scope_year_id
                and c.source_type='lec' and c.is_active and c.grade_code=p.grade_code
            )
          )
      ) x
    ),'[]'::jsonb),
    'supported_grades',coalesce((
      select jsonb_agg(jsonb_build_object(
        'grade_code',x.grade_code,'grade_label',x.grade_label,
        'subject_count',x.subject_count,'present_count',x.present_count
      ) order by x.grade_order)
      from (
        select p.grade_code,min(p.grade_label) as grade_label,
          case p.grade_code
            when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4 when 'P5' then 5 when 'P6' then 6
            when 'M1' then 11 when 'M2' then 12 when 'M3' then 13 when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
            else 99 end as grade_order,
          count(*) as subject_count,
          count(*) filter(where exists(
            select 1
            from public.lao_curriculum_courses c
            join public.lao_subjects s on s.id=c.subject_id
            where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
              and c.is_active and c.grade_code=p.grade_code
              and (
                c.program_id is not distinct from p_program_id
                or (p_program_id is not null and c.program_id is null and p.subject_type='basic')
              )
              and lower(coalesce(s.subject_code,''))=lower(p.subject_code)
          )) as present_count
        from public.lao_curriculum_preset_items p
        where p.preset_code='core_2551_2560'
          and (
            v_scope_year_id is null
            or exists(
              select 1 from public.lao_class_sections c
              where c.school_id=p_school_id and c.academic_year_id=v_scope_year_id
                and c.source_type='lec' and c.is_active and c.grade_code=p.grade_code
            )
          )
        group by p.grade_code
      ) x
    ),'[]'::jsonb),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'grade_code',p.grade_code,'grade_label',p.grade_label,
        'program_label',p.program_label,'sort_order',p.sort_order,
        'subject_code',p.subject_code,'subject_name',p.subject_name,
        'learning_area',p.learning_area,'subject_type',p.subject_type,
        'is_national_core',p.is_national_core,'term_no',p.term_no,
        'present',exists(
          select 1
          from public.lao_curriculum_courses c
          join public.lao_subjects s on s.id=c.subject_id
          where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
            and c.is_active and c.grade_code=p.grade_code
            and (
              c.program_id is not distinct from p_program_id
              or (p_program_id is not null and c.program_id is null and p.subject_type='basic')
            )
            and lower(coalesce(s.subject_code,''))=lower(p.subject_code)
        )
      ) order by
        case p.grade_code
          when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4 when 'P5' then 5 when 'P6' then 6
          when 'M1' then 11 when 'M2' then 12 when 'M3' then 13 when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
          else 99 end,
        p.sort_order)
      from public.lao_curriculum_preset_items p
      where p.preset_code='core_2551_2560'
        and (
          v_scope_year_id is null
          or exists(
            select 1 from public.lao_class_sections c
            where c.school_id=p_school_id and c.academic_year_id=v_scope_year_id
              and c.source_type='lec' and c.is_active and c.grade_code=p.grade_code
          )
        )
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.lao_curriculum_preset(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_preset(uuid,uuid,uuid) to authenticated;

create or replace function public.lao_add_curriculum_library_item(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text,
  p_source_kind text,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_grade_label text;
  v_subject_id uuid;
  v_subject_type text;
  v_subject_code text;
  v_subject_name text;
  v_learning_area text;
  v_weekly numeric;
  v_annual numeric;
  v_sort integer:=0;
  v_course_id uuid;
  v_term_id uuid;
  v_item record;
  v_restored boolean:=false;
  v_term_no smallint;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_source_kind not in ('preset','school') then raise exception 'แหล่งรายวิชาไม่ถูกต้อง'; end if;
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then
    raise exception 'ระดับชั้นไม่ถูกต้อง';
  end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;

  v_grade_label:=case p_grade_code
    when 'P1' then 'ประถมศึกษาปีที่ 1' when 'P2' then 'ประถมศึกษาปีที่ 2'
    when 'P3' then 'ประถมศึกษาปีที่ 3' when 'P4' then 'ประถมศึกษาปีที่ 4'
    when 'P5' then 'ประถมศึกษาปีที่ 5' when 'P6' then 'ประถมศึกษาปีที่ 6'
    when 'M1' then 'มัธยมศึกษาปีที่ 1' when 'M2' then 'มัธยมศึกษาปีที่ 2'
    when 'M3' then 'มัธยมศึกษาปีที่ 3' when 'M4' then 'มัธยมศึกษาปีที่ 4'
    when 'M5' then 'มัธยมศึกษาปีที่ 5' when 'M6' then 'มัธยมศึกษาปีที่ 6'
  end;

  if p_source_kind='preset' then
    select * into v_item
    from public.lao_curriculum_preset_items
    where id=p_source_id and preset_code='core_2551_2560'
      and grade_code=p_grade_code and subject_type='basic' and is_national_core
    limit 1;
    if v_item.id is null then raise exception 'ไม่พบรายวิชาในฐานกลาง'; end if;

    v_subject_type:=v_item.subject_type;
    v_subject_code:=nullif(btrim(v_item.subject_code),'');
    v_subject_name:=btrim(v_item.subject_name);
    v_learning_area:=v_item.learning_area;
    v_weekly:=v_item.weekly_periods;
    v_annual:=v_item.annual_hours;
    v_sort:=coalesce(v_item.sort_order,0);
    v_term_no:=v_item.term_no;

    select id into v_subject_id
    from public.lao_subjects
    where school_id=p_school_id
      and lower(coalesce(subject_code,''))=lower(v_subject_code)
      and subject_type<>'activity'
    limit 1;

    if v_subject_id is null then
      insert into public.lao_subjects(
        school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,v_subject_code,v_subject_name,v_learning_area,'basic',true,v_sort,v_uid,v_uid
      ) returning id into v_subject_id;
    else
      update public.lao_subjects
      set name_th=v_subject_name,learning_area=v_learning_area,subject_type='basic',
          is_active=true,sort_order=v_sort,updated_by=v_uid,updated_at=now()
      where id=v_subject_id;
    end if;
  else
    select id,subject_code,name_th,learning_area,subject_type,sort_order
    into v_subject_id,v_subject_code,v_subject_name,v_learning_area,v_subject_type,v_sort
    from public.lao_subjects
    where id=p_source_id and school_id=p_school_id and is_active;
    if v_subject_id is null then raise exception 'ไม่พบรายวิชาของสถานศึกษา'; end if;
    v_weekly:=null; v_annual:=null; v_term_no:=null;
  end if;

  if p_program_id is not null and v_subject_type='basic' and exists(
    select 1 from public.lao_curriculum_courses c
    where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
      and c.program_id is null and c.grade_code=p_grade_code
      and c.subject_id=v_subject_id and c.is_active
  ) then
    delete from public.lao_curriculum_program_exclusions
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id=p_program_id and grade_code=p_grade_code and subject_id=v_subject_id;
    v_restored:=true;
    select id into v_course_id
    from public.lao_curriculum_courses
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id is null and grade_code=p_grade_code
      and subject_id=v_subject_id and is_active limit 1;
  else
    select id into v_course_id
    from public.lao_curriculum_courses
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id is not distinct from p_program_id
      and grade_code=p_grade_code and subject_id=v_subject_id
    limit 1;

    if v_course_id is null then
      insert into public.lao_curriculum_courses(
        school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
        annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_grade_label,v_subject_id,
        v_annual,null,
        case
          when p_source_kind='preset' and v_term_no is not null then 'เพิ่มจากแม่แบบมาตรฐานกลาง · ภาคเรียนที่ '||v_term_no
          when p_source_kind='preset' then 'เพิ่มจากแม่แบบมาตรฐานกลาง · รายปี'
          else 'รายวิชาเพิ่มเติมของสถานศึกษา'
        end,
        true,v_sort,v_uid,v_uid
      ) returning id into v_course_id;
    else
      update public.lao_curriculum_courses
      set is_active=true,updated_by=v_uid,updated_at=now()
      where id=v_course_id;
    end if;
  end if;

  if p_source_kind='preset' and v_term_no is not null then
    select id into v_term_id
    from public.lao_terms
    where academic_year_id=p_academic_year_id and term_no=v_term_no
    limit 1;
    if v_term_id is not null then
      insert into public.lao_course_term_plans(
        course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
      ) values(
        v_course_id,v_term_id,v_weekly,null,
        'ผูกภาคเรียนจากแม่แบบมาตรฐานกลาง · กำหนดคาบ/สัปดาห์ภายหลังได้',
        v_uid,v_uid
      ) on conflict(course_id,term_id) do nothing;
    end if;
  end if;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id and grade_code=p_grade_code;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case when v_restored then 'curriculum_subject_restored' else 'curriculum_subject_added' end,
    'curriculum_course',v_course_id::text,
    jsonb_build_object(
      'grade_code',p_grade_code,'program_id',p_program_id,'subject_id',v_subject_id,
      'subject_code',v_subject_code,'subject_name',v_subject_name,
      'source_kind',p_source_kind,'term_no',v_term_no
    )
  );

  return jsonb_build_object(
    'course_id',v_course_id,'subject_id',v_subject_id,'restored',v_restored,
    'subject_code',v_subject_code,'subject_name',v_subject_name,'term_no',v_term_no
  );
end;
$function$;

revoke all on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) to authenticated;

commit;

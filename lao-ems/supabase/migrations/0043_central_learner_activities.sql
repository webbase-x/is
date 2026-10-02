-- 0043_central_learner_activities.sql
-- Add learner-development activities to the 2551/2560 shared template.
-- Same activity code may have multiple separately selectable names; there is no one-choice limit.

begin;

delete from public.lao_curriculum_preset_items
where preset_code='core_2551_2560'
  and subject_type='activity';

insert into public.lao_curriculum_preset_items(
  preset_code,grade_code,grade_label,program_label,sort_order,
  subject_code,subject_name,weekly_periods,annual_hours,subject_type,
  learning_area,is_national_core,choice_group,choice_key,auto_apply,term_no
) values
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',900,'ก11901','กิจกรรมแนะแนว',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก11902','กิจกรรมลูกเสือ-เนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P1_student_activity','scout_guide',false,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก11902','กิจกรรมยุวกาชาด',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P1_student_activity','red_cross_youth',false,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',903,'ก11902','กิจกรรมผู้บำเพ็ญประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P1_student_activity','benefit',false,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',904,'ก11903','กิจกรรมชุมนุม',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',905,'ก11904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',900,'ก12901','กิจกรรมแนะแนว',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก12902','กิจกรรมลูกเสือ-เนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P2_student_activity','scout_guide',false,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก12902','กิจกรรมยุวกาชาด',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P2_student_activity','red_cross_youth',false,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',903,'ก12902','กิจกรรมผู้บำเพ็ญประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P2_student_activity','benefit',false,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',904,'ก12903','กิจกรรมชุมนุม',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',905,'ก12904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',900,'ก13901','กิจกรรมแนะแนว',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก13902','กิจกรรมลูกเสือ-เนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P3_student_activity','scout_guide',false,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก13902','กิจกรรมยุวกาชาด',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P3_student_activity','red_cross_youth',false,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',903,'ก13902','กิจกรรมผู้บำเพ็ญประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P3_student_activity','benefit',false,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',904,'ก13903','กิจกรรมชุมนุม',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',905,'ก13904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',900,'ก14901','กิจกรรมแนะแนว',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก14902','กิจกรรมลูกเสือ-เนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P4_student_activity','scout_guide',false,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก14902','กิจกรรมยุวกาชาด',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P4_student_activity','red_cross_youth',false,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',903,'ก14902','กิจกรรมผู้บำเพ็ญประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P4_student_activity','benefit',false,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',904,'ก14903','กิจกรรมชุมนุม',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',905,'ก14904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',900,'ก15901','กิจกรรมแนะแนว',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก15902','กิจกรรมลูกเสือ-เนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P5_student_activity','scout_guide',false,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก15902','กิจกรรมยุวกาชาด',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P5_student_activity','red_cross_youth',false,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',903,'ก15902','กิจกรรมผู้บำเพ็ญประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P5_student_activity','benefit',false,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',904,'ก15903','กิจกรรมชุมนุม',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',905,'ก15904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',900,'ก16901','กิจกรรมแนะแนว',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก16902','กิจกรรมลูกเสือ-เนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P6_student_activity','scout_guide',false,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก16902','กิจกรรมยุวกาชาด',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P6_student_activity','red_cross_youth',false,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',903,'ก16902','กิจกรรมผู้บำเพ็ญประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P6_student_activity','benefit',false,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',904,'ก16903','กิจกรรมชุมนุม',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',905,'ก16904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,null),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1000,'ก21901','กิจกรรมแนะแนว 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก21902','กิจกรรมลูกเสือ-เนตรนารี 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T1_student_activity','scout_guide',false,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก21902','กิจกรรมยุวกาชาด 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T1_student_activity','red_cross_youth',false,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1003,'ก21902','กิจกรรมผู้บำเพ็ญประโยชน์ 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T1_student_activity','benefit',false,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1004,'ก21903','กิจกรรมชุมนุม 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1005,'ก21904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1100,'ก21905','กิจกรรมแนะแนว 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก21906','กิจกรรมลูกเสือ-เนตรนารี 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T2_student_activity','scout_guide',false,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก21906','กิจกรรมยุวกาชาด 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T2_student_activity','red_cross_youth',false,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1103,'ก21906','กิจกรรมผู้บำเพ็ญประโยชน์ 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T2_student_activity','benefit',false,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1104,'ก21907','กิจกรรมชุมนุม 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1105,'ก21908','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1000,'ก22901','กิจกรรมแนะแนว 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก22902','กิจกรรมลูกเสือ-เนตรนารี 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T1_student_activity','scout_guide',false,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก22902','กิจกรรมยุวกาชาด 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T1_student_activity','red_cross_youth',false,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1003,'ก22902','กิจกรรมผู้บำเพ็ญประโยชน์ 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T1_student_activity','benefit',false,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1004,'ก22903','กิจกรรมชุมนุม 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1005,'ก22904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1100,'ก22905','กิจกรรมแนะแนว 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก22906','กิจกรรมลูกเสือ-เนตรนารี 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T2_student_activity','scout_guide',false,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก22906','กิจกรรมยุวกาชาด 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T2_student_activity','red_cross_youth',false,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1103,'ก22906','กิจกรรมผู้บำเพ็ญประโยชน์ 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T2_student_activity','benefit',false,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1104,'ก22907','กิจกรรมชุมนุม 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1105,'ก22908','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1000,'ก23901','กิจกรรมแนะแนว 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก23902','กิจกรรมลูกเสือ-เนตรนารี 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T1_student_activity','scout_guide',false,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก23902','กิจกรรมยุวกาชาด 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T1_student_activity','red_cross_youth',false,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1003,'ก23902','กิจกรรมผู้บำเพ็ญประโยชน์ 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T1_student_activity','benefit',false,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1004,'ก23903','กิจกรรมชุมนุม 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1005,'ก23904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1100,'ก23905','กิจกรรมแนะแนว 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก23906','กิจกรรมลูกเสือ-เนตรนารี 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T2_student_activity','scout_guide',false,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก23906','กิจกรรมยุวกาชาด 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T2_student_activity','red_cross_youth',false,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1103,'ก23906','กิจกรรมผู้บำเพ็ญประโยชน์ 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T2_student_activity','benefit',false,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1104,'ก23907','กิจกรรมชุมนุม 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1105,'ก23908','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1000,'ก31901','กิจกรรมแนะแนว 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก31902','กิจกรรมลูกเสือ-เนตรนารี 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T1_student_activity','scout_guide',false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก31902','กิจกรรมยุวกาชาด 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T1_student_activity','red_cross_youth',false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1003,'ก31902','กิจกรรมผู้บำเพ็ญประโยชน์ 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T1_student_activity','benefit',false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1004,'ก31902','กิจกรรมนักศึกษาวิชาทหาร 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T1_student_activity','rotc',false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1005,'ก31903','กิจกรรมชุมนุม 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1006,'ก31904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1100,'ก31905','กิจกรรมแนะแนว 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก31906','กิจกรรมลูกเสือ-เนตรนารี 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T2_student_activity','scout_guide',false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก31906','กิจกรรมยุวกาชาด 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T2_student_activity','red_cross_youth',false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1103,'ก31906','กิจกรรมผู้บำเพ็ญประโยชน์ 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T2_student_activity','benefit',false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1104,'ก31906','กิจกรรมนักศึกษาวิชาทหาร 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T2_student_activity','rotc',false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1105,'ก31907','กิจกรรมชุมนุม 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1106,'ก31908','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1000,'ก32901','กิจกรรมแนะแนว 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก32902','กิจกรรมลูกเสือ-เนตรนารี 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T1_student_activity','scout_guide',false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก32902','กิจกรรมยุวกาชาด 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T1_student_activity','red_cross_youth',false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1003,'ก32902','กิจกรรมผู้บำเพ็ญประโยชน์ 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T1_student_activity','benefit',false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1004,'ก32902','กิจกรรมนักศึกษาวิชาทหาร 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T1_student_activity','rotc',false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1005,'ก32903','กิจกรรมชุมนุม 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1006,'ก32904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1100,'ก32905','กิจกรรมแนะแนว 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก32906','กิจกรรมลูกเสือ-เนตรนารี 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T2_student_activity','scout_guide',false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก32906','กิจกรรมยุวกาชาด 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T2_student_activity','red_cross_youth',false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1103,'ก32906','กิจกรรมผู้บำเพ็ญประโยชน์ 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T2_student_activity','benefit',false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1104,'ก32906','กิจกรรมนักศึกษาวิชาทหาร 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T2_student_activity','rotc',false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1105,'ก32907','กิจกรรมชุมนุม 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1106,'ก32908','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1000,'ก33901','กิจกรรมแนะแนว 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก33902','กิจกรรมลูกเสือ-เนตรนารี 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T1_student_activity','scout_guide',false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก33902','กิจกรรมยุวกาชาด 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T1_student_activity','red_cross_youth',false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1003,'ก33902','กิจกรรมผู้บำเพ็ญประโยชน์ 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T1_student_activity','benefit',false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1004,'ก33902','กิจกรรมนักศึกษาวิชาทหาร 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T1_student_activity','rotc',false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1005,'ก33903','กิจกรรมชุมนุม 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1006,'ก33904','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1100,'ก33905','กิจกรรมแนะแนว 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก33906','กิจกรรมลูกเสือ-เนตรนารี 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T2_student_activity','scout_guide',false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก33906','กิจกรรมยุวกาชาด 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T2_student_activity','red_cross_youth',false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1103,'ก33906','กิจกรรมผู้บำเพ็ญประโยชน์ 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T2_student_activity','benefit',false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1104,'ก33906','กิจกรรมนักศึกษาวิชาทหาร 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T2_student_activity','rotc',false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1105,'ก33907','กิจกรรมชุมนุม 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1106,'ก33908','กิจกรรมเพื่อสังคมและสาธารณประโยชน์ 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,null,null,false,2);

CREATE OR REPLACE FUNCTION public.lao_add_curriculum_library_item(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text,
  p_source_kind text,
  p_source_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id
  ) then
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
    where id=p_source_id
      and preset_code='core_2551_2560'
      and grade_code=p_grade_code
      and (
        (subject_type='basic' and is_national_core)
        or subject_type='activity'
      )
    limit 1;
    if v_item.id is null then raise exception 'ไม่พบรายการในคลังมาตรฐานส่วนกลาง'; end if;

    v_subject_type:=v_item.subject_type;
    v_subject_code:=nullif(btrim(v_item.subject_code),'');
    v_subject_name:=btrim(v_item.subject_name);
    v_learning_area:=v_item.learning_area;
    v_weekly:=v_item.weekly_periods;
    v_annual:=v_item.annual_hours;
    v_sort:=coalesce(v_item.sort_order,0);
    v_term_no:=v_item.term_no;

    if v_subject_type='activity' then
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and subject_type='activity'
        and lower(coalesce(subject_code,''))=lower(v_subject_code)
        and lower(btrim(name_th))=lower(v_subject_name)
      limit 1;
    else
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and subject_type<>'activity'
        and lower(coalesce(subject_code,''))=lower(v_subject_code)
      limit 1;
    end if;

    if v_subject_id is null then
      insert into public.lao_subjects(
        school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,v_subject_code,v_subject_name,v_learning_area,v_subject_type,true,v_sort,v_uid,v_uid
      ) returning id into v_subject_id;
    else
      update public.lao_subjects
      set name_th=v_subject_name,learning_area=v_learning_area,subject_type=v_subject_type,
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

  if p_program_id is not null and v_subject_type in ('basic','activity') and exists(
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
      and subject_id=v_subject_id and is_active
    limit 1;
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
          when p_source_kind='preset' and v_subject_type='activity' and v_term_no is not null
            then 'กิจกรรมจากคลังมาตรฐานกลาง · ภาคเรียนที่ '||v_term_no
          when p_source_kind='preset' and v_subject_type='activity'
            then 'กิจกรรมจากคลังมาตรฐานกลาง · รายปี'
          when p_source_kind='preset' and v_term_no is not null
            then 'เพิ่มจากแม่แบบมาตรฐานกลาง · ภาคเรียนที่ '||v_term_no
          when p_source_kind='preset'
            then 'เพิ่มจากแม่แบบมาตรฐานกลาง · รายปี'
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
        'ผูกภาคเรียนจากคลังมาตรฐานกลาง · กำหนดคาบ/สัปดาห์ภายหลังได้',
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
      'subject_type',v_subject_type,'source_kind',p_source_kind,'term_no',v_term_no
    )
  );

  return jsonb_build_object(
    'course_id',v_course_id,'subject_id',v_subject_id,'restored',v_restored,
    'subject_code',v_subject_code,'subject_name',v_subject_name,
    'subject_type',v_subject_type,'term_no',v_term_no
  );
end;
$function$;

revoke all on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) to authenticated;

commit;

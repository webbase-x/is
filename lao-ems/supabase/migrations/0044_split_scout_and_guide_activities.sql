-- 0044_split_scout_and_guide_activities.sql
-- PP records must carry the activity name actually studied by each learner.
-- Therefore scout and guide are separate selectable activities even though they share the same code.

begin;

delete from public.lao_curriculum_preset_items
where preset_code='core_2551_2560'
  and subject_type='activity'
  and choice_key='scout_guide';

insert into public.lao_curriculum_preset_items(
  preset_code,grade_code,grade_label,program_label,sort_order,
  subject_code,subject_name,weekly_periods,annual_hours,subject_type,
  learning_area,is_national_core,choice_group,choice_key,auto_apply,term_no
) values
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก11902','กิจกรรมลูกเสือ',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P1_student_activity','scout',false,null),
('core_2551_2560','P1','ประถมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก11902','กิจกรรมเนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P1_student_activity','guide',false,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก12902','กิจกรรมลูกเสือ',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P2_student_activity','scout',false,null),
('core_2551_2560','P2','ประถมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก12902','กิจกรรมเนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P2_student_activity','guide',false,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก13902','กิจกรรมลูกเสือ',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P3_student_activity','scout',false,null),
('core_2551_2560','P3','ประถมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก13902','กิจกรรมเนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P3_student_activity','guide',false,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก14902','กิจกรรมลูกเสือ',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P4_student_activity','scout',false,null),
('core_2551_2560','P4','ประถมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก14902','กิจกรรมเนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P4_student_activity','guide',false,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก15902','กิจกรรมลูกเสือ',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P5_student_activity','scout',false,null),
('core_2551_2560','P5','ประถมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก15902','กิจกรรมเนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P5_student_activity','guide',false,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',901,'ก16902','กิจกรรมลูกเสือ',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P6_student_activity','scout',false,null),
('core_2551_2560','P6','ประถมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',902,'ก16902','กิจกรรมเนตรนารี',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'P6_student_activity','guide',false,null),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก21902','กิจกรรมลูกเสือ 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T1_student_activity','scout',false,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก21902','กิจกรรมเนตรนารี 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T1_student_activity','guide',false,1),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก21906','กิจกรรมลูกเสือ 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T2_student_activity','scout',false,2),
('core_2551_2560','M1','มัธยมศึกษาปีที่ 1','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก21906','กิจกรรมเนตรนารี 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M1_T2_student_activity','guide',false,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก22902','กิจกรรมลูกเสือ 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T1_student_activity','scout',false,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก22902','กิจกรรมเนตรนารี 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T1_student_activity','guide',false,1),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก22906','กิจกรรมลูกเสือ 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T2_student_activity','scout',false,2),
('core_2551_2560','M2','มัธยมศึกษาปีที่ 2','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก22906','กิจกรรมเนตรนารี 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M2_T2_student_activity','guide',false,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก23902','กิจกรรมลูกเสือ 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T1_student_activity','scout',false,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก23902','กิจกรรมเนตรนารี 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T1_student_activity','guide',false,1),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก23906','กิจกรรมลูกเสือ 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T2_student_activity','scout',false,2),
('core_2551_2560','M3','มัธยมศึกษาปีที่ 3','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก23906','กิจกรรมเนตรนารี 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M3_T2_student_activity','guide',false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก31902','กิจกรรมลูกเสือ 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T1_student_activity','scout',false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก31902','กิจกรรมเนตรนารี 1',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T1_student_activity','guide',false,1),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก31906','กิจกรรมลูกเสือ 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T2_student_activity','scout',false,2),
('core_2551_2560','M4','มัธยมศึกษาปีที่ 4','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก31906','กิจกรรมเนตรนารี 2',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M4_T2_student_activity','guide',false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก32902','กิจกรรมลูกเสือ 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T1_student_activity','scout',false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก32902','กิจกรรมเนตรนารี 3',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T1_student_activity','guide',false,1),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก32906','กิจกรรมลูกเสือ 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T2_student_activity','scout',false,2),
('core_2551_2560','M5','มัธยมศึกษาปีที่ 5','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก32906','กิจกรรมเนตรนารี 4',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M5_T2_student_activity','guide',false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1001,'ก33902','กิจกรรมลูกเสือ 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T1_student_activity','scout',false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1002,'ก33902','กิจกรรมเนตรนารี 5',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T1_student_activity','guide',false,1),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1101,'ก33906','กิจกรรมลูกเสือ 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T2_student_activity','scout',false,2),
('core_2551_2560','M6','มัธยมศึกษาปีที่ 6','แม่แบบมาตรฐานกลาง 2551/2560',1102,'ก33906','กิจกรรมเนตรนารี 6',null,null,'activity','กิจกรรมพัฒนาผู้เรียน',false,'M6_T2_student_activity','guide',false,2);

commit;

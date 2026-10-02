-- 0044_split_scout_and_guide_activities.sql
-- PP records must carry the activity name actually studied by each learner.
-- Scout and guide are separate selectable activities even though they share the same activity code.

begin;

-- Make room immediately after the former combined scout/guide row.
update public.lao_curriculum_preset_items
set sort_order=sort_order+10000
where preset_code='core_2551_2560'
  and subject_type='activity'
  and (
    (grade_code in ('P1','P2','P3','P4','P5','P6') and sort_order>=902)
    or (grade_code in ('M1','M2','M3','M4','M5','M6') and term_no=1 and sort_order>=1002)
    or (grade_code in ('M1','M2','M3','M4','M5','M6') and term_no=2 and sort_order>=1102)
  );

update public.lao_curriculum_preset_items
set sort_order=sort_order-9999
where preset_code='core_2551_2560'
  and subject_type='activity'
  and sort_order>=10902;

-- Rename the existing combined option to Scout.
update public.lao_curriculum_preset_items
set subject_name=replace(subject_name,'ลูกเสือ-เนตรนารี','ลูกเสือ'),
    choice_key='scout'
where preset_code='core_2551_2560'
  and subject_type='activity'
  and choice_key='scout_guide';

-- Add Guide as a second selectable item with the exact same activity code.
insert into public.lao_curriculum_preset_items(
  preset_code,grade_code,grade_label,program_label,sort_order,
  subject_code,subject_name,weekly_periods,annual_hours,subject_type,
  learning_area,is_national_core,choice_group,choice_key,auto_apply,term_no
)
select
  preset_code,grade_code,grade_label,program_label,sort_order+1,
  subject_code,replace(subject_name,'ลูกเสือ','เนตรนารี'),
  weekly_periods,annual_hours,subject_type,learning_area,is_national_core,
  choice_group,'guide',auto_apply,term_no
from public.lao_curriculum_preset_items
where preset_code='core_2551_2560'
  and subject_type='activity'
  and choice_key='scout';

commit;

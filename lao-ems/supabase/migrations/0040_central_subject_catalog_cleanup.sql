-- 0040_central_subject_catalog_cleanup.sql
-- Keep the shared catalog limited to Ministry-framework/basic curriculum templates.
-- School-specific additional subjects remain in lao_subjects / lao_curriculum_courses and are not deleted.

begin;

-- Additional subjects are defined by each school/program; they must not live in the shared central catalog.
delete from public.lao_curriculum_preset_items
where preset_code='normal_primary_example'
  and subject_type='additional';

-- Normalize the central basic-subject display names to the Ministry examples.
update public.lao_curriculum_preset_items
set subject_name='ภาษาอังกฤษ',
    learning_area='ภาษาต่างประเทศ',
    program_label='มาตรฐานส่วนกลาง'
where preset_code='normal_primary_example'
  and subject_type='basic'
  and subject_code like 'อ%';

update public.lao_curriculum_preset_items
set program_label='มาตรฐานส่วนกลาง'
where preset_code='normal_primary_example'
  and subject_type in ('basic','activity');

commit;

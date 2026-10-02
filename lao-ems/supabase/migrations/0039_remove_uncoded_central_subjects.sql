-- 0039_remove_uncoded_central_subjects.sql
-- Central subject catalog entries must have an explicit subject code.
-- This removes legacy uncoded preset rows without touching school-owned subjects.

delete from public.lao_curriculum_preset_items
where preset_code='normal_primary_example'
  and nullif(btrim(subject_code),'') is null;

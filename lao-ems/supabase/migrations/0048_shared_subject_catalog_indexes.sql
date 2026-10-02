-- 0048_shared_subject_catalog_indexes.sql
-- Cover foreign keys used by shared-catalog lifecycle and revision tracking.

begin;
create index if not exists lao_shared_subject_catalog_created_by_idx on public.lao_shared_subject_catalog(created_by);
create index if not exists lao_shared_subject_catalog_updated_by_idx on public.lao_shared_subject_catalog(updated_by);
create index if not exists lao_shared_subject_catalog_reviewed_by_idx on public.lao_shared_subject_catalog(reviewed_by);
create index if not exists lao_shared_subject_catalog_supersedes_idx on public.lao_shared_subject_catalog(supersedes_id);
commit;

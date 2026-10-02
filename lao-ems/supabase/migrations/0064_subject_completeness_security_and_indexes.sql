-- 0064_subject_completeness_security_and_indexes.sql
-- Internal completeness helpers are not exposed directly to signed-in clients.
-- Client-facing access is through guarded workspace/timeline RPCs and the explicit decision RPC.

begin;

create index if not exists lao_subject_requirement_decisions_year_fk_idx
  on public.lao_subject_requirement_decisions(academic_year_id);
create index if not exists lao_subject_requirement_decisions_program_fk_idx
  on public.lao_subject_requirement_decisions(program_id)
  where program_id is not null;
create index if not exists lao_subject_requirement_decisions_replacement_fk_idx
  on public.lao_subject_requirement_decisions(replacement_subject_id)
  where replacement_subject_id is not null;

revoke all on function public.lao_subject_group_completeness(uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.lao_subject_readiness(uuid,uuid)
  from public,anon,authenticated;

commit;

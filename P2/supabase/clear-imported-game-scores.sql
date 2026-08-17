-- Let an authorized teacher remove only imported/derived game scores before live collection.
create or replace function public.clear_imported_game_scores(p_class_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare deleted_count integer;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;

  delete from public.game_score_backfills
  where class_id=p_class_id and source_kind='derived_from_posttest';
  get diagnostics deleted_count = row_count;

  perform public.refresh_research_game_dataset_for_class(p_class_id);
  return deleted_count;
end;
$$;

revoke all on function public.clear_imported_game_scores(uuid) from public, anon;
grant execute on function public.clear_imported_game_scores(uuid) to authenticated;

notify pgrst, 'reload schema';

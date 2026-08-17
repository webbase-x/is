-- Return the latest room code for the selected class report.
create or replace function public.get_class_report_context(p_class_id uuid)
returns table (
  room_code text,
  session_status text,
  plan_id smallint,
  opened_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;

  return query
  select trim(session_row.room_code)::text, session_row.status,
    session_row.plan_id, session_row.opened_at
  from public.class_sessions session_row
  where session_row.class_id=p_class_id
    and session_row.score_recording_enabled
  order by session_row.opened_at desc
  limit 1;
end;
$$;

revoke all on function public.get_class_report_context(uuid) from public, anon;
grant execute on function public.get_class_report_context(uuid) to authenticated;

notify pgrst, 'reload schema';

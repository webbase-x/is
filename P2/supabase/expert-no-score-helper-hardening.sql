-- The score-recording capability is an internal helper, not a public RPC.
revoke all on function public.teacher_can_record_scores(uuid) from public, anon, authenticated;

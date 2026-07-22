-- Allow an authenticated student to read the class session they joined.
-- The previous policy compared p.session_id to p.id because `id` was
-- unqualified inside the subquery, so approved students could not enter the game.
drop policy if exists "players read own session" on public.class_sessions;
create policy "players read own session" on public.class_sessions for select to authenticated
  using (exists (
    select 1 from public.session_players as p
    where p.session_id = public.class_sessions.id
      and p.auth_user_id = auth.uid()
  ));
notify pgrst, 'reload schema';

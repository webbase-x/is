-- Authorize administrator actions only when both role and numeric level agree.
create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_profiles t
    where t.user_id = check_user
      and t.active
      and t.role = 'admin'
      and t.access_level = 1
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

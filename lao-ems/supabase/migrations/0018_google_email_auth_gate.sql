-- Email authorization gate for password/Google sign-in.
-- Authenticated users may enter LAO-EMS only when their verified auth email
-- matches an existing platform admin, membership, or pending invitation.

create or replace function public.lao_email_is_authorized()
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  with current_identity as (
    select
      (select auth.uid()) as uid,
      lower(nullif(btrim(coalesce((select auth.jwt())->>'email','')),'')) as email
  )
  select coalesce((
    select
      ci.uid is not null
      and ci.email is not null
      and (
        exists(
          select 1
          from public.lao_platform_admins pa
          join auth.users u on u.id=pa.user_id
          where lower(u.email)=ci.email
        )
        or exists(
          select 1
          from public.lao_memberships m
          join auth.users u on u.id=m.user_id
          where lower(u.email)=ci.email
            and m.status in ('active','pending','suspended')
        )
        or exists(
          select 1
          from public.lao_user_invitations i
          where lower(i.email)=ci.email
            and i.status='pending'
        )
      )
    from current_identity ci
  ),false);
$$;

revoke all on function public.lao_email_is_authorized() from public,anon;
grant execute on function public.lao_email_is_authorized() to authenticated;

-- LAO-EMS admin-managed invitations and first-login onboarding.

create table if not exists public.lao_user_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.lao_organizations(id) on delete cascade,
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  email text not null,
  role_code text not null references public.lao_roles(code) on delete restrict,
  auth_user_id uuid references auth.users(id) on delete set null,
  invitation_mode text not null
    check(invitation_mode in ('platform_first_admin','school_admin')),
  status text not null default 'pending'
    check(status in ('pending','accepted','revoked','failed')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lao_user_invitations_school_status_idx
  on public.lao_user_invitations(school_id,status,sent_at desc);
create index if not exists lao_user_invitations_email_idx
  on public.lao_user_invitations(lower(email),status);
create unique index if not exists lao_user_invitations_pending_school_email_uq
  on public.lao_user_invitations(school_id,lower(email))
  where status='pending';

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='lao_user_invitations_touch') then
    create trigger lao_user_invitations_touch
    before update on public.lao_user_invitations
    for each row execute function public.lao_touch_updated_at();
  end if;
end $$;

alter table public.lao_user_invitations enable row level security;
grant select on public.lao_user_invitations to authenticated;

drop policy if exists "lao user invitations admin read" on public.lao_user_invitations;
create policy "lao user invitations admin read"
on public.lao_user_invitations
for select to authenticated
using(
  public.lao_is_platform_admin()
  or public.lao_is_local_school_admin(school_id)
);

create or replace function public.lao_has_lao_access()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.lao_is_platform_admin()
    or exists(
      select 1 from public.lao_memberships m
      where m.user_id=(select auth.uid())
        and m.status in ('active','pending','suspended')
    )
    or exists(
      select 1
      from public.lao_user_invitations i
      where i.status='pending'
        and (
          i.auth_user_id=(select auth.uid())
          or lower(i.email)=lower(coalesce((select auth.jwt())->>'email',''))
        )
    );
$$;

create or replace function public.lao_my_pending_invitation()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_email text:=lower(coalesce((select auth.jwt())->>'email',''));
  v_i public.lao_user_invitations;
  v_school_name text;
  v_org_name text;
begin
  if v_uid is null then return null; end if;

  select *
  into v_i
  from public.lao_user_invitations
  where status='pending'
    and (auth_user_id=v_uid or lower(email)=v_email)
  order by sent_at desc
  limit 1;

  if not found then return null; end if;

  select s.name_th,o.name_th
  into v_school_name,v_org_name
  from public.lao_schools s
  join public.lao_organizations o on o.id=s.organization_id
  where s.id=v_i.school_id;

  return jsonb_build_object(
    'id',v_i.id,
    'email',v_i.email,
    'school_id',v_i.school_id,
    'school_name',v_school_name,
    'organization_name',v_org_name,
    'role_code',v_i.role_code,
    'invitation_mode',v_i.invitation_mode,
    'sent_at',v_i.sent_at
  );
end;
$$;

create or replace function public.lao_complete_invitation(
  p_prefix text,
  p_first_name_th text,
  p_last_name_th text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_email text:=lower(coalesce((select auth.jwt())->>'email',''));
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
  v_i public.lao_user_invitations;
  v_membership_id uuid;
  v_role_id uuid;
  v_display text;
  v_existing_admin boolean;
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  if nullif(btrim(p_first_name_th),'') is null or nullif(btrim(p_last_name_th),'') is null then
    raise exception 'First name and last name are required';
  end if;

  select *
  into v_i
  from public.lao_user_invitations
  where status='pending'
    and (auth_user_id=v_uid or lower(email)=v_email)
  order by sent_at desc
  limit 1
  for update;

  if not found then raise exception 'No pending LAO-EMS invitation found'; end if;

  if v_i.auth_user_id is null then
    update public.lao_user_invitations set auth_user_id=v_uid where id=v_i.id;
  elsif v_i.auth_user_id<>v_uid then
    raise exception 'Invitation belongs to another account';
  end if;

  if v_i.invitation_mode='platform_first_admin' then
    v_existing_admin:=public.lao_school_has_admin(v_i.school_id);
    if v_existing_admin then
      raise exception 'This school already has a School Admin. Ask the School Admin to send a new invitation';
    end if;
  end if;

  v_display:=concat_ws(' ',
    nullif(btrim(p_prefix),''),
    nullif(btrim(p_first_name_th),''),
    nullif(btrim(p_last_name_th),'')
  );

  perform public.lao_ensure_profile(
    p_prefix,
    p_first_name_th,
    p_last_name_th,
    v_display,
    p_phone
  );

  select m.id
  into v_membership_id
  from public.lao_memberships m
  where m.user_id=v_uid
    and m.school_id=v_i.school_id
    and m.status in ('pending','active','suspended')
  order by m.created_at desc
  limit 1;

  if v_membership_id is null then
    insert into public.lao_memberships(
      user_id,organization_id,school_id,requested_role_code,request_note,
      status,requested_at,reviewed_at,reviewed_by
    )
    values(
      v_uid,v_i.organization_id,v_i.school_id,v_i.role_code,
      'สร้างบัญชีโดยผู้ดูแลผ่านระบบเชิญ',
      'active',v_i.sent_at,now(),v_i.invited_by
    )
    returning id into v_membership_id;
  else
    update public.lao_memberships
    set organization_id=v_i.organization_id,
        requested_role_code=v_i.role_code,
        request_note='สร้างบัญชีโดยผู้ดูแลผ่านระบบเชิญ',
        status='active',
        reviewed_at=now(),
        reviewed_by=v_i.invited_by,
        ended_at=null,
        updated_at=now()
    where id=v_membership_id;
  end if;

  select id into v_role_id
  from public.lao_roles
  where code=v_i.role_code;

  if v_role_id is null then raise exception 'Invitation role no longer exists'; end if;

  delete from public.lao_membership_roles where membership_id=v_membership_id;
  insert into public.lao_membership_roles(membership_id,role_id,granted_by)
  values(v_membership_id,v_role_id,v_i.invited_by);

  update public.lao_user_invitations
  set status='accepted',accepted_at=now(),auth_user_id=v_uid,last_error=null
  where id=v_i.id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data,context
  )
  values(
    v_i.organization_id,v_i.school_id,v_uid,
    'invitation_accepted','user_invitation',v_i.id::text,
    jsonb_build_object('role_code',v_i.role_code,'membership_id',v_membership_id),
    jsonb_build_object('invited_by',v_i.invited_by,'email',v_i.email)
  );

  return jsonb_build_object(
    'invitation_id',v_i.id,
    'membership_id',v_membership_id,
    'school_id',v_i.school_id,
    'role_code',v_i.role_code
  );
end;
$$;

revoke all on function public.lao_has_lao_access() from public,anon;
revoke all on function public.lao_my_pending_invitation() from public,anon;
revoke all on function public.lao_complete_invitation(text,text,text,text) from public,anon;

grant execute on function public.lao_has_lao_access() to authenticated;
grant execute on function public.lao_my_pending_invitation() to authenticated;
grant execute on function public.lao_complete_invitation(text,text,text,text) to authenticated;

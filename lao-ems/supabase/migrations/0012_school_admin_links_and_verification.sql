-- Platform Admin School Admin invite links, verification applications, and self-school onboarding.
-- Applied to ISSQL as migration lao_school_admin_links_and_verification.

create table if not exists public.lao_school_admin_invite_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  label text not null default 'School Admin invitation',
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lao_school_admin_applications (
  id uuid primary key default gen_random_uuid(),
  invite_link_id uuid not null references public.lao_school_admin_invite_links(id) on delete restrict,
  email text not null,
  prefix text,
  first_name_th text not null,
  last_name_th text not null,
  phone text,
  claimed_organization_name text,
  claimed_school_name text,
  applicant_note text,
  document_object_path text not null,
  document_file_name text not null,
  document_mime_type text not null,
  document_size bigint not null check(document_size > 0 and document_size <= 10485760),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists lao_school_admin_applications_status_idx
  on public.lao_school_admin_applications(status,created_at desc);
create unique index if not exists lao_school_admin_applications_pending_email_uq
  on public.lao_school_admin_applications(lower(email)) where status='pending';

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='lao_school_admin_invite_links_touch') then
    create trigger lao_school_admin_invite_links_touch
    before update on public.lao_school_admin_invite_links
    for each row execute function public.lao_touch_updated_at();
  end if;
end $$;

alter table public.lao_school_admin_invite_links enable row level security;
alter table public.lao_school_admin_applications enable row level security;
grant select on public.lao_school_admin_invite_links to authenticated;
grant select on public.lao_school_admin_applications to authenticated;
revoke insert,update,delete on public.lao_school_admin_invite_links from authenticated,anon;
revoke insert,update,delete on public.lao_school_admin_applications from authenticated,anon;

drop policy if exists "platform admin reads invite links" on public.lao_school_admin_invite_links;
create policy "platform admin reads invite links" on public.lao_school_admin_invite_links
for select to authenticated using(public.lao_is_platform_admin());

drop policy if exists "platform admin reads school admin applications" on public.lao_school_admin_applications;
create policy "platform admin reads school admin applications" on public.lao_school_admin_applications
for select to authenticated using(public.lao_is_platform_admin());

create or replace function public.lao_create_school_admin_invite_link(
  p_label text default 'School Admin invitation', p_expires_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=(select auth.uid()); v_id uuid; v_token text;
begin
  if v_uid is null or not public.lao_is_platform_admin() then raise exception 'Platform Admin required'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'Expiration must be in the future'; end if;
  v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.lao_school_admin_invite_links(token,label,is_active,expires_at,created_by)
  values(v_token,coalesce(nullif(btrim(p_label),''),'School Admin invitation'),true,p_expires_at,v_uid)
  returning id into v_id;
  insert into public.lao_audit_logs(actor_user_id,action,entity_type,entity_id,after_data)
  values(v_uid,'school_admin_invite_link_created','school_admin_invite_link',v_id::text,
    jsonb_build_object('label',p_label,'expires_at',p_expires_at,'is_active',true));
  return jsonb_build_object('id',v_id,'token',v_token,'is_active',true,'expires_at',p_expires_at);
end; $$;

create or replace function public.lao_set_school_admin_invite_link_active(p_link_id uuid,p_is_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=(select auth.uid()); v_link public.lao_school_admin_invite_links;
begin
  if v_uid is null or not public.lao_is_platform_admin() then raise exception 'Platform Admin required'; end if;
  update public.lao_school_admin_invite_links set is_active=p_is_active,updated_at=now()
  where id=p_link_id returning * into v_link;
  if not found then raise exception 'Invitation link not found'; end if;
  insert into public.lao_audit_logs(actor_user_id,action,entity_type,entity_id,after_data)
  values(v_uid,'school_admin_invite_link_status_changed','school_admin_invite_link',p_link_id::text,
    jsonb_build_object('is_active',p_is_active));
  return jsonb_build_object('id',v_link.id,'is_active',v_link.is_active);
end; $$;

create or replace function public.lao_public_school_admin_link_status(p_token text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_link public.lao_school_admin_invite_links;
begin
  select * into v_link from public.lao_school_admin_invite_links where token=p_token limit 1;
  if not found then return jsonb_build_object('valid',false,'reason','not_found'); end if;
  if not v_link.is_active then return jsonb_build_object('valid',false,'reason','closed','label',v_link.label); end if;
  if v_link.expires_at is not null and v_link.expires_at <= now() then
    return jsonb_build_object('valid',false,'reason','expired','label',v_link.label);
  end if;
  return jsonb_build_object('valid',true,'id',v_link.id,'label',v_link.label,'expires_at',v_link.expires_at);
end; $$;

create or replace function public.lao_reject_school_admin_application(p_application_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=(select auth.uid()); v_app public.lao_school_admin_applications;
begin
  if v_uid is null or not public.lao_is_platform_admin() then raise exception 'Platform Admin required'; end if;
  update public.lao_school_admin_applications
  set status='rejected',reviewed_by=v_uid,reviewed_at=now(),review_note=nullif(btrim(p_note),'')
  where id=p_application_id and status='pending' returning * into v_app;
  if not found then raise exception 'Pending application not found'; end if;
  insert into public.lao_audit_logs(actor_user_id,action,entity_type,entity_id,after_data)
  values(v_uid,'school_admin_application_rejected','school_admin_application',p_application_id::text,
    jsonb_build_object('email',v_app.email,'review_note',v_app.review_note));
  return jsonb_build_object('id',v_app.id,'status',v_app.status);
end; $$;

create or replace function public.lao_platform_begin_school_onboarding()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=(select auth.uid()); v_email text:=lower(coalesce((select auth.jwt())->>'email','')); v_inv public.lao_user_invitations;
begin
  if v_uid is null or not public.lao_is_platform_admin() then raise exception 'Platform Admin required'; end if;
  if exists(
    select 1 from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=v_uid and m.status='active' and m.school_id is not null and r.code='school_admin'
  ) then return jsonb_build_object('already_school_admin',true); end if;
  select * into v_inv from public.lao_user_invitations
  where auth_user_id=v_uid and invitation_mode='platform_first_admin' and role_code='school_admin'
    and school_id is null and status in ('pending','onboarding')
  order by created_at desc limit 1 for update;
  if found then
    update public.lao_user_invitations set status='onboarding',auth_user_id=v_uid where id=v_inv.id returning * into v_inv;
  else
    insert into public.lao_user_invitations(
      organization_id,school_id,email,role_code,auth_user_id,invitation_mode,status,invited_by,sent_at
    ) values(null,null,v_email,'school_admin',v_uid,'platform_first_admin','onboarding',v_uid,now())
    returning * into v_inv;
  end if;
  insert into public.lao_audit_logs(actor_user_id,action,entity_type,entity_id,after_data)
  values(v_uid,'platform_admin_self_school_onboarding_started','user_invitation',v_inv.id::text,
    jsonb_build_object('email',v_email,'role_code','school_admin'));
  return jsonb_build_object('already_school_admin',false,'invitation_id',v_inv.id,'status',v_inv.status);
end; $$;

revoke all on function public.lao_create_school_admin_invite_link(text,timestamptz) from public,anon;
revoke all on function public.lao_set_school_admin_invite_link_active(uuid,boolean) from public,anon;
revoke all on function public.lao_reject_school_admin_application(uuid,text) from public,anon;
revoke all on function public.lao_platform_begin_school_onboarding() from public,anon;
grant execute on function public.lao_create_school_admin_invite_link(text,timestamptz) to authenticated;
grant execute on function public.lao_set_school_admin_invite_link_active(uuid,boolean) to authenticated;
grant execute on function public.lao_reject_school_admin_application(uuid,text) to authenticated;
grant execute on function public.lao_platform_begin_school_onboarding() to authenticated;
revoke all on function public.lao_public_school_admin_link_status(text) from public;
grant execute on function public.lao_public_school_admin_link_status(text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lao-ems-admin-verification','lao-ems-admin-verification',false,10485760,
  array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists "platform admin reads verification documents" on storage.objects;
create policy "platform admin reads verification documents" on storage.objects
for select to authenticated
using(bucket_id='lao-ems-admin-verification' and public.lao_is_platform_admin());

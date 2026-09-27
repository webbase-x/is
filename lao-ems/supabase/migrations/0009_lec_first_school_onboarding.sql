-- LAO-EMS: remove manual organization/school bootstrap.
-- The first School Admin is invited before a school exists.
-- The first accepted LEC import creates/reuses the LGO and school from source data.

alter table public.lao_user_invitations
  alter column organization_id drop not null,
  alter column school_id drop not null;

alter table public.lao_user_invitations
  drop constraint if exists lao_user_invitations_status_check;
alter table public.lao_user_invitations
  add constraint lao_user_invitations_status_check
  check(status in ('pending','onboarding','accepted','revoked','failed'));

create unique index if not exists lao_user_invitations_unbound_email_uq
  on public.lao_user_invitations(lower(email))
  where school_id is null and status in ('pending','onboarding');

drop policy if exists "lao user invitations admin read" on public.lao_user_invitations;
create policy "lao user invitations admin read"
on public.lao_user_invitations
for select to authenticated
using(
  public.lao_is_platform_admin()
  or (school_id is not null and public.lao_is_local_school_admin(school_id))
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
      where i.status in ('pending','onboarding')
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

  select * into v_i
  from public.lao_user_invitations
  where status in ('pending','onboarding')
    and (auth_user_id=v_uid or lower(email)=v_email)
  order by sent_at desc
  limit 1;

  if not found then return null; end if;

  if v_i.school_id is not null then
    select s.name_th,o.name_th
    into v_school_name,v_org_name
    from public.lao_schools s
    join public.lao_organizations o on o.id=s.organization_id
    where s.id=v_i.school_id;
  end if;

  return jsonb_build_object(
    'id',v_i.id,
    'email',v_i.email,
    'organization_id',v_i.organization_id,
    'school_id',v_i.school_id,
    'school_name',v_school_name,
    'organization_name',v_org_name,
    'role_code',v_i.role_code,
    'invitation_mode',v_i.invitation_mode,
    'status',v_i.status,
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

  select * into v_i
  from public.lao_user_invitations
  where status in ('pending','onboarding')
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

  v_display:=concat_ws(' ',
    nullif(btrim(p_prefix),''),
    nullif(btrim(p_first_name_th),''),
    nullif(btrim(p_last_name_th),'')
  );

  perform public.lao_ensure_profile(
    p_prefix,p_first_name_th,p_last_name_th,v_display,p_phone
  );

  if v_i.invitation_mode='platform_first_admin' and v_i.school_id is null then
    update public.lao_user_invitations
    set status='onboarding',auth_user_id=v_uid,last_error=null
    where id=v_i.id;

    insert into public.lao_audit_logs(
      actor_user_id,action,entity_type,entity_id,after_data,context
    )
    values(
      v_uid,'first_school_admin_profile_completed','user_invitation',v_i.id::text,
      jsonb_build_object('role_code',v_i.role_code,'next_step','lec_import'),
      jsonb_build_object('invited_by',v_i.invited_by,'email',v_i.email)
    );

    return jsonb_build_object(
      'invitation_id',v_i.id,
      'role_code',v_i.role_code,
      'needs_lec',true
    );
  end if;

  if v_i.school_id is null or v_i.organization_id is null then
    raise exception 'Invitation is not bound to a school';
  end if;

  if v_i.invitation_mode='platform_first_admin' then
    v_existing_admin:=public.lao_school_has_admin(v_i.school_id);
    if v_existing_admin then
      raise exception 'This school already has a School Admin. Ask the School Admin to send a new invitation';
    end if;
  end if;

  select m.id into v_membership_id
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

  select id into v_role_id from public.lao_roles where code=v_i.role_code;
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
    'role_code',v_i.role_code,
    'needs_lec',false
  );
end;
$$;

create or replace function public.lao_onboard_school_from_lec(
  p_invitation_id uuid,
  p_file_name text,
  p_file_size bigint,
  p_file_sha256 text,
  p_sheet_name text,
  p_ignored_sheet_count integer,
  p_header_map jsonb,
  p_metadata jsonb,
  p_rows jsonb
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
  v_org_name text:=nullif(btrim(p_metadata->>'organization_name_th'),'');
  v_school_name text:=nullif(btrim(p_metadata->>'school_name_th'),'');
  v_school_code text:=nullif(btrim(p_metadata->>'school_code'),'');
  v_province text:=nullif(btrim(p_metadata->>'province_name_th'),'');
  v_district text:=nullif(btrim(p_metadata->>'district_name_th'),'');
  v_year integer;
  v_term smallint;
  v_org_id uuid;
  v_school_id uuid;
  v_membership_id uuid;
  v_role_id uuid;
  v_org_count integer;
  v_school_count integer;
  v_org_type text;
  v_slug text;
  v_result jsonb;
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;

  select * into v_i
  from public.lao_user_invitations
  where id=p_invitation_id
    and status='onboarding'
    and invitation_mode='platform_first_admin'
    and role_code='school_admin'
    and school_id is null
    and organization_id is null
    and (auth_user_id=v_uid or lower(email)=v_email)
  for update;

  if not found then raise exception 'No active first School Admin onboarding invitation found'; end if;
  if v_i.auth_user_id is not null and v_i.auth_user_id<>v_uid then
    raise exception 'Invitation belongs to another account';
  end if;

  if coalesce(p_metadata->>'school_resolution','')<>'accept_new_lec' then
    raise exception 'Explicit confirmation of LEC school data is required';
  end if;

  begin v_year:=(p_metadata->>'academic_year_be')::integer; exception when others then v_year:=null; end;
  begin v_term:=(p_metadata->>'term_no')::smallint; exception when others then v_term:=null; end;

  if v_org_name is null or v_school_name is null or v_province is null or v_district is null then
    raise exception 'LEC source must contain organization, school, province and district';
  end if;
  if v_year is null or v_year not between 2400 and 2800 then
    raise exception 'LEC source does not contain a valid academic year';
  end if;
  if v_term is null or v_term not between 1 and 4 then
    raise exception 'LEC source does not contain a valid term';
  end if;

  select count(*),min(id) into v_org_count,v_org_id
  from public.lao_organizations
  where regexp_replace(lower(name_th),'\s+','','g')
        =regexp_replace(lower(v_org_name),'\s+','','g');

  if v_org_count>1 then
    raise exception 'More than one matching LGO exists. Platform Admin review is required';
  elsif v_org_count=0 then
    v_org_type:=case
      when v_org_name like 'องค์การบริหารส่วนจังหวัด%' then 'pao'
      when v_org_name like 'องค์การบริหารส่วนตำบล%' then 'sao'
      when v_org_name like 'เทศบาล%' then 'municipality'
      else 'local_government'
    end;

    insert into public.lao_organizations(name_th,organization_type,is_active)
    values(v_org_name,v_org_type,true)
    returning id into v_org_id;
  end if;

  if v_school_code is not null then
    select count(*),min(id) into v_school_count,v_school_id
    from public.lao_schools
    where organization_id=v_org_id and code=v_school_code;
  else
    select count(*),min(id) into v_school_count,v_school_id
    from public.lao_schools
    where organization_id=v_org_id
      and regexp_replace(lower(name_th),'\s+','','g')
          =regexp_replace(lower(v_school_name),'\s+','','g');
  end if;

  if v_school_count>1 then
    raise exception 'More than one matching school exists. Platform Admin review is required';
  elsif v_school_count=1 then
    if public.lao_school_has_admin(v_school_id) then
      raise exception 'This school already has a School Admin';
    end if;
  else
    v_slug:='lec-'||substr(replace(gen_random_uuid()::text,'-',''),1,12);
    insert into public.lao_schools(
      organization_id,code,name_th,slug,is_active,source_system,
      lec_province_name_th,lec_district_name_th,lec_organization_name_th
    )
    values(
      v_org_id,v_school_code,v_school_name,v_slug,true,'setup',
      v_province,v_district,v_org_name
    )
    returning id into v_school_id;
  end if;

  select id into v_role_id from public.lao_roles where code='school_admin';
  if v_role_id is null then raise exception 'School Admin role is missing'; end if;

  select id into v_membership_id
  from public.lao_memberships
  where user_id=v_uid and school_id=v_school_id
    and status in ('pending','active','suspended')
  order by created_at desc
  limit 1;

  if v_membership_id is null then
    insert into public.lao_memberships(
      user_id,organization_id,school_id,requested_role_code,request_note,
      status,requested_at,reviewed_at,reviewed_by
    )
    values(
      v_uid,v_org_id,v_school_id,'school_admin',
      'School Admin คนแรก: ผูกสถานศึกษาจากไฟล์ LEC',
      'active',v_i.sent_at,now(),v_i.invited_by
    )
    returning id into v_membership_id;
  else
    update public.lao_memberships
    set organization_id=v_org_id,requested_role_code='school_admin',
        request_note='School Admin คนแรก: ผูกสถานศึกษาจากไฟล์ LEC',
        status='active',reviewed_at=now(),reviewed_by=v_i.invited_by,
        ended_at=null,updated_at=now()
    where id=v_membership_id;
  end if;

  delete from public.lao_membership_roles where membership_id=v_membership_id;
  insert into public.lao_membership_roles(membership_id,role_id,granted_by)
  values(v_membership_id,v_role_id,v_i.invited_by);

  update public.lao_user_invitations
  set organization_id=v_org_id,school_id=v_school_id,auth_user_id=v_uid
  where id=v_i.id;

  v_result:=public.lao_import_lec_students(
    v_school_id,v_year,v_term,
    p_file_name,p_file_size,p_file_sha256,p_sheet_name,p_ignored_sheet_count,
    p_header_map,p_metadata,p_rows
  );

  update public.lao_user_invitations
  set status='accepted',accepted_at=now(),last_error=null
  where id=v_i.id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data,context
  )
  values(
    v_org_id,v_school_id,v_uid,
    'school_onboarded_from_lec','user_invitation',v_i.id::text,
    jsonb_build_object(
      'membership_id',v_membership_id,
      'organization_id',v_org_id,
      'school_id',v_school_id,
      'school_name_th',v_school_name
    ),
    jsonb_build_object(
      'invited_by',v_i.invited_by,
      'email',v_i.email,
      'source_file_name',p_file_name
    )
  );

  return coalesce(v_result,'{}'::jsonb)
    ||jsonb_build_object(
      'organization_id',v_org_id,
      'school_id',v_school_id,
      'membership_id',v_membership_id,
      'onboarding_completed',true
    );
end;
$$;

revoke all on function public.lao_onboard_school_from_lec(uuid,text,bigint,text,text,integer,jsonb,jsonb,jsonb)
from public,anon;
grant execute on function public.lao_onboard_school_from_lec(uuid,text,bigint,text,text,integer,jsonb,jsonb,jsonb)
to authenticated;

revoke insert,update,delete on public.lao_organizations from authenticated;
revoke insert,update,delete on public.lao_schools from authenticated;

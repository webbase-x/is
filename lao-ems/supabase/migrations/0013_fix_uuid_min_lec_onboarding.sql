-- Fix PostgreSQL UUID lookup in first-school LEC onboarding.
-- PostgreSQL has no min(uuid) aggregate in this environment; count and select the single UUID separately.

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

  select count(*) into v_org_count
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
  else
    select id into v_org_id
    from public.lao_organizations
    where regexp_replace(lower(name_th),'\s+','','g')
          =regexp_replace(lower(v_org_name),'\s+','','g')
    limit 1;
  end if;

  if v_school_code is not null then
    select count(*) into v_school_count
    from public.lao_schools
    where organization_id=v_org_id and code=v_school_code;

    if v_school_count=1 then
      select id into v_school_id
      from public.lao_schools
      where organization_id=v_org_id and code=v_school_code
      limit 1;
    end if;
  else
    select count(*) into v_school_count
    from public.lao_schools
    where organization_id=v_org_id
      and regexp_replace(lower(name_th),'\s+','','g')
          =regexp_replace(lower(v_school_name),'\s+','','g');

    if v_school_count=1 then
      select id into v_school_id
      from public.lao_schools
      where organization_id=v_org_id
        and regexp_replace(lower(name_th),'\s+','','g')
            =regexp_replace(lower(v_school_name),'\s+','','g')
      limit 1;
    end if;
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

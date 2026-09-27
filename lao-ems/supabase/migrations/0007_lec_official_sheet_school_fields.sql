-- LAO-EMS: the authoritative LEC worksheet is selected by complete school identity columns,
-- not by workbook position or worksheet name.

alter table public.lao_schools
  add column if not exists lec_province_name_th text,
  add column if not exists lec_district_name_th text,
  add column if not exists lec_organization_name_th text;

alter table public.lao_lec_school_snapshots
  add column if not exists province_name_th text,
  add column if not exists district_name_th text,
  add column if not exists organization_name_th text;

create or replace function public.lao_lec_school_snapshot_fill_metadata()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.province_name_th:=coalesce(new.province_name_th,nullif(btrim(new.raw_metadata->>'province_name_th'),''));
  new.district_name_th:=coalesce(new.district_name_th,nullif(btrim(new.raw_metadata->>'district_name_th'),''));
  new.organization_name_th:=coalesce(new.organization_name_th,nullif(btrim(new.raw_metadata->>'organization_name_th'),''));
  return new;
end;
$$;

drop trigger if exists lao_lec_school_snapshot_fill_metadata on public.lao_lec_school_snapshots;
create trigger lao_lec_school_snapshot_fill_metadata
before insert or update of raw_metadata
on public.lao_lec_school_snapshots
for each row execute function public.lao_lec_school_snapshot_fill_metadata();

create or replace function public.lao_lec_school_snapshot_sync_current()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.lao_schools
  set lec_province_name_th=coalesce(new.province_name_th,lec_province_name_th),
      lec_district_name_th=coalesce(new.district_name_th,lec_district_name_th),
      lec_organization_name_th=coalesce(new.organization_name_th,lec_organization_name_th)
  where id=new.school_id;
  return new;
end;
$$;

drop trigger if exists lao_lec_school_snapshot_sync_current on public.lao_lec_school_snapshots;
create trigger lao_lec_school_snapshot_sync_current
after insert or update of province_name_th,district_name_th,organization_name_th
on public.lao_lec_school_snapshots
for each row execute function public.lao_lec_school_snapshot_sync_current();

create or replace function public.lao_lec_school_check(
  p_school_id uuid,
  p_metadata jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_s public.lao_schools;
  v_in_code text:=nullif(btrim(p_metadata->>'school_code'),'');
  v_in_name text:=nullif(btrim(p_metadata->>'school_name_th'),'');
  v_in_org text:=nullif(btrim(p_metadata->>'organization_name_th'),'');
  v_in_province text:=nullif(btrim(p_metadata->>'province_name_th'),'');
  v_in_district text:=nullif(btrim(p_metadata->>'district_name_th'),'');
  v_in_phone text:=nullif(btrim(p_metadata->>'school_phone'),'');
  v_in_email text:=nullif(btrim(p_metadata->>'school_email'),'');
  v_in_web text:=nullif(btrim(p_metadata->>'school_website_url'),'');
  v_in_address text:=nullif(btrim(p_metadata->>'school_address_text'),'');
  v_diff jsonb:='{}'::jsonb;
  v_first boolean;
  v_hard_block boolean:=false;
  v_requires_confirmation boolean:=false;
  v_status text;
  v_name_diff boolean:=false;
  v_org_diff boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (public.lao_is_platform_admin() or public.lao_is_local_school_admin(p_school_id)) then
    raise exception 'Access denied';
  end if;

  select * into v_s from public.lao_schools where id=p_school_id;
  if not found then raise exception 'School not found'; end if;

  if v_in_name is null or v_in_org is null or v_in_province is null or v_in_district is null then
    return jsonb_build_object(
      'status','missing_school_identity',
      'can_import',false,
      'requires_confirmation',false,
      'hard_block',true,
      'message','ชีตข้อมูล LEC ต้องมี จังหวัด อำเภอ อปท. และสถานศึกษาครบ',
      'current',jsonb_build_object(
        'school_code',v_s.code,'school_name_th',v_s.name_th,
        'organization_name_th',v_s.lec_organization_name_th,
        'province_name_th',v_s.lec_province_name_th,
        'district_name_th',v_s.lec_district_name_th
      ),
      'incoming',jsonb_build_object(
        'school_code',v_in_code,'school_name_th',v_in_name,
        'organization_name_th',v_in_org,'province_name_th',v_in_province,'district_name_th',v_in_district
      ),
      'diff','{}'::jsonb
    );
  end if;

  v_first:=coalesce(v_s.source_system,'setup')<>'LEC' or v_s.lec_last_batch_id is null;

  if not v_first
     and v_s.code is not null and v_in_code is not null
     and regexp_replace(v_s.code,'\s','','g')<>regexp_replace(v_in_code,'\s','','g') then
    v_diff:=v_diff||jsonb_build_object('school_code',jsonb_build_object('current',v_s.code,'incoming',v_in_code));
    v_hard_block:=true;
  elsif v_in_code is not null and coalesce(v_s.code,'')<>v_in_code then
    v_diff:=v_diff||jsonb_build_object('school_code',jsonb_build_object('current',v_s.code,'incoming',v_in_code));
  end if;

  if v_in_name is not null
     and regexp_replace(lower(coalesce(v_s.name_th,'')),'\s+','','g')
         <>regexp_replace(lower(v_in_name),'\s+','','g') then
    v_diff:=v_diff||jsonb_build_object('school_name_th',jsonb_build_object('current',v_s.name_th,'incoming',v_in_name));
    v_name_diff:=true;
  end if;

  if v_in_org is not null
     and regexp_replace(lower(coalesce(v_s.lec_organization_name_th,'')),'\s+','','g')
         <>regexp_replace(lower(v_in_org),'\s+','','g') then
    v_diff:=v_diff||jsonb_build_object('organization_name_th',jsonb_build_object('current',v_s.lec_organization_name_th,'incoming',v_in_org));
    if v_s.lec_organization_name_th is not null then v_org_diff:=true; end if;
  end if;

  if v_in_province is not null
     and regexp_replace(lower(coalesce(v_s.lec_province_name_th,'')),'\s+','','g')
         <>regexp_replace(lower(v_in_province),'\s+','','g') then
    v_diff:=v_diff||jsonb_build_object('province_name_th',jsonb_build_object('current',v_s.lec_province_name_th,'incoming',v_in_province));
  end if;

  if v_in_district is not null
     and regexp_replace(lower(coalesce(v_s.lec_district_name_th,'')),'\s+','','g')
         <>regexp_replace(lower(v_in_district),'\s+','','g') then
    v_diff:=v_diff||jsonb_build_object('district_name_th',jsonb_build_object('current',v_s.lec_district_name_th,'incoming',v_in_district));
  end if;

  if v_in_phone is not null and coalesce(v_s.phone,'')<>v_in_phone then
    v_diff:=v_diff||jsonb_build_object('school_phone',jsonb_build_object('current',v_s.phone,'incoming',v_in_phone));
  end if;
  if v_in_email is not null and lower(coalesce(v_s.email,''))<>lower(v_in_email) then
    v_diff:=v_diff||jsonb_build_object('school_email',jsonb_build_object('current',v_s.email,'incoming',v_in_email));
  end if;
  if v_in_web is not null and coalesce(v_s.website_url,'')<>v_in_web then
    v_diff:=v_diff||jsonb_build_object('school_website_url',jsonb_build_object('current',v_s.website_url,'incoming',v_in_web));
  end if;
  if v_in_address is not null and regexp_replace(coalesce(v_s.address_text,''),'\s+',' ','g')
      <>regexp_replace(v_in_address,'\s+',' ','g') then
    v_diff:=v_diff||jsonb_build_object('school_address_text',jsonb_build_object('current',v_s.address_text,'incoming',v_in_address));
  end if;

  if not v_first and v_name_diff and v_org_diff then
    v_hard_block:=true;
  end if;

  if v_hard_block then
    v_status:='school_identity_mismatch';
  elsif v_first and v_diff<>'{}'::jsonb then
    v_status:='first_import_confirmation';
    v_requires_confirmation:=true;
  elsif v_first then
    v_status:='first_import';
  elsif v_diff<>'{}'::jsonb then
    v_status:='school_data_changed';
    v_requires_confirmation:=true;
  else
    v_status:='matched';
  end if;

  return jsonb_build_object(
    'status',v_status,
    'can_import',not v_hard_block,
    'requires_confirmation',v_requires_confirmation,
    'hard_block',v_hard_block,
    'is_first_import',v_first,
    'message',case
      when v_status='school_identity_mismatch' then 'ข้อมูลระบุสถานศึกษาในไฟล์ LEC ไม่ตรงกับโรงเรียนที่ผูกไว้'
      when v_status='first_import_confirmation' then 'พบข้อมูลสถานศึกษาครบจาก LEC กรุณายืนยันการผูกครั้งแรก'
      when v_status='first_import' then 'พร้อมผูกข้อมูลสถานศึกษาจาก LEC ครั้งแรก'
      when v_status='school_data_changed' then 'ข้อมูลสถานศึกษาใน LEC รอบใหม่มีการเปลี่ยนแปลง ต้องยืนยันใช้ข้อมูล LEC ใหม่'
      else 'ข้อมูลสถานศึกษาตรงกับ LEC ที่ผูกไว้'
    end,
    'current',jsonb_build_object(
      'school_code',v_s.code,
      'school_name_th',v_s.name_th,
      'organization_name_th',v_s.lec_organization_name_th,
      'province_name_th',v_s.lec_province_name_th,
      'district_name_th',v_s.lec_district_name_th,
      'school_phone',v_s.phone,
      'school_email',v_s.email,
      'school_website_url',v_s.website_url,
      'school_address_text',v_s.address_text
    ),
    'incoming',jsonb_build_object(
      'school_code',v_in_code,
      'school_name_th',v_in_name,
      'organization_name_th',v_in_org,
      'province_name_th',v_in_province,
      'district_name_th',v_in_district,
      'school_phone',v_in_phone,
      'school_email',v_in_email,
      'school_website_url',v_in_web,
      'school_address_text',v_in_address
    ),
    'diff',v_diff
  );
end;
$$;

revoke all on function public.lao_lec_school_snapshot_fill_metadata() from public,anon,authenticated;
revoke all on function public.lao_lec_school_snapshot_sync_current() from public,anon,authenticated;
revoke all on function public.lao_lec_school_check(uuid,jsonb) from public,anon;
grant execute on function public.lao_lec_school_check(uuid,jsonb) to authenticated;

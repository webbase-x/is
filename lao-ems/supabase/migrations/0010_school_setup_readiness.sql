-- LAO-EMS school readiness after first LEC import.
-- School Admin must complete operational settings and Google Drive before inviting school users.

create table if not exists public.lao_school_settings (
  school_id uuid primary key references public.lao_schools(id) on delete cascade,
  timezone text not null default 'Asia/Bangkok',
  locale text not null default 'th-TH',
  default_file_visibility text not null default 'internal'
    check(default_file_visibility in ('private','internal','public')),
  drive_root_folder_name text not null default 'LAO-EMS',
  setup_confirmed_at timestamptz,
  setup_confirmed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='lao_school_settings_touch') then
    create trigger lao_school_settings_touch
    before update on public.lao_school_settings
    for each row execute function public.lao_touch_updated_at();
  end if;
end $$;

alter table public.lao_drive_connections
  add column if not exists root_folder_name text not null default 'LAO-EMS',
  add column if not exists folder_schema_version smallint not null default 1,
  add column if not exists provisioned_at timestamptz;

alter table public.lao_school_settings enable row level security;
grant select on public.lao_school_settings to authenticated;
revoke insert,update,delete on public.lao_school_settings from authenticated,anon;
revoke insert,update,delete on public.lao_drive_connections from authenticated,anon;

drop policy if exists "lao school settings admin read" on public.lao_school_settings;
create policy "lao school settings admin read"
on public.lao_school_settings
for select to authenticated
using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

create or replace function public.lao_school_setup_status(p_school_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_school public.lao_schools;
  v_settings public.lao_school_settings;
  v_drive public.lao_drive_connections;
  v_lec_ready boolean:=false;
  v_settings_ready boolean:=false;
  v_drive_connected boolean:=false;
  v_missing jsonb:='[]'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (public.lao_is_platform_admin() or public.lao_is_local_school_admin(p_school_id)) then raise exception 'Access denied'; end if;
  select * into v_school from public.lao_schools where id=p_school_id;
  if not found then raise exception 'School not found'; end if;
  select * into v_settings from public.lao_school_settings where school_id=p_school_id;
  select * into v_drive from public.lao_drive_connections where school_id=p_school_id;
  v_lec_ready:=coalesce(v_school.source_system,'')='LEC' and v_school.lec_last_batch_id is not null;
  v_settings_ready:=v_settings.school_id is not null and v_settings.setup_confirmed_at is not null;
  v_drive_connected:=v_drive.school_id is not null and v_drive.status='connected' and nullif(btrim(v_drive.root_folder_id),'') is not null;
  if not v_lec_ready then v_missing:=v_missing||jsonb_build_array('lec'); end if;
  if not v_settings_ready then v_missing:=v_missing||jsonb_build_array('settings'); end if;
  if not v_drive_connected then v_missing:=v_missing||jsonb_build_array('google_drive'); end if;
  return jsonb_build_object(
    'school_id',p_school_id,'lec_ready',v_lec_ready,'lec_synced_at',v_school.lec_synced_at,
    'settings_ready',v_settings_ready,'timezone',coalesce(v_settings.timezone,'Asia/Bangkok'),
    'locale',coalesce(v_settings.locale,'th-TH'),
    'default_file_visibility',coalesce(v_settings.default_file_visibility,'internal'),
    'drive_root_folder_name',coalesce(v_settings.drive_root_folder_name,v_drive.root_folder_name,'LAO-EMS'),
    'drive_connected',v_drive_connected,'drive_status',coalesce(v_drive.status,'not_connected'),
    'drive_account_email',v_drive.google_account_email,'drive_root_folder_id',v_drive.root_folder_id,
    'drive_connected_at',v_drive.connected_at,
    'can_invite_users',(v_lec_ready and v_settings_ready and v_drive_connected),
    'missing_steps',v_missing
  );
end;
$$;

create or replace function public.lao_ensure_school_settings(p_school_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_is_local_school_admin(p_school_id) then raise exception 'Only School Admin can configure this school'; end if;
  insert into public.lao_school_settings(school_id) values(p_school_id) on conflict(school_id) do nothing;
  return public.lao_school_setup_status(p_school_id);
end;
$$;

create or replace function public.lao_save_school_settings(
  p_school_id uuid,p_timezone text default 'Asia/Bangkok',p_locale text default 'th-TH',
  p_default_file_visibility text default 'internal'
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=(select auth.uid()); v_lec_ready boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_is_local_school_admin(p_school_id) then raise exception 'Only School Admin can configure this school'; end if;
  select source_system='LEC' and lec_last_batch_id is not null into v_lec_ready from public.lao_schools where id=p_school_id;
  if coalesce(v_lec_ready,false)=false then raise exception 'LEC must be imported before school settings can be confirmed'; end if;
  if p_timezone not in ('Asia/Bangkok') then raise exception 'Unsupported timezone'; end if;
  if p_locale not in ('th-TH','en-US') then raise exception 'Unsupported locale'; end if;
  if p_default_file_visibility not in ('private','internal','public') then raise exception 'Invalid file visibility'; end if;
  insert into public.lao_school_settings(
    school_id,timezone,locale,default_file_visibility,drive_root_folder_name,setup_confirmed_at,setup_confirmed_by
  ) values(p_school_id,p_timezone,p_locale,p_default_file_visibility,'LAO-EMS',now(),v_uid)
  on conflict(school_id) do update set timezone=excluded.timezone,locale=excluded.locale,
    default_file_visibility=excluded.default_file_visibility,drive_root_folder_name='LAO-EMS',
    setup_confirmed_at=now(),setup_confirmed_by=v_uid,updated_at=now();
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  select s.organization_id,p_school_id,v_uid,'school_settings_confirmed','school_settings',p_school_id::text,
    jsonb_build_object('timezone',p_timezone,'locale',p_locale,'default_file_visibility',p_default_file_visibility,'drive_root_folder_name','LAO-EMS')
  from public.lao_schools s where s.id=p_school_id;
  return public.lao_school_setup_status(p_school_id);
end;
$$;

revoke all on function public.lao_school_setup_status(uuid) from public,anon;
revoke all on function public.lao_ensure_school_settings(uuid) from public,anon;
revoke all on function public.lao_save_school_settings(uuid,text,text,text) from public,anon;
grant execute on function public.lao_school_setup_status(uuid) to authenticated;
grant execute on function public.lao_ensure_school_settings(uuid) to authenticated;
grant execute on function public.lao_save_school_settings(uuid,text,text,text) to authenticated;

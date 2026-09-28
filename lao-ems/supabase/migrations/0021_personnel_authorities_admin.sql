-- Personnel authority assignment management for school administrators.

create or replace function public.lao_personnel_work_counts(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_can_review boolean := false;
  v_can_manage_intake boolean := false;
  v_can_assign boolean := false;
  v_pending integer := 0;
begin
  if (select auth.uid()) is null or p_school_id is null then
    return jsonb_build_object(
      'can_review',false,'can_manage_intake',false,'can_assign_authority',false,'pending_join_requests',0
    );
  end if;

  v_can_review:=public.lao_can_review_personnel_join(p_school_id);
  v_can_manage_intake:=public.lao_can_manage_personnel_intake(p_school_id);
  v_can_assign:=public.lao_is_school_admin(p_school_id);

  if v_can_review then
    select count(*) into v_pending
    from public.lao_personnel_join_requests
    where school_id=p_school_id and status='pending_review';
  end if;

  return jsonb_build_object(
    'can_review',v_can_review,
    'can_manage_intake',v_can_manage_intake,
    'can_assign_authority',v_can_assign,
    'pending_join_requests',v_pending
  );
end;
$$;

revoke all on function public.lao_personnel_work_counts(uuid) from public,anon;
grant execute on function public.lao_personnel_work_counts(uuid) to authenticated;

create or replace function public.lao_personnel_authority_settings(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_is_school_admin(p_school_id) then raise exception 'Access denied'; end if;

  select jsonb_build_object(
    'items',coalesce(jsonb_agg(
      jsonb_build_object(
        'personnel_id',p.id,
        'user_id',pa.user_id,
        'full_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
        'email',u.email,
        'position_title',p.position_title,
        'academic_standing',p.academic_standing,
        'authority_code',a.authority_code,
        'can_edit_personnel',coalesce(a.can_edit_personnel,false),
        'can_review_join',coalesce(a.can_review_join,false),
        'is_active',coalesce(a.is_active,false)
      )
      order by
        case when a.authority_code='personnel_head' and a.is_active then 0
             when a.authority_code='personnel_officer' and a.is_active then 1
             else 2 end,
        p.first_name_th,p.last_name_th
    ),'[]'::jsonb)
  )
  into v_result
  from public.lao_personnel p
  join public.lao_personnel_accounts pa on pa.personnel_id=p.id and pa.school_id=p_school_id
  join auth.users u on u.id=pa.user_id
  left join lateral (
    select x.*
    from public.lao_personnel_authorities x
    where x.school_id=p_school_id and x.user_id=pa.user_id and x.is_active
    order by case x.authority_code when 'personnel_head' then 0 else 1 end
    limit 1
  ) a on true
  where p.school_id=p_school_id and p.employment_status='active';

  return coalesce(v_result,jsonb_build_object('items','[]'::jsonb));
end;
$$;

revoke all on function public.lao_personnel_authority_settings(uuid) from public,anon;
grant execute on function public.lao_personnel_authority_settings(uuid) to authenticated;

create or replace function public.lao_save_personnel_authority(
  p_school_id uuid,
  p_personnel_id uuid,
  p_authority_code text default null,
  p_can_edit_personnel boolean default true,
  p_can_review_join boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target_user uuid;
  v_org uuid;
  v_name text;
  v_code text := nullif(btrim(p_authority_code),'');
  v_edit boolean;
  v_review boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_is_school_admin(p_school_id) then raise exception 'Access denied'; end if;

  select pa.user_id,concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th)
  into v_target_user,v_name
  from public.lao_personnel p
  join public.lao_personnel_accounts pa on pa.personnel_id=p.id and pa.school_id=p_school_id
  where p.id=p_personnel_id and p.school_id=p_school_id;

  if v_target_user is null then
    raise exception 'บุคลากรรายนี้ยังไม่ได้เชื่อมบัญชี LAO-EMS';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;

  update public.lao_personnel_authorities
  set is_active=false,updated_at=now()
  where school_id=p_school_id and user_id=v_target_user and is_active;

  if v_code is null or v_code='none' then
    insert into public.lao_audit_logs(
      organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
    ) values(
      v_org,p_school_id,v_uid,'personnel_authority_removed','personnel_authority',v_target_user::text,
      jsonb_build_object('personnel_id',p_personnel_id)
    );
    return jsonb_build_object('personnel_id',p_personnel_id,'authority_code',null,'is_active',false);
  end if;

  if v_code not in ('personnel_head','personnel_officer') then
    raise exception 'Invalid personnel authority';
  end if;

  v_edit:=case when v_code='personnel_head' then true else coalesce(p_can_edit_personnel,true) end;
  v_review:=case when v_code='personnel_head' then true else coalesce(p_can_review_join,false) end;

  insert into public.lao_personnel_authorities(
    school_id,personnel_id,user_id,authority_code,can_edit_personnel,can_review_join,is_active,starts_on,assigned_by
  )
  values(
    p_school_id,p_personnel_id,v_target_user,v_code,v_edit,v_review,true,current_date,v_uid
  )
  on conflict(school_id,user_id,authority_code) do update set
    personnel_id=excluded.personnel_id,
    can_edit_personnel=excluded.can_edit_personnel,
    can_review_join=excluded.can_review_join,
    is_active=true,
    starts_on=coalesce(public.lao_personnel_authorities.starts_on,current_date),
    ends_on=null,
    assigned_by=v_uid,
    updated_at=now();

  insert into public.lao_notifications(
    user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
  ) values(
    v_target_user,v_org,p_school_id,'personnel_authority_assigned',
    case when v_code='personnel_head' then 'ได้รับมอบหมายเป็นหัวหน้างานบุคลากร' else 'ได้รับมอบหมายงานบุคลากร' end,
    case when v_code='personnel_head'
      then 'คุณสามารถจัดการทะเบียน เปิด/ปิดรับสมัคร และตรวจคำขอเข้าร่วมโรงเรียน'
      else 'คุณได้รับสิทธิ์งานบุคลากรตามที่ School Admin กำหนด'
    end,
    'personnel',p_personnel_id::text
  );

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'personnel_authority_assigned','personnel_authority',v_target_user::text,
    jsonb_build_object(
      'personnel_id',p_personnel_id,'authority_code',v_code,
      'can_edit_personnel',v_edit,'can_review_join',v_review
    )
  );

  return jsonb_build_object(
    'personnel_id',p_personnel_id,'authority_code',v_code,
    'can_edit_personnel',v_edit,'can_review_join',v_review,'is_active',true
  );
end;
$$;

revoke all on function public.lao_save_personnel_authority(uuid,uuid,text,boolean,boolean) from public,anon;
grant execute on function public.lao_save_personnel_authority(uuid,uuid,text,boolean,boolean) to authenticated;

-- 0082_academic_group_members.sql
-- Read-only member directory for the academic management group.

begin;

create or replace function public.lao_academic_group_members(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.lao_can_view_academic(p_school_id) then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'members',coalesce((
      select jsonb_agg(jsonb_build_object(
        'personnel_id',m.personnel_id,
        'user_id',m.user_id,
        'full_name',m.full_name,
        'position_title',m.position_title,
        'authority_role',m.authority_role,
        'role_label',case m.authority_role
          when 'department_head' then 'หัวหน้ากลุ่มบริหารงานวิชาการ'
          when 'work_head' then 'หัวหน้างาน'
          else 'สมาชิก / ผู้ได้รับมอบหมาย'
        end,
        'scopes',coalesce((
          select jsonb_agg(jsonb_build_object(
            'scope_code',s2.scope_code,
            'title',s2.title_th,
            'can_edit',a2.can_edit,
            'can_approve',a2.can_approve,
            'can_delegate',a2.can_delegate
          ) order by s2.sort_order,s2.scope_code)
          from public.lao_work_authorities a2
          join public.lao_work_scopes s2 on s2.scope_code=a2.scope_code
          where a2.school_id=p_school_id
            and a2.personnel_id=m.personnel_id
            and s2.department_code='academics'
            and a2.is_active
            and (a2.starts_on is null or a2.starts_on<=current_date)
            and (a2.ends_on is null or a2.ends_on>=current_date)
        ),'[]'::jsonb)
      ) order by
        case m.authority_role when 'department_head' then 0 when 'work_head' then 1 else 2 end,
        m.full_name)
      from (
        select distinct on (a.personnel_id)
          a.personnel_id,
          a.user_id,
          concat_ws('',p.prefix,p.first_name_th,' ',p.last_name_th) as full_name,
          p.position_title,
          a.authority_role
        from public.lao_work_authorities a
        join public.lao_work_scopes s on s.scope_code=a.scope_code
        join public.lao_personnel p on p.id=a.personnel_id
        where a.school_id=p_school_id
          and s.department_code='academics'
          and a.is_active
          and (a.starts_on is null or a.starts_on<=current_date)
          and (a.ends_on is null or a.ends_on>=current_date)
          and p.employment_status='active'
        order by
          a.personnel_id,
          case a.authority_role when 'department_head' then 0 when 'work_head' then 1 else 2 end,
          a.updated_at desc
      ) m
    ),'[]'::jsonb),
    'can_manage_members',
      public.lao_is_local_school_admin(p_school_id)
      or public.lao_has_work_permission(p_school_id,'academics','delegate')
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.lao_academic_group_members(uuid) from public,anon;
grant execute on function public.lao_academic_group_members(uuid) to authenticated;

commit;

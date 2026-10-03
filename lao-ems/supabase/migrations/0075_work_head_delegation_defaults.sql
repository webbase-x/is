-- 0075_work_head_delegation_defaults.sql
-- Heads of departments/works always receive edit + delegation authority
-- within their assigned scope. Approval remains an explicit permission.

begin;

alter function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) rename to lao_save_work_authority_base_v01915_heads;

revoke all on function public.lao_save_work_authority_base_v01915_heads(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) from public,anon,authenticated;

create function public.lao_save_work_authority(
  p_school_id uuid,
  p_personnel_id uuid,
  p_scope_code text,
  p_authority_role text default 'delegate',
  p_can_view boolean default true,
  p_can_edit boolean default false,
  p_can_approve boolean default false,
  p_can_delegate boolean default false,
  p_starts_on date default null,
  p_ends_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_parent_scope text;
begin
  select parent_scope_code into v_parent_scope
  from public.lao_work_scopes
  where scope_code=p_scope_code and is_active;

  if not found then
    raise exception 'ไม่พบส่วนงานที่เลือก';
  end if;

  if p_authority_role='department_head' and v_parent_scope is not null then
    raise exception 'หัวหน้าฝ่ายต้องกำหนดที่ระดับฝ่ายเท่านั้น';
  end if;

  if p_authority_role='work_head' and v_parent_scope is null then
    raise exception 'หัวหน้างานต้องกำหนดที่ระดับงาน/ส่วนงานภายในฝ่าย';
  end if;

  return public.lao_save_work_authority_base_v01915_heads(
    p_school_id,
    p_personnel_id,
    p_scope_code,
    p_authority_role,
    true,
    case when p_authority_role in ('department_head','work_head')
      then true else coalesce(p_can_edit,false) end,
    coalesce(p_can_approve,false),
    case when p_authority_role in ('department_head','work_head')
      then true else coalesce(p_can_delegate,false) end,
    p_starts_on,
    p_ends_on
  );
end;
$function$;

revoke all on function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) from public,anon;
grant execute on function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) to authenticated;

commit;

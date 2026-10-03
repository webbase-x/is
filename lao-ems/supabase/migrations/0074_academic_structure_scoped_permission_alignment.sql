-- 0074_academic_structure_scoped_permission_alignment.sql
-- Keep the academic structure permission payload aligned with the work-scope model.

begin;

alter function public.lao_academic_structure(uuid,uuid)
  rename to lao_academic_structure_base_v01914_permissions;
revoke all on function public.lao_academic_structure_base_v01914_permissions(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_structure(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_base jsonb;
  v_can_workload_edit boolean;
  v_can_workload_approve boolean;
  v_can_any boolean;
begin
  v_base:=public.lao_academic_structure_base_v01914_permissions(
    p_school_id,p_academic_year_id
  );

  v_can_workload_edit:=public.lao_has_work_permission(
    p_school_id,'academics.workload','edit'
  );
  v_can_workload_approve:=public.lao_has_work_permission(
    p_school_id,'academics.workload','approve'
  );
  v_can_any:=coalesce((v_base->>'can_manage_any_academic')::boolean,false)
    or v_can_workload_edit
    or v_can_workload_approve;

  return v_base||jsonb_build_object(
    'can_manage_workload',v_can_workload_edit,
    'can_approve_workload',v_can_workload_approve,
    'can_manage_any_academic',v_can_any
  );
end;
$function$;

revoke all on function public.lao_academic_structure(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_structure(uuid,uuid) to authenticated;

commit;

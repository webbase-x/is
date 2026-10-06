-- 0099_curriculum_confirmation_reconfirm.sql
-- Fix re-confirmation after a previously confirmed curriculum context changes.
-- The current confirmation table is unique per school/year/program/grade, so
-- the old ON CONFLICT DO NOTHING path could leave an outdated fingerprint in
-- place and make the confirm button appear to do nothing.

begin;

create or replace function public.lao_confirm_curriculum_group_base_v01914(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  -- Keep validation, replacement semantics and audit logging in one canonical
  -- implementation. The scoped wrapper sets the effective approve permission
  -- before entering this base helper.
  return public.lao_confirm_curriculum_structure(
    p_school_id,
    p_academic_year_id,
    p_program_id,
    p_grade_code
  );
end;
$function$;

revoke all on function public.lao_confirm_curriculum_group_base_v01914(uuid,uuid,uuid,text)
  from public,anon;
grant execute on function public.lao_confirm_curriculum_group_base_v01914(uuid,uuid,uuid,text)
  to authenticated;

commit;

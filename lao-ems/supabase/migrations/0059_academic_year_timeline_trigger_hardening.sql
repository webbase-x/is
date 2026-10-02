-- 0059_academic_year_timeline_trigger_hardening.sql

begin;

create or replace function public.lao_academic_program_change_invalidate_year_review()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_school_id uuid;
begin
  if tg_op='DELETE' then
    v_school_id:=old.school_id;
  else
    v_school_id:=new.school_id;
  end if;

  delete from public.lao_academic_year_setup_progress
  where school_id=v_school_id and step_code='programs' and status='confirmed';

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function public.lao_academic_program_change_invalidate_year_review() from public,anon,authenticated;

commit;

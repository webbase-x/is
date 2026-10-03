-- 0067_align_department_subject_step.sql
-- Keep the older department-level academic setup helper aligned with the
-- annual subject timeline: the Subjects step is done only at true 100%.

begin;

create or replace function public.lao_department_setup_step_is_done(
  p_school_id uuid,
  p_department_code text,
  p_step_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_year_id uuid;
  v_curriculum_readiness jsonb;
  v_subject_readiness jsonb;
begin
  if p_department_code='personnel' then
    case p_step_code
      when 'registry' then return exists(select 1 from public.lao_personnel where school_id=p_school_id and employment_status='active');
      when 'authorities' then return exists(select 1 from public.lao_personnel_authorities where school_id=p_school_id and is_active and (starts_on is null or starts_on<=current_date) and (ends_on is null or ends_on>=current_date));
      when 'intake' then return exists(select 1 from public.lao_personnel_join_links where school_id=p_school_id);
      when 'requests' then return not exists(select 1 from public.lao_personnel_join_requests where school_id=p_school_id and status='pending_review');
      else return false;
    end case;
  end if;

  if p_department_code='academics' then
    select ay.id into v_year_id
    from public.lao_academic_years ay
    where ay.school_id=p_school_id
    order by ay.is_current desc,ay.year_be desc
    limit 1;

    if v_year_id is not null and p_step_code='subjects' then
      v_subject_readiness:=public.lao_subject_readiness(p_school_id,v_year_id);
    end if;

    if v_year_id is not null and p_step_code='curriculum' then
      v_curriculum_readiness:=public.lao_curriculum_readiness(p_school_id,v_year_id);
    end if;

    case p_step_code
      when 'periods' then return v_year_id is not null and exists(
        select 1 from public.lao_terms where academic_year_id=v_year_id
      );
      when 'programs' then return exists(
        select 1 from public.lao_academic_programs where school_id=p_school_id and is_active
      );
      when 'classes' then return v_year_id is not null and exists(
        select 1 from public.lao_class_sections
        where school_id=p_school_id and academic_year_id=v_year_id
          and is_active and source_type='lec'
      );
      when 'subjects' then return v_year_id is not null
        and coalesce((v_subject_readiness->>'is_complete')::boolean,false);
      when 'curriculum' then return v_year_id is not null
        and coalesce((v_curriculum_readiness->>'is_complete')::boolean,false);
      when 'workload' then return v_year_id is not null and exists(
        select 1 from public.lao_teaching_workloads
        where school_id=p_school_id and academic_year_id=v_year_id and status<>'cancelled'
      );
      when 'workload_review' then return v_year_id is null or not exists(
        select 1 from public.lao_teaching_workloads
        where school_id=p_school_id and academic_year_id=v_year_id and status='submitted'
      );
      else return false;
    end case;
  end if;

  return false;
end;
$function$;

revoke all on function public.lao_department_setup_step_is_done(uuid,text,text)
  from public,anon;
grant execute on function public.lao_department_setup_step_is_done(uuid,text,text)
  to authenticated;

commit;

-- Fix unresolved setup-step detection when no progress override exists.\n\ncreate or replace function public.lao_department_setup_timeline(
  p_school_id uuid,
  p_department_code text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_can_manage boolean;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_department_setup(p_school_id,p_department_code) then
    raise exception 'Access denied';
  end if;

  v_can_manage:=public.lao_can_manage_department_setup(p_school_id,p_department_code);

  with base as (
    select
      s.department_code,
      s.step_code,
      s.sequence_no,
      s.title_th,
      s.description_th,
      s.route,
      s.is_required,
      s.completion_mode,
      public.lao_department_setup_step_is_done(p_school_id,s.department_code,s.step_code) as auto_done,
      p.override_status,
      p.updated_at as progress_updated_at
    from public.lao_department_setup_steps s
    left join public.lao_department_setup_progress p
      on p.school_id=p_school_id
     and p.department_code=s.department_code
     and p.step_code=s.step_code
    where s.department_code=p_department_code
      and s.is_active
  ),
  effective as (
    select *,
      (
        coalesce(auto_done,false)
        or (completion_mode='manual' and coalesce(override_status='completed',false))
      ) as is_done,
      (
        not is_required
        and coalesce(override_status='skipped',false)
        and not coalesce(auto_done,false)
      ) as is_skipped
    from base
  ),
  next_seq as (
    select min(sequence_no) as sequence_no
    from effective
    where not is_done and not is_skipped
  ),
  labeled as (
    select e.*,
      case
        when e.is_done then 'completed'
        when e.is_skipped then 'skipped'
        when e.sequence_no=(select sequence_no from next_seq) then 'current'
        else 'queued'
      end as status
    from effective e
  )
  select jsonb_build_object(
    'department_code',p_department_code,
    'department_name',case p_department_code
      when 'personnel' then 'งานบุคลากร'
      when 'academics' then 'งานวิชาการ'
      else p_department_code
    end,
    'can_manage',v_can_manage,
    'is_complete',not exists(
      select 1 from labeled where status in ('current','queued')
    ),
    'completed_count',(select count(*) from labeled where status='completed'),
    'skipped_count',(select count(*) from labeled where status='skipped'),
    'resolved_count',(select count(*) from labeled where status in ('completed','skipped')),
    'total_count',(select count(*) from labeled),
    'next_step',(
      select jsonb_build_object(
        'step_code',l.step_code,
        'sequence_no',l.sequence_no,
        'title',l.title_th,
        'description',l.description_th,
        'route',l.route,
        'is_required',l.is_required
      )
      from labeled l where l.status='current'
      limit 1
    ),
    'steps',coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_code',l.step_code,
        'sequence_no',l.sequence_no,
        'title',l.title_th,
        'description',l.description_th,
        'route',l.route,
        'is_required',l.is_required,
        'is_skippable',not l.is_required,
        'completion_mode',l.completion_mode,
        'status',l.status,
        'auto_done',l.auto_done,
        'progress_updated_at',l.progress_updated_at
      ) order by l.sequence_no)
      from labeled l
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.lao_department_setup_timeline(uuid,text) from public,anon;
grant execute on function public.lao_department_setup_timeline(uuid,text) to authenticated;\n
-- 0068_compact_academic_timeline_subject_payload.sql
-- The annual academic timeline only needs subject progress summaries per grade/program.
-- Full requirement lists remain available from lao_subject_workspace for the selected group.
-- This prevents large duplicated payloads on mobile/PWA clients.

begin;

alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v01911;
revoke all on function public.lao_academic_year_setup_timeline_base_v01911(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_year_setup_timeline(
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
  v_subjects jsonb;
  v_groups jsonb:='[]'::jsonb;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v01911(
    p_school_id,p_academic_year_id
  );

  v_subjects:=coalesce(v_base->'subject_readiness','{}'::jsonb);

  if jsonb_typeof(v_subjects->'groups')='array' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'grade_code',g->>'grade_code',
        'grade_label',g->>'grade_label',
        'program_id',nullif(g->>'program_id','')::uuid,
        'program_name',g->>'program_name',
        'room_count',coalesce((g->>'room_count')::int,0),
        'is_complete',coalesce((g->>'is_complete')::boolean,false),
        'completion_percent',coalesce((g->>'completion_percent')::int,0),
        'content_completion_percent',coalesce((g->>'content_completion_percent')::int,0),
        'time_progress_percent',coalesce((g->>'time_progress_percent')::int,0),
        'time_is_complete',coalesce((g->>'time_is_complete')::boolean,false),
        'schedule_configured',coalesce((g->>'schedule_configured')::boolean,false),
        'basic_met_count',coalesce((g->>'basic_met_count')::int,0),
        'basic_required_count',coalesce((g->>'basic_required_count')::int,0),
        'activity_met_count',coalesce((g->>'activity_met_count')::int,0),
        'activity_required_count',coalesce((g->>'activity_required_count')::int,0),
        'missing_count',coalesce((g->>'missing_count')::int,0),
        'anomaly_count',coalesce((g->>'anomaly_count')::int,0),
        'missing_time_count',coalesce((g->>'missing_time_count')::int,0),
        'parallel_mismatch_count',coalesce((g->>'parallel_mismatch_count')::int,0),
        'time_issue_count',coalesce((g->>'time_issue_count')::int,0),
        'weekly_periods_total',nullif(g->>'weekly_periods_total','')::numeric,
        'periods_per_week_capacity',nullif(g->>'periods_per_week_capacity','')::numeric,
        'periods_per_week_over',nullif(g->>'periods_per_week_over','')::numeric,
        'scheduled_hours_total',nullif(g->>'scheduled_hours_total','')::numeric,
        'schedule_capacity_hours',nullif(g->>'schedule_capacity_hours','')::numeric,
        'schedule_capacity_hours_over',nullif(g->>'schedule_capacity_hours_over','')::numeric,
        'integrated_activity_hours',nullif(g->>'integrated_activity_hours','')::numeric,
        'framework_hours_complete',coalesce((g->>'framework_hours_complete')::boolean,false),
        'primary_time_issue',case
          when jsonb_typeof(g->'time_issues')='array' and jsonb_array_length(g->'time_issues')>0
            then (g->'time_issues')->0
          else null
        end
      )
      order by coalesce((g->>'grade_code'),''),
               coalesce((g->>'program_name'),'')
    ),'[]'::jsonb)
    into v_groups
    from jsonb_array_elements(v_subjects->'groups') g;
  end if;

  v_subjects:=(v_subjects-'groups')||jsonb_build_object('groups',v_groups);

  return
    (v_base-'subject_readiness')
    ||jsonb_build_object('subject_readiness',v_subjects);
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid)
  from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid)
  to authenticated;

commit;

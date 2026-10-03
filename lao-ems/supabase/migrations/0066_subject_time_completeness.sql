-- 0066_subject_time_completeness.sql
-- Make the annual "subjects" step reach 100% only when subject requirements
-- AND real learning-time/capacity checks are complete for every active grade/program group.
-- Integrated learner activities still count toward curriculum hours but do not consume timetable capacity.
-- Parallel/alternative courses continue to consume only one shared timetable slot.

begin;

alter function public.lao_subject_group_completeness(uuid,uuid,uuid,text)
  rename to lao_subject_group_completeness_base_v01910;
revoke all on function public.lao_subject_group_completeness_base_v01910(uuid,uuid,uuid,text)
  from public,anon,authenticated;

create function public.lao_subject_group_completeness(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_base jsonb;
  v_curr jsonb;
  v_hours jsonb;
  v_framework jsonb;
  v_scope text:='';
  v_content_complete boolean:=false;
  v_schedule_configured boolean:=false;
  v_assignment_complete boolean:=false;
  v_framework_complete boolean:=true;
  v_period_capacity_ok boolean:=false;
  v_hour_capacity_ok boolean:=false;
  v_time_complete boolean:=false;
  v_overall_complete boolean:=false;
  v_band_deferred boolean:=false;

  v_missing_time int:=0;
  v_parallel_mismatch int:=0;
  v_weekly_periods numeric:=0;
  v_weekly_capacity numeric:=0;
  v_weekly_gap numeric:=0;
  v_weekly_over numeric:=0;
  v_minutes numeric:=0;
  v_weeks numeric:=0;
  v_days numeric:=0;
  v_periods_day numeric:=0;
  v_scheduled_hours numeric:=0;
  v_capacity_hours numeric:=0;
  v_capacity_hours_gap numeric:=0;
  v_capacity_hours_over numeric:=0;
  v_integrated_hours numeric:=0;

  v_basic_actual numeric:=0;
  v_activity_actual numeric:=0;
  v_history_actual numeric:=0;
  v_basic_required numeric:=0;
  v_activity_required numeric:=0;
  v_history_required numeric:=null;
  v_basic_gap numeric:=0;
  v_activity_gap numeric:=0;
  v_history_gap numeric:=0;

  v_band_grade_count int:=0;
  v_band_grade text;
  v_band_hours jsonb;
  v_band_basic_actual numeric:=0;
  v_band_activity_actual numeric:=0;
  v_band_history_actual numeric:=0;

  v_time_checks_total int:=5;
  v_time_checks_passed int:=0;
  v_time_pct int:=0;
  v_base_pct int:=0;
  v_completion_pct int:=0;
  v_time_issues jsonb:='[]'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_base:=public.lao_subject_group_completeness_base_v01910(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_curr:=public.lao_curriculum_group_status(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_hours:=public.lao_curriculum_hours_breakdown(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );

  v_content_complete:=coalesce((v_base->>'is_complete')::boolean,false);
  v_base_pct:=coalesce((v_base->>'completion_percent')::int,0);

  v_schedule_configured:=coalesce((v_curr->>'schedule_configured')::boolean,false);
  v_missing_time:=coalesce((v_curr->>'missing_time_count')::int,0);
  v_parallel_mismatch:=coalesce((v_curr->>'parallel_mismatch_count')::int,0);
  v_assignment_complete:=(v_missing_time=0 and v_parallel_mismatch=0);

  v_weekly_periods:=coalesce((v_curr->>'weekly_periods_total')::numeric,0);
  v_weekly_capacity:=coalesce((v_curr->>'periods_per_week_capacity')::numeric,0);
  v_weekly_gap:=case when v_schedule_configured then v_weekly_capacity-v_weekly_periods else 0 end;
  v_weekly_over:=case when v_schedule_configured then greatest(v_weekly_periods-v_weekly_capacity,0) else 0 end;

  v_days:=coalesce((v_curr->>'school_days_per_week')::numeric,0);
  v_periods_day:=coalesce((v_curr->>'periods_per_day')::numeric,0);
  v_minutes:=coalesce((v_curr->>'minutes_per_period')::numeric,0);
  v_weeks:=coalesce((v_curr->>'instructional_weeks_per_year')::numeric,0);
  v_scheduled_hours:=coalesce((v_hours->>'scheduled_hours_total')::numeric,0);
  v_integrated_hours:=coalesce((v_hours->>'integrated_activity_hours')::numeric,0);

  if v_schedule_configured then
    v_capacity_hours:=v_days*v_periods_day*v_minutes/60.0*v_weeks;
    v_capacity_hours_gap:=v_capacity_hours-v_scheduled_hours;
    v_capacity_hours_over:=greatest(v_scheduled_hours-v_capacity_hours,0);
  end if;

  v_period_capacity_ok:=v_schedule_configured and v_weekly_over<=0.001;
  v_hour_capacity_ok:=v_schedule_configured and v_capacity_hours_over<=0.001;

  v_framework:=coalesce(v_hours->'time_framework','{}'::jsonb);
  v_scope:=coalesce(v_framework->>'grade_scope','');
  v_basic_actual:=coalesce((v_hours->>'basic_hours_total')::numeric,0);
  v_activity_actual:=coalesce((v_hours->>'learner_activity_hours_total')::numeric,0);
  v_history_actual:=coalesce((v_hours->>'history_hours_total')::numeric,0);
  v_basic_required:=coalesce((v_framework->>'basic_hours')::numeric,0);
  v_activity_required:=coalesce((v_framework->>'learner_activity_hours')::numeric,0);
  v_history_required:=nullif(v_framework->>'history_hours','')::numeric;

  if v_scope='annual' then
    v_basic_gap:=v_basic_required-v_basic_actual;
    v_activity_gap:=v_activity_required-v_activity_actual;
    v_history_gap:=case when v_history_required is null then 0 else v_history_required-v_history_actual end;
    v_framework_complete:=
      abs(v_basic_gap)<=0.001
      and abs(v_activity_gap)<=0.001
      and (v_history_required is null or abs(v_history_gap)<=0.001);
  elsif v_scope='three_year_band' then
    select count(distinct c.grade_code)::int
    into v_band_grade_count
    from public.lao_class_sections c
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.is_active
      and c.source_type='lec'
      and c.grade_code in ('M4','M5','M6')
      and c.program_id is not distinct from p_program_id;

    if v_band_grade_count=3 then
      foreach v_band_grade in array array['M4','M5','M6']::text[]
      loop
        v_band_hours:=public.lao_curriculum_hours_breakdown(
          p_school_id,p_academic_year_id,p_program_id,v_band_grade
        );
        v_band_basic_actual:=v_band_basic_actual+coalesce((v_band_hours->>'basic_hours_total')::numeric,0);
        v_band_activity_actual:=v_band_activity_actual+coalesce((v_band_hours->>'learner_activity_hours_total')::numeric,0);
        v_band_history_actual:=v_band_history_actual+coalesce((v_band_hours->>'history_hours_total')::numeric,0);
      end loop;

      v_basic_actual:=v_band_basic_actual;
      v_activity_actual:=v_band_activity_actual;
      v_history_actual:=v_band_history_actual;
      v_basic_gap:=v_basic_required-v_basic_actual;
      v_activity_gap:=v_activity_required-v_activity_actual;
      v_history_gap:=case when v_history_required is null then 0 else v_history_required-v_history_actual end;
      v_framework_complete:=
        abs(v_basic_gap)<=0.001
        and abs(v_activity_gap)<=0.001
        and (v_history_required is null or abs(v_history_gap)<=0.001);
    else
      -- A school may currently operate only part of M4-M6. Do not invent a yearly
      -- requirement for a three-year framework; defer the band-total gate until all
      -- three grades exist for the same program. Per-course time and capacity still apply.
      v_band_deferred:=true;
      v_framework_complete:=true;
    end if;
  else
    v_framework_complete:=true;
  end if;

  if not v_schedule_configured then
    v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
      'type','schedule_settings',
      'message','ยังไม่กำหนดวันเรียน คาบต่อวัน นาทีต่อคาบ และจำนวนสัปดาห์เรียนของปีนี้'
    ));
  end if;

  if v_missing_time>0 then
    v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
      'type','missing_time',
      'count',v_missing_time,
      'message','ยังมีรายวิชา/กลุ่มวิชาที่ไม่ได้กำหนดเวลาเรียน '||v_missing_time||' รายการ'
    ));
  end if;

  if v_parallel_mismatch>0 then
    v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
      'type','parallel_time_mismatch',
      'count',v_parallel_mismatch,
      'message','กลุ่มวิชาทางเลือก/เรียนเวลาเดียวกันมีเวลาไม่ตรงกัน '||v_parallel_mismatch||' กลุ่ม'
    ));
  end if;

  if not v_framework_complete then
    if abs(v_basic_gap)>0.001 then
      v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
        'type','curriculum_hours',
        'component','basic',
        'actual_hours',v_basic_actual,
        'required_hours',v_basic_required,
        'gap_hours',v_basic_gap,
        'direction',case when v_basic_gap>0 then 'short' else 'over' end,
        'message','รายวิชาพื้นฐาน '||
          case when v_basic_gap>0 then 'ขาด '||abs(v_basic_gap)||' ชั่วโมง' else 'เกินกรอบ '||abs(v_basic_gap)||' ชั่วโมง' end
      ));
    end if;
    if abs(v_activity_gap)>0.001 then
      v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
        'type','curriculum_hours',
        'component','activity',
        'actual_hours',v_activity_actual,
        'required_hours',v_activity_required,
        'gap_hours',v_activity_gap,
        'direction',case when v_activity_gap>0 then 'short' else 'over' end,
        'message','กิจกรรมพัฒนาผู้เรียน '||
          case when v_activity_gap>0 then 'ขาด '||abs(v_activity_gap)||' ชั่วโมง' else 'เกินกรอบ '||abs(v_activity_gap)||' ชั่วโมง' end
      ));
    end if;
    if v_history_required is not null and abs(v_history_gap)>0.001 then
      v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
        'type','curriculum_hours',
        'component','history',
        'actual_hours',v_history_actual,
        'required_hours',v_history_required,
        'gap_hours',v_history_gap,
        'direction',case when v_history_gap>0 then 'short' else 'over' end,
        'message','ประวัติศาสตร์ '||
          case when v_history_gap>0 then 'ขาด '||abs(v_history_gap)||' ชั่วโมง' else 'เกินกรอบ '||abs(v_history_gap)||' ชั่วโมง' end
      ));
    end if;
  end if;

  if v_schedule_configured and v_weekly_over>0.001 then
    v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
      'type','period_capacity',
      'used_periods_per_week',v_weekly_periods,
      'capacity_periods_per_week',v_weekly_capacity,
      'over_periods_per_week',v_weekly_over,
      'message','คาบเรียนเกินความจุตาราง '||v_weekly_over||' คาบ/สัปดาห์'
    ));
  end if;

  if v_schedule_configured and v_capacity_hours_over>0.001 then
    v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
      'type','hour_capacity',
      'scheduled_hours',v_scheduled_hours,
      'capacity_hours',v_capacity_hours,
      'over_hours',v_capacity_hours_over,
      'message','ชั่วโมงที่ต้องลงตารางเกินความจุจริง '||round(v_capacity_hours_over,2)||' ชั่วโมง/ปี'
    ));
  end if;

  v_time_checks_passed:=
      (case when v_schedule_configured then 1 else 0 end)
    + (case when v_assignment_complete then 1 else 0 end)
    + (case when v_framework_complete then 1 else 0 end)
    + (case when v_period_capacity_ok then 1 else 0 end)
    + (case when v_hour_capacity_ok then 1 else 0 end);

  v_time_pct:=round(v_time_checks_passed*100.0/v_time_checks_total)::int;
  v_time_complete:=
    v_schedule_configured
    and v_assignment_complete
    and v_framework_complete
    and v_period_capacity_ok
    and v_hour_capacity_ok;

  v_overall_complete:=v_content_complete and v_time_complete;
  v_completion_pct:=case
    when v_overall_complete then 100
    else least(99,round((v_base_pct+v_time_pct)/2.0)::int)
  end;

  return
    (v_base-'completion_percent'-'is_complete')
    ||jsonb_build_object(
      'content_completion_percent',v_base_pct,
      'content_is_complete',v_content_complete,
      'time_progress_percent',v_time_pct,
      'time_is_complete',v_time_complete,
      'completion_percent',v_completion_pct,
      'is_complete',v_overall_complete,
      'schedule_configured',v_schedule_configured,
      'missing_time_count',v_missing_time,
      'parallel_mismatch_count',v_parallel_mismatch,
      'weekly_periods_total',v_weekly_periods,
      'periods_per_week_capacity',case when v_schedule_configured then v_weekly_capacity else null end,
      'periods_per_week_gap',case when v_schedule_configured then v_weekly_gap else null end,
      'periods_per_week_over',case when v_schedule_configured then v_weekly_over else null end,
      'scheduled_hours_total',v_scheduled_hours,
      'schedule_capacity_hours',case when v_schedule_configured then v_capacity_hours else null end,
      'schedule_capacity_hours_gap',case when v_schedule_configured then v_capacity_hours_gap else null end,
      'schedule_capacity_hours_over',case when v_schedule_configured then v_capacity_hours_over else null end,
      'integrated_activity_hours',v_integrated_hours,
      'framework_scope',nullif(v_scope,''),
      'framework_hours_complete',v_framework_complete,
      'band_framework_deferred',v_band_deferred,
      'band_grade_count',case when v_scope='three_year_band' then v_band_grade_count else null end,
      'basic_hours_actual',v_basic_actual,
      'basic_hours_required',case when v_scope<>'' then v_basic_required else null end,
      'basic_hours_gap',case when v_scope<>'' and not v_band_deferred then v_basic_gap else null end,
      'activity_hours_actual',v_activity_actual,
      'activity_hours_required',case when v_scope<>'' then v_activity_required else null end,
      'activity_hours_gap',case when v_scope<>'' and not v_band_deferred then v_activity_gap else null end,
      'history_hours_actual',v_history_actual,
      'history_hours_required',v_history_required,
      'history_hours_gap',case when v_scope<>'' and not v_band_deferred and v_history_required is not null then v_history_gap else null end,
      'time_issue_count',jsonb_array_length(v_time_issues),
      'time_issues',v_time_issues
    );
end;
$function$;

revoke all on function public.lao_subject_group_completeness(uuid,uuid,uuid,text)
  from public,anon;
grant execute on function public.lao_subject_group_completeness(uuid,uuid,uuid,text)
  to authenticated;


create or replace function public.lao_subject_readiness(
  p_school_id uuid,
  p_academic_year_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_groups jsonb:='[]'::jsonb;
  v_group record;
  v_status jsonb;
  v_total int:=0;
  v_complete int:=0;
  v_time_complete int:=0;
  v_required int:=0;
  v_met int:=0;
  v_anomalies int:=0;
  v_time_issue_groups int:=0;
  v_progress_sum numeric:=0;
  v_time_progress_sum numeric:=0;
  v_program_name text;
  v_progress int:=0;
  v_content_coverage int:=0;
  v_time_progress int:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;

  for v_group in
    select c.grade_code,min(c.grade_label) grade_label,c.program_id,count(*)::int room_count,min(c.sort_order) sort_order
    from public.lao_class_sections c
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.is_active
      and c.source_type='lec'
      and c.grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
    group by c.grade_code,c.program_id
    order by min(c.sort_order),c.grade_code,c.program_id nulls first
  loop
    v_total:=v_total+1;
    v_status:=public.lao_subject_group_completeness(
      p_school_id,p_academic_year_id,v_group.program_id,v_group.grade_code
    );

    if coalesce((v_status->>'is_complete')::boolean,false) then v_complete:=v_complete+1; end if;
    if coalesce((v_status->>'time_is_complete')::boolean,false) then v_time_complete:=v_time_complete+1; end if;
    if coalesce((v_status->>'time_issue_count')::int,0)>0 then v_time_issue_groups:=v_time_issue_groups+1; end if;

    v_required:=v_required+coalesce((v_status->>'required_count')::int,0);
    v_met:=v_met+coalesce((v_status->>'met_count')::int,0);
    v_anomalies:=v_anomalies+coalesce((v_status->>'anomaly_count')::int,0);
    v_progress_sum:=v_progress_sum+coalesce((v_status->>'completion_percent')::numeric,0);
    v_time_progress_sum:=v_time_progress_sum+coalesce((v_status->>'time_progress_percent')::numeric,0);

    select p.name_th into v_program_name
    from public.lao_academic_programs p
    where p.id=v_group.program_id;

    v_groups:=v_groups||jsonb_build_array(
      v_status||jsonb_build_object(
        'grade_label',v_group.grade_label,
        'program_name',v_program_name,
        'room_count',v_group.room_count
      )
    );
  end loop;

  v_progress:=case when v_total=0 then 0 else round(v_progress_sum/v_total)::int end;
  v_content_coverage:=case when v_required=0 then 0 else round(v_met*100.0/v_required)::int end;
  v_time_progress:=case when v_total=0 then 0 else round(v_time_progress_sum/v_total)::int end;

  return jsonb_build_object(
    'total_groups',v_total,
    'completed_groups',v_complete,
    'incomplete_groups',greatest(v_total-v_complete,0),
    'time_completed_groups',v_time_complete,
    'time_issue_groups',v_time_issue_groups,
    'required_count',v_required,
    'met_count',v_met,
    'anomaly_count',v_anomalies,
    'progress_percent',v_progress,
    -- Keep this legacy key aligned with real overall progress because v0.19.9
    -- consumes it for the timeline mini-ring.
    'coverage_percent',v_progress,
    'content_coverage_percent',v_content_coverage,
    'time_progress_percent',v_time_progress,
    'is_complete',(v_total>0 and v_complete=v_total),
    'groups',v_groups
  );
end;
$function$;

revoke all on function public.lao_subject_readiness(uuid,uuid) from public,anon;
grant execute on function public.lao_subject_readiness(uuid,uuid) to authenticated;


alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v01910;
revoke all on function public.lao_academic_year_setup_timeline_base_v01910(uuid,uuid)
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
  v_year_id uuid;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
  v_pct int:=0;
  v_label text;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v01910(
    p_school_id,p_academic_year_id
  );
  v_year_id:=nullif(v_base->>'academic_year_id','')::uuid;
  if v_year_id is null then return v_base; end if;

  v_subjects:=public.lao_subject_readiness(p_school_id,v_year_id);
  v_pct:=coalesce((v_subjects->>'progress_percent')::int,0);

  for v_step in select value from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
  loop
    if v_step->>'step_code'='subjects' then
      v_label:=case
        when coalesce((v_subjects->>'is_complete')::boolean,false)
          then 'รายวิชาและเวลาเรียนครบจริงทุกกลุ่มแล้ว'
        else
          'ครบจริง '||coalesce((v_subjects->>'completed_groups')::int,0)
          ||' / '||coalesce((v_subjects->>'total_groups')::int,0)
          ||' กลุ่ม · รายวิชา '||coalesce((v_subjects->>'content_coverage_percent')::int,0)
          ||'% · เวลา '||coalesce((v_subjects->>'time_progress_percent')::int,0)||'%'
      end;

      v_step:=v_step||jsonb_build_object(
        'detail',
          coalesce(v_step->'detail','{}'::jsonb)
          ||jsonb_build_object(
            'completed_groups',coalesce((v_subjects->>'completed_groups')::int,0),
            'total_groups',coalesce((v_subjects->>'total_groups')::int,0),
            'required_count',coalesce((v_subjects->>'required_count')::int,0),
            'met_count',coalesce((v_subjects->>'met_count')::int,0),
            'anomaly_count',coalesce((v_subjects->>'anomaly_count')::int,0),
            'coverage_percent',v_pct,
            'content_coverage_percent',coalesce((v_subjects->>'content_coverage_percent')::int,0),
            'time_progress_percent',coalesce((v_subjects->>'time_progress_percent')::int,0),
            'time_completed_groups',coalesce((v_subjects->>'time_completed_groups')::int,0),
            'time_issue_groups',coalesce((v_subjects->>'time_issue_groups')::int,0)
          ),
        'step_progress_percent',case
          when (v_step->>'status') in ('completed','reused') then 100
          when (v_step->>'status') in ('skipped','not_applicable') then null
          else least(99,greatest(0,v_pct))
        end,
        'step_progress_label',v_label
      );
    end if;
    v_steps:=v_steps||jsonb_build_array(v_step);
  end loop;

  return
    (v_base-'steps'-'subject_readiness')
    ||jsonb_build_object(
      'steps',v_steps,
      'subject_readiness',v_subjects
    );
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid) to authenticated;

commit;

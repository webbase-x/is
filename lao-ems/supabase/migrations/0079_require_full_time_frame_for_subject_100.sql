-- 0079_require_full_time_frame_for_subject_100.sql
-- Fix false 100% completeness: a grade/program group is complete only when
-- its real weekly periods and annual scheduled hours exactly fill the effective
-- learning-time frame. Both shortages and overages block 100%.

begin;

create or replace function public.lao_subject_group_completeness(
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

  -- 100% means the configured learning-time frame is filled exactly.
  -- Being merely under capacity is not complete; both short and over are issues.
  v_period_capacity_ok:=v_schedule_configured and abs(v_weekly_gap)<=0.001;
  v_hour_capacity_ok:=v_schedule_configured and abs(v_capacity_hours_gap)<=0.001;

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

  if v_schedule_configured and abs(v_weekly_gap)>0.001 then
    v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
      'type','period_capacity',
      'direction',case when v_weekly_gap>0 then 'short' else 'over' end,
      'used_periods_per_week',v_weekly_periods,
      'capacity_periods_per_week',v_weekly_capacity,
      'gap_periods_per_week',v_weekly_gap,
      'over_periods_per_week',v_weekly_over,
      'message',case
        when v_weekly_gap>0
          then 'คาบเรียนยังไม่เต็มกรอบ ขาด '||round(v_weekly_gap,2)||' คาบ/สัปดาห์'
        else 'คาบเรียนเกินกรอบ '||round(abs(v_weekly_gap),2)||' คาบ/สัปดาห์'
      end
    ));
  end if;

  if v_schedule_configured and abs(v_capacity_hours_gap)>0.001 then
    v_time_issues:=v_time_issues||jsonb_build_array(jsonb_build_object(
      'type','hour_capacity',
      'direction',case when v_capacity_hours_gap>0 then 'short' else 'over' end,
      'scheduled_hours',v_scheduled_hours,
      'capacity_hours',v_capacity_hours,
      'gap_hours',v_capacity_hours_gap,
      'over_hours',v_capacity_hours_over,
      'message',case
        when v_capacity_hours_gap>0
          then 'ชั่วโมงเรียนยังไม่เต็มกรอบ ขาด '||round(v_capacity_hours_gap,2)||' ชั่วโมง/ปี'
        else 'ชั่วโมงเรียนเกินกรอบ '||round(abs(v_capacity_hours_gap),2)||' ชั่วโมง/ปี'
      end
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

commit;

-- 0070_combine_subject_curriculum_step.sql
-- Collapse Subjects + Curriculum Structure into one academic setup step.
-- Keep the old curriculum route compatible at the client, but expose only five annual steps.

begin;

alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v01913;
revoke all on function public.lao_academic_year_setup_timeline_base_v01913(uuid,uuid)
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
  v_uid uuid:=(select auth.uid());
  v_base jsonb;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
  v_subject_step jsonb;
  v_curriculum_step jsonb;
  v_subjects jsonb;
  v_curriculum jsonb;
  v_subject_status text;
  v_curriculum_status text;
  v_combined_status text;
  v_data_pct int:=0;
  v_confirmed int:=0;
  v_total_groups int:=0;
  v_completed int:=0;
  v_skipped int:=0;
  v_not_applicable int:=0;
  v_applicable int:=0;
  v_next jsonb:=null;
  v_overall_pct int:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_base:=public.lao_academic_year_setup_timeline_base_v01913(
    p_school_id,p_academic_year_id
  );

  if nullif(v_base->>'academic_year_id','') is null then
    return v_base;
  end if;

  v_subjects:=coalesce(v_base->'subject_readiness','{}'::jsonb);
  v_curriculum:=public.lao_curriculum_readiness(
    p_school_id,
    (v_base->>'academic_year_id')::uuid
  );

  select value into v_subject_step
  from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
  where value->>'step_code'='subjects'
  limit 1;

  select value into v_curriculum_step
  from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
  where value->>'step_code'='curriculum'
  limit 1;

  v_subject_status:=coalesce(v_subject_step->>'status','queued');
  v_curriculum_status:=coalesce(v_curriculum_step->>'status','queued');
  v_data_pct:=coalesce((v_subjects->>'progress_percent')::int,0);
  v_confirmed:=coalesce((v_curriculum->>'confirmed_groups')::int,0);
  v_total_groups:=coalesce((v_curriculum->>'total_groups')::int,0);

  v_combined_status:=case
    when v_subject_status in ('completed','reused')
      and v_curriculum_status in ('completed','reused')
      then 'completed'
    when v_subject_status='current' or v_curriculum_status='current'
      then 'current'
    when v_subject_status='queued' or v_curriculum_status='queued'
      then 'queued'
    when v_subject_status='skipped' and v_curriculum_status='skipped'
      then 'skipped'
    when v_subject_status='not_applicable' and v_curriculum_status='not_applicable'
      then 'not_applicable'
    else 'current'
  end;

  for v_step in
    select value
    from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
    order by (value->>'sequence_no')::int
  loop
    if v_step->>'step_code'='curriculum' then
      continue;
    end if;

    if v_step->>'step_code'='subjects' then
      v_step:=v_step||jsonb_build_object(
        'title','โครงสร้างหลักสูตรและเวลาเรียน',
        'description','จัดรายวิชา กำหนดเวลาเรียน เทียบกรอบหลักสูตร และยืนยันความครบถ้วนในขั้นเดียว',
        'route','#/academics/subjects',
        'status',v_combined_status,
        'sequence_no',4,
        'step_progress_percent',case
          when v_combined_status in ('completed','reused') then 100
          when v_data_pct>=100 then 99
          else greatest(0,least(99,v_data_pct))
        end,
        'step_progress_label',case
          when v_combined_status in ('completed','reused')
            then 'รายวิชา เวลาเรียน และการยืนยันโครงสร้างครบทุกกลุ่มแล้ว'
          when v_data_pct>=100
            then 'ข้อมูลครบ 100% · รอยืนยันโครงสร้าง '
              ||v_confirmed||' / '||v_total_groups||' กลุ่ม'
          else
            'ความครบจริง '||v_data_pct||'% · ยืนยันแล้ว '
              ||v_confirmed||' / '||v_total_groups||' กลุ่ม'
        end,
        'detail',
          coalesce(v_step->'detail','{}'::jsonb)
          ||jsonb_build_object(
            'combined_subject_curriculum',true,
            'confirmed_groups',v_confirmed,
            'curriculum_total_groups',v_total_groups,
            'curriculum_issue_groups',coalesce((v_curriculum->>'issue_groups')::int,0)
          )
      );
    elsif (v_step->>'sequence_no')::int>5 then
      v_step:=v_step||jsonb_build_object(
        'sequence_no',(v_step->>'sequence_no')::int-1
      );
    end if;

    v_steps:=v_steps||jsonb_build_array(v_step);
  end loop;

  for v_step in
    select value
    from jsonb_array_elements(v_steps)
    order by (value->>'sequence_no')::int
  loop
    if v_step->>'status'='skipped' then
      v_skipped:=v_skipped+1;
    elsif v_step->>'status'='not_applicable' then
      v_not_applicable:=v_not_applicable+1;
    else
      v_applicable:=v_applicable+1;
      if v_step->>'status' in ('completed','reused') then
        v_completed:=v_completed+1;
      end if;
    end if;

    if v_next is null and v_step->>'status'='current' then
      v_next:=jsonb_build_object(
        'step_code',v_step->>'step_code',
        'sequence_no',(v_step->>'sequence_no')::int,
        'title',v_step->>'title',
        'description',v_step->>'description',
        'route',v_step->>'route',
        'is_required',coalesce((v_step->>'is_required')::boolean,true)
      );
    end if;
  end loop;

  v_overall_pct:=case
    when v_applicable=0 then 100
    else round(v_completed*100.0/v_applicable)::int
  end;

  return
    (v_base
      -'steps'
      -'is_complete'
      -'completed_count'
      -'skipped_count'
      -'not_applicable_count'
      -'resolved_count'
      -'applicable_count'
      -'progress_percent'
      -'next_step')
    ||jsonb_build_object(
      'steps',v_steps,
      'is_complete',(v_applicable>0 and v_completed=v_applicable),
      'completed_count',v_completed,
      'skipped_count',v_skipped,
      'not_applicable_count',v_not_applicable,
      'resolved_count',v_completed+v_skipped+v_not_applicable,
      'applicable_count',v_applicable,
      'progress_percent',v_overall_pct,
      'next_step',v_next,
      'curriculum_readiness_summary',jsonb_build_object(
        'total_groups',v_total_groups,
        'confirmed_groups',v_confirmed,
        'issue_groups',coalesce((v_curriculum->>'issue_groups')::int,0),
        'is_complete',coalesce((v_curriculum->>'is_complete')::boolean,false)
      )
    );
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid)
  from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid)
  to authenticated;

commit;

-- 0063_subject_wrong_grade_code_detection.sql
-- Catch standard basic/activity codes that belong to a different grade even when
-- the subject was created locally and has no direct central-catalog reference.

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
  v_required int:=0;
  v_met int:=0;
  v_basic_required int:=0;
  v_basic_met int:=0;
  v_activity_required int:=0;
  v_activity_met int:=0;
  v_anomaly_count int:=0;
  v_ack_count int:=0;
  v_replaced_count int:=0;
  v_pct int:=0;
  v_requirements jsonb:='[]'::jsonb;
  v_missing jsonb:='[]'::jsonb;
  v_anomalies jsonb:='[]'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;

  with preset_base as (
    select
      p.id,p.grade_code,p.term_no,p.subject_code,p.subject_name,p.subject_type,
      p.is_national_core,p.choice_group,p.choice_key,p.sort_order
    from public.lao_curriculum_preset_items p
    left join public.lao_central_subject_time_templates tt
      on tt.preset_item_id=p.id and tt.is_active
    where p.preset_code='core_2551_2560'
      and p.grade_code=p_grade_code
      and (
        (p.subject_type='basic' and p.is_national_core)
        or p.subject_type='activity'
      )
      and not (
        p.subject_type='basic'
        and coalesce(tt.standard_kind,'')='three_year_band_allocation'
      )
  ),
  req_basic as (
    select
      'basic|t'||coalesce(term_no,0)::text||'|'||lower(coalesce(subject_code,subject_name)) as requirement_key,
      'core_basic'::text as requirement_kind,
      term_no,
      subject_code,
      subject_name,
      null::text as choice_group,
      array[subject_code]::text[] as expected_codes,
      array[subject_name]::text[] as expected_names,
      sort_order
    from preset_base
    where subject_type='basic' and is_national_core
  ),
  req_activity_single as (
    select
      'activity|t'||coalesce(term_no,0)::text||'|'||lower(coalesce(subject_code,subject_name)) as requirement_key,
      'activity'::text as requirement_kind,
      term_no,
      subject_code,
      subject_name,
      null::text as choice_group,
      array[subject_code]::text[] as expected_codes,
      array[subject_name]::text[] as expected_names,
      sort_order
    from preset_base
    where subject_type='activity' and choice_group is null
  ),
  req_activity_choice as (
    select
      'activity-choice|'||choice_group as requirement_key,
      'activity_choice'::text as requirement_kind,
      min(term_no) as term_no,
      min(subject_code) as subject_code,
      regexp_replace(min(subject_name),' (1|2)$','') as subject_name,
      choice_group,
      array_agg(distinct subject_code) filter(where subject_code is not null) as expected_codes,
      array_agg(distinct subject_name order by subject_name) as expected_names,
      min(sort_order) as sort_order
    from preset_base
    where subject_type='activity' and choice_group is not null
    group by choice_group
  ),
  req as (
    select * from req_basic
    union all
    select * from req_activity_single
    union all
    select * from req_activity_choice
  ),
  eligible as (
    select
      c.id as course_id,c.subject_id,c.program_id,c.grade_code,c.sort_order,c.updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,s.source_catalog_item_id,
      case
        when s.subject_type='activity' and nullif(btrim(s.subject_code),'') is not null
          then 'activity|'||lower(btrim(s.subject_code))||'|'||lower(btrim(s.name_th))
        when nullif(btrim(s.subject_code),'') is not null
          then 'code|'||lower(btrim(s.subject_code))
        else 'name|'||s.subject_type||'|'||lower(btrim(s.name_th))
      end as subject_key,
      case when p_program_id is not null and c.program_id=p_program_id then 2 else 1 end as priority
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.grade_code=p_grade_code
      and c.is_active
      and (
        (p_program_id is null and c.program_id is null)
        or
        (p_program_id is not null and (
          c.program_id=p_program_id
          or (
            c.program_id is null
            and s.subject_type in ('basic','activity')
            and not exists(
              select 1 from public.lao_curriculum_program_exclusions x
              where x.school_id=p_school_id
                and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id
                and x.grade_code=p_grade_code
                and x.subject_id=c.subject_id
            )
          )
        ))
      )
  ),
  ranked as (
    select e.*,row_number() over(
      partition by e.subject_key
      order by e.priority desc,e.updated_at desc,e.course_id
    ) rn
    from eligible e
  ),
  eff as (
    select * from ranked where rn=1
  ),
  decision_rows as (
    select d.*
    from public.lao_subject_requirement_decisions d
    where d.school_id=p_school_id
      and d.academic_year_id=p_academic_year_id
      and d.program_id is not distinct from p_program_id
      and d.grade_code=p_grade_code
  ),
  eval as (
    select
      r.*,
      d.id as decision_id,d.decision,d.replacement_subject_id,d.note as decision_note,
      case
        when r.requirement_kind='activity_choice' then exists(
          select 1 from eff e
          where e.subject_type='activity'
            and e.subject_code is not null
            and lower(e.subject_code)=any(
              select lower(x) from unnest(coalesce(r.expected_codes,array[]::text[])) x
            )
        )
        else exists(
          select 1 from eff e
          where e.subject_code is not null
            and r.subject_code is not null
            and lower(e.subject_code)=lower(r.subject_code)
            and (
              r.requirement_kind='core_basic' and e.subject_type='basic'
              or r.requirement_kind='activity' and e.subject_type='activity'
            )
        )
      end as direct_match,
      case when d.decision='replaced' and d.replacement_subject_id is not null then exists(
        select 1 from eff e where e.subject_id=d.replacement_subject_id
      ) else false end as replacement_valid
    from req r
    left join decision_rows d on d.requirement_key=r.requirement_key
  ),
  result_rows as (
    select *,
      (direct_match or replacement_valid) as is_met,
      (decision='not_used') as is_acknowledged_not_used
    from eval
  ),
  duplicate_anomalies as (
    select jsonb_build_object(
      'type','duplicate_code',
      'subject_code',subject_code,
      'message','รหัสวิชา '||subject_code||' ซ้ำในโครงสร้างเดียวกัน'
    ) anomaly
    from (
      select lower(btrim(subject_code)) as code_key,min(subject_code) subject_code,
             count(*) cnt,count(distinct subject_type) type_count,
             bool_and(subject_type='activity') all_activity
      from eligible e
      where nullif(btrim(e.subject_code),'') is not null
        and e.priority=(
          select max(e2.priority)
          from eligible e2
          where lower(btrim(coalesce(e2.subject_code,'')))=lower(btrim(coalesce(e.subject_code,'')))
        )
      group by lower(btrim(e.subject_code))
      having count(*)>1 and (not bool_and(e.subject_type='activity') or count(distinct e.subject_type)>1)
    ) x
  ),
  grade_anomalies as (
    select distinct jsonb_build_object(
      'type','wrong_grade',
      'subject_code',e.subject_code,
      'subject_name',e.subject_name,
      'message','รายการนี้อ้างอิงคลังมาตรฐานของระดับ '||coalesce(p.grade_label,p.grade_code)||' แต่ถูกใช้ใน '||p_grade_code
    ) anomaly
    from eff e
    join public.lao_curriculum_preset_items p on p.id=e.source_catalog_item_id
    where p.grade_code<>p_grade_code
  ),
  code_grade_anomalies as (
    select distinct jsonb_build_object(
      'type','wrong_grade_code',
      'subject_code',e.subject_code,
      'subject_name',e.subject_name,
      'message','รหัสวิชานี้เป็นรหัสมาตรฐานของระดับชั้นอื่น กรุณาตรวจระดับชั้นหรือรหัสวิชา'
    ) anomaly
    from eff e
    where e.subject_type in ('basic','activity')
      and nullif(btrim(e.subject_code),'') is not null
      and exists(
        select 1 from public.lao_curriculum_preset_items p
        where p.preset_code='core_2551_2560'
          and p.grade_code<>p_grade_code
          and lower(coalesce(p.subject_code,''))=lower(e.subject_code)
      )
      and not exists(
        select 1 from public.lao_curriculum_preset_items p
        where p.preset_code='core_2551_2560'
          and p.grade_code=p_grade_code
          and lower(coalesce(p.subject_code,''))=lower(e.subject_code)
      )
  ),
  type_anomalies as (
    select distinct jsonb_build_object(
      'type','required_code_wrong_type',
      'subject_code',e.subject_code,
      'subject_name',e.subject_name,
      'message','รหัสวิชาตรงกับรายการบังคับ แต่ประเภทวิชาไม่ตรงกับมาตรฐาน'
    ) anomaly
    from eff e
    join req r on r.subject_code is not null
              and e.subject_code is not null
              and lower(r.subject_code)=lower(e.subject_code)
    where (r.requirement_kind='core_basic' and e.subject_type<>'basic')
       or (r.requirement_kind in ('activity','activity_choice') and e.subject_type<>'activity')
  ),
  anomalies as (
    select anomaly from duplicate_anomalies
    union all select anomaly from grade_anomalies
    union all select anomaly from code_grade_anomalies
    union all select anomaly from type_anomalies
  )
  select
    (select count(*) from result_rows)::int,
    (select count(*) from result_rows where is_met)::int,
    (select count(*) from result_rows where requirement_kind='core_basic')::int,
    (select count(*) from result_rows where requirement_kind='core_basic' and is_met)::int,
    (select count(*) from result_rows where requirement_kind in ('activity','activity_choice'))::int,
    (select count(*) from result_rows where requirement_kind in ('activity','activity_choice') and is_met)::int,
    (select count(*) from anomalies)::int,
    (select count(*) from result_rows where is_acknowledged_not_used)::int,
    (select count(*) from result_rows where replacement_valid)::int,
    coalesce((select jsonb_agg(jsonb_build_object(
      'requirement_key',requirement_key,
      'requirement_kind',requirement_kind,
      'term_no',term_no,
      'subject_code',subject_code,
      'subject_name',subject_name,
      'choice_group',choice_group,
      'choice_names',expected_names,
      'is_met',is_met,
      'direct_match',direct_match,
      'replacement_valid',replacement_valid,
      'decision',decision,
      'replacement_subject_id',replacement_subject_id,
      'decision_note',decision_note
    ) order by term_no nulls first,sort_order,subject_name) from result_rows),'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'requirement_key',requirement_key,
      'requirement_kind',requirement_kind,
      'term_no',term_no,
      'subject_code',subject_code,
      'subject_name',subject_name,
      'choice_group',choice_group,
      'choice_names',expected_names,
      'decision',decision,
      'replacement_subject_id',replacement_subject_id,
      'decision_note',decision_note,
      'message',case
        when decision='not_used' then 'ระบุว่าไม่นำมาใช้ แต่ยังไม่ผ่านเกณฑ์ความครบถ้วน'
        when decision='replaced' and not replacement_valid then 'กำหนดวิชาแทนไว้ แต่ไม่พบวิชาแทนในโครงสร้างปัจจุบัน'
        else 'ยังไม่มีรายการที่ตรงกับข้อกำหนดนี้'
      end
    ) order by term_no nulls first,sort_order,subject_name)
      from result_rows where not is_met),'[]'::jsonb),
    coalesce((select jsonb_agg(anomaly) from anomalies),'[]'::jsonb)
  into
    v_required,v_met,v_basic_required,v_basic_met,v_activity_required,v_activity_met,
    v_anomaly_count,v_ack_count,v_replaced_count,v_requirements,v_missing,v_anomalies;

  v_pct:=case
    when v_required=0 then 100
    when v_met>=v_required and v_anomaly_count=0 then 100
    when v_met>=v_required and v_anomaly_count>0 then 99
    else round(v_met*100.0/v_required)::int
  end;

  return jsonb_build_object(
    'grade_code',p_grade_code,
    'program_id',p_program_id,
    'required_count',v_required,
    'met_count',v_met,
    'missing_count',greatest(v_required-v_met,0),
    'basic_required_count',v_basic_required,
    'basic_met_count',v_basic_met,
    'activity_required_count',v_activity_required,
    'activity_met_count',v_activity_met,
    'anomaly_count',v_anomaly_count,
    'acknowledged_not_used_count',v_ack_count,
    'replacement_count',v_replaced_count,
    'completion_percent',v_pct,
    'is_complete',(v_required>0 and v_met=v_required and v_anomaly_count=0),
    'requirements',v_requirements,
    'missing_requirements',v_missing,
    'anomalies',v_anomalies
  );
end;
$function$;


revoke all on function public.lao_subject_group_completeness(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_subject_group_completeness(uuid,uuid,uuid,text) to authenticated;

commit;

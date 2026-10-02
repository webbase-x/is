-- 0060_subject_completeness_readiness.sql
-- A subject step is complete only when every real grade/program group satisfies
-- the required central core + learner-activity requirements and has no structural anomalies.
-- Learning-time completeness remains the responsibility of the next curriculum-time step.

begin;

create table if not exists public.lao_subject_requirement_decisions(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid references public.lao_academic_programs(id) on delete cascade,
  grade_code text not null,
  requirement_key text not null,
  decision text not null check(decision in ('not_used','replaced')),
  replacement_subject_id uuid references public.lao_subjects(id) on delete set null,
  note text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lao_subject_requirement_decisions_scope_uq
  on public.lao_subject_requirement_decisions(
    school_id,academic_year_id,coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid),
    grade_code,requirement_key
  );
create index if not exists lao_subject_requirement_decisions_lookup_idx
  on public.lao_subject_requirement_decisions(school_id,academic_year_id,grade_code,program_id);
alter table public.lao_subject_requirement_decisions enable row level security;
revoke all on table public.lao_subject_requirement_decisions from public,anon,authenticated;

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
    where p.preset_code='core_2551_2560'
      and p.grade_code=p_grade_code
      and (
        (p.subject_type='basic' and p.is_national_core)
        or p.subject_type='activity'
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
      from eff
      where nullif(btrim(subject_code),'') is not null
      group by lower(btrim(subject_code))
      having count(*)>1 and (not bool_and(subject_type='activity') or count(distinct subject_type)>1)
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
  v_required int:=0;
  v_met int:=0;
  v_anomalies int:=0;
  v_program_name text;
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
    v_required:=v_required+coalesce((v_status->>'required_count')::int,0);
    v_met:=v_met+coalesce((v_status->>'met_count')::int,0);
    v_anomalies:=v_anomalies+coalesce((v_status->>'anomaly_count')::int,0);
    select p.name_th into v_program_name from public.lao_academic_programs p where p.id=v_group.program_id;

    v_groups:=v_groups||jsonb_build_array(
      v_status||jsonb_build_object(
        'grade_label',v_group.grade_label,
        'program_name',v_program_name,
        'room_count',v_group.room_count
      )
    );
  end loop;

  return jsonb_build_object(
    'total_groups',v_total,
    'completed_groups',v_complete,
    'incomplete_groups',greatest(v_total-v_complete,0),
    'required_count',v_required,
    'met_count',v_met,
    'anomaly_count',v_anomalies,
    'progress_percent',case when v_total=0 then 0 else round(v_complete*100.0/v_total)::int end,
    'coverage_percent',case when v_required=0 then 0 else round(v_met*100.0/v_required)::int end,
    'is_complete',(v_total>0 and v_complete=v_total),
    'groups',v_groups
  );
end;
$function$;
revoke all on function public.lao_subject_readiness(uuid,uuid) from public,anon;
grant execute on function public.lao_subject_readiness(uuid,uuid) to authenticated;

create or replace function public.lao_set_subject_requirement_decision(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text,
  p_requirement_key text,
  p_decision text,
  p_replacement_subject_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_current jsonb;
  v_req jsonb;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_decision not in ('not_used','replaced','clear') then raise exception 'Invalid decision'; end if;

  v_current:=public.lao_subject_group_completeness(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  select x into v_req
  from jsonb_array_elements(v_current->'requirements') x
  where x->>'requirement_key'=p_requirement_key
  limit 1;
  if v_req is null then raise exception 'ไม่พบข้อกำหนดรายวิชาที่เลือก'; end if;

  if p_decision='clear' then
    delete from public.lao_subject_requirement_decisions
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and program_id is not distinct from p_program_id
      and grade_code=p_grade_code
      and requirement_key=p_requirement_key;
  else
    if p_decision='not_used' and nullif(btrim(p_note),'') is null then
      raise exception 'กรุณาระบุเหตุผลที่ไม่นำรายการนี้มาใช้';
    end if;
    if p_decision='replaced' then
      if p_replacement_subject_id is null then raise exception 'กรุณาเลือกวิชาที่ใช้แทน'; end if;
      if not exists(
        select 1
        from public.lao_curriculum_courses c
        join public.lao_subjects s on s.id=c.subject_id
        where c.school_id=p_school_id
          and c.academic_year_id=p_academic_year_id
          and c.grade_code=p_grade_code
          and c.is_active
          and s.id=p_replacement_subject_id
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
      ) then raise exception 'วิชาที่เลือกแทนไม่ได้อยู่ในโครงสร้างปัจจุบัน'; end if;
    end if;

    insert into public.lao_subject_requirement_decisions(
      school_id,academic_year_id,program_id,grade_code,requirement_key,
      decision,replacement_subject_id,note,updated_by,updated_at
    ) values(
      p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_requirement_key,
      p_decision,case when p_decision='replaced' then p_replacement_subject_id else null end,
      nullif(btrim(p_note),''),v_uid,now()
    )
    on conflict(
      school_id,academic_year_id,
      (coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid)),
      grade_code,requirement_key
    ) do update set
      decision=excluded.decision,
      replacement_subject_id=excluded.replacement_subject_id,
      note=excluded.note,
      updated_by=excluded.updated_by,
      updated_at=now();
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case p_decision when 'clear' then 'subject_requirement_decision_cleared' else 'subject_requirement_decision_saved' end,
    'subject_requirement',
    p_academic_year_id::text||':'||p_grade_code||':'||p_requirement_key,
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,'program_id',p_program_id,'grade_code',p_grade_code,
      'requirement_key',p_requirement_key,'decision',p_decision,
      'replacement_subject_id',p_replacement_subject_id,'note',p_note
    )
  );

  return public.lao_subject_group_completeness(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
end;
$function$;
revoke all on function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon;
grant execute on function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text) to authenticated;

-- Enrich the subject workspace without changing its established payload.
alter function public.lao_subject_workspace(uuid,uuid,uuid,text)
  rename to lao_subject_workspace_base_v0198;
revoke all on function public.lao_subject_workspace_base_v0198(uuid,uuid,uuid,text) from public,anon,authenticated;

create function public.lao_subject_workspace(
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
  v_base jsonb;
begin
  v_base:=public.lao_subject_workspace_base_v0198(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  return v_base||jsonb_build_object(
    'subject_completeness',
    public.lao_subject_group_completeness(
      p_school_id,p_academic_year_id,p_program_id,p_grade_code
    )
  );
end;
$function$;
revoke all on function public.lao_subject_workspace(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_subject_workspace(uuid,uuid,uuid,text) to authenticated;

-- Upgrade the annual academic timeline by replacing only the subject-step rule.
alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v0198;
revoke all on function public.lao_academic_year_setup_timeline_base_v0198(uuid,uuid) from public,anon,authenticated;

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
  v_status text;
  v_first_unresolved int;
  v_applicable int:=0;
  v_completed int:=0;
  v_skipped int:=0;
  v_not_applicable int:=0;
  v_pct int:=0;
  v_next jsonb:=null;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v0198(
    p_school_id,p_academic_year_id
  );
  v_year_id=nullif(v_base->>'academic_year_id','')::uuid;
  if v_year_id is null then return v_base; end if;

  v_subjects:=public.lao_subject_readiness(p_school_id,v_year_id);

  for v_step in select value from jsonb_array_elements(v_base->'steps')
  loop
    if v_step->>'step_code'='subjects' then
      v_status:=case when coalesce((v_subjects->>'is_complete')::boolean,false)
        then 'completed' else 'pending' end;
      v_step:=v_step
        ||jsonb_build_object(
          'detail',jsonb_build_object(
            'completed_groups',coalesce((v_subjects->>'completed_groups')::int,0),
            'total_groups',coalesce((v_subjects->>'total_groups')::int,0),
            'required_count',coalesce((v_subjects->>'required_count')::int,0),
            'met_count',coalesce((v_subjects->>'met_count')::int,0),
            'anomaly_count',coalesce((v_subjects->>'anomaly_count')::int,0),
            'coverage_percent',coalesce((v_subjects->>'coverage_percent')::int,0)
          )
        )
        -'status';
      v_step:=v_step||jsonb_build_object('_raw_status',v_status);
    else
      v_status:=coalesce(v_step->>'status','queued');
      if v_status in ('current','queued') then v_status:='pending'; end if;
      v_step:=(v_step-'status')||jsonb_build_object('_raw_status',v_status);
    end if;
    v_steps:=v_steps||jsonb_build_array(v_step);
  end loop;

  select min((x->>'sequence_no')::int) into v_first_unresolved
  from jsonb_array_elements(v_steps) x
  where x->>'_raw_status'='pending';

  v_base:=v_base-'steps';

  for v_step in select value from jsonb_array_elements(v_steps)
  loop
    v_status:=v_step->>'_raw_status';
    if v_status='pending' then
      v_status:=case when (v_step->>'sequence_no')::int=v_first_unresolved then 'current' else 'queued' end;
    end if;

    if v_status='skipped' then
      v_skipped:=v_skipped+1;
    elsif v_status='not_applicable' then
      v_not_applicable:=v_not_applicable+1;
    else
      v_applicable:=v_applicable+1;
      if v_status in ('completed','reused') then v_completed:=v_completed+1; end if;
    end if;

    if v_next is null and v_status='current' then
      v_next:=jsonb_build_object(
        'step_code',v_step->>'step_code',
        'sequence_no',(v_step->>'sequence_no')::int,
        'title',v_step->>'title',
        'description',v_step->>'description',
        'route',v_step->>'route',
        'is_required',(v_step->>'is_required')::boolean
      );
    end if;

    v_base:=v_base||jsonb_build_object(
      'steps',
      coalesce(v_base->'steps','[]'::jsonb)
      ||jsonb_build_array((v_step-'_raw_status')||jsonb_build_object('status',v_status))
    );
  end loop;

  v_pct:=case when v_applicable=0 then 100 else round(v_completed*100.0/v_applicable)::int end;

  return v_base||jsonb_build_object(
    'completed_count',v_completed,
    'skipped_count',v_skipped,
    'not_applicable_count',v_not_applicable,
    'resolved_count',v_completed+v_skipped+v_not_applicable,
    'applicable_count',v_applicable,
    'progress_percent',v_pct,
    'is_complete',(v_completed=v_applicable),
    'next_step',v_next,
    'subject_readiness',v_subjects
  );
end;
$function$;
revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid) to authenticated;

commit;

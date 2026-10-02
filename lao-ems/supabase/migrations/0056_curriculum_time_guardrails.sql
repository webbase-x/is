-- 0056_curriculum_time_guardrails.sql
-- Add curriculum-time framework references and ensure integrated learner-development
-- activities count toward activity requirements but not toward scheduled-learning totals.

begin;

alter table public.lao_central_subject_time_templates
  add column if not exists counts_toward_schedule_total boolean not null default true,
  add column if not exists counts_toward_curriculum_total boolean not null default true;

update public.lao_central_subject_time_templates
set counts_toward_schedule_total=false,
    counts_toward_curriculum_total=true,
    note='บูรณาการกับรายวิชาอื่นหรือกิจกรรมนอกเวลาเรียน · นับในกิจกรรมพัฒนาผู้เรียน แต่ไม่นับรวมชั่วโมงลงตารางเรียน',
    updated_at=now()
where time_mode='integrated';

create table if not exists public.lao_curriculum_time_frameworks(
  curriculum_version text not null,
  grade_code text not null,
  grade_scope text not null check(grade_scope in ('annual','three_year_band')),
  band_code text,
  basic_hours numeric not null,
  learner_activity_hours numeric not null,
  history_hours numeric,
  overall_max_hours numeric,
  overall_rule text not null default 'school_defined',
  source_label text not null,
  source_url text,
  note text,
  updated_at timestamptz not null default now(),
  primary key(curriculum_version,grade_code)
);
alter table public.lao_curriculum_time_frameworks enable row level security;
revoke all on table public.lao_curriculum_time_frameworks from public,anon,authenticated;

insert into public.lao_curriculum_time_frameworks(
  curriculum_version,grade_code,grade_scope,band_code,basic_hours,learner_activity_hours,
  history_hours,overall_max_hours,overall_rule,source_label,source_url,note
)
values
  ('core_2551_2560','P1','annual','P',840,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','P2','annual','P',840,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','P3','annual','P',840,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','P4','annual','P',840,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','P5','annual','P',840,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','P6','annual','P',840,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','M1','annual','MLOW',880,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','M2','annual','MLOW',880,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','M3','annual','MLOW',880,120,40,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','รวมเวลาเรียนทั้งหมดให้สถานศึกษากำหนดตามบริบท'),
  ('core_2551_2560','M4','three_year_band','MUP',1640,360,80,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','ตรวจกรอบพื้นฐาน กิจกรรมพัฒนาผู้เรียน และประวัติศาสตร์รวม ม.4–ม.6 ทั้ง 3 ปี'),
  ('core_2551_2560','M5','three_year_band','MUP',1640,360,80,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','ตรวจกรอบพื้นฐาน กิจกรรมพัฒนาผู้เรียน และประวัติศาสตร์รวม ม.4–ม.6 ทั้ง 3 ปี'),
  ('core_2551_2560','M6','three_year_band','MUP',1640,360,80,null,'school_defined','คำสั่ง สพฐ. ที่ 922/2561','https://academic.obec.go.th/images/official/1525922232_d_1.pdf','ตรวจกรอบพื้นฐาน กิจกรรมพัฒนาผู้เรียน และประวัติศาสตร์รวม ม.4–ม.6 ทั้ง 3 ปี')
on conflict(curriculum_version,grade_code) do update set
  grade_scope=excluded.grade_scope,
  band_code=excluded.band_code,
  basic_hours=excluded.basic_hours,
  learner_activity_hours=excluded.learner_activity_hours,
  history_hours=excluded.history_hours,
  overall_max_hours=excluded.overall_max_hours,
  overall_rule=excluded.overall_rule,
  source_label=excluded.source_label,
  source_url=excluded.source_url,
  note=excluded.note,
  updated_at=now();

create or replace function public.lao_time_template_json(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $function$
  select case when t.id is null then null else jsonb_build_object(
    'id',t.id,
    'preset_item_id',t.preset_item_id,
    'curriculum_version',t.curriculum_version,
    'grade_code',t.grade_code,
    'subject_code',t.subject_code,
    'term_no',t.term_no,
    'period_scope',t.period_scope,
    'annual_hours',t.annual_hours,
    'term_hours',t.term_hours,
    'weekly_periods',t.weekly_periods,
    'credits',t.credits,
    'basis_weeks',t.basis_weeks,
    'time_mode',t.time_mode,
    'standard_kind',t.standard_kind,
    'is_flexible',t.is_flexible,
    'counts_toward_schedule_total',t.counts_toward_schedule_total,
    'counts_toward_curriculum_total',t.counts_toward_curriculum_total,
    'note',t.note
  ) end
  from public.lao_central_subject_time_templates t
  where t.id=p_template_id and t.is_active
$function$;
revoke all on function public.lao_time_template_json(uuid) from public,anon,authenticated;

create or replace function public.lao_curriculum_hours_breakdown(
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
  v_uid uuid := (select auth.uid());
  v_minutes numeric;
  v_weeks numeric;
  v_basic numeric:=0;
  v_activity numeric:=0;
  v_additional numeric:=0;
  v_other numeric:=0;
  v_integrated numeric:=0;
  v_scheduled numeric:=0;
  v_curriculum numeric:=0;
  v_history numeric:=0;
  v_framework public.lao_curriculum_time_frameworks%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  select minutes_per_period::numeric,instructional_weeks_per_year
  into v_minutes,v_weeks
  from public.lao_academic_schedule_settings
  where school_id=p_school_id and academic_year_id=p_academic_year_id;

  select * into v_framework
  from public.lao_curriculum_time_frameworks
  where curriculum_version='core_2551_2560' and grade_code=p_grade_code;

  with eligible as (
    select
      c.id,c.subject_id,c.program_id,c.annual_hours,c.updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,
      pg.id as parallel_group_id,
      case
        when c.standard_time_snapshot ? 'time_mode' then coalesce(nullif(c.standard_time_snapshot->>'time_mode',''),'weekly')
        when ct.time_mode is not null then ct.time_mode
        else 'weekly'
      end as time_mode,
      case
        when c.standard_time_snapshot ? 'counts_toward_schedule_total'
          then coalesce((c.standard_time_snapshot->>'counts_toward_schedule_total')::boolean,true)
        when ct.id is not null then ct.counts_toward_schedule_total
        when coalesce(c.standard_time_snapshot->>'time_mode',ct.time_mode,'weekly')='integrated' then false
        else true
      end as counts_schedule,
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
    left join public.lao_central_subject_time_templates ct on ct.id=c.standard_time_template_id and ct.is_active
    left join public.lao_curriculum_parallel_group_courses pgc on pgc.course_id=c.id
    left join public.lao_curriculum_parallel_groups pg on pg.id=pgc.group_id
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
    select e.*,row_number() over(partition by e.subject_key order by e.priority desc,e.updated_at desc,e.id) as rn
    from eligible e
  ),
  eff0 as (
    select * from ranked where rn=1
  ),
  eff as (
    select e.*,
      coalesce(
        e.annual_hours,
        (select sum(tp.term_hours) from public.lao_course_term_plans tp where tp.course_id=e.id and tp.term_hours is not null),
        case when v_minutes is not null and v_weeks is not null then
          (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id)
          * v_minutes/60*v_weeks
        end,
        0
      ) as course_hours
    from eff0 e
  ),
  slots as (
    select
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end as schedule_key,
      max(course_hours) as slot_hours,
      bool_or(subject_type='basic') as is_basic,
      bool_or(subject_type='activity') as is_activity,
      bool_or(subject_type='additional') as is_additional,
      bool_or(subject_type='other') as is_other,
      bool_and(counts_schedule) as counts_schedule,
      bool_or(time_mode='integrated') as is_integrated,
      bool_or(subject_type='basic' and position('ประวัติศาสตร์' in subject_name)>0) as is_history
    from eff
    group by
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end
  )
  select
    coalesce(sum(slot_hours) filter(where is_basic),0),
    coalesce(sum(slot_hours) filter(where is_activity),0),
    coalesce(sum(slot_hours) filter(where is_additional),0),
    coalesce(sum(slot_hours) filter(where is_other),0),
    coalesce(sum(slot_hours) filter(where is_activity and (is_integrated or not counts_schedule)),0),
    coalesce(sum(slot_hours) filter(where counts_schedule),0),
    coalesce(sum(slot_hours),0),
    coalesce(sum(slot_hours) filter(where is_history),0)
  into v_basic,v_activity,v_additional,v_other,v_integrated,v_scheduled,v_curriculum,v_history
  from slots;

  return jsonb_build_object(
    'basic_hours_total',v_basic,
    'learner_activity_hours_total',v_activity,
    'additional_hours_total',v_additional,
    'other_hours_total',v_other,
    'integrated_activity_hours',v_integrated,
    'scheduled_hours_total',v_scheduled,
    'curriculum_hours_total',v_curriculum,
    'history_hours_total',v_history,
    'time_framework',case when v_framework.grade_code is null then null else jsonb_build_object(
      'curriculum_version',v_framework.curriculum_version,
      'grade_code',v_framework.grade_code,
      'grade_scope',v_framework.grade_scope,
      'band_code',v_framework.band_code,
      'basic_hours',v_framework.basic_hours,
      'learner_activity_hours',v_framework.learner_activity_hours,
      'history_hours',v_framework.history_hours,
      'overall_max_hours',v_framework.overall_max_hours,
      'overall_rule',v_framework.overall_rule,
      'source_label',v_framework.source_label,
      'source_url',v_framework.source_url,
      'note',v_framework.note,
      'basic_status',case
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_basic-v_framework.basic_hours)<0.001 then 'match'
        when v_basic<v_framework.basic_hours then 'below'
        else 'above'
      end,
      'activity_status',case
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_activity-v_framework.learner_activity_hours)<0.001 then 'match'
        when v_activity<v_framework.learner_activity_hours then 'below'
        else 'above'
      end,
      'history_status',case
        when v_framework.history_hours is null then 'not_applicable'
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_history-v_framework.history_hours)<0.001 then 'match'
        when v_history<v_framework.history_hours then 'below'
        else 'above'
      end
    ) end
  );
end;
$function$;
revoke all on function public.lao_curriculum_hours_breakdown(uuid,uuid,uuid,text) from public,anon,authenticated;

alter function public.lao_curriculum_group_status(uuid,uuid,uuid,text)
  rename to lao_curriculum_group_status_base_v0196;
revoke all on function public.lao_curriculum_group_status_base_v0196(uuid,uuid,uuid,text) from public,anon,authenticated;

create function public.lao_curriculum_group_status(
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
  v_hours jsonb;
  v_fp text;
begin
  v_base:=public.lao_curriculum_group_status_base_v0196(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_hours:=public.lao_curriculum_hours_breakdown(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_fp:=md5(coalesce(v_base->>'fingerprint','')||'|'||coalesce(v_hours::text,''));
  return v_base
    || v_hours
    || jsonb_build_object(
      'annual_hours_total',coalesce((v_hours->>'scheduled_hours_total')::numeric,0),
      'curriculum_recorded_hours_total',coalesce((v_hours->>'curriculum_hours_total')::numeric,0),
      'fingerprint',v_fp
    );
end;
$function$;
revoke all on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) to authenticated;

commit;

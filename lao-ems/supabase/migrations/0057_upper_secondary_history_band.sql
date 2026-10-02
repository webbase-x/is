-- 0057_upper_secondary_history_band.sql
-- History at upper-secondary level is a 3-year requirement (80 hours total),
-- not a fixed 20-hour requirement in every semester. Keep allocation school-controlled.

begin;

alter table public.lao_central_subject_time_templates
  add column if not exists band_requirement_code text,
  add column if not exists band_requirement_hours numeric,
  add column if not exists band_requirement_scope text;

update public.lao_central_subject_time_templates t
set term_hours=null,
    weekly_periods=null,
    credits=null,
    standard_kind='three_year_band_allocation',
    is_flexible=true,
    band_requirement_code='MUP_HISTORY',
    band_requirement_hours=80,
    band_requirement_scope='M4-M6 · 3 ปี',
    note='ประวัติศาสตร์ระดับ ม.4–ม.6 รวม 80 ชั่วโมงตลอด 3 ปี · สถานศึกษากำหนดการกระจายรายชั้น/รายภาคตามแผนการเรียน',
    updated_at=now()
from public.lao_curriculum_preset_items p
where p.id=t.preset_item_id
  and t.grade_code in ('M4','M5','M6')
  and p.subject_type='basic'
  and position('ประวัติศาสตร์' in p.subject_name)>0;

update public.lao_curriculum_preset_items p
set weekly_periods=null,
    annual_hours=null,
    updated_at=now()
from public.lao_central_subject_time_templates t
where t.preset_item_id=p.id
  and t.band_requirement_code='MUP_HISTORY';

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
    'band_requirement_code',t.band_requirement_code,
    'band_requirement_hours',t.band_requirement_hours,
    'band_requirement_scope',t.band_requirement_scope,
    'note',t.note
  ) end
  from public.lao_central_subject_time_templates t
  where t.id=p_template_id and t.is_active
$function$;
revoke all on function public.lao_time_template_json(uuid) from public,anon,authenticated;

create or replace function public.lao_reset_course_time_to_standard(
  p_school_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  c public.lao_curriculum_courses%rowtype;
  t public.lao_central_subject_time_templates%rowtype;
  v_org uuid;
  v_template jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  select * into c from public.lao_curriculum_courses where id=p_course_id and school_id=p_school_id;
  if c.id is null then raise exception 'Course not found'; end if;
  if c.standard_time_template_id is null then raise exception 'รายวิชานี้ไม่มีแม่แบบเวลาเรียนกลาง'; end if;

  select * into t
  from public.lao_central_subject_time_templates
  where id=c.standard_time_template_id and is_active;

  if t.standard_kind='three_year_band_allocation' then
    raise exception 'มาตรฐานรายการนี้กำหนดเป็นกรอบรวม % ชั่วโมง (%), ไม่มีค่าเวลาเรียนรายภาคตายตัว กรุณากำหนดการกระจายของโรงเรียนเอง',
      t.band_requirement_hours,t.band_requirement_scope;
  end if;

  v_template:=public.lao_apply_central_time_default_to_course(c.id,true);
  update public.lao_curriculum_courses
  set standard_time_snapshot=v_template,time_override_note=null,updated_by=v_uid,updated_at=now()
  where id=c.id;
  perform public.lao_recalculate_course_time_customized(c.id);

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(v_org,p_school_id,v_uid,'curriculum_time_reset_to_standard','curriculum_course',c.id::text,
    jsonb_build_object('standard_time',v_template));

  return (select x from jsonb_array_elements((public.lao_course_time_overview(p_school_id,c.academic_year_id)->'items')) x where x->>'course_id'=c.id::text limit 1);
end;
$function$;
revoke all on function public.lao_reset_course_time_to_standard(uuid,uuid) from public,anon;
grant execute on function public.lao_reset_course_time_to_standard(uuid,uuid) to authenticated;

commit;

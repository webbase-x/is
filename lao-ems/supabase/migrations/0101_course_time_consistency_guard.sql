-- 0101_course_time_consistency_guard.sql
-- School-defined annual hours are authoritative. When annual hours and weekly
-- periods are both supplied they must agree with the effective school/program
-- time frame. A blank weekly-period value may be derived from annual hours.

create or replace function public.lao_update_course_time_override_base_v01991(
  p_school_id uuid,
  p_course_id uuid,
  p_annual_hours numeric default null,
  p_term_hours numeric default null,
  p_weekly_periods numeric default null,
  p_credits numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
  c public.lao_curriculum_courses%rowtype;
  s jsonb;
  v_scope text;
  v_term_no integer;
  v_term record;
  v_term_id uuid;
  v_org uuid;
  v_has_standard boolean := false;
  v_frame jsonb;
  v_weeks numeric;
  v_minutes numeric;
  v_expected_weekly numeric;
  v_effective_weekly numeric;
  v_time_mode text := 'weekly';
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select * into c
  from public.lao_curriculum_courses
  where id=p_course_id and school_id=p_school_id;

  if c.id is null then raise exception 'Course not found'; end if;

  if coalesce(p_annual_hours,0)<0
     or coalesce(p_term_hours,0)<0
     or coalesce(p_weekly_periods,0)<0
     or coalesce(p_credits,0)<0 then
    raise exception 'ค่าเวลาเรียนต้องไม่ติดลบ';
  end if;

  v_has_standard := c.standard_time_snapshot is not null;

  if v_has_standard then
    s := c.standard_time_snapshot;
    v_scope := coalesce(nullif(s->>'period_scope',''),'annual');
    v_term_no := nullif(s->>'term_no','')::integer;
    v_time_mode := coalesce(nullif(s->>'time_mode',''),'weekly');
  else
    v_scope := 'annual';
    v_term_no := null;
    v_time_mode := 'weekly';
  end if;

  if v_scope='annual' and v_time_mode<>'integrated' and p_annual_hours is not null then
    v_frame := public.lao_effective_academic_time_frame(c.school_id,c.academic_year_id,c.program_id);

    if coalesce((v_frame->>'configured')::boolean,false) then
      v_weeks := nullif(v_frame->>'instructional_weeks_per_year','')::numeric;
      v_minutes := nullif(v_frame->>'minutes_per_period','')::numeric;
    end if;

    if coalesce(v_weeks,0)>0 and coalesce(v_minutes,0)>0 then
      v_expected_weekly := round(p_annual_hours / (v_weeks*(v_minutes/60)),4);

      if p_weekly_periods is not null
         and abs(p_weekly_periods-v_expected_weekly)>.001 then
        raise exception
          'ชั่วโมง/ปีกับคาบ/สัปดาห์ไม่สัมพันธ์กัน: % ชม./ปี ตามกรอบ % สัปดาห์ คาบละ % นาที ต้องเป็น % คาบ/สัปดาห์',
          trim(to_char(p_annual_hours,'FM999999990.##')),
          trim(to_char(v_weeks,'FM999999990.##')),
          trim(to_char(v_minutes,'FM999999990.##')),
          trim(to_char(v_expected_weekly,'FM999999990.####'));
      end if;

      v_effective_weekly := coalesce(p_weekly_periods,v_expected_weekly);
    else
      v_effective_weekly := p_weekly_periods;
    end if;
  elsif v_scope='annual' and v_time_mode='integrated' then
    v_effective_weekly := null;
  else
    v_effective_weekly := p_weekly_periods;
  end if;

  update public.lao_curriculum_courses
  set annual_hours=case when v_scope='annual' then p_annual_hours else null end,
      credits=p_credits,
      time_override_note=nullif(btrim(p_note),''),
      updated_by=v_uid,
      updated_at=now()
  where id=c.id;

  delete from public.lao_course_term_plans where course_id=c.id;

  if v_scope='annual' then
    if v_effective_weekly is not null then
      for v_term in
        select id
        from public.lao_terms
        where academic_year_id=c.academic_year_id
        order by term_no
      loop
        insert into public.lao_course_term_plans(
          course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
        )
        values(
          c.id,v_term.id,v_effective_weekly,null,
          case
            when p_weekly_periods is null and v_expected_weekly is not null
              then 'โรงเรียนกำหนดชั่วโมง/ปี · ระบบคำนวณคาบ/สัปดาห์ตามกรอบเวลา'
            when v_has_standard
              then 'โรงเรียนปรับจากมาตรฐานกลาง'
            else 'โรงเรียนกำหนดเวลาเรียนเอง'
          end,
          v_uid,v_uid
        );
      end loop;
    end if;
  else
    select id into v_term_id
    from public.lao_terms
    where academic_year_id=c.academic_year_id
      and term_no=v_term_no
    limit 1;

    if v_term_id is null then raise exception 'ไม่พบภาคเรียนที่ %',v_term_no; end if;

    if p_weekly_periods is not null or p_term_hours is not null then
      insert into public.lao_course_term_plans(
        course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
      )
      values(
        c.id,v_term_id,p_weekly_periods,p_term_hours,
        'โรงเรียนปรับจากมาตรฐานกลาง',v_uid,v_uid
      );
    end if;
  end if;

  if v_has_standard then
    perform public.lao_recalculate_course_time_customized(c.id);
  else
    update public.lao_curriculum_courses
    set time_customized=false,time_customized_at=null,time_customized_by=null
    where id=c.id;
  end if;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  )
  values(
    v_org,p_school_id,v_uid,
    case when v_has_standard then 'curriculum_time_overridden' else 'curriculum_time_defined' end,
    'curriculum_course',c.id::text,
    jsonb_build_object(
      'annual_hours',p_annual_hours,
      'term_hours',p_term_hours,
      'weekly_periods',v_effective_weekly,
      'weekly_periods_source',
        case when p_weekly_periods is null and v_expected_weekly is not null
          then 'derived_from_school_annual_hours'
          else 'validated_manual'
        end,
      'credits',p_credits,
      'note',p_note,
      'has_standard_template',v_has_standard
    )
  );

  return (
    select x
    from jsonb_array_elements(
      public.lao_course_time_overview(p_school_id,c.academic_year_id)->'items'
    ) x
    where x->>'course_id'=c.id::text
    limit 1
  );
end;
$function$;

revoke all on function public.lao_update_course_time_override_base_v01991(uuid,uuid,numeric,numeric,numeric,numeric,text)
  from public,anon,authenticated;

create or replace function public.lao_update_course_time_override(
  p_school_id uuid,
  p_course_id uuid,
  p_annual_hours numeric default null,
  p_term_hours numeric default null,
  p_weekly_periods numeric default null,
  p_credits numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then
    raise exception 'ไม่มีสิทธิ์ดำเนินการในส่วนงานนี้';
  end if;

  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.subjects',true);
  perform set_config('app.lao_scoped_permission','edit',true);

  return public.lao_update_course_time_override_base_v01991(
    p_school_id,p_course_id,p_annual_hours,p_term_hours,p_weekly_periods,p_credits,p_note
  );
end;
$function$;

revoke all on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text)
  from public,anon;
grant execute on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text)
  to authenticated;

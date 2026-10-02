-- 0052_academic_term_100_day_defaults.sql
-- Auto-fill term 1 and term 2 as 100 weekday instructional days when an academic year is defined.
-- Existing manually entered term dates are preserved. Missing dates are filled only.
-- Users can still edit term dates later.

begin;

create or replace function public.lao_add_school_weekdays(
  p_start date,
  p_days integer
)
returns date
language plpgsql
immutable
strict
set search_path=public
as $function$
declare
  v_date date := p_start;
  v_count integer := 0;
begin
  if p_days is null or p_days <= 0 then
    return p_start;
  end if;

  while v_count < p_days loop
    if extract(isodow from v_date) between 1 and 5 then
      v_count := v_count + 1;
    end if;
    if v_count < p_days then
      v_date := v_date + 1;
    end if;
  end loop;

  return v_date;
end;
$function$;

create or replace function public.lao_next_school_weekday(
  p_date date
)
returns date
language plpgsql
immutable
strict
set search_path=public
as $function$
declare
  v_date date := p_date + 1;
begin
  while extract(isodow from v_date) not between 1 and 5 loop
    v_date := v_date + 1;
  end loop;
  return v_date;
end;
$function$;

create or replace function public.lao_save_academic_year(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_year_be integer default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_is_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
  v_year_end date;
  v_term1_start date;
  v_term1_end date;
  v_term2_start date;
  v_term2_end date;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_year_be is null or p_year_be<2400 or p_year_be>2800 then raise exception 'ปีการศึกษาไม่ถูกต้อง'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  if v_org is null then raise exception 'School not found'; end if;

  if p_is_current then
    update public.lao_academic_years set is_current=false,updated_at=now()
    where school_id=p_school_id and (p_academic_year_id is null or id<>p_academic_year_id) and is_current;
  end if;

  if p_academic_year_id is null then
    v_year_end := case
      when p_ends_on is not null then p_ends_on
      when p_starts_on is not null then public.lao_add_school_weekdays(p_starts_on,200)
      else null
    end;

    insert into public.lao_academic_years(school_id,year_be,starts_on,ends_on,is_current)
    values(p_school_id,p_year_be,p_starts_on,v_year_end,p_is_current)
    returning id into v_id;

    if p_starts_on is not null then
      v_term1_start := p_starts_on;
      v_term1_end := public.lao_add_school_weekdays(v_term1_start,100);
      v_term2_start := public.lao_next_school_weekday(v_term1_end);
      v_term2_end := public.lao_add_school_weekdays(v_term2_start,100);
    end if;

    insert into public.lao_terms(academic_year_id,term_no,name,starts_on,ends_on,is_current)
    values
      (v_id,1,'ภาคเรียนที่ 1',v_term1_start,v_term1_end,false),
      (v_id,2,'ภาคเรียนที่ 2',v_term2_start,v_term2_end,false)
    on conflict(academic_year_id,term_no) do nothing;

    v_action:='academic_year_created';
  else
    update public.lao_academic_years
    set year_be=p_year_be,starts_on=p_starts_on,ends_on=p_ends_on,is_current=p_is_current,updated_at=now()
    where id=p_academic_year_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Academic year not found'; end if;

    -- Fill only missing term dates so previously edited values are never overwritten.
    select t.starts_on,t.ends_on
    into v_term1_start,v_term1_end
    from public.lao_terms t
    where t.academic_year_id=v_id and t.term_no=1;

    if v_term1_start is null then
      v_term1_start := p_starts_on;
    end if;
    if v_term1_end is null and v_term1_start is not null then
      v_term1_end := public.lao_add_school_weekdays(v_term1_start,100);
    end if;

    update public.lao_terms
    set starts_on=coalesce(starts_on,v_term1_start),
        ends_on=coalesce(ends_on,v_term1_end),
        updated_at=now()
    where academic_year_id=v_id and term_no=1;

    select t.starts_on,t.ends_on
    into v_term2_start,v_term2_end
    from public.lao_terms t
    where t.academic_year_id=v_id and t.term_no=2;

    if v_term2_start is null and v_term1_end is not null then
      v_term2_start := public.lao_next_school_weekday(v_term1_end);
    end if;
    if v_term2_end is null and v_term2_start is not null then
      v_term2_end := public.lao_add_school_weekdays(v_term2_start,100);
    end if;

    update public.lao_terms
    set starts_on=coalesce(starts_on,v_term2_start),
        ends_on=coalesce(ends_on,v_term2_end),
        updated_at=now()
    where academic_year_id=v_id and term_no=2;

    -- If legacy data is missing term 1 or 2, recreate the missing default term.
    insert into public.lao_terms(academic_year_id,term_no,name,starts_on,ends_on,is_current)
    select v_id,1,'ภาคเรียนที่ 1',p_starts_on,
           case when p_starts_on is not null then public.lao_add_school_weekdays(p_starts_on,100) else null end,
           false
    where not exists(select 1 from public.lao_terms where academic_year_id=v_id and term_no=1);

    select t.starts_on,t.ends_on into v_term1_start,v_term1_end
    from public.lao_terms t
    where t.academic_year_id=v_id and t.term_no=1;

    insert into public.lao_terms(academic_year_id,term_no,name,starts_on,ends_on,is_current)
    select v_id,2,'ภาคเรียนที่ 2',
           case when v_term1_end is not null then public.lao_next_school_weekday(v_term1_end) else null end,
           case when v_term1_end is not null then public.lao_add_school_weekdays(public.lao_next_school_weekday(v_term1_end),100) else null end,
           false
    where not exists(select 1 from public.lao_terms where academic_year_id=v_id and term_no=2);

    v_action:='academic_year_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'academic_year',v_id::text,
    jsonb_build_object(
      'year_be',p_year_be,
      'starts_on',p_starts_on,
      'ends_on',case when p_academic_year_id is null then v_year_end else p_ends_on end,
      'is_current',p_is_current,
      'default_term_days',100,
      'term_dates_auto_filled',true
    )
  );

  return jsonb_build_object(
    'id',v_id,
    'year_be',p_year_be,
    'default_term_days',100
  );
exception
  when unique_violation then
    raise exception 'มีปีการศึกษา % อยู่แล้ว',p_year_be;
end;
$function$;

revoke all on function public.lao_add_school_weekdays(date,integer) from public,anon;
grant execute on function public.lao_add_school_weekdays(date,integer) to authenticated;

revoke all on function public.lao_next_school_weekday(date) from public,anon;
grant execute on function public.lao_next_school_weekday(date) to authenticated;

revoke all on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) from public,anon;
grant execute on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) to authenticated;

commit;

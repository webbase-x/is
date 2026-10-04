-- 0086_assessment_outcome_links.sql
-- Link every assessment item to standards/indicators/learning outcomes and snapshot those links into assessment components.

begin;

alter table public.lao_assessment_components
  add column if not exists outcome_codes jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='lao_assessment_components_outcome_codes_array_chk'
      and conrelid='public.lao_assessment_components'::regclass
  ) then
    alter table public.lao_assessment_components
      add constraint lao_assessment_components_outcome_codes_array_chk
      check (jsonb_typeof(outcome_codes)='array');
  end if;
end $$;

create or replace function public.lao_course_curriculum_validation(p_curriculum_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_cur public.lao_course_curricula%rowtype;
  v_target_hours numeric:=null;
  v_unit_hours numeric:=0;
  v_outcome_count integer:=0;
  v_unit_count integer:=0;
  v_assessment_count integer:=0;
  v_required_term_count integer:=0;
  v_required_outcome_count integer:=0;
  v_assessed_outcome_count integer:=0;
  v_missing_outcome_codes text:=null;
  v_issues jsonb:='[]'::jsonb;
  v_terms jsonb:='[]'::jsonb;
  v_term record;
  v_score numeric;
  v_term_unit_hours numeric;
  v_term_hours_target numeric;
  v_hours_ok boolean;
  v_score_ok boolean;
  v_ready boolean:=false;
begin
  select * into v_cur
  from public.lao_course_curricula
  where id=p_curriculum_id;

  if not found then
    return jsonb_build_object('ready',false,'issues',jsonb_build_array('ไม่พบหลักสูตรรายวิชา'));
  end if;

  select c.annual_hours into v_target_hours
  from public.lao_curriculum_courses c
  where c.id=v_cur.course_id;

  v_outcome_count:=jsonb_array_length(v_cur.outcomes);
  v_unit_count:=jsonb_array_length(v_cur.units);
  v_assessment_count:=jsonb_array_length(v_cur.assessment_plan);

  if btrim(coalesce(v_cur.course_description,''))='' then
    v_issues:=v_issues||jsonb_build_array('ยังไม่ได้ระบุคำอธิบายรายวิชา');
  end if;

  if v_outcome_count=0 then
    v_issues:=v_issues||jsonb_build_array('ยังไม่มีมาตรฐาน/ตัวชี้วัด/ผลการเรียนรู้');
  elsif exists(
    select 1
    from jsonb_array_elements(v_cur.outcomes) o
    where btrim(coalesce(o->>'code',''))=''
       or btrim(coalesce(o->>'description',''))=''
       or coalesce(o->>'type','') not in ('standard','indicator','learning_outcome')
  ) then
    v_issues:=v_issues||jsonb_build_array('มาตรฐาน/ตัวชี้วัดบางรายการยังไม่ครบ');
  elsif (
    select count(*) from (
      select lower(btrim(o->>'code')) code
      from jsonb_array_elements(v_cur.outcomes) o
      group by lower(btrim(o->>'code'))
      having count(*)>1
    ) d
  )>0 then
    v_issues:=v_issues||jsonb_build_array('รหัสมาตรฐาน/ตัวชี้วัดซ้ำกัน');
  end if;

  if v_unit_count=0 then
    v_issues:=v_issues||jsonb_build_array('ยังไม่มีโครงสร้างหน่วยการเรียนรู้');
  elsif exists(
    select 1
    from jsonb_array_elements(v_cur.units) u
    where btrim(coalesce(u->>'title',''))=''
       or coalesce(u->>'unit_no','') !~ '^[0-9]+$'
       or coalesce(u->>'term_no','') !~ '^[0-9]+$'
       or coalesce(u->>'hours','') !~ '^[0-9]+([.][0-9]+)?$'
       or (u->>'hours')::numeric<=0
       or jsonb_typeof(coalesce(u->'outcome_codes','[]'::jsonb))<>'array'
       or jsonb_array_length(coalesce(u->'outcome_codes','[]'::jsonb))=0
  ) then
    v_issues:=v_issues||jsonb_build_array('หน่วยการเรียนรู้บางหน่วยยังกรอกข้อมูลไม่ครบ');
  else
    if exists(
      select 1
      from jsonb_array_elements(v_cur.units) u
      cross join lateral jsonb_array_elements_text(coalesce(u->'outcome_codes','[]'::jsonb)) oc
      where not exists(
        select 1
        from jsonb_array_elements(v_cur.outcomes) o
        where lower(btrim(o->>'code'))=lower(btrim(oc.value))
      )
    ) then
      v_issues:=v_issues||jsonb_build_array('หน่วยการเรียนรู้มีตัวชี้วัดที่ไม่พบในหลักสูตรรายวิชา');
    end if;
  end if;

  select coalesce(sum(
    case when coalesce(u->>'hours','') ~ '^[0-9]+([.][0-9]+)?$'
      then (u->>'hours')::numeric else 0 end
  ),0)
  into v_unit_hours
  from jsonb_array_elements(v_cur.units) u;

  if coalesce(v_target_hours,0)>0 and abs(v_unit_hours-v_target_hours)>0.01 then
    v_issues:=v_issues||jsonb_build_array(
      'ชั่วโมงรวมของหน่วยเรียน ('||trim(to_char(v_unit_hours,'FM999999990.##'))||
      ') ไม่ตรงกับเวลาเรียนรายวิชา ('||trim(to_char(v_target_hours,'FM999999990.##'))||')'
    );
  end if;

  if v_assessment_count=0 then
    v_issues:=v_issues||jsonb_build_array('ยังไม่มีแผนการวัดและประเมินผล');
  elsif exists(
    select 1
    from jsonb_array_elements(v_cur.assessment_plan) a
    where btrim(coalesce(a->>'label',''))=''
       or coalesce(a->>'term_no','') !~ '^[0-9]+$'
       or coalesce(a->>'max_score','') !~ '^[0-9]+([.][0-9]+)?$'
       or (a->>'max_score')::numeric<=0
       or (a->>'max_score')::numeric>100
       or coalesce(a->>'category','') not in ('coursework','midterm','final','performance','activity','other')
  ) then
    v_issues:=v_issues||jsonb_build_array('รายการวัดและประเมินผลบางรายการยังไม่ครบหรือคะแนนไม่ถูกต้อง');
  else
    if exists(
      select 1
      from jsonb_array_elements(v_cur.assessment_plan) a
      where jsonb_typeof(coalesce(a->'outcome_codes','[]'::jsonb))<>'array'
         or jsonb_array_length(coalesce(a->'outcome_codes','[]'::jsonb))=0
    ) then
      v_issues:=v_issues||jsonb_build_array('รายการวัดและประเมินผลทุกรายการต้องระบุตัวชี้วัด/มาตรฐาน/ผลการเรียนรู้ที่วัด');
    end if;

    if exists(
      select 1
      from jsonb_array_elements(v_cur.assessment_plan) a
      cross join lateral jsonb_array_elements_text(coalesce(a->'outcome_codes','[]'::jsonb)) oc
      where not exists(
        select 1
        from jsonb_array_elements(v_cur.outcomes) o
        where lower(btrim(o->>'code'))=lower(btrim(oc.value))
      )
    ) then
      v_issues:=v_issues||jsonb_build_array('แผนการวัดผลมีตัวชี้วัด/มาตรฐานที่ไม่พบในหลักสูตรรายวิชา');
    end if;
  end if;

  with outcome_rows as (
    select btrim(o->>'code') code,coalesce(o->>'type','') outcome_type
    from jsonb_array_elements(v_cur.outcomes) o
    where btrim(coalesce(o->>'code',''))<>''
  ),
  preferred as (
    select * from outcome_rows where outcome_type in ('indicator','learning_outcome')
  ),
  required as (
    select * from preferred
    union all
    select * from outcome_rows
    where outcome_type='standard'
      and not exists(select 1 from preferred)
  ),
  assessed as (
    select distinct lower(btrim(oc.value)) code
    from jsonb_array_elements(v_cur.assessment_plan) a
    cross join lateral jsonb_array_elements_text(coalesce(a->'outcome_codes','[]'::jsonb)) oc
  )
  select
    (select count(*) from required),
    (select count(*) from required r where exists(select 1 from assessed a where a.code=lower(r.code))),
    (select string_agg(r.code, ', ' order by r.code)
     from required r
     where not exists(select 1 from assessed a where a.code=lower(r.code)))
  into v_required_outcome_count,v_assessed_outcome_count,v_missing_outcome_codes;

  if v_required_outcome_count>0 and v_assessed_outcome_count<v_required_outcome_count then
    v_issues:=v_issues||jsonb_build_array(
      'ยังไม่มีรายการวัดผลครอบคลุมตัวชี้วัด/ผลการเรียนรู้: '||coalesce(v_missing_outcome_codes,'')
    );
  end if;

  for v_term in
    with term_source as (
      select t.term_no::integer term_no,ctp.term_hours target_hours
      from public.lao_course_term_plans ctp
      join public.lao_terms t on t.id=ctp.term_id
      where ctp.course_id=v_cur.course_id
        and (ctp.term_hours is not null or ctp.weekly_periods is not null)
      union all
      select distinct t.term_no::integer,null::numeric
      from public.lao_teaching_workload_items wi
      join public.lao_teaching_workloads w on w.id=wi.workload_id
      join public.lao_terms t on t.id=w.term_id
      where wi.course_id=v_cur.course_id and w.status='approved'
      union all
      select distinct (u->>'term_no')::integer,null::numeric
      from jsonb_array_elements(v_cur.units) u
      where coalesce(u->>'term_no','') ~ '^[0-9]+$'
      union all
      select distinct (a->>'term_no')::integer,null::numeric
      from jsonb_array_elements(v_cur.assessment_plan) a
      where coalesce(a->>'term_no','') ~ '^[0-9]+$'
    )
    select term_no,max(target_hours) target_hours
    from term_source
    where term_no>0
    group by term_no
    order by term_no
  loop
    v_required_term_count:=v_required_term_count+1;
    v_term_hours_target:=v_term.target_hours;

    select coalesce(sum(
      case when coalesce(a->>'max_score','') ~ '^[0-9]+([.][0-9]+)?$'
        then (a->>'max_score')::numeric else 0 end
    ),0)
    into v_score
    from jsonb_array_elements(v_cur.assessment_plan) a
    where coalesce(a->>'term_no','') ~ '^[0-9]+$'
      and (a->>'term_no')::integer=v_term.term_no;

    select coalesce(sum(
      case when coalesce(u->>'hours','') ~ '^[0-9]+([.][0-9]+)?$'
        then (u->>'hours')::numeric else 0 end
    ),0)
    into v_term_unit_hours
    from jsonb_array_elements(v_cur.units) u
    where coalesce(u->>'term_no','') ~ '^[0-9]+$'
      and (u->>'term_no')::integer=v_term.term_no;

    v_score_ok:=abs(v_score-100)<=0.01;
    v_hours_ok:=v_term_hours_target is null
      or v_term_hours_target<=0
      or abs(v_term_unit_hours-v_term_hours_target)<=0.01;

    if not v_score_ok then
      v_issues:=v_issues||jsonb_build_array(
        'โครงสร้างคะแนนภาคเรียนที่ '||v_term.term_no||' รวม '||
        trim(to_char(v_score,'FM999999990.##'))||' คะแนน ต้องรวม 100 คะแนน'
      );
    end if;
    if not v_hours_ok then
      v_issues:=v_issues||jsonb_build_array(
        'ชั่วโมงหน่วยเรียนภาคเรียนที่ '||v_term.term_no||' รวม '||
        trim(to_char(v_term_unit_hours,'FM999999990.##'))||' ชม. ไม่ตรงกับกรอบ '||
        trim(to_char(v_term_hours_target,'FM999999990.##'))||' ชม.'
      );
    end if;

    v_terms:=v_terms||jsonb_build_array(jsonb_build_object(
      'term_no',v_term.term_no,
      'score_total',v_score,
      'score_ok',v_score_ok,
      'unit_hours',v_term_unit_hours,
      'target_hours',v_term_hours_target,
      'hours_ok',v_hours_ok
    ));
  end loop;

  if v_required_term_count=0 then
    v_issues:=v_issues||jsonb_build_array('ยังไม่พบภาคเรียนสำหรับรายวิชานี้');
  end if;

  v_ready:=jsonb_array_length(v_issues)=0;

  return jsonb_build_object(
    'ready',v_ready,
    'issues',v_issues,
    'outcome_count',v_outcome_count,
    'unit_count',v_unit_count,
    'assessment_count',v_assessment_count,
    'required_outcome_count',v_required_outcome_count,
    'assessed_outcome_count',v_assessed_outcome_count,
    'unit_hours_total',v_unit_hours,
    'target_hours',v_target_hours,
    'terms',v_terms
  );
end;
$function$;

revoke all on function public.lao_course_curriculum_validation(uuid) from public,anon,authenticated;

create or replace function public.lao_ensure_assessment_book_curriculum_v01938(
  p_school_id uuid,
  p_workload_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_course_id uuid;
  v_term_no integer;
  v_cc public.lao_course_curricula%rowtype;
  v_existing_book uuid;
  v_result jsonb;
  v_book_id uuid;
  v_plan_count integer:=0;
  v_score_total numeric:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select wi.course_id,t.term_no
  into v_course_id,v_term_no
  from public.lao_teaching_workload_items wi
  join public.lao_teaching_workloads w on w.id=wi.workload_id
  join public.lao_terms t on t.id=w.term_id
  where wi.id=p_workload_item_id and w.school_id=p_school_id;

  if v_course_id is null then raise exception 'ไม่พบภาระงานสอนที่เลือก'; end if;

  select * into v_cc
  from public.lao_course_curricula
  where course_id=v_course_id and school_id=p_school_id and status='approved'
  limit 1;

  if not found then
    raise exception 'ต้องจัดทำหลักสูตรรายวิชา โครงสร้างรายวิชา และโครงสร้างคะแนนให้ได้รับอนุมัติก่อนเริ่มบันทึกคะแนน';
  end if;

  select count(*),coalesce(sum((a->>'max_score')::numeric),0)
  into v_plan_count,v_score_total
  from jsonb_array_elements(v_cc.assessment_plan) a
  where coalesce(a->>'term_no','') ~ '^[0-9]+$'
    and (a->>'term_no')::integer=v_term_no
    and coalesce(a->>'max_score','') ~ '^[0-9]+([.][0-9]+)?$';

  if v_plan_count=0 or abs(v_score_total-100)>0.01 then
    raise exception 'โครงสร้างคะแนนภาคเรียนที่ % ยังไม่พร้อมใช้งาน',v_term_no;
  end if;

  select b.id into v_existing_book
  from public.lao_assessment_books b
  where b.workload_item_id=p_workload_item_id
  limit 1;

  v_result:=public.lao_ensure_assessment_book_base_v01938(p_school_id,p_workload_item_id);
  v_book_id=nullif(v_result->>'id','')::uuid;

  if v_existing_book is null and v_book_id is not null then
    delete from public.lao_assessment_components
    where book_id=v_book_id;

    insert into public.lao_assessment_components(
      book_id,code,label,max_score,sort_order,
      source_plan_code,component_category,assessment_method,evidence,unit_no,
      outcome_codes,course_curriculum_revision,created_by,updated_by
    )
    select
      v_book_id,
      coalesce(nullif(btrim(a->>'code'),''),'score_'||row_number() over(order by ordinality)),
      btrim(a->>'label'),
      (a->>'max_score')::numeric,
      row_number() over(order by ordinality),
      nullif(btrim(a->>'code'),''),
      nullif(btrim(a->>'category'),''),
      nullif(btrim(a->>'method'),''),
      nullif(btrim(a->>'evidence'),''),
      case when coalesce(a->>'unit_no','') ~ '^[0-9]+$' then (a->>'unit_no')::integer else null end,
      coalesce(a->'outcome_codes','[]'::jsonb),
      v_cc.revision_no,
      v_uid,v_uid
    from jsonb_array_elements(v_cc.assessment_plan) with ordinality x(a,ordinality)
    where coalesce(a->>'term_no','') ~ '^[0-9]+$'
      and (a->>'term_no')::integer=v_term_no
    order by ordinality;

    update public.lao_assessment_books
    set course_curriculum_id=v_cc.id,
        course_curriculum_revision=v_cc.revision_no,
        updated_by=v_uid,
        updated_at=now()
    where id=v_book_id;
  end if;

  return v_result||jsonb_build_object(
    'course_curriculum_id',v_cc.id,
    'course_curriculum_revision',v_cc.revision_no
  );
end;
$function$;

revoke all on function public.lao_ensure_assessment_book_curriculum_v01938(uuid,uuid)
  from public,anon,authenticated;

create or replace function public.lao_assessment_component_outcomes(p_book_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_book public.lao_assessment_books%rowtype;
  v_own uuid;
  v_can_manage boolean:=false;
  v_can_approve boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_book
  from public.lao_assessment_books
  where id=p_book_id;

  if not found then raise exception 'ไม่พบสมุดวัดผล'; end if;
  if not public.lao_can_view_academic(v_book.school_id) then raise exception 'Access denied'; end if;

  v_own:=public.lao_my_personnel_id(v_book.school_id);
  v_can_manage:=public.lao_has_work_permission(v_book.school_id,'academics.assessment','edit');
  v_can_approve:=public.lao_has_work_permission(v_book.school_id,'academics.assessment','approve');

  if not (v_can_manage or v_can_approve or v_book.personnel_id=v_own) then
    raise exception 'Access denied';
  end if;

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'component_id',ac.id,
        'outcome_codes',ac.outcome_codes,
        'outcomes',coalesce((
          select jsonb_agg(jsonb_build_object(
            'code',o->>'code',
            'type',o->>'type',
            'description',o->>'description'
          ) order by o->>'code')
          from public.lao_course_curricula cc
          cross join lateral jsonb_array_elements(cc.outcomes) o
          where cc.id=v_book.course_curriculum_id
            and exists(
              select 1
              from jsonb_array_elements_text(ac.outcome_codes) oc
              where lower(btrim(oc.value))=lower(btrim(o->>'code'))
            )
        ),'[]'::jsonb)
      ) order by ac.sort_order)
      from public.lao_assessment_components ac
      where ac.book_id=p_book_id
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.lao_assessment_component_outcomes(uuid) from public,anon,authenticated;
grant execute on function public.lao_assessment_component_outcomes(uuid) to authenticated;

update public.lao_assessment_components ac
set outcome_codes=coalesce(x.outcome_codes,'[]'::jsonb)
from (
  select ac2.id component_id,a->'outcome_codes' outcome_codes
  from public.lao_assessment_components ac2
  join public.lao_assessment_books b on b.id=ac2.book_id
  join public.lao_course_curricula cc on cc.id=b.course_curriculum_id
  cross join lateral jsonb_array_elements(cc.assessment_plan) a
  where nullif(btrim(a->>'code'),'')=ac2.source_plan_code
) x
where ac.id=x.component_id
  and jsonb_array_length(ac.outcome_codes)=0
  and jsonb_typeof(coalesce(x.outcome_codes,'[]'::jsonb))='array';

notify pgrst, 'reload schema';

commit;

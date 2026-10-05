-- 0097_course_type_detail_and_standard_order.sql
-- Show subject classification consistently and make curriculum ordering automatic.
-- Ordering policy:
--   1) basic subjects follow the official central preset order when available,
--   2) additional subjects follow the standard learning-area/code order,
--   3) learner-development activities follow the standard activity order,
--   4) other items come last.
-- Manual sort_order edits are ignored by the trigger.

begin;

create or replace function public.lao_subject_learning_area_rank(
  p_subject_code text,
  p_learning_area text
)
returns integer
language sql
stable
security definer
set search_path=public
as $function$
  select case
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='ท'
      or lower(coalesce(p_learning_area,'')) like '%ภาษาไทย%' then 1
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='ค'
      or lower(coalesce(p_learning_area,'')) like '%คณิต%' then 2
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='ว'
      or lower(coalesce(p_learning_area,'')) like '%วิทยาศาสตร์%' then 3
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='ส'
      or lower(coalesce(p_learning_area,'')) like '%สังคม%' then 4
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='พ'
      or lower(coalesce(p_learning_area,'')) like '%สุขศึกษา%'
      or lower(coalesce(p_learning_area,'')) like '%พลศึกษา%' then 5
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='ศ'
      or lower(coalesce(p_learning_area,'')) like '%ศิลป%' then 6
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='ง'
      or lower(coalesce(p_learning_area,'')) like '%การงาน%'
      or lower(coalesce(p_learning_area,'')) like '%อาชีพ%' then 7
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='อ'
      or lower(coalesce(p_learning_area,'')) like '%ภาษาต่างประเทศ%'
      or lower(coalesce(p_learning_area,'')) like '%อังกฤษ%' then 8
    when left(coalesce(nullif(btrim(p_subject_code),''),''),1)='ก'
      or lower(coalesce(p_learning_area,'')) like '%กิจกรรมพัฒนาผู้เรียน%' then 9
    else 99
  end;
$function$;

revoke all on function public.lao_subject_learning_area_rank(text,text)
  from public,anon,authenticated;

create or replace function public.lao_course_standard_sort_order(
  p_grade_code text,
  p_subject_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_subject public.lao_subjects%rowtype;
  v_preset_order integer;
  v_area_rank integer;
  v_code_digits text;
  v_code_tail integer:=999;
  v_activity_rank integer:=90;
begin
  select * into v_subject
  from public.lao_subjects
  where id=p_subject_id;

  if v_subject.id is null then return 999999; end if;

  v_area_rank:=public.lao_subject_learning_area_rank(
    v_subject.subject_code,
    v_subject.learning_area
  );

  v_code_digits:=regexp_replace(coalesce(v_subject.subject_code,''),'[^0-9]','','g');
  if nullif(v_code_digits,'') is not null then
    begin
      v_code_tail:=right(v_code_digits,3)::integer;
    exception when others then
      v_code_tail:=999;
    end;
  end if;

  select min(p.sort_order)
  into v_preset_order
  from public.lao_curriculum_preset_items p
  where p.preset_code='core_2551_2560'
    and p.grade_code=p_grade_code
    and lower(coalesce(p.subject_code,''))=lower(coalesce(v_subject.subject_code,''))
    and (
      p.subject_type<>'activity'
      or lower(btrim(p.subject_name))=lower(btrim(v_subject.name_th))
    );

  if v_subject.subject_type='basic' then
    if v_preset_order is not null then
      return 100000 + v_preset_order*100 + least(v_code_tail,99);
    end if;
    return 150000 + least(v_area_rank,99)*1000 + least(v_code_tail,999);
  end if;

  if v_subject.subject_type='additional' then
    return 200000 + least(v_area_rank,99)*10000 + least(v_code_tail,999);
  end if;

  if v_subject.subject_type='activity' then
    if v_preset_order is not null and v_preset_order>=900 then
      return 300000 + (v_preset_order-900)*100 + mod(v_code_tail,100);
    end if;

    v_activity_rank:=case v_subject.subject_subtype
      when 'guidance' then 1
      when 'student_activity' then 2
      when 'scout' then 3
      when 'guide' then 4
      when 'red_cross_youth' then 5
      when 'club' then 6
      when 'social_public_benefit' then 7
      when 'school_additional_activity' then 8
      when 'other_activity' then 9
      else 50
    end;
    return 300000 + v_activity_rank*100 + mod(v_code_tail,100);
  end if;

  return 400000 + least(v_area_rank,99)*10000 + least(v_code_tail,999);
end;
$function$;

revoke all on function public.lao_course_standard_sort_order(text,uuid)
  from public,anon,authenticated;

create or replace function public.lao_apply_standard_course_order()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  new.sort_order:=public.lao_course_standard_sort_order(
    new.grade_code,
    new.subject_id
  );
  return new;
end;
$function$;

revoke all on function public.lao_apply_standard_course_order()
  from public,anon,authenticated;

drop trigger if exists lao_curriculum_courses_standard_order
on public.lao_curriculum_courses;

create trigger lao_curriculum_courses_standard_order
before insert or update of subject_id,grade_code,sort_order
on public.lao_curriculum_courses
for each row execute function public.lao_apply_standard_course_order();

create or replace function public.lao_refresh_course_order_from_subject()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  if new.subject_code is distinct from old.subject_code
     or new.name_th is distinct from old.name_th
     or new.learning_area is distinct from old.learning_area
     or new.subject_type is distinct from old.subject_type
     or new.subject_subtype is distinct from old.subject_subtype then
    update public.lao_curriculum_courses c
    set sort_order=c.sort_order,
        updated_at=now()
    where c.subject_id=new.id;
  end if;
  return new;
end;
$function$;

revoke all on function public.lao_refresh_course_order_from_subject()
  from public,anon,authenticated;

drop trigger if exists lao_subjects_refresh_course_standard_order
on public.lao_subjects;

create trigger lao_subjects_refresh_course_standard_order
after update of subject_code,name_th,learning_area,subject_type,subject_subtype
on public.lao_subjects
for each row execute function public.lao_refresh_course_order_from_subject();

-- Recompute all existing curriculum rows using the standard rule.
update public.lao_curriculum_courses
set sort_order=sort_order;

-- Enrich the academic payload with classification metadata used by the
-- curriculum cards/editor, without changing the older base function chain.
alter function public.lao_academic_structure(uuid,uuid)
  rename to lao_academic_structure_base_v01970_subject_detail;

revoke all on function public.lao_academic_structure_base_v01970_subject_detail(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_structure(
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
  v_subjects jsonb:='[]'::jsonb;
  v_courses jsonb:='[]'::jsonb;
begin
  v_base:=public.lao_academic_structure_base_v01970_subject_detail(
    p_school_id,p_academic_year_id
  );

  select coalesce(jsonb_agg(
    a.item || jsonb_build_object(
      'subject_subtype',s.subject_subtype,
      'source_kind',s.source_kind,
      'source_catalog_item_id',s.source_catalog_item_id,
      'source_shared_subject_id',s.source_shared_subject_id
    )
    order by a.ord
  ),'[]'::jsonb)
  into v_subjects
  from jsonb_array_elements(coalesce(v_base->'subjects','[]'::jsonb))
       with ordinality a(item,ord)
  left join public.lao_subjects s
    on s.id=nullif(a.item->>'id','')::uuid;

  select coalesce(jsonb_agg(
    a.item || jsonb_build_object(
      'subject_subtype',s.subject_subtype,
      'source_kind',s.source_kind,
      'standard_sort_order',c.sort_order
    )
    order by a.ord
  ),'[]'::jsonb)
  into v_courses
  from jsonb_array_elements(coalesce(v_base->'courses','[]'::jsonb))
       with ordinality a(item,ord)
  left join public.lao_curriculum_courses c
    on c.id=nullif(a.item->>'id','')::uuid
  left join public.lao_subjects s
    on s.id=c.subject_id;

  return jsonb_set(
    jsonb_set(v_base,'{subjects}',v_subjects,true),
    '{courses}',v_courses,true
  );
end;
$function$;

revoke all on function public.lao_academic_structure(uuid,uuid)
  from public,anon;
grant execute on function public.lao_academic_structure(uuid,uuid)
  to authenticated;

commit;

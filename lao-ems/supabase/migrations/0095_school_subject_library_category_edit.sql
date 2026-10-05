-- 0095_school_subject_library_category_edit.sql
-- Allow a school to correct/reclassify its own subject library without changing
-- central catalog data. Unused items are edited in place. Once a subject has
-- been used in any yearly curriculum, edits create a new active library version
-- so prior academic years keep their original classification.

begin;

-- Historical versions must be allowed to keep the same code after they are
-- superseded. Uniqueness therefore applies only to the active school-library row.
drop index if exists public.lao_subjects_school_code_nonactivity_uq;
drop index if exists public.lao_subjects_school_code_activity_name_uq;

create unique index if not exists lao_subjects_school_code_nonactivity_uq
  on public.lao_subjects(school_id,lower(subject_code))
  where is_active
    and subject_code is not null
    and btrim(subject_code)<>''
    and subject_type<>'activity';

create unique index if not exists lao_subjects_school_code_activity_name_uq
  on public.lao_subjects(school_id,lower(subject_code),lower(name_th))
  where is_active
    and subject_code is not null
    and btrim(subject_code)<>''
    and subject_type='activity';

create or replace function public.lao_update_school_subject_library(
  p_school_id uuid,
  p_subject_id uuid,
  p_subject_code text default null,
  p_name_th text default null,
  p_learning_area text default null,
  p_subject_type text default null,
  p_subject_subtype text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_old public.lao_subjects%rowtype;
  v_new_id uuid;
  v_used_count integer := 0;
  v_code text := upper(nullif(btrim(p_subject_code),''));
  v_name text := nullif(btrim(p_name_th),'');
  v_area text := nullif(btrim(p_learning_area),'');
  v_type text := nullif(btrim(p_subject_type),'');
  v_subtype text := nullif(btrim(p_subject_subtype),'');
  v_type_changed boolean := false;
  v_versioned boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select * into v_old
  from public.lao_subjects
  where id=p_subject_id and school_id=p_school_id;

  if v_old.id is null then raise exception 'ไม่พบรายการในคลังโรงเรียน'; end if;
  if not v_old.is_active then raise exception 'รายการนี้ไม่ใช่รุ่นที่ใช้งานอยู่ในคลังโรงเรียน'; end if;

  v_code:=coalesce(v_code,v_old.subject_code);
  v_name:=coalesce(v_name,v_old.name_th);
  v_area:=case when p_learning_area is null then v_old.learning_area else v_area end;
  v_type:=coalesce(v_type,v_old.subject_type);
  v_subtype:=case when p_subject_subtype is null then v_old.subject_subtype else v_subtype end;

  if v_name is null then raise exception 'กรุณาระบุชื่อรายวิชา/กิจกรรม'; end if;
  if v_type not in ('basic','additional','activity','other') then
    raise exception 'ประเภทรายการไม่ถูกต้อง';
  end if;

  -- Keep subtype choices meaningful for the selected curriculum component.
  if v_type='additional' and v_subtype is not null and v_subtype not in (
    'elective_free','career','language','program_specific','local',
    'special_focus','other_additional'
  ) then
    raise exception 'ประเภทย่อยไม่ตรงกับรายวิชาเพิ่มเติม';
  end if;

  if v_type='activity' and v_subtype is not null and v_subtype not in (
    'guidance','student_activity','scout','guide','red_cross_youth','club',
    'social_public_benefit','school_additional_activity','other_activity'
  ) then
    raise exception 'ประเภทย่อยไม่ตรงกับกิจกรรมพัฒนาผู้เรียน';
  end if;

  if v_type in ('basic','other') then
    v_subtype:=null;
  end if;

  -- Prevent accidental duplicates inside the school's active library.
  if v_code is not null then
    if v_type='activity' then
      if exists(
        select 1 from public.lao_subjects s
        where s.school_id=p_school_id and s.is_active and s.id<>p_subject_id
          and s.subject_type='activity'
          and lower(coalesce(s.subject_code,''))=lower(v_code)
          and lower(btrim(s.name_th))=lower(btrim(v_name))
      ) then
        raise exception 'รหัสและชื่อกิจกรรมนี้มีอยู่ในคลังโรงเรียนแล้ว';
      end if;
    else
      if exists(
        select 1 from public.lao_subjects s
        where s.school_id=p_school_id and s.is_active and s.id<>p_subject_id
          and s.subject_type<>'activity'
          and lower(coalesce(s.subject_code,''))=lower(v_code)
      ) then
        raise exception 'รหัส % มีอยู่ในคลังโรงเรียนแล้ว',v_code;
      end if;
    end if;
  end if;

  select count(*)::integer into v_used_count
  from public.lao_curriculum_courses c
  where c.school_id=p_school_id and c.subject_id=p_subject_id;

  v_type_changed:=v_old.subject_type is distinct from v_type
    or v_old.subject_subtype is distinct from v_subtype;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  if v_used_count=0 then
    update public.lao_subjects
    set subject_code=v_code,
        name_th=v_name,
        learning_area=v_area,
        subject_type=v_type,
        subject_subtype=v_subtype,
        updated_by=v_uid,
        updated_at=now()
    where id=p_subject_id
    returning id into v_new_id;

    insert into public.lao_audit_logs(
      organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
    ) values(
      v_org,p_school_id,v_uid,'school_subject_library_updated','subject',v_new_id::text,
      jsonb_build_object(
        'subject_code',v_old.subject_code,'name_th',v_old.name_th,
        'learning_area',v_old.learning_area,'subject_type',v_old.subject_type,
        'subject_subtype',v_old.subject_subtype
      ),
      jsonb_build_object(
        'subject_code',v_code,'name_th',v_name,
        'learning_area',v_area,'subject_type',v_type,
        'subject_subtype',v_subtype,'used_count',0,'versioned',false
      )
    );

    return jsonb_build_object(
      'subject_id',v_new_id,
      'previous_subject_id',null,
      'used_count',0,
      'versioned',false,
      'type_changed',v_type_changed,
      'applies_to','current_library'
    );
  end if;

  -- Used subjects are immutable historical references. Create a new active
  -- library version for future use and keep all existing courses on the old row.
  update public.lao_subjects
  set is_active=false,updated_by=v_uid,updated_at=now()
  where id=p_subject_id;

  insert into public.lao_subjects(
    school_id,subject_code,name_th,name_en,learning_area,subject_type,subject_subtype,
    is_active,sort_order,source_kind,source_catalog_item_id,source_shared_subject_id,
    curriculum_framework,aliases,created_by,updated_by
  ) values(
    p_school_id,v_code,v_name,v_old.name_en,v_area,v_type,v_subtype,
    true,v_old.sort_order,
    case when v_type_changed then 'school_local' else v_old.source_kind end,
    case when v_type_changed then null else v_old.source_catalog_item_id end,
    case when v_type_changed then null else v_old.source_shared_subject_id end,
    v_old.curriculum_framework,v_old.aliases,v_uid,v_uid
  )
  returning id into v_new_id;

  v_versioned:=true;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  ) values(
    v_org,p_school_id,v_uid,'school_subject_library_versioned','subject',v_new_id::text,
    jsonb_build_object(
      'previous_subject_id',p_subject_id,
      'subject_code',v_old.subject_code,'name_th',v_old.name_th,
      'learning_area',v_old.learning_area,'subject_type',v_old.subject_type,
      'subject_subtype',v_old.subject_subtype,'historical_usage_count',v_used_count
    ),
    jsonb_build_object(
      'subject_id',v_new_id,'subject_code',v_code,'name_th',v_name,
      'learning_area',v_area,'subject_type',v_type,'subject_subtype',v_subtype,
      'historical_usage_count',v_used_count,'versioned',true,
      'historical_courses_unchanged',true
    )
  );

  return jsonb_build_object(
    'subject_id',v_new_id,
    'previous_subject_id',p_subject_id,
    'used_count',v_used_count,
    'versioned',v_versioned,
    'type_changed',v_type_changed,
    'applies_to','future_use',
    'historical_courses_unchanged',true
  );
exception
  when unique_violation then
    raise exception 'รหัสหรือชื่อรายการซ้ำกับรายการที่ใช้งานอยู่ในคลังโรงเรียน';
end;
$function$;

revoke all on function public.lao_update_school_subject_library(uuid,uuid,text,text,text,text,text)
  from public,anon;
grant execute on function public.lao_update_school_subject_library(uuid,uuid,text,text,text,text,text)
  to authenticated;

commit;

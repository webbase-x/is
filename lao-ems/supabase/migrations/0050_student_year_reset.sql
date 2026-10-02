-- 0050_student_year_reset.sql
-- Safe school-scoped reset for student/LEC data in one academic year.
-- Keeps the academic year, terms, curriculum, programs, schedule settings and teaching structure.
-- Intended for trial/import mistakes; destructive execution requires local school-admin permission
-- plus an exact Thai confirmation phrase.

begin;

create or replace function public.lao_student_year_reset_preview(
  p_school_id uuid,
  p_year_be integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_year_id uuid;
  v_is_current boolean;
  v_confirmation text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can reset student-year data';
  end if;

  select ay.id,ay.is_current
  into v_year_id,v_is_current
  from public.lao_academic_years ay
  where ay.school_id=p_school_id and ay.year_be=p_year_be
  limit 1;

  if v_year_id is null then
    raise exception 'Academic year not found';
  end if;

  v_confirmation := 'ลบข้อมูลนักเรียนปี '||p_year_be::text;

  return jsonb_build_object(
    'school_id',p_school_id,
    'academic_year_id',v_year_id,
    'year_be',p_year_be,
    'is_current',coalesce(v_is_current,false),
    'confirmation_text',v_confirmation,
    'student_count',(
      select count(distinct e.student_id)
      from public.lao_student_term_enrollments e
      where e.school_id=p_school_id and e.academic_year_id=v_year_id
    ),
    'enrollment_count',(
      select count(*)
      from public.lao_student_term_enrollments e
      where e.school_id=p_school_id and e.academic_year_id=v_year_id
    ),
    'activity_enrollment_count',(
      select count(*)
      from public.lao_student_activity_enrollments e
      where e.school_id=p_school_id and e.academic_year_id=v_year_id
    ),
    'lec_batch_count',(
      select count(*)
      from public.lao_lec_import_batches b
      where b.school_id=p_school_id and b.academic_year_id=v_year_id
    ),
    'lec_row_count',(
      select count(*)
      from public.lao_lec_import_rows r
      join public.lao_lec_import_batches b on b.id=r.batch_id
      where b.school_id=p_school_id and b.academic_year_id=v_year_id
    ),
    'family_snapshot_count',(
      select count(*)
      from public.lao_student_family_snapshots x
      join public.lao_lec_import_batches b on b.id=x.batch_id
      where b.school_id=p_school_id and b.academic_year_id=v_year_id
    ),
    'address_snapshot_count',(
      select count(*)
      from public.lao_student_address_snapshots x
      join public.lao_lec_import_batches b on b.id=x.batch_id
      where b.school_id=p_school_id and b.academic_year_id=v_year_id
    ),
    'measurement_snapshot_count',(
      select count(*)
      from public.lao_student_measurement_snapshots x
      join public.lao_lec_import_batches b on b.id=x.batch_id
      where b.school_id=p_school_id and b.academic_year_id=v_year_id
    ),
    'benefit_snapshot_count',(
      select count(*)
      from public.lao_student_benefit_snapshots x
      join public.lao_lec_import_batches b on b.id=x.batch_id
      where b.school_id=p_school_id and b.academic_year_id=v_year_id
    ),
    'lec_class_count',(
      select count(*)
      from public.lao_class_sections cs
      where cs.school_id=p_school_id
        and cs.academic_year_id=v_year_id
        and cs.source_type='lec'
    ),
    'protected_lec_class_count',(
      select count(*)
      from public.lao_class_sections cs
      where cs.school_id=p_school_id
        and cs.academic_year_id=v_year_id
        and cs.source_type='lec'
        and exists(
          select 1
          from public.lao_teaching_workload_items wi
          where wi.class_section_id=cs.id
        )
    ),
    'school_records_to_remove',(
      with target_students as (
        select distinct e.student_id
        from public.lao_student_term_enrollments e
        where e.school_id=p_school_id and e.academic_year_id=v_year_id
      )
      select count(*)
      from public.lao_student_school_records sr
      join target_students ts on ts.student_id=sr.student_id
      where sr.school_id=p_school_id
        and not exists(
          select 1
          from public.lao_student_term_enrollments e2
          where e2.school_id=p_school_id
            and e2.student_id=sr.student_id
            and e2.academic_year_id<>v_year_id
        )
    ),
    'orphan_student_masters_estimate',(
      with target_students as (
        select distinct e.student_id
        from public.lao_student_term_enrollments e
        where e.school_id=p_school_id and e.academic_year_id=v_year_id
      )
      select count(*)
      from target_students ts
      where not exists(
        select 1
        from public.lao_student_term_enrollments e2
        where e2.student_id=ts.student_id
          and not (e2.school_id=p_school_id and e2.academic_year_id=v_year_id)
      )
      and not exists(
        select 1
        from public.lao_student_school_records sr2
        where sr2.student_id=ts.student_id
          and sr2.school_id<>p_school_id
      )
    ),
    'preserved',jsonb_build_object(
      'academic_year',true,
      'terms',true,
      'curriculum_courses',true,
      'subjects',true,
      'programs',true,
      'schedule_settings',true,
      'teaching_workloads',true
    )
  );
end;
$function$;

create or replace function public.lao_reset_student_year_data(
  p_school_id uuid,
  p_year_be integer,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_year_id uuid;
  v_org uuid;
  v_expected text;
  v_preview jsonb;
  v_student_ids uuid[] := '{}'::uuid[];
  v_activity_removed integer := 0;
  v_enrollments_removed integer := 0;
  v_classes_removed integer := 0;
  v_batches_removed integer := 0;
  v_school_records_removed integer := 0;
  v_student_masters_removed integer := 0;
  v_master_cleanup_skipped boolean := false;
  v_latest_batch_id uuid;
  v_latest_batch_at timestamptz;
  v_latest_file text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can reset student-year data';
  end if;

  select ay.id
  into v_year_id
  from public.lao_academic_years ay
  where ay.school_id=p_school_id and ay.year_be=p_year_be
  limit 1;

  if v_year_id is null then
    raise exception 'Academic year not found';
  end if;

  v_expected := 'ลบข้อมูลนักเรียนปี '||p_year_be::text;
  if coalesce(btrim(p_confirmation),'')<>v_expected then
    raise exception 'Confirmation text does not match';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_school_id::text),p_year_be);

  v_preview := public.lao_student_year_reset_preview(p_school_id,p_year_be);

  select coalesce(array_agg(distinct s.student_id),'{}'::uuid[])
  into v_student_ids
  from (
    select e.student_id
    from public.lao_student_term_enrollments e
    where e.school_id=p_school_id and e.academic_year_id=v_year_id
    union
    select r.student_id
    from public.lao_lec_import_rows r
    join public.lao_lec_import_batches b on b.id=r.batch_id
    where b.school_id=p_school_id
      and b.academic_year_id=v_year_id
      and r.student_id is not null
  ) s;

  delete from public.lao_student_activity_enrollments e
  where e.school_id=p_school_id and e.academic_year_id=v_year_id;
  get diagnostics v_activity_removed = row_count;

  delete from public.lao_student_term_enrollments e
  where e.school_id=p_school_id and e.academic_year_id=v_year_id;
  get diagnostics v_enrollments_removed = row_count;

  delete from public.lao_class_sections cs
  where cs.school_id=p_school_id
    and cs.academic_year_id=v_year_id
    and cs.source_type='lec'
    and not exists(
      select 1
      from public.lao_teaching_workload_items wi
      where wi.class_section_id=cs.id
    );
  get diagnostics v_classes_removed = row_count;

  delete from public.lao_lec_import_batches b
  where b.school_id=p_school_id and b.academic_year_id=v_year_id;
  get diagnostics v_batches_removed = row_count;

  if cardinality(v_student_ids)>0 then
    delete from public.lao_student_school_records sr
    where sr.school_id=p_school_id
      and sr.student_id=any(v_student_ids)
      and not exists(
        select 1
        from public.lao_student_term_enrollments e
        where e.school_id=p_school_id and e.student_id=sr.student_id
      );
    get diagnostics v_school_records_removed = row_count;

    update public.lao_student_school_records sr
    set
      first_seen_batch_id=(
        select b.id
        from public.lao_lec_import_rows r
        join public.lao_lec_import_batches b on b.id=r.batch_id
        where r.student_id=sr.student_id and b.school_id=p_school_id
        order by b.imported_at asc,b.id asc
        limit 1
      ),
      last_seen_batch_id=(
        select b.id
        from public.lao_lec_import_rows r
        join public.lao_lec_import_batches b on b.id=r.batch_id
        where r.student_id=sr.student_id and b.school_id=p_school_id
        order by b.imported_at desc,b.id desc
        limit 1
      ),
      lec_presence_status=coalesce((
        select e.lec_presence_status
        from public.lao_student_term_enrollments e
        join public.lao_academic_years ay on ay.id=e.academic_year_id
        join public.lao_terms t on t.id=e.term_id
        where e.school_id=p_school_id and e.student_id=sr.student_id
        order by ay.year_be desc,t.term_no desc,e.updated_at desc
        limit 1
      ),sr.lec_presence_status),
      updated_at=now()
    where sr.school_id=p_school_id
      and sr.student_id=any(v_student_ids);

    update public.lao_students st
    set
      lec_last_batch_id=(
        select b.id
        from public.lao_lec_import_rows r
        join public.lao_lec_import_batches b on b.id=r.batch_id
        where r.student_id=st.id
        order by b.imported_at desc,b.id desc
        limit 1
      ),
      lec_last_seen_at=coalesce((
        select b.imported_at
        from public.lao_lec_import_rows r
        join public.lao_lec_import_batches b on b.id=r.batch_id
        where r.student_id=st.id
        order by b.imported_at desc,b.id desc
        limit 1
      ),st.lec_last_seen_at),
      updated_at=now()
    where st.id=any(v_student_ids);

    begin
      delete from public.lao_students st
      where st.id=any(v_student_ids)
        and not exists(select 1 from public.lao_student_school_records sr where sr.student_id=st.id)
        and not exists(select 1 from public.lao_student_term_enrollments e where e.student_id=st.id)
        and not exists(select 1 from public.lao_student_activity_enrollments ae where ae.student_id=st.id)
        and not exists(select 1 from public.lao_lec_import_rows r where r.student_id=st.id);
      get diagnostics v_student_masters_removed = row_count;
    exception when foreign_key_violation then
      v_master_cleanup_skipped := true;
      v_student_masters_removed := 0;
    end;
  end if;

  select b.id,b.imported_at,b.source_file_name
  into v_latest_batch_id,v_latest_batch_at,v_latest_file
  from public.lao_lec_import_batches b
  where b.school_id=p_school_id and b.status='completed'
  order by b.imported_at desc,b.id desc
  limit 1;

  update public.lao_schools
  set lec_last_batch_id=v_latest_batch_id,
      lec_synced_at=v_latest_batch_at,
      lec_source_file_name=v_latest_file,
      updated_at=now()
  where id=p_school_id;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,context
  ) values(
    v_org,p_school_id,v_uid,
    'student_year_data_reset','academic_year',v_year_id::text,
    v_preview,
    jsonb_build_object(
      'year_be',p_year_be,
      'activity_enrollments_removed',v_activity_removed,
      'student_enrollments_removed',v_enrollments_removed,
      'lec_classes_removed',v_classes_removed,
      'lec_batches_removed',v_batches_removed,
      'school_records_removed',v_school_records_removed,
      'student_masters_removed',v_student_masters_removed,
      'master_cleanup_skipped',v_master_cleanup_skipped,
      'academic_structure_preserved',true
    ),
    jsonb_build_object('reason','trial_or_incorrect_student_data')
  );

  return jsonb_build_object(
    'ok',true,
    'year_be',p_year_be,
    'activity_enrollments_removed',v_activity_removed,
    'student_enrollments_removed',v_enrollments_removed,
    'lec_classes_removed',v_classes_removed,
    'lec_batches_removed',v_batches_removed,
    'school_records_removed',v_school_records_removed,
    'student_masters_removed',v_student_masters_removed,
    'master_cleanup_skipped',v_master_cleanup_skipped,
    'protected_lec_classes_preserved',
      greatest(0,coalesce((v_preview->>'protected_lec_class_count')::integer,0)),
    'preserved',v_preview->'preserved'
  );
end;
$function$;

revoke all on function public.lao_student_year_reset_preview(uuid,integer) from public,anon;
grant execute on function public.lao_student_year_reset_preview(uuid,integer) to authenticated;

revoke all on function public.lao_reset_student_year_data(uuid,integer,text) from public,anon;
grant execute on function public.lao_reset_student_year_data(uuid,integer,text) to authenticated;

commit;

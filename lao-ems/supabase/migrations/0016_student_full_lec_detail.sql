-- Expand student detail to expose all imported LEC data to authorized school staff.
-- Full citizen ID remains masked. Source raw_data is returned with citizen ID masked.

create or replace function public.lao_student_detail(
  p_school_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_can_view_student_directory(p_school_id) then
    raise exception 'Access denied';
  end if;

  with base as (
    select
      st.*,
      sr.student_no,
      sr.admission_date,
      sr.lec_student_condition,
      sr.lec_presence_status,
      sr.registry_status,
      sr.first_seen_at,
      sr.last_seen_at,
      sr.first_seen_batch_id,
      sr.last_seen_batch_id
    from public.lao_students st
    join public.lao_student_school_records sr
      on sr.student_id=st.id and sr.school_id=p_school_id
    where st.id=p_student_id
  ),
  latest_row as (
    select r.*
    from public.lao_lec_import_rows r
    join base b on b.id=r.student_id
    where r.batch_id=coalesce(b.last_seen_batch_id,r.batch_id)
    order by
      case when r.batch_id=b.last_seen_batch_id then 0 else 1 end,
      r.created_at desc,
      r.id desc
    limit 1
  ),
  latest_batch as (
    select ib.*
    from public.lao_lec_import_batches ib
    join latest_row lr on lr.batch_id=ib.id
    limit 1
  )
  select jsonb_build_object(
    'student_id',b.id,
    'student_no',b.student_no,
    'prefix',b.prefix,
    'first_name_th',b.first_name_th,
    'last_name_th',b.last_name_th,
    'full_name',concat_ws('',b.prefix,b.first_name_th,' ',b.last_name_th),
    'citizen_id_masked',case
      when b.citizen_id is null then null
      else repeat('•',greatest(length(b.citizen_id)-4,0))||right(b.citizen_id,4)
    end,
    'birth_date',b.birth_date,
    'race',b.race,
    'nationality',b.nationality,
    'religion',b.religion,
    'admission_date',b.admission_date,
    'student_condition',b.lec_student_condition,
    'presence_status',b.lec_presence_status,
    'registry_status',b.registry_status,
    'source','LEC',
    'first_seen_at',b.first_seen_at,
    'last_seen_at',b.last_seen_at,
    'enrollments',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'year_be',ay.year_be,
          'term_no',t.term_no,
          'grade_level',e.grade_level,
          'classroom',e.classroom,
          'presence_status',e.lec_presence_status,
          'source_row_no',e.source_row_no
        )
        order by ay.year_be desc,t.term_no desc
      )
      from public.lao_student_term_enrollments e
      join public.lao_academic_years ay on ay.id=e.academic_year_id
      join public.lao_terms t on t.id=e.term_id
      where e.school_id=p_school_id and e.student_id=b.id
    ),'[]'::jsonb),
    'family',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'relation_type',f.relation_type,
          'prefix',f.prefix,
          'first_name',f.first_name,
          'last_name',f.last_name,
          'full_name',concat_ws('',f.prefix,f.first_name,' ',f.last_name),
          'religion',f.religion,
          'occupation',f.occupation,
          'monthly_income',f.monthly_income,
          'phone',f.phone,
          'relationship_text',f.relationship_text,
          'source_row_no',f.source_row_no
        )
        order by case f.relation_type when 'father' then 1 when 'mother' then 2 when 'guardian' then 3 else 9 end
      )
      from public.lao_student_family_snapshots f
      where f.school_id=p_school_id
        and f.student_id=b.id
        and (b.last_seen_batch_id is null or f.batch_id=b.last_seen_batch_id)
    ),'[]'::jsonb),
    'addresses',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'address_type',a.address_type,
          'house_no',a.house_no,
          'moo',a.moo,
          'road',a.road,
          'subdistrict',a.subdistrict,
          'district',a.district,
          'province',a.province,
          'postal_code',a.postal_code,
          'source_row_no',a.source_row_no
        )
        order by case a.address_type when 'registered' then 1 when 'current' then 2 else 9 end
      )
      from public.lao_student_address_snapshots a
      where a.school_id=p_school_id
        and a.student_id=b.id
        and (b.last_seen_batch_id is null or a.batch_id=b.last_seen_batch_id)
    ),'[]'::jsonb),
    'measurement',(
      select jsonb_build_object(
        'height_cm',m.height_cm,
        'weight_kg',m.weight_kg,
        'source_row_no',m.source_row_no,
        'recorded_at',m.created_at
      )
      from public.lao_student_measurement_snapshots m
      where m.school_id=p_school_id
        and m.student_id=b.id
        and (b.last_seen_batch_id is null or m.batch_id=b.last_seen_batch_id)
      order by m.created_at desc,m.id desc
      limit 1
    ),
    'benefits',(
      select jsonb_build_object(
        'tuition_reimbursement',bf.tuition_reimbursement,
        'medical_reimbursement',bf.medical_reimbursement,
        'family_status',bf.family_status,
        'source_row_no',bf.source_row_no,
        'recorded_at',bf.created_at
      )
      from public.lao_student_benefit_snapshots bf
      where bf.school_id=p_school_id
        and bf.student_id=b.id
        and (b.last_seen_batch_id is null or bf.batch_id=b.last_seen_batch_id)
      order by bf.created_at desc,bf.id desc
      limit 1
    ),
    'source_import',(
      select jsonb_build_object(
        'batch_id',lb.id,
        'academic_year_be',lb.academic_year_be,
        'term_no',lb.term_no,
        'source_report_code',lb.source_report_code,
        'source_file_name',lb.source_file_name,
        'source_sheet_name',lb.source_sheet_name,
        'source_row_no',lr.source_row_no,
        'outcome',lr.outcome,
        'issue_message',lr.issue_message,
        'imported_at',lb.imported_at,
        'imported_row_count',lb.imported_row_count
      )
      from latest_row lr
      join latest_batch lb on lb.id=lr.batch_id
    ),
    'source_fields',(
      select case
        when lr.raw_data is null then '{}'::jsonb
        when lr.raw_data ? 'เลขประจำตัวประชาชน'
          then jsonb_set(
            lr.raw_data,
            '{เลขประจำตัวประชาชน}',
            to_jsonb(
              case
                when b.citizen_id is null then ''
                else repeat('•',greatest(length(b.citizen_id)-4,0))||right(b.citizen_id,4)
              end
            ),
            true
          )
        else lr.raw_data
      end
      from latest_row lr
    )
  )
  into v_result
  from base b;

  if v_result is null then raise exception 'Student not found'; end if;
  return v_result;
end;
$$;

revoke all on function public.lao_student_detail(uuid,uuid) from public, anon;
grant execute on function public.lao_student_detail(uuid,uuid) to authenticated;

-- LAO-EMS: import and verify school identity/details from the same LEC file.
-- A completed LEC import may not mix old official school data with a new mismatching LEC identity.

create table if not exists public.lao_lec_school_snapshots (
  id bigint generated always as identity primary key,
  batch_id uuid not null unique references public.lao_lec_import_batches(id) on delete cascade,
  school_id uuid not null references public.lao_schools(id) on delete restrict,
  school_code text,
  school_name_th text,
  phone text,
  email text,
  website_url text,
  address_text text,
  raw_metadata jsonb not null default '{}'::jsonb,
  diff_from_previous jsonb not null default '{}'::jsonb,
  resolution text not null
    check(resolution in ('first_import','matched','accepted_lec_update')),
  confirmed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lao_lec_school_snapshots_school_created_idx
  on public.lao_lec_school_snapshots(school_id,created_at desc);

alter table public.lao_lec_school_snapshots enable row level security;
grant select on public.lao_lec_school_snapshots to authenticated;

drop policy if exists "lao lec school snapshots admin read" on public.lao_lec_school_snapshots;
create policy "lao lec school snapshots admin read"
on public.lao_lec_school_snapshots
for select to authenticated
using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

create or replace function public.lao_lec_school_check(
  p_school_id uuid,
  p_metadata jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_s public.lao_schools;
  v_in_code text:=nullif(btrim(p_metadata->>'school_code'),'');
  v_in_name text:=nullif(btrim(p_metadata->>'school_name_th'),'');
  v_in_phone text:=nullif(btrim(p_metadata->>'school_phone'),'');
  v_in_email text:=nullif(btrim(p_metadata->>'school_email'),'');
  v_in_web text:=nullif(btrim(p_metadata->>'school_website_url'),'');
  v_in_address text:=nullif(btrim(p_metadata->>'school_address_text'),'');
  v_diff jsonb:='{}'::jsonb;
  v_first boolean;
  v_hard_block boolean:=false;
  v_requires_confirmation boolean:=false;
  v_status text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (public.lao_is_platform_admin() or public.lao_is_local_school_admin(p_school_id)) then
    raise exception 'Access denied';
  end if;

  select * into v_s from public.lao_schools where id=p_school_id;
  if not found then raise exception 'School not found'; end if;

  if v_in_code is null and v_in_name is null then
    return jsonb_build_object(
      'status','missing_school_identity',
      'can_import',false,
      'requires_confirmation',false,
      'hard_block',true,
      'message','ไม่พบรหัสหรือชื่อสถานศึกษาในไฟล์ LEC',
      'current',jsonb_build_object('school_code',v_s.code,'school_name_th',v_s.name_th),
      'incoming',jsonb_build_object('school_code',v_in_code,'school_name_th',v_in_name),
      'diff','{}'::jsonb
    );
  end if;

  v_first:=coalesce(v_s.source_system,'setup')<>'LEC' or v_s.lec_last_batch_id is null;

  if not v_first
     and v_s.code is not null and v_in_code is not null
     and regexp_replace(v_s.code,'\s','','g')<>regexp_replace(v_in_code,'\s','','g') then
    v_diff:=v_diff||jsonb_build_object('school_code',jsonb_build_object('current',v_s.code,'incoming',v_in_code));
    v_hard_block:=true;
  elsif v_in_code is not null and coalesce(v_s.code,'')<>v_in_code then
    v_diff:=v_diff||jsonb_build_object('school_code',jsonb_build_object('current',v_s.code,'incoming',v_in_code));
  end if;

  if v_in_name is not null
     and regexp_replace(lower(coalesce(v_s.name_th,'')),'\s+','','g')
         <>regexp_replace(lower(v_in_name),'\s+','','g') then
    v_diff:=v_diff||jsonb_build_object('school_name_th',jsonb_build_object('current',v_s.name_th,'incoming',v_in_name));
  end if;

  if v_in_phone is not null and coalesce(v_s.phone,'')<>v_in_phone then
    v_diff:=v_diff||jsonb_build_object('school_phone',jsonb_build_object('current',v_s.phone,'incoming',v_in_phone));
  end if;
  if v_in_email is not null and lower(coalesce(v_s.email,''))<>lower(v_in_email) then
    v_diff:=v_diff||jsonb_build_object('school_email',jsonb_build_object('current',v_s.email,'incoming',v_in_email));
  end if;
  if v_in_web is not null and coalesce(v_s.website_url,'')<>v_in_web then
    v_diff:=v_diff||jsonb_build_object('school_website_url',jsonb_build_object('current',v_s.website_url,'incoming',v_in_web));
  end if;
  if v_in_address is not null and regexp_replace(coalesce(v_s.address_text,''),'\s+',' ','g')
      <>regexp_replace(v_in_address,'\s+',' ','g') then
    v_diff:=v_diff||jsonb_build_object('school_address_text',jsonb_build_object('current',v_s.address_text,'incoming',v_in_address));
  end if;

  if v_hard_block then
    v_status:='school_code_mismatch';
  elsif v_first and v_diff<>'{}'::jsonb then
    v_status:='first_import_confirmation';
    v_requires_confirmation:=true;
  elsif v_first then
    v_status:='first_import';
  elsif v_diff<>'{}'::jsonb then
    v_status:='school_data_changed';
    v_requires_confirmation:=true;
  else
    v_status:='matched';
  end if;

  return jsonb_build_object(
    'status',v_status,
    'can_import',not v_hard_block,
    'requires_confirmation',v_requires_confirmation,
    'hard_block',v_hard_block,
    'is_first_import',v_first,
    'message',case
      when v_status='school_code_mismatch' then 'รหัสสถานศึกษาในไฟล์ LEC ไม่ตรงกับโรงเรียนที่ผูกไว้'
      when v_status='first_import_confirmation' then 'ข้อมูลสถานศึกษาในไฟล์ LEC ต่างจากข้อมูลพื้นที่ที่สร้างไว้ ต้องยืนยันก่อนผูก LEC ครั้งแรก'
      when v_status='first_import' then 'พร้อมผูกข้อมูลสถานศึกษาจาก LEC ครั้งแรก'
      when v_status='school_data_changed' then 'ข้อมูลสถานศึกษาใน LEC รอบใหม่มีการเปลี่ยนแปลง ต้องยืนยันใช้ข้อมูล LEC ใหม่'
      else 'ข้อมูลสถานศึกษาตรงกับ LEC ที่ผูกไว้'
    end,
    'current',jsonb_build_object(
      'school_code',v_s.code,'school_name_th',v_s.name_th,'school_phone',v_s.phone,
      'school_email',v_s.email,'school_website_url',v_s.website_url,'school_address_text',v_s.address_text
    ),
    'incoming',jsonb_build_object(
      'school_code',v_in_code,'school_name_th',v_in_name,'school_phone',v_in_phone,
      'school_email',v_in_email,'school_website_url',v_in_web,'school_address_text',v_in_address
    ),
    'diff',v_diff
  );
end;
$$;

revoke all on function public.lao_lec_school_check(uuid,jsonb) from public,anon;
grant execute on function public.lao_lec_school_check(uuid,jsonb) to authenticated;

create or replace function public.lao_import_lec_students(
  p_school_id uuid,
  p_academic_year_be integer,
  p_term_no smallint,
  p_file_name text,
  p_file_size bigint,
  p_file_sha256 text,
  p_sheet_name text,
  p_ignored_sheet_count integer,
  p_header_map jsonb,
  p_metadata jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
  v_year_id uuid; v_term_id uuid; v_batch_id uuid; v_prev uuid;
  v_row jsonb; c jsonb; v_raw jsonb; v_row_no integer;
  v_student_id uuid; v_school_record_id uuid; v_student_no text; v_citizen text; v_is_new boolean;
  v_new_count integer:=0; v_updated_count integer:=0; v_imported integer:=0; v_issues integer:=0; v_missing integer:=0;
  v_f jsonb; v_a jsonb;
  v_school_check jsonb;
  v_resolution text:=nullif(btrim(p_metadata->>'school_resolution'),'');
  v_school_resolution text;
  v_school_code text:=nullif(btrim(p_metadata->>'school_code'),'');
  v_school_name text:=nullif(btrim(p_metadata->>'school_name_th'),'');
  v_school_phone text:=nullif(btrim(p_metadata->>'school_phone'),'');
  v_school_email text:=nullif(btrim(p_metadata->>'school_email'),'');
  v_school_web text:=nullif(btrim(p_metadata->>'school_website_url'),'');
  v_school_address text:=nullif(btrim(p_metadata->>'school_address_text'),'');
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  if not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can import LEC data';
  end if;
  if p_academic_year_be not between 2400 and 2800 then raise exception 'Invalid academic year'; end if;
  if p_term_no not between 1 and 4 then raise exception 'Invalid term'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then
    raise exception 'No LEC rows found';
  end if;
  if jsonb_array_length(p_rows)>10000 then raise exception 'LEC file contains too many rows for one import'; end if;
  if p_file_sha256 is not null and exists(
    select 1 from public.lao_lec_import_batches
    where school_id=p_school_id and source_file_sha256=p_file_sha256 and status='completed'
  ) then
    raise exception 'This exact LEC file has already been imported';
  end if;

  v_school_check:=public.lao_lec_school_check(p_school_id,p_metadata);
  if coalesce((v_school_check->>'can_import')::boolean,false)=false then
    raise exception '%',coalesce(v_school_check->>'message','School identity mismatch');
  end if;
  if coalesce((v_school_check->>'requires_confirmation')::boolean,false)
     and v_resolution<>'accept_new_lec' then
    raise exception 'School data changed. Explicit confirmation to use the new LEC school data is required';
  end if;

  v_school_resolution:=case
    when coalesce((v_school_check->>'is_first_import')::boolean,false) then 'first_import'
    when v_school_check->>'status'='matched' then 'matched'
    else 'accepted_lec_update'
  end;

  insert into public.lao_academic_years(school_id,year_be,is_current)
  values(p_school_id,p_academic_year_be,false)
  on conflict(school_id,year_be) do update set year_be=excluded.year_be
  returning id into v_year_id;

  insert into public.lao_terms(academic_year_id,term_no,name,is_current)
  values(v_year_id,p_term_no,'ภาคเรียนที่ '||p_term_no,false)
  on conflict(academic_year_id,term_no) do update set term_no=excluded.term_no
  returning id into v_term_id;

  select id into v_prev
  from public.lao_lec_import_batches
  where school_id=p_school_id and status='completed'
  order by imported_at desc limit 1;

  insert into public.lao_lec_import_batches(
    school_id,academic_year_id,term_id,academic_year_be,term_no,
    source_file_name,source_file_size,source_file_sha256,source_sheet_name,
    ignored_sheet_count,header_map,source_metadata,previous_batch_id,
    source_row_count,imported_by
  )
  values(
    p_school_id,v_year_id,v_term_id,p_academic_year_be,p_term_no,
    p_file_name,p_file_size,p_file_sha256,p_sheet_name,
    greatest(coalesce(p_ignored_sheet_count,0),0),coalesce(p_header_map,'{}'::jsonb),
    coalesce(p_metadata,'{}'::jsonb)-'school_resolution',v_prev,jsonb_array_length(p_rows),v_uid
  )
  returning id into v_batch_id;

  update public.lao_student_term_enrollments
  set lec_presence_status='not_in_latest_lec'
  where school_id=p_school_id and term_id=v_term_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_row_no:=coalesce((v_row->>'source_row_no')::integer,0);
      v_raw:=coalesce(v_row->'raw','{}'::jsonb);
      c:=coalesce(v_row->'canonical','{}'::jsonb);
      v_student_no:=nullif(btrim(c->>'student_no'),'');
      v_citizen:=public.lao_normalize_lec_citizen_id(c->>'citizen_id');
      v_student_id:=null; v_school_record_id:=null; v_is_new:=false;

      if v_student_no is null then raise exception 'Missing student number'; end if;
      if nullif(btrim(c->>'first_name_th'),'') is null and nullif(btrim(c->>'last_name_th'),'') is null then
        raise exception 'Missing student name';
      end if;

      if v_citizen is not null then
        select id into v_student_id from public.lao_students where citizen_id=v_citizen;
      end if;
      if v_student_id is null then
        select ss.student_id into v_student_id
        from public.lao_student_school_records ss
        where ss.school_id=p_school_id and ss.student_no=v_student_no;
      end if;

      if v_student_id is null then
        insert into public.lao_students(
          citizen_id,prefix,first_name_th,last_name_th,birth_date,race,nationality,religion,
          lec_first_seen_at,lec_last_seen_at,lec_last_batch_id
        ) values(
          v_citizen,nullif(btrim(c->>'prefix'),''),
          nullif(btrim(c->>'first_name_th'),''),nullif(btrim(c->>'last_name_th'),''),
          public.lao_parse_lec_date(c->>'birth_date'),nullif(btrim(c->>'race'),''),
          nullif(btrim(c->>'nationality'),''),nullif(btrim(c->>'religion'),''),
          now(),now(),v_batch_id
        ) returning id into v_student_id;
        v_is_new:=true; v_new_count:=v_new_count+1;
      else
        update public.lao_students s set
          citizen_id=case when c ? 'citizen_id' and v_citizen is not null then v_citizen else s.citizen_id end,
          prefix=case when c ? 'prefix' then nullif(btrim(c->>'prefix'),'') else s.prefix end,
          first_name_th=case when c ? 'first_name_th' then nullif(btrim(c->>'first_name_th'),'') else s.first_name_th end,
          last_name_th=case when c ? 'last_name_th' then nullif(btrim(c->>'last_name_th'),'') else s.last_name_th end,
          birth_date=case when c ? 'birth_date' then public.lao_parse_lec_date(c->>'birth_date') else s.birth_date end,
          race=case when c ? 'race' then nullif(btrim(c->>'race'),'') else s.race end,
          nationality=case when c ? 'nationality' then nullif(btrim(c->>'nationality'),'') else s.nationality end,
          religion=case when c ? 'religion' then nullif(btrim(c->>'religion'),'') else s.religion end,
          lec_last_seen_at=now(),lec_last_batch_id=v_batch_id
        where s.id=v_student_id;
        v_updated_count:=v_updated_count+1;
      end if;

      select id into v_school_record_id
      from public.lao_student_school_records
      where school_id=p_school_id and student_id=v_student_id;

      if v_school_record_id is null then
        insert into public.lao_student_school_records(
          student_id,school_id,student_no,admission_date,lec_student_condition,
          lec_presence_status,first_seen_batch_id,last_seen_batch_id,first_seen_at,last_seen_at
        ) values(
          v_student_id,p_school_id,v_student_no,public.lao_parse_lec_date(c->>'admission_date'),
          nullif(btrim(c->>'student_condition'),''),'present',v_batch_id,v_batch_id,now(),now()
        ) returning id into v_school_record_id;
      else
        update public.lao_student_school_records set
          student_no=v_student_no,
          admission_date=case when c ? 'admission_date' then public.lao_parse_lec_date(c->>'admission_date') else admission_date end,
          lec_student_condition=case when c ? 'student_condition' then nullif(btrim(c->>'student_condition'),'') else lec_student_condition end,
          lec_presence_status='present',last_seen_batch_id=v_batch_id,last_seen_at=now()
        where id=v_school_record_id;
      end if;

      insert into public.lao_student_term_enrollments(
        student_id,school_id,academic_year_id,term_id,grade_level,classroom,
        lec_presence_status,source_batch_id,source_row_no
      ) values(
        v_student_id,p_school_id,v_year_id,v_term_id,
        nullif(btrim(c->>'grade_level'),''),nullif(btrim(c->>'classroom'),''),
        'present',v_batch_id,v_row_no
      )
      on conflict(student_id,school_id,term_id) do update set
        academic_year_id=excluded.academic_year_id,
        grade_level=excluded.grade_level,
        classroom=excluded.classroom,
        lec_presence_status='present',
        source_batch_id=excluded.source_batch_id,
        source_row_no=excluded.source_row_no,
        updated_at=now();

      v_f:=c->'father';
      if v_f is not null and jsonb_typeof(v_f)='object' and v_f<>'{}'::jsonb then
        insert into public.lao_student_family_snapshots(
          student_id,school_id,batch_id,source_row_no,relation_type,prefix,first_name,last_name,
          religion,occupation,monthly_income,phone,relationship_text
        ) values(
          v_student_id,p_school_id,v_batch_id,v_row_no,'father',
          nullif(btrim(v_f->>'prefix'),''),nullif(btrim(v_f->>'first_name'),''),
          nullif(btrim(v_f->>'last_name'),''),nullif(btrim(v_f->>'religion'),''),
          nullif(btrim(v_f->>'occupation'),''),public.lao_lec_numeric(v_f->>'monthly_income'),
          nullif(btrim(v_f->>'phone'),''),null
        );
      end if;

      v_f:=c->'mother';
      if v_f is not null and jsonb_typeof(v_f)='object' and v_f<>'{}'::jsonb then
        insert into public.lao_student_family_snapshots(
          student_id,school_id,batch_id,source_row_no,relation_type,prefix,first_name,last_name,
          religion,occupation,monthly_income,phone,relationship_text
        ) values(
          v_student_id,p_school_id,v_batch_id,v_row_no,'mother',
          nullif(btrim(v_f->>'prefix'),''),nullif(btrim(v_f->>'first_name'),''),
          nullif(btrim(v_f->>'last_name'),''),nullif(btrim(v_f->>'religion'),''),
          nullif(btrim(v_f->>'occupation'),''),public.lao_lec_numeric(v_f->>'monthly_income'),
          nullif(btrim(v_f->>'phone'),''),null
        );
      end if;

      v_f:=c->'guardian';
      if v_f is not null and jsonb_typeof(v_f)='object' and v_f<>'{}'::jsonb then
        insert into public.lao_student_family_snapshots(
          student_id,school_id,batch_id,source_row_no,relation_type,prefix,first_name,last_name,
          religion,occupation,monthly_income,phone,relationship_text
        ) values(
          v_student_id,p_school_id,v_batch_id,v_row_no,'guardian',
          nullif(btrim(v_f->>'prefix'),''),nullif(btrim(v_f->>'first_name'),''),
          nullif(btrim(v_f->>'last_name'),''),nullif(btrim(v_f->>'religion'),''),
          nullif(btrim(v_f->>'occupation'),''),public.lao_lec_numeric(v_f->>'monthly_income'),
          nullif(btrim(v_f->>'phone'),''),nullif(btrim(v_f->>'relationship'),'')
        );
      end if;

      v_a:=c->'registered_address';
      if v_a is not null and jsonb_typeof(v_a)='object' and v_a<>'{}'::jsonb then
        insert into public.lao_student_address_snapshots(
          student_id,school_id,batch_id,source_row_no,address_type,house_no,moo,road,subdistrict,district,province,postal_code
        ) values(
          v_student_id,p_school_id,v_batch_id,v_row_no,'registered',
          nullif(btrim(v_a->>'house_no'),''),nullif(btrim(v_a->>'moo'),''),
          nullif(btrim(v_a->>'road'),''),nullif(btrim(v_a->>'subdistrict'),''),
          nullif(btrim(v_a->>'district'),''),nullif(btrim(v_a->>'province'),''),
          nullif(btrim(v_a->>'postal_code'),'')
        );
      end if;

      v_a:=c->'current_address';
      if v_a is not null and jsonb_typeof(v_a)='object' and v_a<>'{}'::jsonb then
        insert into public.lao_student_address_snapshots(
          student_id,school_id,batch_id,source_row_no,address_type,house_no,moo,road,subdistrict,district,province,postal_code
        ) values(
          v_student_id,p_school_id,v_batch_id,v_row_no,'current',
          nullif(btrim(v_a->>'house_no'),''),nullif(btrim(v_a->>'moo'),''),
          nullif(btrim(v_a->>'road'),''),nullif(btrim(v_a->>'subdistrict'),''),
          nullif(btrim(v_a->>'district'),''),nullif(btrim(v_a->>'province'),''),
          nullif(btrim(v_a->>'postal_code'),'')
        );
      end if;

      if c ? 'height_cm' or c ? 'weight_kg' then
        insert into public.lao_student_measurement_snapshots(
          student_id,school_id,batch_id,source_row_no,height_cm,weight_kg
        ) values(
          v_student_id,p_school_id,v_batch_id,v_row_no,
          public.lao_lec_numeric(c->>'height_cm'),public.lao_lec_numeric(c->>'weight_kg')
        );
      end if;

      if c ? 'tuition_reimbursement' or c ? 'medical_reimbursement' or c ? 'family_status' then
        insert into public.lao_student_benefit_snapshots(
          student_id,school_id,batch_id,source_row_no,tuition_reimbursement,medical_reimbursement,family_status
        ) values(
          v_student_id,p_school_id,v_batch_id,v_row_no,
          nullif(btrim(c->>'tuition_reimbursement'),''),
          nullif(btrim(c->>'medical_reimbursement'),''),
          nullif(btrim(c->>'family_status'),'')
        );
      end if;

      insert into public.lao_lec_import_rows(
        batch_id,source_row_no,raw_data,canonical_data,student_id,outcome
      ) values(
        v_batch_id,v_row_no,v_raw,c,v_student_id,case when v_is_new then 'new' else 'updated' end
      );
      v_imported:=v_imported+1;

    exception when others then
      v_issues:=v_issues+1;
      insert into public.lao_lec_import_rows(
        batch_id,source_row_no,raw_data,canonical_data,outcome,issue_message
      ) values(
        v_batch_id,coalesce(v_row_no,0),coalesce(v_raw,'{}'::jsonb),coalesce(c,'{}'::jsonb),'error',sqlerrm
      )
      on conflict(batch_id,source_row_no) do update set
        outcome='error',issue_message=excluded.issue_message,
        raw_data=excluded.raw_data,canonical_data=excluded.canonical_data;
    end;
  end loop;

  update public.lao_student_school_records ss
  set lec_presence_status='not_in_latest_lec'
  where ss.school_id=p_school_id
    and not exists(
      select 1 from public.lao_lec_import_rows ir
      where ir.batch_id=v_batch_id and ir.student_id=ss.student_id and ir.outcome in ('new','updated')
    );

  select count(*) into v_missing
  from public.lao_student_school_records
  where school_id=p_school_id and lec_presence_status='not_in_latest_lec';

  update public.lao_lec_import_batches set
    status='completed',
    imported_row_count=v_imported,
    new_student_count=v_new_count,
    updated_student_count=v_updated_count,
    missing_from_latest_count=v_missing,
    issue_count=v_issues,
    completed_at=now()
  where id=v_batch_id;

  update public.lao_schools s set
    source_system='LEC',
    lec_synced_at=now(),
    lec_last_batch_id=v_batch_id,
    lec_source_file_name=p_file_name,
    code=coalesce(v_school_code,s.code),
    name_th=coalesce(v_school_name,s.name_th),
    phone=coalesce(v_school_phone,s.phone),
    email=coalesce(v_school_email,s.email),
    website_url=coalesce(v_school_web,s.website_url),
    address_text=coalesce(v_school_address,s.address_text)
  where s.id=p_school_id;

  insert into public.lao_lec_school_snapshots(
    batch_id,school_id,school_code,school_name_th,phone,email,website_url,address_text,
    raw_metadata,diff_from_previous,resolution,confirmed_by
  ) values(
    v_batch_id,p_school_id,v_school_code,v_school_name,v_school_phone,v_school_email,v_school_web,v_school_address,
    coalesce(p_metadata,'{}'::jsonb)-'school_resolution',
    coalesce(v_school_check->'diff','{}'::jsonb),
    v_school_resolution,
    case when v_school_resolution='accepted_lec_update' then v_uid else null end
  );

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data,context
  )
  select s.organization_id,p_school_id,v_uid,'lec_import_completed','lec_import',v_batch_id::text,
    jsonb_build_object(
      'academic_year_be',p_academic_year_be,'term_no',p_term_no,
      'rows',v_imported,'new_students',v_new_count,'updated_students',v_updated_count,
      'missing_from_latest',v_missing,'issues',v_issues,
      'school_resolution',v_school_resolution
    ),
    jsonb_build_object(
      'source_file_name',p_file_name,'source_file_sha256',p_file_sha256,
      'source_sheet_name',p_sheet_name,'school_diff',coalesce(v_school_check->'diff','{}'::jsonb)
    )
  from public.lao_schools s where s.id=p_school_id;

  return jsonb_build_object(
    'batch_id',v_batch_id,
    'imported_rows',v_imported,
    'new_students',v_new_count,
    'updated_students',v_updated_count,
    'missing_from_latest',v_missing,
    'issues',v_issues,
    'school_resolution',v_school_resolution
  );
end;
$$;

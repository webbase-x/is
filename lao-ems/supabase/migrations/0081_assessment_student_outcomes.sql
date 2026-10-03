-- 0081_assessment_student_outcomes.sql
-- Optional per-course observations used with ปพ.6: reading/thinking/writing,
-- desirable characteristics, and teacher comment.

begin;

create table if not exists public.lao_assessment_student_outcomes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.lao_assessment_books(id) on delete cascade,
  student_id uuid not null references public.lao_students(id) on delete restrict,
  reading_level text check(reading_level is null or reading_level in ('excellent','good','pass','fail')),
  attribute_level text check(attribute_level is null or attribute_level in ('excellent','good','pass','fail')),
  teacher_comment text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id,student_id)
);

create index if not exists lao_assessment_outcomes_book_idx
  on public.lao_assessment_student_outcomes(book_id,student_id);

drop trigger if exists lao_assessment_outcomes_touch on public.lao_assessment_student_outcomes;
create trigger lao_assessment_outcomes_touch
before update on public.lao_assessment_student_outcomes
for each row execute function public.lao_touch_updated_at();

alter table public.lao_assessment_student_outcomes enable row level security;
revoke all on public.lao_assessment_student_outcomes from public,anon,authenticated;

create or replace function public.lao_assessment_outcomes_page(p_book_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_book public.lao_assessment_books;
  v_own uuid;
  v_manage boolean;
  v_approve boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_book
  from public.lao_assessment_books
  where id=p_book_id;
  if not found then raise exception 'ไม่พบสมุดวัดผล'; end if;

  v_own:=public.lao_my_personnel_id(v_book.school_id);
  v_manage:=public.lao_has_work_permission(v_book.school_id,'academics.assessment','edit');
  v_approve:=public.lao_has_work_permission(v_book.school_id,'academics.assessment','approve');

  if not (v_manage or v_approve or v_book.personnel_id=v_own) then
    raise exception 'Access denied';
  end if;

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id',o.student_id,
        'reading_level',o.reading_level,
        'attribute_level',o.attribute_level,
        'teacher_comment',o.teacher_comment
      ) order by o.student_id)
      from public.lao_assessment_student_outcomes o
      where o.book_id=p_book_id
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.lao_assessment_outcomes_page(uuid) from public,anon;
grant execute on function public.lao_assessment_outcomes_page(uuid) to authenticated;

create or replace function public.lao_save_assessment_outcomes(
  p_book_id uuid,
  p_outcomes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_book public.lao_assessment_books;
  v_own uuid;
  v_manage boolean;
  v_row jsonb;
  v_student uuid;
  v_reading text;
  v_attribute text;
  v_comment text;
  v_saved integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_book
  from public.lao_assessment_books
  where id=p_book_id
  for update;
  if not found then raise exception 'ไม่พบสมุดวัดผล'; end if;

  v_own:=public.lao_my_personnel_id(v_book.school_id);
  v_manage:=public.lao_has_work_permission(v_book.school_id,'academics.assessment','edit');

  if not v_manage and v_book.personnel_id is distinct from v_own then
    raise exception 'Access denied';
  end if;
  if v_book.status not in ('draft','returned') then
    raise exception 'รายการที่ส่งตรวจหรืออนุมัติแล้วไม่สามารถแก้การประเมินประกอบได้';
  end if;
  if jsonb_typeof(coalesce(p_outcomes,'[]'::jsonb))<>'array' then
    raise exception 'ข้อมูลการประเมินประกอบไม่ถูกต้อง';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_outcomes,'[]'::jsonb))
  loop
    v_student:=nullif(v_row->>'student_id','')::uuid;
    v_reading:=nullif(v_row->>'reading_level','');
    v_attribute:=nullif(v_row->>'attribute_level','');
    v_comment:=nullif(btrim(coalesce(v_row->>'teacher_comment','')),'');

    if v_student is null then raise exception 'ข้อมูลนักเรียนไม่ครบ'; end if;
    if v_reading is not null and v_reading not in ('excellent','good','pass','fail') then
      raise exception 'ระดับอ่าน คิดวิเคราะห์ และเขียนไม่ถูกต้อง';
    end if;
    if v_attribute is not null and v_attribute not in ('excellent','good','pass','fail') then
      raise exception 'ระดับคุณลักษณะอันพึงประสงค์ไม่ถูกต้อง';
    end if;

    if not exists(
      select 1
      from public.lao_class_sections cs
      join public.lao_student_term_enrollments e
        on e.school_id=v_book.school_id
       and e.academic_year_id=v_book.academic_year_id
       and e.term_id=v_book.term_id
       and e.grade_level=cs.grade_label
       and e.classroom=cs.section_label
       and e.student_id=v_student
       and e.lec_presence_status='present'
      where cs.id=v_book.class_section_id
    ) then
      raise exception 'นักเรียนไม่อยู่ในห้องเรียนของรายการนี้';
    end if;

    if v_reading is null and v_attribute is null and v_comment is null then
      delete from public.lao_assessment_student_outcomes
      where book_id=v_book.id and student_id=v_student;
    else
      insert into public.lao_assessment_student_outcomes(
        book_id,student_id,reading_level,attribute_level,teacher_comment,updated_by
      ) values(
        v_book.id,v_student,v_reading,v_attribute,v_comment,v_uid
      )
      on conflict(book_id,student_id) do update set
        reading_level=excluded.reading_level,
        attribute_level=excluded.attribute_level,
        teacher_comment=excluded.teacher_comment,
        updated_by=v_uid,
        updated_at=now();
      v_saved:=v_saved+1;
    end if;
  end loop;

  return jsonb_build_object('book_id',v_book.id,'saved',v_saved);
end;
$function$;

revoke all on function public.lao_save_assessment_outcomes(uuid,jsonb) from public,anon;
grant execute on function public.lao_save_assessment_outcomes(uuid,jsonb) to authenticated;

commit;

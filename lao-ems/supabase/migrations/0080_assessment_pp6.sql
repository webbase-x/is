-- 0080_assessment_pp6.sql
-- Integrated assessment / ปพ.6 workflow driven by approved teaching workload.

begin;

insert into public.lao_work_scopes(
  scope_code,department_code,work_code,section_code,title_th,parent_scope_code,route,sort_order,is_active
) values(
  'academics.assessment','academics','assessment',null,'วัดผลและ ปพ.','academics','#/assessment',160,true
)
on conflict(scope_code) do update set
  department_code=excluded.department_code,
  work_code=excluded.work_code,
  section_code=excluded.section_code,
  title_th=excluded.title_th,
  parent_scope_code=excluded.parent_scope_code,
  route=excluded.route,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active,
  updated_at=now();

create table if not exists public.lao_assessment_books (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  term_id uuid not null references public.lao_terms(id) on delete cascade,
  workload_item_id uuid not null references public.lao_teaching_workload_items(id) on delete restrict,
  course_id uuid not null references public.lao_curriculum_courses(id) on delete restrict,
  class_section_id uuid not null references public.lao_class_sections(id) on delete restrict,
  personnel_id uuid not null references public.lao_personnel(id) on delete restrict,
  grading_type text not null default 'grade8'
    check(grading_type in ('grade8','pass_fail')),
  status text not null default 'draft'
    check(status in ('draft','submitted','approved','returned','cancelled')),
  note text,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workload_item_id)
);

create unique index if not exists lao_assessment_books_assignment_uq
  on public.lao_assessment_books(term_id,course_id,class_section_id,personnel_id)
  where status<>'cancelled';

create index if not exists lao_assessment_books_school_term_idx
  on public.lao_assessment_books(school_id,term_id,status,personnel_id);

drop trigger if exists lao_assessment_books_touch on public.lao_assessment_books;
create trigger lao_assessment_books_touch
before update on public.lao_assessment_books
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_assessment_components (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.lao_assessment_books(id) on delete cascade,
  code text,
  label text not null,
  max_score numeric(7,2) not null check(max_score>0 and max_score<=100),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id,sort_order)
);

create index if not exists lao_assessment_components_book_idx
  on public.lao_assessment_components(book_id,sort_order);

drop trigger if exists lao_assessment_components_touch on public.lao_assessment_components;
create trigger lao_assessment_components_touch
before update on public.lao_assessment_components
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_assessment_scores (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.lao_assessment_books(id) on delete cascade,
  component_id uuid not null references public.lao_assessment_components(id) on delete cascade,
  student_id uuid not null references public.lao_students(id) on delete restrict,
  score numeric(7,2),
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id,component_id,student_id)
);

create index if not exists lao_assessment_scores_book_student_idx
  on public.lao_assessment_scores(book_id,student_id);

drop trigger if exists lao_assessment_scores_touch on public.lao_assessment_scores;
create trigger lao_assessment_scores_touch
before update on public.lao_assessment_scores
for each row execute function public.lao_touch_updated_at();

alter table public.lao_assessment_books enable row level security;
alter table public.lao_assessment_components enable row level security;
alter table public.lao_assessment_scores enable row level security;

revoke all on public.lao_assessment_books from public,anon,authenticated;
revoke all on public.lao_assessment_components from public,anon,authenticated;
revoke all on public.lao_assessment_scores from public,anon,authenticated;

create or replace function public.lao_ensure_assessment_book(
  p_school_id uuid,
  p_workload_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_own uuid;
  v_manage boolean;
  v_workload public.lao_teaching_workloads;
  v_item public.lao_teaching_workload_items;
  v_subject_type text;
  v_book public.lao_assessment_books;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_own:=public.lao_my_personnel_id(p_school_id);
  v_manage:=public.lao_has_work_permission(p_school_id,'academics.assessment','edit')
    or public.lao_has_work_permission(p_school_id,'academics.assessment','approve');

  select i.* into v_item
  from public.lao_teaching_workload_items i
  join public.lao_teaching_workloads w on w.id=i.workload_id
  where i.id=p_workload_item_id and w.school_id=p_school_id;
  if not found then raise exception 'ไม่พบภาระงานสอนที่เลือก'; end if;

  select * into v_workload
  from public.lao_teaching_workloads
  where id=v_item.workload_id and school_id=p_school_id;
  if not found or v_workload.status<>'approved' then
    raise exception 'ต้องอนุมัติภาระงานสอนก่อนจึงจะเปิดงานวัดผลได้';
  end if;

  if not v_manage and v_workload.personnel_id is distinct from v_own then
    raise exception 'Access denied';
  end if;

  select s.subject_type into v_subject_type
  from public.lao_curriculum_courses c
  join public.lao_subjects s on s.id=c.subject_id
  where c.id=v_item.course_id and c.school_id=p_school_id;

  select * into v_book
  from public.lao_assessment_books
  where workload_item_id=p_workload_item_id
  limit 1;

  if v_book.id is null then
    insert into public.lao_assessment_books(
      school_id,academic_year_id,term_id,workload_item_id,course_id,class_section_id,
      personnel_id,grading_type,status,created_by,updated_by
    ) values(
      p_school_id,v_workload.academic_year_id,v_workload.term_id,p_workload_item_id,
      v_item.course_id,v_item.class_section_id,v_workload.personnel_id,
      case when v_subject_type='activity' then 'pass_fail' else 'grade8' end,
      'draft',v_uid,v_uid
    ) returning * into v_book;

    if v_book.grading_type='pass_fail' then
      insert into public.lao_assessment_components(
        book_id,code,label,max_score,sort_order,created_by,updated_by
      ) values(v_book.id,'activity','ผลการประเมิน',100,1,v_uid,v_uid);
    else
      insert into public.lao_assessment_components(
        book_id,code,label,max_score,sort_order,created_by,updated_by
      ) values
        (v_book.id,'coursework','ระหว่างเรียน',70,1,v_uid,v_uid),
        (v_book.id,'final','ปลายภาค',30,2,v_uid,v_uid);
    end if;
  end if;

  return jsonb_build_object('id',v_book.id,'status',v_book.status);
end;
$function$;

revoke all on function public.lao_ensure_assessment_book(uuid,uuid) from public,anon;
grant execute on function public.lao_ensure_assessment_book(uuid,uuid) to authenticated;

create or replace function public.lao_assessment_page(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_term_id uuid default null,
  p_book_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_year_id uuid;
  v_term_id uuid;
  v_own uuid;
  v_manage boolean;
  v_approve boolean;
  v_book public.lao_assessment_books;
  v_years jsonb:='[]'::jsonb;
  v_items jsonb:='[]'::jsonb;
  v_components jsonb:='[]'::jsonb;
  v_students jsonb:='[]'::jsonb;
  v_book_json jsonb:=null;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_own:=public.lao_my_personnel_id(p_school_id);
  v_manage:=public.lao_has_work_permission(p_school_id,'academics.assessment','edit');
  v_approve:=public.lao_has_work_permission(p_school_id,'academics.assessment','approve');

  select ay.id into v_year_id
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
    and (p_academic_year_id is null or ay.id=p_academic_year_id)
  order by
    case when p_academic_year_id is not null and ay.id=p_academic_year_id then 0 else 1 end,
    ay.is_current desc,ay.year_be desc
  limit 1;

  if v_year_id is not null then
    select t.id into v_term_id
    from public.lao_terms t
    where t.academic_year_id=v_year_id
      and (p_term_id is null or t.id=p_term_id)
    order by
      case when p_term_id is not null and t.id=p_term_id then 0 else 1 end,
      t.is_current desc,t.term_no asc
    limit 1;
  end if;

  select coalesce(jsonb_agg(y.payload),'[]'::jsonb)
  into v_years
  from (
    select jsonb_build_object(
      'id',ay.id,
      'year_be',ay.year_be,
      'is_current',ay.is_current,
      'terms',coalesce((
        select jsonb_agg(z.payload)
        from (
          select jsonb_build_object(
            'id',t.id,
            'term_no',t.term_no,
            'name',coalesce(t.name,'ภาคเรียนที่ '||t.term_no),
            'is_current',t.is_current
          ) as payload
          from public.lao_terms t
          where t.academic_year_id=ay.id
          order by t.term_no
        ) z
      ),'[]'::jsonb)
    ) as payload
    from public.lao_academic_years ay
    where ay.school_id=p_school_id
    order by ay.year_be desc
  ) y;

  if v_term_id is not null then
    select coalesce(jsonb_agg(x.payload),'[]'::jsonb)
    into v_items
    from (
      select jsonb_build_object(
        'workload_item_id',i.id,
        'workload_id',w.id,
        'personnel_id',w.personnel_id,
        'personnel_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
        'course_id',i.course_id,
        'class_section_id',i.class_section_id,
        'subject_code',s.subject_code,
        'subject_name',s.name_th,
        'subject_type',s.subject_type,
        'grade_label',cs.grade_label,
        'class_label',cs.section_label,
        'class_short',case
          when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
          when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
          when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
          else cs.grade_label||'/'||cs.section_label
        end,
        'program_code',ap.code,
        'program_name',ap.name_th,
        'book_id',b.id,
        'status',coalesce(b.status,'not_started'),
        'review_note',b.review_note,
        'updated_at',b.updated_at,
        'student_count',(
          select count(*)
          from public.lao_student_term_enrollments e
          where e.school_id=p_school_id
            and e.academic_year_id=v_year_id
            and e.term_id=v_term_id
            and e.grade_level=cs.grade_label
            and e.classroom=cs.section_label
            and e.lec_presence_status='present'
        ),
        'completed_student_count',case
          when b.id is null then 0
          else (
            select count(*)
            from public.lao_student_term_enrollments e
            where e.school_id=p_school_id
              and e.academic_year_id=v_year_id
              and e.term_id=v_term_id
              and e.grade_level=cs.grade_label
              and e.classroom=cs.section_label
              and e.lec_presence_status='present'
              and not exists(
                select 1
                from public.lao_assessment_components ac
                where ac.book_id=b.id
                  and not exists(
                    select 1
                    from public.lao_assessment_scores sc
                    where sc.book_id=b.id
                      and sc.component_id=ac.id
                      and sc.student_id=e.student_id
                      and sc.score is not null
                  )
              )
          )
        end
      ) as payload
      from public.lao_teaching_workloads w
      join public.lao_teaching_workload_items i on i.workload_id=w.id
      join public.lao_personnel p on p.id=w.personnel_id
      join public.lao_curriculum_courses c on c.id=i.course_id
      join public.lao_subjects s on s.id=c.subject_id
      join public.lao_class_sections cs on cs.id=i.class_section_id
      left join public.lao_academic_programs ap on ap.id=cs.program_id
      left join public.lao_assessment_books b
        on b.workload_item_id=i.id and b.status<>'cancelled'
      where w.school_id=p_school_id
        and w.term_id=v_term_id
        and w.status='approved'
        and (v_manage or v_approve or w.personnel_id=v_own)
      order by
        case coalesce(b.status,'not_started')
          when 'returned' then 0
          when 'submitted' then 1
          when 'draft' then 2
          when 'not_started' then 3
          when 'approved' then 4
          else 5
        end,
        cs.grade_label,cs.section_label,coalesce(s.subject_code,''),s.name_th
    ) x;
  end if;

  if p_book_id is not null then
    select * into v_book
    from public.lao_assessment_books
    where id=p_book_id and school_id=p_school_id;
    if not found then raise exception 'ไม่พบสมุดวัดผล'; end if;
    if not (v_manage or v_approve or v_book.personnel_id=v_own) then
      raise exception 'Access denied';
    end if;

    select coalesce(jsonb_agg(x.payload),'[]'::jsonb)
    into v_components
    from (
      select jsonb_build_object(
        'id',ac.id,
        'code',ac.code,
        'label',ac.label,
        'max_score',ac.max_score,
        'sort_order',ac.sort_order
      ) as payload
      from public.lao_assessment_components ac
      where ac.book_id=p_book_id
      order by ac.sort_order
    ) x;

    select coalesce(jsonb_agg(x.payload),'[]'::jsonb)
    into v_students
    from (
      select jsonb_build_object(
        'student_id',e.student_id,
        'student_no',sr.student_no,
        'prefix',st.prefix,
        'first_name_th',st.first_name_th,
        'last_name_th',st.last_name_th,
        'full_name',concat_ws('',st.prefix,st.first_name_th,' ',st.last_name_th),
        'scores',coalesce((
          select jsonb_agg(jsonb_build_object(
            'component_id',sc.component_id,
            'score',sc.score
          ))
          from public.lao_assessment_scores sc
          where sc.book_id=p_book_id and sc.student_id=e.student_id
        ),'[]'::jsonb)
      ) as payload
      from public.lao_student_term_enrollments e
      join public.lao_students st on st.id=e.student_id
      join public.lao_student_school_records sr
        on sr.student_id=e.student_id and sr.school_id=e.school_id
      join public.lao_class_sections cs on cs.id=v_book.class_section_id
      where e.school_id=v_book.school_id
        and e.academic_year_id=v_book.academic_year_id
        and e.term_id=v_book.term_id
        and e.grade_level=cs.grade_label
        and e.classroom=cs.section_label
        and e.lec_presence_status='present'
      order by
        case when sr.student_no ~ '^\d+$' then sr.student_no::bigint else null end nulls last,
        sr.student_no,st.first_name_th,st.last_name_th
    ) x;

    select jsonb_build_object(
      'id',b.id,
      'status',b.status,
      'grading_type',b.grading_type,
      'note',b.note,
      'review_note',b.review_note,
      'submitted_at',b.submitted_at,
      'reviewed_at',b.reviewed_at,
      'personnel_id',b.personnel_id,
      'personnel_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
      'subject_code',s.subject_code,
      'subject_name',s.name_th,
      'subject_type',s.subject_type,
      'grade_label',cs.grade_label,
      'class_label',cs.section_label,
      'class_short',case
        when cs.grade_label ~ '^อนุบาล[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^อนุบาล[[:space:]]*([0-9]+)$','อ.\1')||'/'||cs.section_label
        when cs.grade_label ~ '^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^ประถมศึกษาปีที่[[:space:]]*([0-9]+)$','ป.\1')||'/'||cs.section_label
        when cs.grade_label ~ '^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$' then regexp_replace(cs.grade_label,'^มัธยมศึกษาปีที่[[:space:]]*([0-9]+)$','ม.\1')||'/'||cs.section_label
        else cs.grade_label||'/'||cs.section_label
      end,
      'program_code',ap.code,
      'program_name',ap.name_th,
      'components',v_components,
      'students',v_students
    )
    into v_book_json
    from public.lao_assessment_books b
    join public.lao_personnel p on p.id=b.personnel_id
    join public.lao_curriculum_courses c on c.id=b.course_id
    join public.lao_subjects s on s.id=c.subject_id
    join public.lao_class_sections cs on cs.id=b.class_section_id
    left join public.lao_academic_programs ap on ap.id=cs.program_id
    where b.id=p_book_id;
  end if;

  return jsonb_build_object(
    'can_manage',v_manage,
    'can_approve',v_approve,
    'own_personnel_id',v_own,
    'selected_year_id',v_year_id,
    'selected_term_id',v_term_id,
    'years',v_years,
    'items',v_items,
    'stats',jsonb_build_object(
      'submitted',case when v_approve and v_term_id is not null then (
        select count(*) from public.lao_assessment_books
        where school_id=p_school_id and term_id=v_term_id and status='submitted'
      ) else 0 end,
      'returned',case when v_own is not null and v_term_id is not null then (
        select count(*) from public.lao_assessment_books
        where school_id=p_school_id and term_id=v_term_id
          and personnel_id=v_own and status='returned'
      ) else 0 end,
      'approved',case when (v_manage or v_approve) and v_term_id is not null then (
        select count(*) from public.lao_assessment_books
        where school_id=p_school_id and term_id=v_term_id and status='approved'
      ) else 0 end
    ),
    'book',v_book_json
  );
end;
$function$;

revoke all on function public.lao_assessment_page(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_assessment_page(uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.lao_save_assessment_book(
  p_book_id uuid,
  p_scores jsonb default '[]'::jsonb,
  p_note text default null,
  p_action text default 'draft'
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
  v_component uuid;
  v_score numeric;
  v_max numeric;
  v_missing integer:=0;
  v_org uuid;
  v_teacher_name text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_action not in ('draft','submit') then raise exception 'Invalid action'; end if;

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
    raise exception 'รายการที่ส่งตรวจหรืออนุมัติแล้วไม่สามารถแก้คะแนนได้';
  end if;
  if jsonb_typeof(coalesce(p_scores,'[]'::jsonb))<>'array' then
    raise exception 'ข้อมูลคะแนนไม่ถูกต้อง';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_scores,'[]'::jsonb))
  loop
    v_student:=nullif(v_row->>'student_id','')::uuid;
    v_component:=nullif(v_row->>'component_id','')::uuid;
    v_score:=nullif(v_row->>'score','')::numeric;

    if v_student is null or v_component is null then
      raise exception 'ข้อมูลนักเรียนหรือรายการคะแนนไม่ครบ';
    end if;

    select max_score into v_max
    from public.lao_assessment_components
    where id=v_component and book_id=v_book.id;
    if v_max is null then raise exception 'ไม่พบหัวข้อคะแนน'; end if;

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

    if v_score is not null and (v_score<0 or v_score>v_max) then
      raise exception 'คะแนนต้องอยู่ระหว่าง 0 ถึง %',v_max;
    end if;

    insert into public.lao_assessment_scores(
      book_id,component_id,student_id,score,updated_by
    ) values(v_book.id,v_component,v_student,v_score,v_uid)
    on conflict(book_id,component_id,student_id) do update set
      score=excluded.score,
      updated_by=v_uid,
      updated_at=now();
  end loop;

  if p_action='submit' then
    select count(*) into v_missing
    from public.lao_student_term_enrollments e
    join public.lao_class_sections cs on cs.id=v_book.class_section_id
    cross join public.lao_assessment_components ac
    left join public.lao_assessment_scores sc
      on sc.book_id=v_book.id
     and sc.component_id=ac.id
     and sc.student_id=e.student_id
    where e.school_id=v_book.school_id
      and e.academic_year_id=v_book.academic_year_id
      and e.term_id=v_book.term_id
      and e.grade_level=cs.grade_label
      and e.classroom=cs.section_label
      and e.lec_presence_status='present'
      and ac.book_id=v_book.id
      and sc.score is null;

    if v_missing>0 then
      raise exception 'ยังมีคะแนนไม่ครบ % ช่อง กรุณากรอกให้ครบก่อนส่งฝ่ายวิชาการ',v_missing;
    end if;
  end if;

  update public.lao_assessment_books
  set status=case when p_action='submit' then 'submitted' else 'draft' end,
      note=nullif(btrim(p_note),''),
      review_note=case when p_action='submit' then null else review_note end,
      submitted_at=case when p_action='submit' then now() else submitted_at end,
      reviewed_at=case when p_action='submit' then null else reviewed_at end,
      reviewed_by=case when p_action='submit' then null else reviewed_by end,
      updated_by=v_uid
  where id=v_book.id;

  select s.organization_id,concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th)
  into v_org,v_teacher_name
  from public.lao_schools s
  join public.lao_personnel p on p.id=v_book.personnel_id
  where s.id=v_book.school_id;

  if p_action='submit' then
    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    select distinct x.user_id,v_org,v_book.school_id,'assessment_submitted',
      'มีผลการเรียนรอตรวจสอบ',
      coalesce(v_teacher_name,'ครูผู้สอน')||' ส่งผลการเรียนเพื่อรอการตรวจสอบ',
      'assessment_book',v_book.id::text
    from (
      select m.user_id
      from public.lao_memberships m
      join public.lao_membership_roles mr on mr.membership_id=m.id
      join public.lao_roles r on r.id=mr.role_id
      where m.school_id=v_book.school_id and m.status='active' and r.code='school_admin'
      union
      select a.user_id
      from public.lao_work_authorities a
      where a.school_id=v_book.school_id
        and a.is_active and a.can_approve
        and (a.scope_code='academics' or a.scope_code='academics.assessment')
        and (a.starts_on is null or a.starts_on<=current_date)
        and (a.ends_on is null or a.ends_on>=current_date)
    ) x;
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,v_book.school_id,v_uid,
    case when p_action='submit' then 'assessment_submitted' else 'assessment_saved' end,
    'assessment_book',v_book.id::text,
    jsonb_build_object('status',case when p_action='submit' then 'submitted' else 'draft' end)
  );

  return jsonb_build_object(
    'id',v_book.id,
    'status',case when p_action='submit' then 'submitted' else 'draft' end
  );
end;
$function$;

revoke all on function public.lao_save_assessment_book(uuid,jsonb,text,text) from public,anon;
grant execute on function public.lao_save_assessment_book(uuid,jsonb,text,text) to authenticated;

create or replace function public.lao_review_assessment_book(
  p_book_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_book public.lao_assessment_books;
  v_org uuid;
  v_target_user uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approved','returned') then raise exception 'Invalid decision'; end if;

  select * into v_book
  from public.lao_assessment_books
  where id=p_book_id
  for update;
  if not found then raise exception 'ไม่พบสมุดวัดผล'; end if;

  if not public.lao_has_work_permission(v_book.school_id,'academics.assessment','approve') then
    raise exception 'ไม่มีสิทธิ์ตรวจอนุมัติผลการเรียน';
  end if;
  if v_book.status<>'submitted' then
    raise exception 'รายการนี้ยังไม่อยู่ในสถานะรอตรวจสอบ';
  end if;
  if p_decision='returned' and nullif(btrim(p_review_note),'') is null then
    raise exception 'กรุณาระบุสิ่งที่ต้องแก้ไขก่อนส่งกลับ';
  end if;

  update public.lao_assessment_books
  set status=p_decision,
      review_note=nullif(btrim(p_review_note),''),
      reviewed_at=now(),
      reviewed_by=v_uid,
      updated_by=v_uid
  where id=v_book.id;

  select s.organization_id,pa.user_id
  into v_org,v_target_user
  from public.lao_schools s
  left join public.lao_personnel_accounts pa
    on pa.personnel_id=v_book.personnel_id and pa.school_id=v_book.school_id
  where s.id=v_book.school_id;

  if v_target_user is not null and v_target_user<>v_uid then
    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    ) values(
      v_target_user,v_org,v_book.school_id,
      case when p_decision='approved' then 'assessment_approved' else 'assessment_returned' end,
      case when p_decision='approved' then 'ผลการเรียนได้รับการอนุมัติแล้ว' else 'ผลการเรียนถูกส่งกลับให้แก้ไข' end,
      case when p_decision='approved' then 'ฝ่ายวิชาการอนุมัติผลการเรียนและ ปพ.6 ของคุณแล้ว' else btrim(p_review_note) end,
      'assessment_book',v_book.id::text
    );
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  ) values(
    v_org,v_book.school_id,v_uid,
    case when p_decision='approved' then 'assessment_approved' else 'assessment_returned' end,
    'assessment_book',v_book.id::text,
    jsonb_build_object('status',v_book.status),
    jsonb_build_object('status',p_decision,'review_note',nullif(btrim(p_review_note),''))
  );

  return jsonb_build_object('id',v_book.id,'status',p_decision);
end;
$function$;

revoke all on function public.lao_review_assessment_book(uuid,text,text) from public,anon;
grant execute on function public.lao_review_assessment_book(uuid,text,text) to authenticated;

commit;

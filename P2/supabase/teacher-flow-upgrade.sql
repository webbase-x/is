-- อัปเกรดหน้าครู: จำกัดรายชื่อห้องตามสิทธิ์ และป้องกันรหัสซ้ำเมื่อสร้างพร้อมกัน
-- รันไฟล์นี้หนึ่งครั้งใน Supabase SQL Editor

create or replace function public.get_teacher_classes()
returns table (
  class_id uuid,
  class_label text,
  grade smallint,
  room_no smallint,
  academic_year smallint,
  school_id uuid,
  school_name text,
  school_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.label, c.grade, c.room_no, c.academic_year,
         school.id, school.name, school.code
  from public.classes c
  join public.schools school on school.id = c.school_id
  where c.active and school.active and public.teacher_can_access_class(c.id)
  order by school.name, c.grade, c.room_no;
$$;

create or replace function public.generate_room_code()
returns char(6)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate char(6);
begin
  loop
    candidate := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    exit when not exists (
      select 1 from public.class_sessions where room_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_class_session(
  p_class_id uuid,
  p_plan_id smallint,
  p_play_mode text,
  p_attempt_mode text,
  p_max_attempts smallint,
  p_score_policy text,
  p_leaderboard_mode text,
  p_pass_percent smallint
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_session public.class_sessions%rowtype;
  create_attempt smallint := 0;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Teacher is not assigned to this class';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text, 0));
  if exists (
    select 1 from public.class_sessions
    where class_id = p_class_id and status <> 'closed'
  ) then
    raise exception 'ห้องเรียนนี้มีคาบที่ยังไม่ปิด กรุณากลับไปใช้คาบเดิมหรือปิดคาบก่อน';
  end if;

  loop
    create_attempt := create_attempt + 1;
    begin
      insert into public.class_sessions(
        class_id, teacher_id, plan_id, room_code, play_mode, attempt_mode,
        max_attempts, score_policy, leaderboard_mode, pass_percent
      ) values (
        p_class_id, auth.uid(), p_plan_id, public.generate_room_code(), p_play_mode,
        p_attempt_mode, p_max_attempts, p_score_policy, p_leaderboard_mode, p_pass_percent
      ) returning * into new_session;
      return new_session;
    exception when unique_violation then
      if create_attempt >= 20 then
        raise exception 'ไม่สามารถสร้างรหัสห้องที่ไม่ซ้ำได้ กรุณาลองใหม่';
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.get_teacher_classes() from public, anon;
grant execute on function public.get_teacher_classes() to authenticated;
grant execute on function public.create_class_session(uuid, smallint, text, text, smallint, text, text, smallint) to authenticated;

drop policy if exists "teachers manage schools" on public.schools;
drop policy if exists "teachers read assigned schools" on public.schools;
create policy "teachers read assigned schools" on public.schools for select to authenticated
  using (exists (select 1 from public.classes c where c.school_id = schools.id and public.teacher_can_access_class(c.id)));
drop policy if exists "admins manage schools" on public.schools;
create policy "admins manage schools" on public.schools for all to authenticated
  using (exists (select 1 from public.teacher_profiles t where t.user_id = auth.uid() and t.role = 'admin' and t.active))
  with check (exists (select 1 from public.teacher_profiles t where t.user_id = auth.uid() and t.role = 'admin' and t.active));

drop policy if exists "teachers manage classes" on public.classes;
drop policy if exists "teachers read assigned classes" on public.classes;
create policy "teachers read assigned classes" on public.classes for select to authenticated using (public.teacher_can_access_class(id));
drop policy if exists "admins manage classes" on public.classes;
create policy "admins manage classes" on public.classes for all to authenticated
  using (exists (select 1 from public.teacher_profiles t where t.user_id = auth.uid() and t.role = 'admin' and t.active))
  with check (exists (select 1 from public.teacher_profiles t where t.user_id = auth.uid() and t.role = 'admin' and t.active));

drop policy if exists "teachers manage students" on public.students;
drop policy if exists "teachers manage assigned students" on public.students;
create policy "teachers manage assigned students" on public.students for all to authenticated
  using (public.teacher_can_access_class(class_id)) with check (public.teacher_can_access_class(class_id));

drop policy if exists "teachers read own assignments" on public.teacher_class_assignments;
create policy "teachers read own assignments" on public.teacher_class_assignments for select to authenticated
  using (teacher_id = auth.uid());

notify pgrst, 'reload schema';

-- รองรับครูหลายคนควบคุมคาบเดียวกัน และนักเรียนหนึ่งคนอยู่ได้หลายห้อง
-- รันไฟล์นี้หนึ่งครั้งใน Supabase SQL Editor สำหรับฐานข้อมูลที่ติดตั้งอยู่แล้ว

begin;

create table if not exists public.student_class_assignments (
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (student_id, class_id)
);

create index if not exists student_class_assignments_class_active_idx
  on public.student_class_assignments(class_id, active, student_id);

-- ย้ายรายชื่อเดิมเข้าสู่ตารางสังกัด โดยยังคง students.class_id ไว้เป็นห้องหลัก
-- เพื่อให้คะแนนและข้อมูลเดิมทั้งหมดใช้งานต่อได้
insert into public.student_class_assignments(student_id, class_id, active)
select id, class_id, true
from public.students
on conflict (student_id, class_id) do nothing;

alter table public.student_class_assignments enable row level security;
revoke all on table public.student_class_assignments from public, anon;
grant select, insert, update, delete on table public.student_class_assignments to authenticated;

create or replace function public.teacher_can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_class_assignments membership
    where membership.student_id = p_student_id
      and public.teacher_can_access_class(membership.class_id)
  );
$$;

revoke all on function public.teacher_can_access_student(uuid) from public, anon;
grant execute on function public.teacher_can_access_student(uuid) to authenticated;

drop policy if exists "teachers read assigned student memberships" on public.student_class_assignments;
create policy "teachers read assigned student memberships"
  on public.student_class_assignments
  for select
  to authenticated
  using (public.teacher_can_access_class(class_id));

drop policy if exists "admins manage student memberships" on public.student_class_assignments;
create policy "admins manage student memberships"
  on public.student_class_assignments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "teachers manage students" on public.students;
drop policy if exists "teachers manage assigned students" on public.students;
drop policy if exists "teachers read assigned students" on public.students;
create policy "teachers read assigned students"
  on public.students
  for select
  to authenticated
  using (public.teacher_can_access_student(id));

create or replace function public.get_teacher_roster()
returns table (
  student_id uuid,
  class_id uuid,
  class_label text,
  grade smallint,
  room_no smallint,
  academic_year smallint,
  school_id uuid,
  school_name text,
  student_code text,
  full_name text,
  nickname text,
  avatar text,
  student_active boolean,
  membership_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    student.id,
    classroom.id,
    classroom.label,
    classroom.grade,
    classroom.room_no,
    classroom.academic_year,
    school.id,
    school.name,
    student.student_code,
    student.full_name,
    student.nickname,
    student.avatar,
    student.active,
    membership.active
  from public.student_class_assignments membership
  join public.students student on student.id = membership.student_id
  join public.classes classroom on classroom.id = membership.class_id
  join public.schools school on school.id = classroom.school_id
  where classroom.active
    and school.active
    and public.teacher_can_access_class(membership.class_id)
  order by school.name, classroom.grade, classroom.room_no, student.student_code, student.full_name;
$$;

revoke all on function public.get_teacher_roster() from public, anon;
grant execute on function public.get_teacher_roster() to authenticated;

create or replace function public.upsert_student_class_membership(
  p_class_id uuid,
  p_student_code text,
  p_full_name text,
  p_nickname text,
  p_avatar text default '⭐'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class public.classes%rowtype;
  target_student public.students%rowtype;
  clean_code text := btrim(coalesce(p_student_code, ''));
  clean_name text := btrim(coalesce(p_full_name, ''));
  clean_nickname text;
  clean_avatar text := coalesce(nullif(btrim(coalesce(p_avatar, '')), ''), '⭐');
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Teacher is not assigned to this class';
  end if;

  select * into target_class
  from public.classes
  where id = p_class_id and active;

  if target_class.id is null then
    raise exception 'ไม่พบห้องเรียนที่เปิดใช้งาน';
  end if;
  if clean_code = '' then raise exception 'กรุณากรอกเลขประจำตัวนักเรียน'; end if;
  if clean_name = '' then raise exception 'กรุณากรอกชื่อ–นามสกุลนักเรียน'; end if;

  clean_nickname := coalesce(
    nullif(btrim(coalesce(p_nickname, '')), ''),
    nullif(split_part(clean_name, ' ', 1), ''),
    clean_name
  );

  -- ป้องกันครูสองคนเพิ่มรายชื่อเดียวกันพร้อมกัน
  perform pg_advisory_xact_lock(hashtextextended(
    target_class.school_id::text || ':' || target_class.academic_year::text || ':' || lower(clean_code),
    0
  ));

  -- หากเลขประจำตัวนี้อยู่ในห้องเป้าหมายแล้ว ให้แก้ข้อมูลคนเดิม
  select student.* into target_student
  from public.students student
  where lower(btrim(student.student_code)) = lower(clean_code)
    and (
      student.class_id = p_class_id
      or exists (
        select 1
        from public.student_class_assignments membership
        where membership.student_id = student.id
          and membership.class_id = p_class_id
      )
    )
  order by student.created_at
  limit 1;

  -- หากเป็นเลขประจำตัวและชื่อเดียวกันในโรงเรียน/ปีการศึกษาเดียวกัน
  -- ให้ใช้ตัวนักเรียนเดิมแล้วเพิ่มสังกัดห้องใหม่
  if target_student.id is null then
    select student.* into target_student
    from public.students student
    join public.classes home_class on home_class.id = student.class_id
    where home_class.school_id = target_class.school_id
      and home_class.academic_year = target_class.academic_year
      and lower(btrim(student.student_code)) = lower(clean_code)
      and lower(regexp_replace(btrim(student.full_name), '[[:space:]]+', '', 'g'))
          = lower(regexp_replace(clean_name, '[[:space:]]+', '', 'g'))
    order by student.created_at
    limit 1;
  end if;

  if target_student.id is null then
    insert into public.students(class_id, student_code, full_name, nickname, avatar, active)
    values (p_class_id, clean_code, clean_name, clean_nickname, clean_avatar, true)
    returning * into target_student;
  else
    update public.students
    set student_code = clean_code,
        full_name = clean_name,
        nickname = clean_nickname,
        active = true,
        updated_at = now()
    where id = target_student.id
    returning * into target_student;
  end if;

  insert into public.student_class_assignments(student_id, class_id, active)
  values (target_student.id, p_class_id, true)
  on conflict (student_id, class_id)
  do update set active = true;

  return target_student.id;
end;
$$;

revoke all on function public.upsert_student_class_membership(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.upsert_student_class_membership(uuid, text, text, text, text)
  to authenticated;

create or replace function public.get_open_session_roster(p_room_code text)
returns table (
  session_id uuid,
  class_id uuid,
  class_label text,
  school_id uuid,
  school_name text,
  plan_id smallint,
  session_status text,
  play_mode text,
  student_id uuid,
  student_code text,
  full_name text,
  nickname text,
  avatar text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session_row.id,
    classroom.id,
    classroom.label,
    school.id,
    school.name,
    session_row.plan_id,
    session_row.status,
    session_row.play_mode,
    student.id,
    student.student_code,
    student.full_name,
    student.nickname,
    student.avatar
  from public.class_sessions session_row
  join public.classes classroom on classroom.id = session_row.class_id
  join public.schools school on school.id = classroom.school_id
  join public.student_class_assignments membership
    on membership.class_id = classroom.id and membership.active
  join public.students student
    on student.id = membership.student_id and student.active
  where session_row.room_code = lpad(regexp_replace(p_room_code, '\D', '', 'g'), 6, '0')
    and session_row.status in ('lobby', 'active', 'paused')
  order by student.student_code, student.full_name;
$$;

revoke all on function public.get_open_session_roster(text) from public, anon;
grant execute on function public.get_open_session_roster(text) to authenticated;

create or replace function public.join_session(
  p_room_code text,
  p_student_id uuid,
  p_selfie_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.class_sessions%rowtype;
  player_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into target_session
  from public.class_sessions
  where room_code = lpad(regexp_replace(p_room_code, '\D', '', 'g'), 6, '0')
    and status in ('lobby', 'active', 'paused')
  limit 1;

  if target_session.id is null then raise exception 'คาบนี้จบแล้วหรือไม่พบรหัสห้อง'; end if;
  if not exists (
    select 1
    from public.student_class_assignments membership
    join public.students student on student.id = membership.student_id
    where membership.student_id = p_student_id
      and membership.class_id = target_session.class_id
      and membership.active
      and student.active
  ) then
    raise exception 'ไม่พบรายชื่อนักเรียนในห้องนี้';
  end if;

  delete from public.session_players
  where session_id = target_session.id
    and auth_user_id = auth.uid()
    and student_id <> p_student_id;

  insert into public.session_players(
    session_id, student_id, auth_user_id, status, selfie_path,
    return_reason, joined_at, last_seen_at
  )
  values (
    target_session.id, p_student_id, auth.uid(), 'waiting',
    nullif(p_selfie_path, ''), null, now(), now()
  )
  on conflict (session_id, student_id) do update
    set auth_user_id = auth.uid(),
        status = 'waiting',
        selfie_path = excluded.selfie_path,
        return_reason = null,
        approved_at = null,
        joined_at = now(),
        last_seen_at = now()
  returning id into player_id;

  return player_id;
end;
$$;

revoke all on function public.join_session(text, uuid, text) from public, anon;
grant execute on function public.join_session(text, uuid, text) to authenticated;

create or replace function public.ensure_session_class_has_students()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.student_class_assignments membership
    join public.students student on student.id = membership.student_id
    where membership.class_id = new.class_id
      and membership.active
      and student.active
  ) then
    raise exception 'ห้องเรียนนี้ยังไม่มีรายชื่อนักเรียนที่เปิดใช้งาน';
  end if;
  return new;
end;
$$;

-- ฟังก์ชันสองตัวนี้ใช้ภายใน trigger/RPC เท่านั้น ไม่ควรถูกเรียกตรงจาก Data API
revoke all on function public.ensure_session_class_has_students()
  from public, anon, authenticated;
revoke all on function public.generate_room_code()
  from public, anon, authenticated;

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
  shared_session public.class_sessions%rowtype;
  create_attempt smallint := 0;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Teacher is not assigned to this class';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text, 0));

  select * into shared_session
  from public.class_sessions
  where class_id = p_class_id and status <> 'closed'
  order by opened_at desc
  limit 1;

  if shared_session.id is not null then
    return shared_session;
  end if;

  loop
    create_attempt := create_attempt + 1;
    begin
      insert into public.class_sessions(
        class_id, teacher_id, plan_id, room_code, play_mode, attempt_mode,
        max_attempts, score_policy, score_recording_enabled, leaderboard_mode, pass_percent
      ) values (
        p_class_id, auth.uid(), p_plan_id, public.generate_room_code(), p_play_mode,
        p_attempt_mode, p_max_attempts, p_score_policy,
        public.teacher_can_record_scores(), p_leaderboard_mode, p_pass_percent
      ) returning * into shared_session;
      return shared_session;
    exception when unique_violation then
      if create_attempt >= 20 then
        raise exception 'ไม่สามารถสร้างรหัสห้องที่ไม่ซ้ำได้ กรุณาลองใหม่';
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.create_class_session(uuid, smallint, text, text, smallint, text, text, smallint)
  from public, anon;
grant execute on function public.create_class_session(uuid, smallint, text, text, smallint, text, text, smallint)
  to authenticated;

-- ฟังก์ชันบัญชีผู้เชี่ยวชาญใช้รหัสเดิม 123456 และเข้าร่วมคาบของครูร่วมได้
create or replace function public.create_expert_class_session(
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
  shared_session public.class_sessions%rowtype;
  fixed_room_code char(6) := '123456';
begin
  if public.teacher_can_record_scores() then
    raise exception 'Expert test account required';
  end if;
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Teacher is not assigned to this class';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('expert-fixed-room-123456', 0));

  select * into shared_session
  from public.class_sessions
  where class_id = p_class_id and status <> 'closed'
  order by opened_at desc
  limit 1;

  if shared_session.id is not null then
    return shared_session;
  end if;

  if exists (
    select 1
    from public.class_sessions
    where room_code = fixed_room_code and status <> 'closed'
  ) then
    raise exception 'รหัสห้องตรวจ 123456 กำลังใช้งานอยู่ในอีกห้อง กรุณาปิดคาบเดิมก่อนเปิดคาบใหม่';
  end if;

  insert into public.class_sessions(
    class_id, teacher_id, plan_id, room_code, play_mode, attempt_mode,
    max_attempts, score_policy, score_recording_enabled, leaderboard_mode, pass_percent
  ) values (
    p_class_id, auth.uid(), p_plan_id, fixed_room_code, p_play_mode,
    p_attempt_mode, p_max_attempts, p_score_policy, false, p_leaderboard_mode, p_pass_percent
  ) returning * into shared_session;

  return shared_session;
end;
$$;

revoke all on function public.create_expert_class_session(uuid, smallint, text, text, smallint, text, text, smallint)
  from public, anon;
grant execute on function public.create_expert_class_session(uuid, smallint, text, text, smallint, text, text, smallint)
  to authenticated;

-- แยกสิทธิ์ตามการกระทำ: ผู้สร้างยังถูกบันทึกไว้ใน teacher_id
-- แต่ครูทุกคนที่ได้รับมอบหมายให้ห้องสามารถอ่านและควบคุมคาบร่วมกันได้
drop policy if exists "teachers manage sessions" on public.class_sessions;
drop policy if exists "teachers read assigned sessions" on public.class_sessions;
drop policy if exists "teachers create assigned sessions" on public.class_sessions;
drop policy if exists "teachers update assigned sessions" on public.class_sessions;

create policy "teachers read assigned sessions"
  on public.class_sessions
  for select
  to authenticated
  using (public.teacher_can_access_class(class_id));

create policy "teachers create assigned sessions"
  on public.class_sessions
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.is_teacher()
    and public.teacher_can_access_class(class_id)
  );

create policy "teachers update assigned sessions"
  on public.class_sessions
  for update
  to authenticated
  using (
    public.is_teacher()
    and public.teacher_can_access_class(class_id)
  )
  with check (
    public.is_teacher()
    and public.teacher_can_access_class(class_id)
  );

notify pgrst, 'reload schema';

commit;

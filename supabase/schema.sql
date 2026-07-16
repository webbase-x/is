-- คำไทยผจญภัย: โครงสร้างฐานข้อมูลฉบับเริ่มต้น
-- รันไฟล์นี้หนึ่งครั้งใน Supabase SQL Editor ด้วยบัญชีเจ้าของโครงการ

create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade smallint not null check (grade between 1 and 6),
  room_no smallint not null check (room_no between 1 and 20),
  label text not null,
  academic_year smallint not null default 2569,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, grade, room_no, academic_year)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_code text not null,
  full_name text not null,
  nickname text not null,
  avatar text not null default '⭐',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_code)
);

create table if not exists public.teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_class_assignments (
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  primary key (teacher_id, class_id)
);

create table if not exists public.lesson_plans (
  id smallint primary key check (id between 1 and 8),
  sequence_no smallint not null unique check (sequence_no between 1 and 8),
  title text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  teacher_id uuid not null references public.teacher_profiles(user_id),
  plan_id smallint not null references public.lesson_plans(id),
  room_code char(6) not null unique,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'paused', 'closed')),
  current_activity_key text,
  play_mode text not null default 'practice' check (play_mode in ('practice', 'test', 'real')),
  attempt_mode text not null default 'limited' check (attempt_mode in ('single', 'limited', 'unlimited')),
  max_attempts smallint not null default 2 check (max_attempts between 1 and 10),
  score_policy text not null default 'first_and_best' check (score_policy in ('first_and_best', 'first', 'best', 'latest')),
  leaderboard_mode text not null default 'nickname_avatar' check (leaderboard_mode in ('nickname_avatar', 'real_name', 'student_code', 'hidden')),
  pass_percent smallint not null default 80 check (pass_percent between 0 and 100),
  selfie_delete_policy text not null default 'session_close' check (selfie_delete_policy = 'session_close'),
  opened_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create index if not exists class_sessions_room_code_idx on public.class_sessions(room_code);
create index if not exists class_sessions_class_opened_idx on public.class_sessions(class_id, opened_at desc);

create table if not exists public.session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'returned', 'removed')),
  selfie_path text,
  return_reason text,
  joined_at timestamptz not null default now(),
  approved_at timestamptz,
  last_seen_at timestamptz not null default now(),
  unique (session_id, student_id),
  unique (session_id, auth_user_id)
);

create index if not exists session_players_session_status_idx on public.session_players(session_id, status);

create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  activity_key text not null check (activity_key in ('rhythm', 'wheel', 'sound', 'sort', 'train', 'vote', 'exit')),
  attempt_no smallint not null check (attempt_no > 0),
  score integer not null check (score >= 0),
  max_score integer not null check (max_score > 0),
  percent numeric(5,2) not null check (percent between 0 and 100),
  passed boolean not null,
  answers jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now(),
  unique (session_player_id, activity_key, attempt_no)
);

create index if not exists game_attempts_player_activity_idx on public.game_attempts(session_player_id, activity_key, attempt_no);

create table if not exists public.sentence_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  sentence text not null check (char_length(sentence) between 1 and 200),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sentence_votes (
  submission_id uuid not null references public.sentence_submissions(id) on delete cascade,
  voter_player_id uuid not null references public.session_players(id) on delete cascade,
  emoji text not null default '💗' check (emoji in ('💗', '👍', '🌟')),
  created_at timestamptz not null default now(),
  primary key (submission_id, voter_player_id)
);

create or replace function public.is_teacher(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teacher_profiles t
    where t.user_id = check_user and t.active
  );
$$;

create or replace function public.teacher_can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_profiles t
    where t.user_id = auth.uid()
      and t.active
      and (
        t.role = 'admin'
        or exists (
          select 1 from public.teacher_class_assignments a
          where a.teacher_id = t.user_id and a.class_id = p_class_id
        )
      )
  );
$$;

create or replace function public.teacher_can_access_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_sessions s
    where s.id = p_session_id
      and (s.teacher_id = auth.uid() or public.teacher_can_access_class(s.class_id))
  );
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
      select 1 from public.class_sessions
      where room_code = candidate and status <> 'closed'
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_school_structure(
  p_school_name text,
  p_school_code text,
  p_academic_year smallint default 2569
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_school_id uuid;
  grade_no integer;
  room_number integer;
begin
  if not public.is_teacher() then
    raise exception 'Teacher permission required';
  end if;

  insert into public.schools(code, name)
  values (upper(trim(p_school_code)), trim(p_school_name))
  on conflict (code) do update set name = excluded.name, active = true
  returning id into new_school_id;

  for grade_no in 1..6 loop
    for room_number in 1..4 loop
      insert into public.classes(school_id, grade, room_no, label, academic_year)
      values (new_school_id, grade_no, room_number, 'ป.' || grade_no || '/' || room_number, p_academic_year)
      on conflict (school_id, grade, room_no, academic_year)
      do update set active = true, label = excluded.label;
    end loop;
  end loop;

  return new_school_id;
end;
$$;

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
    s.id, c.id, c.label, school.id, school.name, s.plan_id, s.status,
    s.play_mode, st.id, st.student_code, st.full_name, st.nickname, st.avatar
  from public.class_sessions s
  join public.classes c on c.id = s.class_id
  join public.schools school on school.id = c.school_id
  join public.students st on st.class_id = c.id and st.active
  where s.room_code = lpad(regexp_replace(p_room_code, '\D', '', 'g'), 6, '0')
    and s.status in ('lobby', 'active', 'paused')
  order by st.student_code, st.full_name;
$$;

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
    and status = 'lobby'
  limit 1;

  if target_session.id is null then raise exception 'ห้องนี้ปิดรับนักเรียนแล้ว'; end if;
  if not exists (select 1 from public.students where id = p_student_id and class_id = target_session.class_id and active) then
    raise exception 'ไม่พบรายชื่อนักเรียนในห้องนี้';
  end if;

  delete from public.session_players
  where session_id = target_session.id and auth_user_id = auth.uid() and student_id <> p_student_id;

  insert into public.session_players(session_id, student_id, auth_user_id, status, selfie_path, return_reason, joined_at, last_seen_at)
  values (target_session.id, p_student_id, auth.uid(), 'waiting', nullif(p_selfie_path, ''), null, now(), now())
  on conflict (session_id, student_id) do update
    set auth_user_id = auth.uid(), status = 'waiting', selfie_path = excluded.selfie_path,
        return_reason = null, joined_at = now(), last_seen_at = now()
  returning id into player_id;

  return player_id;
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
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Teacher is not assigned to this class';
  end if;

  insert into public.class_sessions(
    class_id, teacher_id, plan_id, room_code, play_mode, attempt_mode,
    max_attempts, score_policy, leaderboard_mode, pass_percent
  ) values (
    p_class_id, auth.uid(), p_plan_id, public.generate_room_code(), p_play_mode,
    p_attempt_mode, p_max_attempts, p_score_policy, p_leaderboard_mode, p_pass_percent
  ) returning * into new_session;

  return new_session;
end;
$$;

create or replace function public.record_game_attempt(
  p_session_player_id uuid,
  p_activity_key text,
  p_score integer,
  p_max_score integer,
  p_answers jsonb default '[]'::jsonb
)
returns table (attempt_id uuid, attempt_no smallint, percent numeric, passed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  player public.session_players%rowtype;
  session_row public.class_sessions%rowtype;
  previous_count integer;
  next_attempt smallint;
  result_percent numeric(5,2);
  new_attempt_id uuid;
begin
  select * into player from public.session_players where id = p_session_player_id;
  if player.auth_user_id <> auth.uid() or player.status <> 'approved' then
    raise exception 'Player is not approved';
  end if;

  select * into session_row from public.class_sessions where id = player.session_id;
  if session_row.status <> 'active' then raise exception 'เกมยังไม่เริ่มหรือถูกพักอยู่'; end if;
  if p_activity_key <> session_row.current_activity_key then raise exception 'กิจกรรมนี้ยังไม่เปิด'; end if;
  if p_max_score <= 0 or p_score < 0 or p_score > p_max_score then raise exception 'Invalid score'; end if;

  select count(*) into previous_count
  from public.game_attempts
  where session_player_id = player.id and activity_key = p_activity_key;

  if session_row.attempt_mode = 'single' and previous_count >= 1 then raise exception 'กิจกรรมนี้ทำได้รอบเดียว'; end if;
  if session_row.attempt_mode = 'limited' and previous_count >= session_row.max_attempts then raise exception 'ครบจำนวนรอบแล้ว'; end if;

  next_attempt := previous_count + 1;
  result_percent := round((p_score::numeric / p_max_score::numeric) * 100, 2);

  insert into public.game_attempts(session_player_id, activity_key, attempt_no, score, max_score, percent, passed, answers)
  values (player.id, p_activity_key, next_attempt, p_score, p_max_score, result_percent, result_percent >= session_row.pass_percent, p_answers)
  returning id into new_attempt_id;

  return query select new_attempt_id, next_attempt, result_percent, result_percent >= session_row.pass_percent;
end;
$$;

create or replace function public.get_session_leaderboard(p_session_id uuid)
returns table (
  player_id uuid,
  display_name text,
  avatar text,
  total_score bigint,
  average_percent numeric,
  completed_activities bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.teacher_can_access_session(p_session_id)
    or exists (select 1 from public.session_players p where p.session_id = p_session_id and p.auth_user_id = auth.uid())
  ) then raise exception 'Access denied'; end if;

  return query
  with activity_scores as (
    select
      a.session_player_id,
      a.activity_key,
      case s.score_policy
        when 'first' then (array_agg(a.score order by a.attempt_no))[1]
        when 'latest' then (array_agg(a.score order by a.attempt_no desc))[1]
        else max(a.score)
      end::bigint as selected_score,
      case s.score_policy
        when 'first' then (array_agg(a.percent order by a.attempt_no))[1]
        when 'latest' then (array_agg(a.percent order by a.attempt_no desc))[1]
        else max(a.percent)
      end::numeric as selected_percent
    from public.game_attempts a
    join public.session_players p on p.id = a.session_player_id
    join public.class_sessions s on s.id = p.session_id
    where p.session_id = p_session_id
    group by a.session_player_id, a.activity_key, s.score_policy
  )
  select
    p.id,
    case s.leaderboard_mode
      when 'real_name' then st.full_name
      when 'student_code' then st.student_code
      when 'hidden' then 'นักผจญภัย'
      else st.nickname
    end,
    st.avatar,
    coalesce(sum(activity_scores.selected_score), 0)::bigint,
    coalesce(round(avg(activity_scores.selected_percent), 2), 0)::numeric,
    count(activity_scores.activity_key)::bigint
  from public.session_players p
  join public.students st on st.id = p.student_id
  join public.class_sessions s on s.id = p.session_id
  left join activity_scores on activity_scores.session_player_id = p.id
  where p.session_id = p_session_id and p.status = 'approved'
  group by p.id, st.full_name, st.student_code, st.nickname, st.avatar, s.leaderboard_mode
  order by coalesce(sum(activity_scores.selected_score), 0) desc, st.nickname;
end;
$$;

create or replace function public.get_display_snapshot(p_room_code text)
returns table (
  session_id uuid,
  room_code char(6),
  class_label text,
  school_name text,
  plan_id smallint,
  session_status text,
  current_activity_key text,
  leaderboard_mode text,
  approved_count bigint,
  total_students bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.room_code, c.label, school.name, s.plan_id, s.status,
    s.current_activity_key, s.leaderboard_mode,
    (select count(*) from public.session_players p where p.session_id = s.id and p.status = 'approved'),
    (select count(*) from public.students st where st.class_id = c.id and st.active)
  from public.class_sessions s
  join public.classes c on c.id = s.class_id
  join public.schools school on school.id = c.school_id
  where s.room_code = lpad(regexp_replace(p_room_code, '\D', '', 'g'), 6, '0')
    and s.status <> 'closed'
  limit 1;
$$;

create or replace function public.get_display_leaderboard(p_room_code text)
returns table (
  display_name text,
  avatar text,
  total_score bigint,
  average_percent numeric,
  completed_activities bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with target_session as (
    select * from public.class_sessions s
    where s.room_code = lpad(regexp_replace(p_room_code, '\D', '', 'g'), 6, '0')
      and s.status <> 'closed'
    limit 1
  ), activity_scores as (
    select
      a.session_player_id,
      a.activity_key,
      case s.score_policy
        when 'first' then (array_agg(a.score order by a.attempt_no))[1]
        when 'latest' then (array_agg(a.score order by a.attempt_no desc))[1]
        else max(a.score)
      end::bigint as selected_score,
      case s.score_policy
        when 'first' then (array_agg(a.percent order by a.attempt_no))[1]
        when 'latest' then (array_agg(a.percent order by a.attempt_no desc))[1]
        else max(a.percent)
      end::numeric as selected_percent
    from public.game_attempts a
    join public.session_players p on p.id = a.session_player_id
    join target_session s on s.id = p.session_id
    group by a.session_player_id, a.activity_key, s.score_policy
  )
  select
    case s.leaderboard_mode
      when 'real_name' then st.full_name
      when 'student_code' then st.student_code
      when 'hidden' then 'นักผจญภัย'
      else st.nickname
    end,
    st.avatar,
    coalesce(sum(activity_scores.selected_score), 0)::bigint,
    coalesce(round(avg(activity_scores.selected_percent), 2), 0)::numeric,
    count(activity_scores.activity_key)::bigint
  from target_session s
  join public.session_players p on p.session_id = s.id and p.status = 'approved'
  join public.students st on st.id = p.student_id
  left join activity_scores on activity_scores.session_player_id = p.id
  group by p.id, st.full_name, st.student_code, st.nickname, st.avatar, s.leaderboard_mode
  order by coalesce(sum(activity_scores.selected_score), 0) desc, st.nickname
  limit 12;
$$;

create or replace function public.grant_teacher(p_email text, p_full_name text, p_role text default 'teacher')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_user uuid;
begin
  select id into target_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if target_user is null then raise exception 'สร้างผู้ใช้ใน Authentication > Users ก่อน'; end if;
  insert into public.teacher_profiles(user_id, full_name, role)
  values (target_user, trim(p_full_name), p_role)
  on conflict (user_id) do update set full_name = excluded.full_name, role = excluded.role, active = true;
  return target_user;
end;
$$;

revoke all on function public.grant_teacher(text, text, text) from public, anon, authenticated;
grant execute on function public.get_open_session_roster(text) to authenticated;
grant execute on function public.join_session(text, uuid, text) to authenticated;
grant execute on function public.create_class_session(uuid, smallint, text, text, smallint, text, text, smallint) to authenticated;
grant execute on function public.record_game_attempt(uuid, text, integer, integer, jsonb) to authenticated;
grant execute on function public.get_session_leaderboard(uuid) to authenticated;
grant execute on function public.get_display_snapshot(text) to authenticated;
grant execute on function public.get_display_leaderboard(text) to authenticated;
grant execute on function public.create_school_structure(text, text, smallint) to authenticated;

alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.teacher_class_assignments enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.class_sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.game_attempts enable row level security;
alter table public.sentence_submissions enable row level security;
alter table public.sentence_votes enable row level security;

drop policy if exists "teachers manage schools" on public.schools;
create policy "teachers manage schools" on public.schools for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "teachers manage classes" on public.classes;
create policy "teachers manage classes" on public.classes for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "teachers manage students" on public.students;
create policy "teachers manage students" on public.students for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "teachers see own profile" on public.teacher_profiles;
create policy "teachers see own profile" on public.teacher_profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins manage assignments" on public.teacher_class_assignments;
create policy "admins manage assignments" on public.teacher_class_assignments for all to authenticated
  using (exists (select 1 from public.teacher_profiles t where t.user_id = auth.uid() and t.role = 'admin'))
  with check (exists (select 1 from public.teacher_profiles t where t.user_id = auth.uid() and t.role = 'admin'));

drop policy if exists "authenticated read plans" on public.lesson_plans;
create policy "authenticated read plans" on public.lesson_plans for select to authenticated using (true);
drop policy if exists "teachers manage plans" on public.lesson_plans;
create policy "teachers manage plans" on public.lesson_plans for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "teachers manage sessions" on public.class_sessions;
create policy "teachers manage sessions" on public.class_sessions for all to authenticated
  using (teacher_id = auth.uid() or public.teacher_can_access_class(class_id))
  with check (teacher_id = auth.uid() and public.is_teacher());
drop policy if exists "players read own session" on public.class_sessions;
create policy "players read own session" on public.class_sessions for select to authenticated
  using (exists (select 1 from public.session_players p where p.session_id = id and p.auth_user_id = auth.uid()));

drop policy if exists "players see self teachers see class" on public.session_players;
create policy "players see self teachers see class" on public.session_players for select to authenticated
  using (auth_user_id = auth.uid() or public.teacher_can_access_session(session_id));
drop policy if exists "teachers update players" on public.session_players;
create policy "teachers update players" on public.session_players for update to authenticated
  using (public.teacher_can_access_session(session_id)) with check (public.teacher_can_access_session(session_id));

drop policy if exists "players read own attempts teachers read class" on public.game_attempts;
create policy "players read own attempts teachers read class" on public.game_attempts for select to authenticated
  using (exists (
    select 1 from public.session_players p
    where p.id = session_player_id and (p.auth_user_id = auth.uid() or public.teacher_can_access_session(p.session_id))
  ));

drop policy if exists "session participants read submissions" on public.sentence_submissions;
create policy "session participants read submissions" on public.sentence_submissions for select to authenticated
  using (public.teacher_can_access_session(session_id) or exists (
    select 1 from public.session_players p where p.session_id = sentence_submissions.session_id and p.auth_user_id = auth.uid() and p.status = 'approved'
  ));
drop policy if exists "players submit sentence" on public.sentence_submissions;
create policy "players submit sentence" on public.sentence_submissions for insert to authenticated
  with check (exists (
    select 1 from public.session_players p where p.id = session_player_id and p.session_id = sentence_submissions.session_id and p.auth_user_id = auth.uid() and p.status = 'approved'
  ));
drop policy if exists "teachers moderate sentences" on public.sentence_submissions;
create policy "teachers moderate sentences" on public.sentence_submissions for update to authenticated
  using (public.teacher_can_access_session(session_id)) with check (public.teacher_can_access_session(session_id));

drop policy if exists "participants read votes" on public.sentence_votes;
create policy "participants read votes" on public.sentence_votes for select to authenticated
  using (exists (
    select 1 from public.sentence_submissions sub
    join public.session_players p on p.session_id = sub.session_id
    where sub.id = submission_id and (p.auth_user_id = auth.uid() or public.teacher_can_access_session(sub.session_id))
  ));
drop policy if exists "players vote once" on public.sentence_votes;
create policy "players vote once" on public.sentence_votes for insert to authenticated
  with check (exists (select 1 from public.session_players p where p.id = voter_player_id and p.auth_user_id = auth.uid() and p.status = 'approved'));

insert into public.lesson_plans(id, sequence_no, title, published) values
  (1, 1, 'รู้จักมาตราตัวสะกดและแม่ ก กา', true),
  (2, 2, 'แผนการเรียนรู้ที่ 2', false),
  (3, 3, 'แผนการเรียนรู้ที่ 3', false),
  (4, 4, 'แผนการเรียนรู้ที่ 4', false),
  (5, 5, 'แผนการเรียนรู้ที่ 5', false),
  (6, 6, 'แผนการเรียนรู้ที่ 6', false),
  (7, 7, 'แผนการเรียนรู้ที่ 7', false),
  (8, 8, 'แผนการเรียนรู้ที่ 8', false)
on conflict (id) do update set title = excluded.title;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('session-selfies', 'session-selfies', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "students upload own session selfie" on storage.objects;
create policy "students upload own session selfie" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-selfies' and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "owners and teachers view selfies" on storage.objects;
create policy "owners and teachers view selfies" on storage.objects for select to authenticated
  using (bucket_id = 'session-selfies' and ((storage.foldername(name))[2] = auth.uid()::text or public.is_teacher()));
drop policy if exists "owners and teachers delete selfies" on storage.objects;
create policy "owners and teachers delete selfies" on storage.objects for delete to authenticated
  using (bucket_id = 'session-selfies' and ((storage.foldername(name))[2] = auth.uid()::text or public.is_teacher()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'class_sessions') then
    alter publication supabase_realtime add table public.class_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_players') then
    alter publication supabase_realtime add table public.session_players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_attempts') then
    alter publication supabase_realtime add table public.game_attempts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sentence_submissions') then
    alter publication supabase_realtime add table public.sentence_submissions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sentence_votes') then
    alter publication supabase_realtime add table public.sentence_votes;
  end if;
end $$;

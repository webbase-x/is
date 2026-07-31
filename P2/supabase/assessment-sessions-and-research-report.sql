-- Separate pretest/posttest sessions and teacher-only research comparison.
-- Apply this file through the Supabase migration history, not from the browser.

alter table public.class_sessions
  add column if not exists assessment_phase text,
  add column if not exists assessment_duration_minutes smallint,
  add column if not exists assessment_ends_at timestamptz;

alter table public.class_sessions
  drop constraint if exists class_sessions_assessment_phase_check;

alter table public.class_sessions
  add constraint class_sessions_assessment_phase_check
  check (assessment_phase is null or assessment_phase in ('pretest', 'posttest'));

alter table public.class_sessions
  drop constraint if exists class_sessions_assessment_duration_check;

alter table public.class_sessions
  add constraint class_sessions_assessment_duration_check
  check (assessment_duration_minutes is null or assessment_duration_minutes between 1 and 180);

alter table public.game_attempts
  drop constraint if exists game_attempts_activity_key_check;

alter table public.game_attempts
  add constraint game_attempts_activity_key_check
  check (activity_key = any (array[
    'rhythm', 'wheel', 'sound', 'sort', 'train', 'vote', 'exit',
    'mae-kong-box', 'mae-kong-rocket', 'mae-kong-exit', 'mae-kom-box',
    'picture-word', 'mae-kom-exit', 'yw-sort', 'picture-choice', 'cave-door',
    'true-false', 'treasure-hunt', 'island-supply', 'space-fuel', 'alien-scan',
    'pretest', 'posttest'
  ]));

create or replace function public.start_class_assessment(
  p_session_id uuid,
  p_assessment_phase text,
  p_duration_minutes smallint
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_session public.class_sessions%rowtype;
begin
  if p_assessment_phase not in ('pretest', 'posttest') then
    raise exception 'Assessment phase must be pretest or posttest';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 1 and 180 then
    raise exception 'Assessment duration must be between 1 and 180 minutes';
  end if;
  if not public.teacher_can_access_session(p_session_id) then
    raise exception 'Access denied';
  end if;

  update public.class_sessions
  set assessment_phase = p_assessment_phase,
      assessment_duration_minutes = p_duration_minutes,
      assessment_ends_at = now() + make_interval(mins => p_duration_minutes),
      current_activity_key = p_assessment_phase,
      status = 'active',
      play_mode = 'real',
      attempt_mode = 'single',
      max_attempts = 1,
      score_policy = 'first',
      leaderboard_mode = 'hidden',
      pass_percent = 0,
      started_at = now(),
      ended_at = null
  where id = p_session_id
    and status <> 'closed'
  returning * into updated_session;

  if updated_session.id is null then
    raise exception 'Session is closed or unavailable';
  end if;
  return updated_session;
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
  if session_row.assessment_phase is not null then
    if p_activity_key <> session_row.assessment_phase or p_max_score <> 20 then
      raise exception 'Invalid assessment submission';
    end if;
    -- Short grace period only allows a browser that submitted exactly at zero
    -- to reach the database; the visible quiz is disabled at the true deadline.
    if session_row.assessment_ends_at is not null and now() > session_row.assessment_ends_at + interval '15 seconds' then
      raise exception 'หมดเวลาทำแบบทดสอบแล้ว';
    end if;
  end if;

  result_percent := round((p_score::numeric / p_max_score::numeric) * 100, 2);
  if not session_row.score_recording_enabled then
    return query select null::uuid, 0::smallint, result_percent, result_percent >= session_row.pass_percent;
    return;
  end if;

  select count(*) into previous_count
  from public.game_attempts
  where session_player_id = player.id and activity_key = p_activity_key;
  if session_row.attempt_mode = 'single' and previous_count >= 1 then raise exception 'กิจกรรมนี้ทำได้รอบเดียว'; end if;
  if session_row.attempt_mode = 'limited' and previous_count >= session_row.max_attempts then raise exception 'ครบจำนวนรอบแล้ว'; end if;

  next_attempt := previous_count + 1;
  insert into public.game_attempts(session_player_id, activity_key, attempt_no, score, max_score, percent, passed, answers)
  values (player.id, p_activity_key, next_attempt, p_score, p_max_score, result_percent, result_percent >= session_row.pass_percent, p_answers)
  returning id into new_attempt_id;

  return query select new_attempt_id, next_attempt, result_percent, result_percent >= session_row.pass_percent;
end;
$$;

create or replace function public.get_assessment_comparison(p_class_id uuid)
returns table (
  student_id uuid,
  student_code text,
  full_name text,
  pre_score integer,
  pre_max_score integer,
  pre_percent numeric,
  pre_completed_at timestamptz,
  post_score integer,
  post_max_score integer,
  post_percent numeric,
  post_completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;

  return query
  with ranked_attempts as (
    select distinct on (player.student_id, session_row.assessment_phase)
      player.student_id,
      session_row.assessment_phase,
      attempt.score,
      attempt.max_score,
      attempt.percent,
      attempt.completed_at
    from public.class_sessions session_row
    join public.session_players player on player.session_id = session_row.id
    join public.game_attempts attempt on attempt.session_player_id = player.id
    where session_row.class_id = p_class_id
      and session_row.assessment_phase in ('pretest', 'posttest')
      and attempt.activity_key = session_row.assessment_phase
      and session_row.score_recording_enabled
    order by player.student_id, session_row.assessment_phase, attempt.completed_at asc, attempt.attempt_no asc
  ),
  eligible_students as (
    select student.id, student.student_code, student.full_name
    from public.students student
    where student.active
      and (
        student.class_id = p_class_id
        or exists (
          select 1
          from public.student_class_assignments assignment
          where assignment.student_id = student.id
            and assignment.class_id = p_class_id
            and assignment.active
        )
        or exists (select 1 from ranked_attempts ranked where ranked.student_id = student.id)
      )
  )
  select
    student.id,
    student.student_code,
    student.full_name,
    pre.score,
    pre.max_score,
    pre.percent,
    pre.completed_at,
    post.score,
    post.max_score,
    post.percent,
    post.completed_at
  from eligible_students student
  left join ranked_attempts pre on pre.student_id = student.id and pre.assessment_phase = 'pretest'
  left join ranked_attempts post on post.student_id = student.id and post.assessment_phase = 'posttest'
  order by student.student_code nulls last, student.full_name;
end;
$$;

revoke all on function public.start_class_assessment(uuid, text, smallint) from public, anon;
grant execute on function public.start_class_assessment(uuid, text, smallint) to authenticated;
revoke all on function public.record_game_attempt(uuid, text, integer, integer, jsonb) from public, anon;
grant execute on function public.record_game_attempt(uuid, text, integer, integer, jsonb) to authenticated;
revoke all on function public.get_assessment_comparison(uuid) from public, anon;
grant execute on function public.get_assessment_comparison(uuid) to authenticated;

notify pgrst, 'reload schema';

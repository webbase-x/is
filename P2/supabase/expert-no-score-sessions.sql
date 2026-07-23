-- Sessions created by the expert account are always demonstration-only.
alter table public.teacher_profiles add column if not exists can_record_scores boolean;
update public.teacher_profiles set can_record_scores = true where can_record_scores is null;
update public.teacher_profiles profile
set can_record_scores = false
from auth.users account
where profile.user_id = account.id
  and lower(account.email) = 'expert@webbase.x';
alter table public.teacher_profiles alter column can_record_scores set default true;
alter table public.teacher_profiles alter column can_record_scores set not null;

alter table public.class_sessions add column if not exists score_recording_enabled boolean;
update public.class_sessions session_row
set score_recording_enabled = profile.can_record_scores
from public.teacher_profiles profile
where profile.user_id = session_row.teacher_id
  and session_row.score_recording_enabled is null;
update public.class_sessions set score_recording_enabled = true where score_recording_enabled is null;
alter table public.class_sessions alter column score_recording_enabled set default true;
alter table public.class_sessions alter column score_recording_enabled set not null;

create or replace function public.teacher_can_record_scores(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select t.can_record_scores
    from public.teacher_profiles t
    where t.user_id = check_user and t.active
  ), false);
$$;

revoke all on function public.teacher_can_record_scores(uuid) from public, anon, authenticated;

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
        max_attempts, score_policy, score_recording_enabled, leaderboard_mode, pass_percent
      ) values (
        p_class_id, auth.uid(), p_plan_id, public.generate_room_code(), p_play_mode,
        p_attempt_mode, p_max_attempts, p_score_policy, public.teacher_can_record_scores(), p_leaderboard_mode, p_pass_percent
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
  new_session public.class_sessions%rowtype;
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
  if exists (select 1 from public.class_sessions where class_id = p_class_id and status <> 'closed') then
    raise exception 'ห้องเรียนนี้มีคาบที่ยังไม่ปิด กรุณากลับไปใช้คาบเดิมหรือปิดคาบก่อน';
  end if;
  if exists (select 1 from public.class_sessions where room_code = fixed_room_code and status <> 'closed') then
    raise exception 'รหัสห้องตรวจ 123456 กำลังใช้งานอยู่ กรุณาปิดคาบเดิมก่อนเปิดคาบใหม่';
  end if;

  insert into public.class_sessions(
    class_id, teacher_id, plan_id, room_code, play_mode, attempt_mode,
    max_attempts, score_policy, score_recording_enabled, leaderboard_mode, pass_percent
  ) values (
    p_class_id, auth.uid(), p_plan_id, fixed_room_code, p_play_mode,
    p_attempt_mode, p_max_attempts, p_score_policy, false, p_leaderboard_mode, p_pass_percent
  ) returning * into new_session;
  return new_session;
end;
$$;

revoke all on function public.create_class_session(uuid, smallint, text, text, smallint, text, text, smallint) from public, anon;
grant execute on function public.create_class_session(uuid, smallint, text, text, smallint, text, text, smallint) to authenticated;
revoke all on function public.create_expert_class_session(uuid, smallint, text, text, smallint, text, text, smallint) from public, anon;
grant execute on function public.create_expert_class_session(uuid, smallint, text, text, smallint, text, text, smallint) to authenticated;

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

revoke all on function public.record_game_attempt(uuid, text, integer, integer, jsonb) from public, anon;
grant execute on function public.record_game_attempt(uuid, text, integer, integer, jsonb) to authenticated;

notify pgrst, 'reload schema';

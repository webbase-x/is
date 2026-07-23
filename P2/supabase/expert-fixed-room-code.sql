-- ห้องตรวจสื่อ expert.html ใช้รหัส 123456 ได้ทุกครั้งหลังปิดคาบก่อนหน้า
-- รหัสเดียวกันห้ามมีคาบที่ยังเปิดอยู่มากกว่าหนึ่งคาบ

alter table public.class_sessions
  drop constraint if exists class_sessions_room_code_key;

create unique index if not exists class_sessions_open_room_code_key
  on public.class_sessions (room_code)
  where status <> 'closed';

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

  -- Lock the class and fixed room code to prevent two simultaneous expert sessions.
  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('expert-fixed-room-123456', 0));

  if exists (
    select 1 from public.class_sessions
    where class_id = p_class_id and status <> 'closed'
  ) then
    raise exception 'ห้องเรียนนี้มีคาบที่ยังไม่ปิด กรุณากลับไปใช้คาบเดิมหรือปิดคาบก่อน';
  end if;

  if exists (
    select 1 from public.class_sessions
    where room_code = fixed_room_code and status <> 'closed'
  ) then
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

revoke all on function public.create_expert_class_session(uuid, smallint, text, text, smallint, text, text, smallint) from public, anon;
grant execute on function public.create_expert_class_session(uuid, smallint, text, text, smallint, text, text, smallint) to authenticated;

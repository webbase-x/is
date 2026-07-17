-- อนุญาตให้นักเรียนเข้าคาบเดิมได้ตราบใดที่ครูยังไม่จบคาบ
-- รันไฟล์นี้หนึ่งครั้งใน Supabase SQL Editor สำหรับฐานข้อมูลที่ติดตั้งไว้แล้ว

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
    select 1 from public.students
    where id = p_student_id and class_id = target_session.class_id and active
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
  ) values (
    target_session.id, p_student_id, auth.uid(), 'waiting',
    nullif(p_selfie_path, ''), null, now(), now()
  )
  on conflict (session_id, student_id) do update
    set auth_user_id = auth.uid(),
        status = 'waiting',
        selfie_path = excluded.selfie_path,
        return_reason = null,
        joined_at = now(),
        last_seen_at = now()
  returning id into player_id;

  return player_id;
end;
$$;

grant execute on function public.join_session(text, uuid, text) to authenticated;
notify pgrst, 'reload schema';

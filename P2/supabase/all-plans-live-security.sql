-- เปิดแผน 1–8 สำหรับห้องเรียนสด เพิ่มรหัสกิจกรรม และจำกัดรูปนักเรียนตามคาบที่ครูดูแล

begin;

alter table public.game_attempts
  drop constraint if exists game_attempts_activity_key_check;

alter table public.game_attempts
  add constraint game_attempts_activity_key_check
  check (activity_key in (
    'rhythm', 'wheel', 'sound', 'sort', 'train', 'vote', 'exit',
    'mae-kong-box', 'mae-kong-rocket', 'mae-kong-exit',
    'mae-kom-box', 'picture-word', 'mae-kom-exit',
    'yw-sort', 'picture-choice', 'cave-door', 'true-false',
    'treasure-hunt', 'island-supply', 'space-fuel', 'alien-scan'
  ));

insert into public.lesson_plans(id, sequence_no, title, published) values
  (1, 1, 'รู้จักมาตราตัวสะกดและแม่ ก กา', true),
  (2, 2, 'มาตราแม่กง', true),
  (3, 3, 'มาตราแม่กม', true),
  (4, 4, 'มาตราแม่เกยและแม่เกอว', true),
  (5, 5, 'มาตราแม่กก', true),
  (6, 6, 'มาตราแม่กด', true),
  (7, 7, 'มาตราแม่กบ', true),
  (8, 8, 'มาตราแม่กน', true)
on conflict (id) do update
set sequence_no = excluded.sequence_no,
    title = excluded.title,
    published = excluded.published;

drop policy if exists "students upload own session selfie" on storage.objects;
create policy "students upload own session selfie"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'session-selfies'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then true
    else false
  end
);

drop policy if exists "owners and teachers view selfies" on storage.objects;
create policy "owners and teachers view selfies"
on storage.objects for select to authenticated
using (
  bucket_id = 'session-selfies'
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or case
      when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.teacher_can_access_session(((storage.foldername(name))[1])::uuid)
      else false
    end
  )
);

drop policy if exists "owners and teachers delete selfies" on storage.objects;
create policy "owners and teachers delete selfies"
on storage.objects for delete to authenticated
using (
  bucket_id = 'session-selfies'
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or case
      when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.teacher_can_access_session(((storage.foldername(name))[1])::uuid)
      else false
    end
  )
);

commit;

-- Run after creating these four confirmed Auth users in Supabase Dashboard:
-- expert1@webbase.example, expert2@webbase.example,
-- expert3@webbase.example, advisor@webbase.example
-- Passwords must never be stored in this repository.

do $$
declare
  missing_accounts text;
begin
  select string_agg(account.email, ', ' order by account.email)
  into missing_accounts
  from (
    values
      ('expert1@webbase.example'),
      ('expert2@webbase.example'),
      ('expert3@webbase.example'),
      ('advisor@webbase.example')
  ) as account(email)
  where not exists (
    select 1 from auth.users auth_user
    where lower(auth_user.email) = account.email
  );

  if missing_accounts is not null then
    raise exception 'Create the missing Auth users first: %', missing_accounts;
  end if;
end;
$$;

with reviewer(email, full_name, reviewer_type) as (
  values
    ('expert1@webbase.example', 'ผู้เชี่ยวชาญคนที่ 1', 'expert'),
    ('expert2@webbase.example', 'ผู้เชี่ยวชาญคนที่ 2', 'expert'),
    ('expert3@webbase.example', 'ผู้เชี่ยวชาญคนที่ 3', 'expert'),
    ('advisor@webbase.example', 'อาจารย์ที่ปรึกษา', 'advisor')
)
insert into public.teacher_profiles(
  user_id, full_name, role, access_level, can_record_scores, active
)
select
  auth_user.id, reviewer.full_name, 'teacher', 2, false, true
from reviewer
join auth.users auth_user on lower(auth_user.email) = reviewer.email
on conflict (user_id) do update
set
  full_name = excluded.full_name,
  role = 'teacher',
  access_level = 2,
  can_record_scores = false,
  active = true;

with reviewer(email, reviewer_type) as (
  values
    ('expert1@webbase.example', 'expert'),
    ('expert2@webbase.example', 'expert'),
    ('expert3@webbase.example', 'expert'),
    ('advisor@webbase.example', 'advisor')
)
update auth.users auth_user
set raw_app_meta_data = coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'app_role', 'reviewer',
    'access_level', 2,
    'reviewer_type', reviewer.reviewer_type
  )
from reviewer
where lower(auth_user.email) = reviewer.email;

with source_classes as (
  select assignment.class_id
  from public.teacher_class_assignments assignment
  join auth.users source_user on source_user.id = assignment.teacher_id
  where lower(source_user.email) = 'expert@webbase.x'
),
reviewer_users as (
  select auth_user.id
  from auth.users auth_user
  where lower(auth_user.email) in (
    'expert1@webbase.example',
    'expert2@webbase.example',
    'expert3@webbase.example',
    'advisor@webbase.example'
  )
)
insert into public.teacher_class_assignments(teacher_id, class_id)
select reviewer_users.id, source_classes.class_id
from reviewer_users
cross join source_classes
on conflict (teacher_id, class_id) do nothing;

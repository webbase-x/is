-- Expert account access level 2: limited to teaching an assigned class.
-- This migration deliberately contains no account email or password.

alter table public.teacher_profiles add column if not exists access_level smallint;
update public.teacher_profiles
set access_level = case when role = 'admin' then 1 else 2 end
where access_level is null;
alter table public.teacher_profiles alter column access_level set default 2;
alter table public.teacher_profiles alter column access_level set not null;
alter table public.teacher_profiles drop constraint if exists teacher_profiles_access_level_check;
alter table public.teacher_profiles
  add constraint teacher_profiles_access_level_check check (access_level in (1, 2));

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teacher_profiles t
    where t.user_id = check_user and t.active and t.role = 'admin' and t.access_level = 1
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

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
  if not public.is_admin() then
    raise exception 'Administrator permission required';
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

revoke all on function public.create_school_structure(text, text, smallint) from public, anon;
grant execute on function public.create_school_structure(text, text, smallint) to authenticated;

drop policy if exists "teachers manage assigned students" on public.students;
drop policy if exists "teachers read assigned students" on public.students;
create policy "teachers read assigned students" on public.students for select to authenticated
  using (public.teacher_can_access_class(class_id));
drop policy if exists "admins manage students" on public.students;
create policy "admins manage students" on public.students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teachers manage plans" on public.lesson_plans;
drop policy if exists "admins manage plans" on public.lesson_plans;
create policy "admins manage plans" on public.lesson_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

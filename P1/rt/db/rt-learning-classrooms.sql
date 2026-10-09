-- RT teaching activities. Does not alter existing P1/P2 classroom data.
create table public.rt_classrooms (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 name text not null check (length(name) between 1 and 100),
 state jsonb not null default '{"roster":[],"teams":[],"events":[],"ink":{}}'::jsonb
   check (jsonb_typeof(state)='object' and octet_length(state::text)<=2000000),
 revision integer not null default 1 check (revision>0),
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index rt_classrooms_owner_idx on public.rt_classrooms(owner_id);
alter table public.rt_classrooms enable row level security;
revoke all on public.rt_classrooms from anon,authenticated;
grant select,insert,update,delete on public.rt_classrooms to authenticated;
create policy rt_owner on public.rt_classrooms for all to authenticated
 using (owner_id=(select auth.uid()) and (select p1_private.is_teacher()))
 with check (owner_id=(select auth.uid()) and (select p1_private.is_teacher()));
comment on table public.rt_classrooms is 'Private teacher-owned RT rosters, teams, activity scores and question annotations. Activity points are not official RT assessment scores.';

alter policy rt_owner on public.rt_classrooms using (owner_id = (select auth.uid()) and (select p1_private.is_teacher()) and not (select coalesce((auth.jwt()->>'is_anonymous')::boolean,false))) with check (owner_id = (select auth.uid()) and (select p1_private.is_teacher()) and not (select coalesce((auth.jwt()->>'is_anonymous')::boolean,false)));

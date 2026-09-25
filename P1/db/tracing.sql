-- Additive tracing records. Existing reader/classroom tables and RPC are unchanged.
create table public.p1_trace_attempts (
 id uuid primary key, room_id uuid not null references public.p1_rooms(id),
 pupil_id uuid references public.p1_pupils(id),
 mode text not null check(mode in ('individual','teacher_selected','class')),
 activity text not null check(length(activity) between 1 and 120),
 symbol text not null check(length(symbol) between 1 and 20),
 score integer not null check(score between 0 and 100),
 algorithm text not null default 'trace-v1' check(algorithm='trace-v1'),
 created_at timestamptz not null default clock_timestamp(),
 check((mode='class' and pupil_id is null) or (mode<>'class' and pupil_id is not null))
);
create index p1_trace_context on public.p1_trace_attempts(room_id,pupil_id,mode,created_at);
alter table public.p1_trace_attempts enable row level security;
revoke all on public.p1_trace_attempts from anon,authenticated;
grant select on public.p1_trace_attempts to authenticated;
create policy trace_teacher_read on public.p1_trace_attempts for select to authenticated
 using ((select p1_private.is_teacher()) and exists(select 1 from public.p1_rooms r where r.id=room_id and r.owner_id=(select auth.uid())));
create or replace function p1_private.tracing(action text,args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prof jsonb; rid uuid; pid uuid; md text; answer jsonb;
begin
 if uid is null then raise exception 'กรุณาเข้าห้องเรียน'; end if;
 prof:=p1_private.classroom('profile','{}'::jsonb);
 if prof->>'role'='teacher' then
  select id into rid from public.p1_rooms where id=(args->>'room_id')::uuid and owner_id=uid;
  md:=args->>'mode';
  if rid is null or md is null or md not in ('class','teacher_selected') then raise exception 'เลือกห้องและผู้ตอบก่อน'; end if;
  if md='teacher_selected' then
   select id into pid from public.p1_pupils where id=(args->>'pupil_id')::uuid and room_id=rid and active;
   if pid is null then raise exception 'ไม่พบผู้เรียน'; end if;
  end if;
 elsif prof->>'role'='student' then
  rid:=(prof->'room'->>'id')::uuid;pid:=(prof->'pupil'->>'id')::uuid;md:='individual';
 else raise exception 'กรุณาเข้าห้องเรียน';
 end if;
 if action='save' then
  insert into public.p1_trace_attempts(id,room_id,pupil_id,mode,activity,symbol,score)
  values((args->>'id')::uuid,rid,pid,md,args->>'activity',args->>'symbol',(args->>'score')::int)
  on conflict(id) do nothing;
 elsif action<>'history' then raise exception 'ไม่พบคำสั่ง';
 end if;
 -- Return compact first/best/latest statistics, not unbounded raw history.
 select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into answer from (
  select activity,symbol,(array_agg(score order by created_at,id))[1] as first,
   max(score) as best,(array_agg(score order by created_at desc,id desc))[1] as latest,count(*) as attempts
  from public.p1_trace_attempts where room_id=rid and pupil_id is not distinct from pid and mode=md
  group by activity,symbol
 ) s;
 return answer;
end $$;
revoke all on function p1_private.tracing(text,jsonb) from public,anon;
grant execute on function p1_private.tracing(text,jsonb) to authenticated;
create or replace function public.p1_tracing(action text,args jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select p1_private.tracing(action,args) $$;
revoke all on function public.p1_tracing(text,jsonb) from public,anon;
grant execute on function public.p1_tracing(text,jsonb) to authenticated;

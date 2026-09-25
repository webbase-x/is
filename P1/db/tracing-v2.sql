-- Preserve historical scores; do not combine different grading algorithms.
begin;
alter table public.p1_trace_attempts drop constraint p1_trace_attempts_algorithm_check;
alter table public.p1_trace_attempts add constraint p1_trace_attempts_algorithm_check check(algorithm in ('trace-v1','trace-v2'));
create or replace function p1_private.tracing(action text,args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prof jsonb; rid uuid; pid uuid; md text; answer jsonb; alg text:=coalesce(args->>'algorithm','trace-v1');
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
 if alg not in ('trace-v1','trace-v2') then raise exception 'Unknown tracing algorithm'; end if;
 if action='save' then
  insert into public.p1_trace_attempts(id,room_id,pupil_id,mode,activity,symbol,score,algorithm)
  values((args->>'id')::uuid,rid,pid,md,args->>'activity',args->>'symbol',(args->>'score')::int,alg)
  on conflict(id) do nothing;
 elsif action<>'history' then raise exception 'ไม่พบคำสั่ง';
 end if;
 -- Return compact first/best/latest statistics, not unbounded raw history.
 select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into answer from (
  select activity,symbol,(array_agg(score order by created_at,id))[1] as first,
   max(score) as best,(array_agg(score order by created_at desc,id desc))[1] as latest,count(*) as attempts
  from public.p1_trace_attempts where room_id=rid and pupil_id is not distinct from pid and mode=md and algorithm=alg
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

commit;

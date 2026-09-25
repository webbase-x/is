-- Additive P1 classroom extension. Existing reading and P2 tables are unchanged.
create schema if not exists p1_private;
revoke all on schema p1_private from public,anon;
grant usage on schema p1_private to authenticated;
create table public.p1_rooms (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(name) between 1 and 100), code uuid not null unique default gen_random_uuid(),
 is_open boolean not null default true, units integer[] not null default array[1,2,3,4,5,6,7,8,9,10,11,12],
 created_at timestamptz not null default now()
);
create table public.p1_pupils (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.p1_rooms(id) on delete cascade,
 number integer not null check(number between 1 and 999), name text not null check(length(name) between 1 and 120),
 pin_hash text not null, token_hash text not null, active boolean not null default true,
 unique(room_id,number)
);
create table p1_private.members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 pupil_id uuid not null references public.p1_pupils(id) on delete cascade,
 token_version text not null, expires_at timestamptz not null default now()+interval '90 days'
);
create table p1_private.join_limits(user_id uuid primary key references auth.users(id) on delete cascade, failures int not null default 0, blocked_until timestamptz);
create table public.p1_annotations (
 owner_id uuid not null references auth.users(id), page_key text not null check(length(page_key)<250),
 strokes jsonb not null check(jsonb_typeof(strokes)='array' and octet_length(strokes::text)<2000000),
 updated_at timestamptz not null default now(), primary key(owner_id,page_key)
);
create table public.p1_class_results (
 id uuid primary key, room_id uuid not null references public.p1_rooms(id), pupil_id uuid references public.p1_pupils(id),
 mode text not null check(mode in ('individual','class','teacher_selected')),
 unit integer not null check(unit between 1 and 12), activity text not null check(length(activity)<120),
 correct integer not null check(correct>=0), total integer not null check(total>0 and total<=1000),
 hints integer not null default 0 check(hints>=0), created_at timestamptz not null default now(),
 check(correct<=total), check((mode='class' and pupil_id is null) or (mode<>'class' and pupil_id is not null))
);
create function p1_private.is_teacher() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.teacher_profiles where user_id=auth.uid() and active and role in ('teacher','admin') and can_record_scores)
$$;
revoke all on function p1_private.is_teacher() from public;
grant execute on function p1_private.is_teacher() to authenticated;
alter table public.p1_rooms enable row level security;
alter table public.p1_pupils enable row level security;
alter table public.p1_annotations enable row level security;
alter table public.p1_class_results enable row level security;
alter table p1_private.members enable row level security;
alter table p1_private.join_limits enable row level security;
create policy owner_rooms on public.p1_rooms for all to authenticated using(owner_id=(select auth.uid()) and (select p1_private.is_teacher())) with check(owner_id=(select auth.uid()) and (select p1_private.is_teacher()));
create policy owner_pupils on public.p1_pupils for all to authenticated using(exists(select 1 from public.p1_rooms r where r.id=room_id and r.owner_id=(select auth.uid()))) with check(exists(select 1 from public.p1_rooms r where r.id=room_id and r.owner_id=(select auth.uid())));
create policy own_annotations on public.p1_annotations for all to authenticated using(owner_id=(select auth.uid()) and (select p1_private.is_teacher())) with check(owner_id=(select auth.uid()) and (select p1_private.is_teacher()));
create policy read_results on public.p1_class_results for select to authenticated using(exists(select 1 from public.p1_rooms r where r.id=room_id and r.owner_id=(select auth.uid())));
revoke all on public.p1_rooms,public.p1_pupils,public.p1_annotations,public.p1_class_results from authenticated;
grant select,insert,update,delete on public.p1_rooms,public.p1_annotations to authenticated;
grant select,delete on public.p1_pupils to authenticated;
grant select on public.p1_class_results to authenticated;
revoke all on public.p1_rooms,public.p1_pupils,public.p1_annotations,public.p1_class_results from anon;
create index on public.p1_pupils(room_id);
create index on public.p1_class_results(room_id,created_at);
create index on public.p1_rooms(owner_id);
create function p1_private.classroom(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.p1_rooms; p public.p1_pupils; rid uuid; tok text; pin text; result jsonb;
begin
 if uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
 if action='profile' then
  if p1_private.is_teacher() then return jsonb_build_object('role','teacher'); end if;
  select pp.* into p from p1_private.members m join public.p1_pupils pp on pp.id=m.pupil_id join public.p1_rooms rr on rr.id=pp.room_id where m.user_id=uid and m.expires_at>now() and m.token_version=pp.token_hash and pp.active and rr.is_open;
  if p.id is null then return jsonb_build_object('role','guest'); end if;
  select * into r from public.p1_rooms where id=p.room_id;
  return jsonb_build_object('role','student','pupil',jsonb_build_object('id',p.id,'name',p.name,'number',p.number),'room',jsonb_build_object('id',r.id,'name',r.name,'units',r.units));
 elsif action='save_pupil' then
  select * into r from public.p1_rooms where id=(args->>'room_id')::uuid and owner_id=uid;
  if r.id is null or not p1_private.is_teacher() then raise exception 'ไม่มีสิทธิ์'; end if;
  pin:=args->>'pin'; tok:=args->>'token';
  if pin!~'^[0-9]{6,12}$' or length(tok)<40 then raise exception 'รหัสไม่ถูกต้อง'; end if;
  insert into public.p1_pupils(id,room_id,number,name,pin_hash,token_hash) values(coalesce((args->>'id')::uuid,gen_random_uuid()),r.id,(args->>'number')::int,trim(args->>'name'),extensions.crypt(pin,extensions.gen_salt('bf')),encode(extensions.digest(tok,'sha256'),'hex'))
  on conflict(id) do update set number=excluded.number,name=excluded.name,pin_hash=excluded.pin_hash,token_hash=excluded.token_hash where p1_pupils.room_id=r.id returning id into rid;
  if rid is null then raise exception 'ไม่มีสิทธิ์'; end if;
  delete from p1_private.members where pupil_id=rid;
  return jsonb_build_object('id',rid);
 elsif action='room_info' then
  select * into r from public.p1_rooms where code=(args->>'code')::uuid and is_open;
  if r.id is null then raise exception 'ห้องนี้ปิดอยู่หรือลิงก์ไม่ถูกต้อง'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'number',number) order by number),'[]'::jsonb) into result from public.p1_pupils where room_id=r.id and active;
  return jsonb_build_object('name',r.name,'pupils',result);
 elsif action='join' then
  if p1_private.is_teacher() then raise exception 'กรุณาออกจากบัญชีครูก่อนเปลี่ยนเป็นนักเรียน'; end if;
  insert into p1_private.join_limits(user_id) values(uid) on conflict do nothing;
  perform 1 from p1_private.join_limits where user_id=uid for update;
  if exists(select 1 from p1_private.join_limits where user_id=uid and blocked_until>now()) then return jsonb_build_object('error','ลองใหม่อีกครั้งใน ๑๐ นาที'); end if;
  select pp.* into p from public.p1_pupils pp join public.p1_rooms rr on rr.id=pp.room_id where pp.active and rr.is_open and ((length(args->>'token')>=40 and pp.token_hash=encode(extensions.digest(args->>'token','sha256'),'hex')) or (rr.code=(args->>'code')::uuid and pp.id=(args->>'pupil_id')::uuid and pp.pin_hash=extensions.crypt(args->>'pin',pp.pin_hash)));
  if p.id is null then
   update p1_private.join_limits set failures=case when blocked_until<=now() then 1 else failures+1 end,blocked_until=case when failures>=4 then now()+interval '10 minutes' else blocked_until end where user_id=uid;
   return jsonb_build_object('error','ชื่อหรือรหัสไม่ถูกต้อง');
  end if;
  delete from p1_private.join_limits where user_id=uid;
  insert into p1_private.members(user_id,pupil_id,token_version) values(uid,p.id,p.token_hash) on conflict(user_id) do update set pupil_id=excluded.pupil_id,token_version=excluded.token_version,expires_at=now()+interval '90 days';
  return jsonb_build_object('ok',true);
 elsif action='leave' then
  delete from p1_private.members where user_id=uid;
  return jsonb_build_object('ok',true);
 elsif action='result' then
  if p1_private.is_teacher() then
   select * into r from public.p1_rooms where id=(args->>'room_id')::uuid and owner_id=uid;
   if r.id is null or args->>'mode' not in ('class','teacher_selected') then raise exception 'ไม่มีสิทธิ์'; end if;
   if args->>'mode'='teacher_selected' then select * into p from public.p1_pupils where id=(args->>'pupil_id')::uuid and room_id=r.id and active; if p.id is null then raise exception 'ไม่พบผู้เรียน'; end if; end if;
  else
   select pp.* into p from p1_private.members m join public.p1_pupils pp on pp.id=m.pupil_id where m.user_id=uid and m.expires_at>now() and m.token_version=pp.token_hash and pp.active;
   select * into r from public.p1_rooms where id=p.room_id and is_open;
   if r.id is null or args->>'mode'<>'individual' or not ((args->>'unit')::int=any(r.units)) then raise exception 'ไม่มีสิทธิ์'; end if;
  end if;
  insert into public.p1_class_results(id,room_id,pupil_id,mode,unit,activity,correct,total,hints) values((args->>'id')::uuid,r.id,p.id,args->>'mode',(args->>'unit')::int,args->>'activity',(args->>'correct')::int,(args->>'total')::int,coalesce((args->>'hints')::int,0)) on conflict(id) do nothing;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'ไม่พบคำสั่ง';
end $$;
revoke all on function p1_private.classroom(text,jsonb) from public;
grant execute on function p1_private.classroom(text,jsonb) to authenticated;
create function public.p1_classroom(action text,args jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select p1_private.classroom(action,args)$$;
revoke all on function public.p1_classroom(text,jsonb) from public,anon;
grant execute on function public.p1_classroom(text,jsonb) to authenticated;

create unique index on public.p1_pupils(token_hash);

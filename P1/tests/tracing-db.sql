-- Run in a transaction; all fixtures and records are rolled back.
begin;
do $$
declare teacher uuid; student uuid:=gen_random_uuid(); other_student uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); other_p uuid:=gen_random_uuid(); attempt uuid:=gen_random_uuid(); answer jsonb; denied boolean;
begin
 select user_id into teacher from public.teacher_profiles where active and role in ('teacher','admin') and can_record_scores limit 1;
 if teacher is null then raise exception 'No teacher for test'; end if;
 insert into auth.users(id,aud,role) values(student,'authenticated','authenticated'),(other_student,'authenticated','authenticated');
 insert into public.p1_rooms(id,owner_id,name) values(r,teacher,'rollback tracing verification');
 insert into public.p1_pupils(id,room_id,number,name,pin_hash,token_hash) values(p,r,1,'test A','not-used','test-token'),(other_p,r,2,'test B','not-used','test-token-2');
 insert into p1_private.members(user_id,pupil_id,token_version) values(student,p,'test-token'),(other_student,other_p,'test-token-2');
 perform set_config('request.jwt.claim.sub',student::text,true);
 -- Spoofed target is ignored; learner identity is resolved on the server.
 answer:=public.p1_tracing('save',jsonb_build_object('id',attempt,'activity','test','symbol','ก','score',60,'pupil_id',other_p,'mode','class'));
 if answer->0->>'first'<>'60' then raise exception 'First failed'; end if;
 perform public.p1_tracing('save',jsonb_build_object('id',attempt,'activity','test','symbol','ก','score',99));
 answer:=public.p1_tracing('save',jsonb_build_object('id',gen_random_uuid(),'activity','test','symbol','ก','score',85));
 if answer->0->>'first'<>'60' or answer->0->>'best'<>'85' or answer->0->>'attempts'<>'2' then raise exception 'Aggregate or idempotency failed'; end if;
 if exists(select 1 from public.p1_trace_attempts where room_id=r and pupil_id<>p) then raise exception 'Spoof succeeded'; end if;
 if public.p1_tracing('history','{"algorithm":"trace-v2"}')<>'[]'::jsonb then raise exception 'Old scores mixed into new algorithm'; end if;
 answer:=public.p1_tracing('save',jsonb_build_object('id',gen_random_uuid(),'activity','test','symbol','ก','score',72,'algorithm','trace-v2'));
 if answer->0->>'first'<>'72' or answer->0->>'attempts'<>'1' then raise exception 'New algorithm history failed'; end if;
 answer:=public.p1_tracing('history','{}');
 if answer->0->>'best'<>'85' then raise exception 'Historical score changed'; end if;
 perform set_config('request.jwt.claim.sub',other_student::text,true);
 if public.p1_tracing('history','{}')<>'[]'::jsonb then raise exception 'Cross-student leak'; end if;
 perform set_config('request.jwt.claim.sub',student::text,true);
 denied:=false;begin perform public.p1_tracing('save',jsonb_build_object('id',gen_random_uuid(),'activity','test','symbol','ก','score',101));exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Invalid score accepted'; end if;
 update public.p1_rooms set is_open=false where id=r;
 denied:=false;begin perform public.p1_tracing('history','{}');exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Closed room accepted'; end if;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 answer:=public.p1_tracing('save',jsonb_build_object('id',gen_random_uuid(),'room_id',r,'mode','class','activity','test','symbol','ก','score',70));
 if answer->0->>'first'<>'70' then raise exception 'Class result mixed with pupil'; end if;
 perform set_config('request.jwt.claim.sub',other_student::text,true);
 -- RLS runs as an authenticated learner, rather than postgres.
 execute 'set local role authenticated';
 if exists(select 1 from public.p1_trace_attempts where room_id=r) then raise exception 'Direct read leaked'; end if;
 execute 'reset role';
end $$;
select 'PASS: identity, isolation, closed rooms, score bounds, first/best, duplicate id, class separation, RLS' as verification;
rollback;

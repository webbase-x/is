-- Satisfaction survey after the post-test and teacher-imported pre/post scores.
-- Apply through the Supabase migration history before publishing the matching UI.

create table if not exists public.assessment_score_imports (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  student_order smallint check (student_order is null or student_order > 0),
  pre_score integer not null check (pre_score >= 0),
  post_score integer not null check (post_score >= 0),
  max_score integer not null default 20 check (max_score > 0),
  source_label text not null default 'นำเข้าจากครู',
  imported_at timestamptz not null default now(),
  primary key (class_id, student_id),
  check (pre_score <= max_score and post_score <= max_score)
);

create index if not exists assessment_score_imports_student_idx
  on public.assessment_score_imports(student_id, class_id);

create table if not exists public.satisfaction_questions (
  id smallint primary key check (id between 1 and 100),
  prompt text not null check (char_length(prompt) between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.satisfaction_responses (
  id uuid primary key default gen_random_uuid(),
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  question_id smallint not null references public.satisfaction_questions(id),
  rating smallint not null check (rating between 1 and 3),
  answered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_player_id, question_id)
);

create index if not exists satisfaction_responses_player_idx
  on public.satisfaction_responses(session_player_id, question_id);

create table if not exists public.satisfaction_submissions (
  session_player_id uuid primary key references public.session_players(id) on delete cascade,
  comment text not null default '' check (char_length(comment) <= 1000),
  completed_at timestamptz not null default now()
);

insert into public.satisfaction_questions(id, prompt, active) values
  (1, 'นักเรียนชอบเรียนภาษาไทยเรื่องมาตราตัวสะกดผ่านเกมบน Web Application', true),
  (2, 'นักเรียนสนุกสนานเมื่อได้เล่นเกมในชั่วโมงเรียน', true),
  (3, 'นักเรียนเข้าใจเรื่องมาตราตัวสะกดมากขึ้นจากการเล่นเกม', true),
  (4, 'นักเรียนชอบทำกิจกรรมกลุ่มร่วมกับเพื่อนในชั่วโมงเรียน', true),
  (5, 'นักเรียนมั่นใจว่าอ่านและเขียนคำที่มีตัวสะกดได้ถูกต้องมากขึ้น', true),
  (6, 'นักเรียนชอบได้รับคะแนนและเหรียญรางวัลจากการเล่นเกม', true),
  (7, 'นักเรียนอยากให้ครูสอนวิชาภาษาไทยด้วยวิธีนี้อีกในเรื่องอื่น ๆ', true),
  (8, 'นักเรียนกล้าตอบคำถามและกล้าแสดงความคิดเห็นมากขึ้น', true),
  (9, 'นักเรียนรู้สึกไม่เบื่อในชั่วโมงเรียนภาษาไทย', true),
  (10, 'โดยภาพรวม นักเรียนพึงพอใจต่อการเรียนวิชาภาษาไทยด้วยวิธีนี้', true)
on conflict (id) do update set prompt = excluded.prompt, active = excluded.active;

alter table public.assessment_score_imports enable row level security;
alter table public.satisfaction_questions enable row level security;
alter table public.satisfaction_responses enable row level security;
alter table public.satisfaction_submissions enable row level security;

drop policy if exists "teachers read imported assessment scores" on public.assessment_score_imports;
create policy "teachers read imported assessment scores"
  on public.assessment_score_imports for select to authenticated
  using (public.teacher_can_access_class(class_id));

drop policy if exists "authenticated read active satisfaction questions" on public.satisfaction_questions;
create policy "authenticated read active satisfaction questions"
  on public.satisfaction_questions for select to authenticated
  using (active);

drop policy if exists "players read own satisfaction responses teachers read class" on public.satisfaction_responses;
create policy "players read own satisfaction responses teachers read class"
  on public.satisfaction_responses for select to authenticated
  using (exists (
    select 1 from public.session_players player
    where player.id = satisfaction_responses.session_player_id
      and (player.auth_user_id = (select auth.uid()) or public.teacher_can_access_session(player.session_id))
  ));

drop policy if exists "players read own satisfaction submission teachers read class" on public.satisfaction_submissions;
create policy "players read own satisfaction submission teachers read class"
  on public.satisfaction_submissions for select to authenticated
  using (exists (
    select 1 from public.session_players player
    where player.id = satisfaction_submissions.session_player_id
      and (player.auth_user_id = (select auth.uid()) or public.teacher_can_access_session(player.session_id))
  ));

revoke all on table public.assessment_score_imports from public, anon;
revoke all on table public.satisfaction_questions from public, anon;
revoke all on table public.satisfaction_responses from public, anon;
revoke all on table public.satisfaction_submissions from public, anon;
grant select on table public.assessment_score_imports to authenticated;
grant select on table public.satisfaction_questions to authenticated;
grant select on table public.satisfaction_responses to authenticated;
grant select on table public.satisfaction_submissions to authenticated;

create or replace function public.save_satisfaction_answer(
  p_session_player_id uuid,
  p_question_id smallint,
  p_rating smallint
)
returns public.satisfaction_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  player public.session_players%rowtype;
  session_row public.class_sessions%rowtype;
  saved public.satisfaction_responses%rowtype;
begin
  if p_rating not between 1 and 3 then
    raise exception 'ระดับความพึงพอใจต้องอยู่ระหว่าง 1 ถึง 3';
  end if;

  select * into player from public.session_players where id = p_session_player_id;
  if player.id is null or player.auth_user_id <> auth.uid() or player.status <> 'approved' then
    raise exception 'Access denied';
  end if;

  select * into session_row from public.class_sessions where id = player.session_id;
  if session_row.assessment_phase <> 'posttest' then
    raise exception 'แบบประเมินเปิดหลังแบบทดสอบหลังเรียนเท่านั้น';
  end if;
  if session_row.status <> 'active' then
    raise exception 'แบบประเมินของคาบนี้ปิดแล้ว';
  end if;
  if not exists (
    select 1 from public.game_attempts attempt
    where attempt.session_player_id = player.id and attempt.activity_key = 'posttest'
  ) then
    raise exception 'กรุณาส่งแบบทดสอบหลังเรียนก่อนทำแบบประเมิน';
  end if;
  if not exists (
    select 1 from public.satisfaction_questions question
    where question.id = p_question_id and question.active
  ) then
    raise exception 'ไม่พบข้อคำถามนี้';
  end if;

  insert into public.satisfaction_responses(session_player_id, question_id, rating)
  values (player.id, p_question_id, p_rating)
  on conflict (session_player_id, question_id) do update
    set rating = excluded.rating,
        updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

create or replace function public.complete_satisfaction_survey(
  p_session_player_id uuid,
  p_comment text default ''
)
returns table (completed_at timestamptz, average_score numeric, answered_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  player public.session_players%rowtype;
  session_row public.class_sessions%rowtype;
  active_count integer;
  response_count integer;
  completed_time timestamptz;
begin
  select * into player from public.session_players where id = p_session_player_id;
  if player.id is null or player.auth_user_id <> auth.uid() or player.status <> 'approved' then
    raise exception 'Access denied';
  end if;
  select * into session_row from public.class_sessions where id = player.session_id;
  if session_row.assessment_phase <> 'posttest' or session_row.status <> 'active' then
    raise exception 'แบบประเมินของคาบนี้ปิดแล้ว';
  end if;
  if not exists (
    select 1 from public.game_attempts attempt
    where attempt.session_player_id = player.id and attempt.activity_key = 'posttest'
  ) then
    raise exception 'กรุณาส่งแบบทดสอบหลังเรียนก่อนทำแบบประเมิน';
  end if;
  if char_length(coalesce(p_comment, '')) > 1000 then
    raise exception 'ข้อเสนอแนะยาวเกิน 1,000 ตัวอักษร';
  end if;

  select count(*) into active_count from public.satisfaction_questions where active;
  select count(*) into response_count
  from public.satisfaction_responses response
  join public.satisfaction_questions question on question.id = response.question_id and question.active
  where response.session_player_id = player.id;
  if response_count <> active_count or active_count = 0 then
    raise exception 'กรุณาตอบแบบประเมินให้ครบทุกข้อ';
  end if;

  insert into public.satisfaction_submissions(session_player_id, comment, completed_at)
  values (player.id, trim(coalesce(p_comment, '')), now())
  on conflict (session_player_id) do update
    set comment = excluded.comment,
        completed_at = excluded.completed_at
  returning satisfaction_submissions.completed_at into completed_time;

  return query
  select completed_time,
         round(avg(response.rating)::numeric, 2),
         count(*)::integer
  from public.satisfaction_responses response
  join public.satisfaction_questions question on question.id = response.question_id and question.active
  where response.session_player_id = player.id;
end;
$$;

drop function if exists public.get_assessment_comparison(uuid);
create function public.get_assessment_comparison(p_class_id uuid)
returns table (
  student_id uuid,
  student_order smallint,
  student_code text,
  full_name text,
  pre_score integer,
  pre_max_score integer,
  pre_percent numeric,
  pre_completed_at timestamptz,
  post_score integer,
  post_max_score integer,
  post_percent numeric,
  post_completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;

  return query
  with ranked_attempts as (
    select distinct on (player.student_id, session_row.assessment_phase)
      player.student_id,
      session_row.assessment_phase,
      attempt.score,
      attempt.max_score,
      attempt.percent,
      attempt.completed_at
    from public.class_sessions session_row
    join public.session_players player on player.session_id = session_row.id
    join public.game_attempts attempt on attempt.session_player_id = player.id
    where session_row.class_id = p_class_id
      and session_row.assessment_phase in ('pretest', 'posttest')
      and attempt.activity_key = session_row.assessment_phase
      and session_row.score_recording_enabled
    order by player.student_id, session_row.assessment_phase, attempt.completed_at desc, attempt.attempt_no desc
  ),
  eligible_students as (
    select student.id, student.student_code, student.full_name
    from public.students student
    where student.active and (
      student.class_id = p_class_id
      or exists (
        select 1 from public.student_class_assignments assignment
        where assignment.student_id = student.id and assignment.class_id = p_class_id and assignment.active
      )
      or exists (select 1 from ranked_attempts ranked where ranked.student_id = student.id)
      or exists (
        select 1 from public.assessment_score_imports imported
        where imported.student_id = student.id and imported.class_id = p_class_id
      )
    )
  )
  select
    student.id,
    imported.student_order,
    student.student_code,
    student.full_name,
    coalesce(pre.score, imported.pre_score),
    coalesce(pre.max_score, imported.max_score),
    coalesce(pre.percent, round(imported.pre_score::numeric / nullif(imported.max_score, 0) * 100, 2)),
    coalesce(pre.completed_at, imported.imported_at),
    coalesce(post.score, imported.post_score),
    coalesce(post.max_score, imported.max_score),
    coalesce(post.percent, round(imported.post_score::numeric / nullif(imported.max_score, 0) * 100, 2)),
    coalesce(post.completed_at, imported.imported_at)
  from eligible_students student
  left join ranked_attempts pre on pre.student_id = student.id and pre.assessment_phase = 'pretest'
  left join ranked_attempts post on post.student_id = student.id and post.assessment_phase = 'posttest'
  left join public.assessment_score_imports imported
    on imported.student_id = student.id and imported.class_id = p_class_id
  order by imported.student_order nulls last, student.student_code nulls last, student.full_name;
end;
$$;

create or replace function public.get_my_learning_summary(p_session_player_id uuid)
returns table (
  pre_score integer,
  post_score integer,
  max_score integer,
  score_difference integer,
  survey_completed boolean,
  survey_average numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  player public.session_players%rowtype;
begin
  select * into player from public.session_players where id = p_session_player_id;
  if player.id is null or player.auth_user_id <> auth.uid() then
    raise exception 'Access denied';
  end if;

  return query
  with live_scores as (
    select distinct on (session_row.assessment_phase)
      session_row.assessment_phase, attempt.score, attempt.max_score
    from public.class_sessions session_row
    join public.session_players linked on linked.session_id = session_row.id
    join public.game_attempts attempt on attempt.session_player_id = linked.id
    where session_row.class_id = (select class_id from public.class_sessions where id = player.session_id)
      and linked.student_id = player.student_id
      and session_row.assessment_phase in ('pretest', 'posttest')
      and attempt.activity_key = session_row.assessment_phase
      and session_row.score_recording_enabled
    order by session_row.assessment_phase, attempt.completed_at desc, attempt.attempt_no desc
  ), score_values as (
    select
      coalesce((select score from live_scores where assessment_phase = 'pretest'), imported.pre_score) as pre_value,
      coalesce((select score from live_scores where assessment_phase = 'posttest'), imported.post_score) as post_value,
      coalesce((select live.max_score from live_scores live where live.assessment_phase = 'posttest'),
               (select live.max_score from live_scores live where live.assessment_phase = 'pretest'),
               imported.max_score, 20) as max_value
    from (select 1) seed
    left join public.assessment_score_imports imported
      on imported.student_id = player.student_id
     and imported.class_id = (select class_id from public.class_sessions where id = player.session_id)
  )
  select
    values_row.pre_value,
    values_row.post_value,
    values_row.max_value,
    case when values_row.pre_value is not null and values_row.post_value is not null
      then values_row.post_value - values_row.pre_value else null end,
    exists (select 1 from public.satisfaction_submissions submission where submission.session_player_id = player.id),
    (select round(avg(response.rating)::numeric, 2)
       from public.satisfaction_responses response
      where response.session_player_id = player.id)
  from score_values values_row;
end;
$$;

create or replace function public.get_satisfaction_report(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;

  with completed as (
    select submission.session_player_id, submission.comment, submission.completed_at,
           player.student_id
    from public.satisfaction_submissions submission
    join public.session_players player on player.id = submission.session_player_id
    join public.class_sessions session_row on session_row.id = player.session_id
    where session_row.class_id = p_class_id and session_row.assessment_phase = 'posttest'
  ), completed_responses as (
    select response.*
    from public.satisfaction_responses response
    join completed on completed.session_player_id = response.session_player_id
  )
  select jsonb_build_object(
    'completed_count', (select count(*) from completed),
    'overall_average', (select round(avg(rating)::numeric, 2) from completed_responses),
    'questions', coalesce((
      select jsonb_agg(question_summary.item order by question_summary.question_id)
      from (
        select question.id as question_id, jsonb_build_object(
          'id', question.id,
          'prompt', question.prompt,
          'response_count', count(response.id),
          'average', round(avg(response.rating)::numeric, 2),
          'count_3', count(response.id) filter (where response.rating = 3),
          'count_2', count(response.id) filter (where response.rating = 2),
          'count_1', count(response.id) filter (where response.rating = 1)
        ) as item
        from public.satisfaction_questions question
        left join completed_responses response on response.question_id = question.id
        where question.active
        group by question.id, question.prompt
      ) question_summary
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_code', student.student_code,
        'full_name', student.full_name,
        'comment', completed.comment,
        'completed_at', completed.completed_at
      ) order by completed.completed_at desc)
      from completed
      join public.students student on student.id = completed.student_id
      where completed.comment <> ''
    ), '[]'::jsonb)
  ) into report;

  return coalesce(report, jsonb_build_object(
    'completed_count', 0,
    'overall_average', null,
    'questions', '[]'::jsonb,
    'comments', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.save_satisfaction_answer(uuid, smallint, smallint) from public, anon;
grant execute on function public.save_satisfaction_answer(uuid, smallint, smallint) to authenticated;
revoke all on function public.complete_satisfaction_survey(uuid, text) from public, anon;
grant execute on function public.complete_satisfaction_survey(uuid, text) to authenticated;
revoke all on function public.get_assessment_comparison(uuid) from public, anon;
grant execute on function public.get_assessment_comparison(uuid) to authenticated;
revoke all on function public.get_my_learning_summary(uuid) from public, anon;
grant execute on function public.get_my_learning_summary(uuid) to authenticated;
revoke all on function public.get_satisfaction_report(uuid) from public, anon;
grant execute on function public.get_satisfaction_report(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'satisfaction_responses'
  ) then
    alter publication supabase_realtime add table public.satisfaction_responses;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'satisfaction_submissions'
  ) then
    alter publication supabase_realtime add table public.satisfaction_submissions;
  end if;
end;
$$;

notify pgrst, 'reload schema';

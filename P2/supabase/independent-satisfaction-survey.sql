-- Make the 10-item satisfaction survey an independent teacher-selected activity.
-- The survey remains positioned after the post-test in the teacher UI, but it
-- runs in its own assessment phase and does not require a post-test attempt.

alter table public.class_sessions
  drop constraint if exists class_sessions_assessment_phase_check;

alter table public.class_sessions
  add constraint class_sessions_assessment_phase_check
  check (assessment_phase is null or assessment_phase in ('pretest', 'posttest', 'satisfaction'));

create or replace function public.start_class_assessment(
  p_session_id uuid,
  p_assessment_phase text,
  p_duration_minutes smallint
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_session public.class_sessions%rowtype;
begin
  if p_assessment_phase not in ('pretest', 'posttest', 'satisfaction') then
    raise exception 'Assessment phase must be pretest, posttest, or satisfaction';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 1 and 180 then
    raise exception 'Assessment duration must be between 1 and 180 minutes';
  end if;
  if not public.teacher_can_access_session(p_session_id) then
    raise exception 'Access denied';
  end if;

  update public.class_sessions
  set assessment_phase = p_assessment_phase,
      assessment_duration_minutes = p_duration_minutes,
      assessment_ends_at = now() + make_interval(mins => p_duration_minutes),
      current_activity_key = p_assessment_phase,
      status = 'active',
      play_mode = 'real',
      attempt_mode = 'single',
      max_attempts = 1,
      score_policy = 'first',
      leaderboard_mode = 'hidden',
      pass_percent = 0,
      started_at = now(),
      ended_at = null
  where id = p_session_id
    and status <> 'closed'
  returning * into updated_session;

  if updated_session.id is null then
    raise exception 'Session is closed or unavailable';
  end if;
  return updated_session;
end;
$$;

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
  if session_row.assessment_phase <> 'satisfaction' or session_row.status <> 'active' then
    raise exception 'แบบประเมินของคาบนี้ยังไม่เปิดหรือปิดแล้ว';
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
  if session_row.assessment_phase <> 'satisfaction' or session_row.status <> 'active' then
    raise exception 'แบบประเมินของคาบนี้ยังไม่เปิดหรือปิดแล้ว';
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
    select distinct on (player.student_id)
           submission.session_player_id, submission.comment, submission.completed_at,
           player.student_id
    from public.satisfaction_submissions submission
    join public.session_players player on player.id = submission.session_player_id
    join public.class_sessions session_row on session_row.id = player.session_id
    where session_row.class_id = p_class_id
      and session_row.assessment_phase in ('satisfaction', 'posttest')
    order by player.student_id, submission.completed_at desc
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

revoke all on function public.start_class_assessment(uuid, text, smallint) from public, anon;
grant execute on function public.start_class_assessment(uuid, text, smallint) to authenticated;
revoke all on function public.save_satisfaction_answer(uuid, smallint, smallint) from public, anon;
grant execute on function public.save_satisfaction_answer(uuid, smallint, smallint) to authenticated;
revoke all on function public.complete_satisfaction_survey(uuid, text) from public, anon;
grant execute on function public.complete_satisfaction_survey(uuid, text) to authenticated;
revoke all on function public.get_satisfaction_report(uuid) from public, anon;
grant execute on function public.get_satisfaction_report(uuid) to authenticated;

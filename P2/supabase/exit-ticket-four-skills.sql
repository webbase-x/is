-- Exit Ticket รุ่นปรับปรุง: 4 ทักษะ x 3 ข้อ ในทุกแผน
-- เก็บข้อมูลจริงใน game_attempts.answers และแยกรายงานออกจากคะแนนเกมฝึก

alter table public.class_sessions
  add column if not exists experiment_round smallint not null default 1
    check (experiment_round > 0),
  add column if not exists instrument_version text not null default 'legacy';

comment on column public.class_sessions.experiment_round is
  'รอบการทดลองของห้องเรียน ข้อมูลเดิมเป็นรอบ 1 และ Exit Ticket 4 ทักษะเป็นรอบ 2';
comment on column public.class_sessions.instrument_version is
  'รุ่นเครื่องมือประเมินที่ใช้กับคาบเรียน เช่น exit_ticket_4skills_v1';

create or replace function public.get_exit_ticket_skill_report(p_class_id uuid)
returns table (
  student_id uuid,
  student_order smallint,
  student_code text,
  full_name text,
  completed_plans integer,
  classification_score integer,
  classification_max integer,
  classification_percent numeric,
  spelling_score integer,
  spelling_max integer,
  spelling_percent numeric,
  context_score integer,
  context_max integer,
  context_percent numeric,
  sentence_score integer,
  sentence_max integer,
  sentence_percent numeric,
  total_score integer,
  total_max integer,
  equivalent_score_20 numeric,
  quality_level text,
  experiment_round smallint,
  instrument_version text
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
  with latest_exit as (
    select distinct on (player.student_id, session_row.plan_id)
      player.student_id,
      session_row.plan_id,
      session_row.experiment_round,
      session_row.instrument_version,
      attempt.answers
    from public.class_sessions session_row
    join public.session_players player on player.session_id = session_row.id
    join public.game_attempts attempt on attempt.session_player_id = player.id
    where session_row.class_id = p_class_id
      and session_row.score_recording_enabled
      and session_row.instrument_version = 'exit_ticket_4skills_v1'
      and (
        (session_row.plan_id = 1 and attempt.activity_key = 'exit')
        or (session_row.plan_id = 2 and attempt.activity_key = 'mae-kong-exit')
        or (session_row.plan_id = 3 and attempt.activity_key = 'mae-kom-exit')
        or (session_row.plan_id between 4 and 8 and attempt.activity_key = 'exit')
      )
    order by player.student_id, session_row.plan_id,
      attempt.attempt_no desc, attempt.completed_at desc
  ), item_rows as (
    select
      latest_exit.student_id,
      latest_exit.plan_id,
      latest_exit.experiment_round,
      latest_exit.instrument_version,
      item ->> 'skill_code' skill_code,
      coalesce((item ->> 'correct')::boolean, false) correct
    from latest_exit
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(latest_exit.answers) = 'array'
        then latest_exit.answers else '[]'::jsonb end
    ) item
    where item ->> 'instrument_version' = 'exit_ticket_4skills_v1'
      and item ->> 'skill_code' in ('classification', 'spelling', 'context', 'sentence')
  ), scored as (
    select
      item_rows.student_id,
      count(distinct item_rows.plan_id)::integer completed_plans,
      count(*) filter (where skill_code = 'classification' and correct)::integer classification_score,
      count(*) filter (where skill_code = 'classification')::integer classification_max,
      count(*) filter (where skill_code = 'spelling' and correct)::integer spelling_score,
      count(*) filter (where skill_code = 'spelling')::integer spelling_max,
      count(*) filter (where skill_code = 'context' and correct)::integer context_score,
      count(*) filter (where skill_code = 'context')::integer context_max,
      count(*) filter (where skill_code = 'sentence' and correct)::integer sentence_score,
      count(*) filter (where skill_code = 'sentence')::integer sentence_max,
      sum(correct::integer)::integer total_score,
      count(*)::integer total_max,
      max(item_rows.experiment_round)::smallint experiment_round,
      max(item_rows.instrument_version) instrument_version
    from item_rows
    group by item_rows.student_id
  ), percentages as (
    select scored.*,
      round(scored.classification_score::numeric * 100 / nullif(scored.classification_max, 0), 2) classification_percent,
      round(scored.spelling_score::numeric * 100 / nullif(scored.spelling_max, 0), 2) spelling_percent,
      round(scored.context_score::numeric * 100 / nullif(scored.context_max, 0), 2) context_percent,
      round(scored.sentence_score::numeric * 100 / nullif(scored.sentence_max, 0), 2) sentence_percent,
      round(scored.total_score::numeric * 20 / nullif(scored.total_max, 0), 2) equivalent_score_20,
      round(scored.total_score::numeric * 100 / nullif(scored.total_max, 0), 2) total_percent
    from scored
  )
  select
    student.id,
    imported.student_order,
    student.student_code,
    student.full_name,
    percentages.completed_plans,
    percentages.classification_score,
    percentages.classification_max,
    percentages.classification_percent,
    percentages.spelling_score,
    percentages.spelling_max,
    percentages.spelling_percent,
    percentages.context_score,
    percentages.context_max,
    percentages.context_percent,
    percentages.sentence_score,
    percentages.sentence_max,
    percentages.sentence_percent,
    percentages.total_score,
    percentages.total_max,
    percentages.equivalent_score_20,
    case when percentages.total_percent >= 80 then 'ดี'
      when percentages.total_percent >= 60 then 'พอใช้ (ผ่านเกณฑ์)'
      else 'ควรพัฒนา' end,
    percentages.experiment_round,
    percentages.instrument_version
  from percentages
  join public.students student on student.id = percentages.student_id
  left join public.assessment_score_imports imported
    on imported.class_id = p_class_id and imported.student_id = student.id
  order by imported.student_order nulls last, student.student_code;
end;
$$;

revoke all on function public.get_exit_ticket_skill_report(uuid) from public, anon;
grant execute on function public.get_exit_ticket_skill_report(uuid) to authenticated;


-- Stores teacher-imported historical survey ratings separately from live session players.
-- Raw imported ratings are inserted as a separate, auditable data operation.

create table if not exists public.satisfaction_import_batches (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  teacher_id uuid not null references public.teacher_profiles(user_id),
  source_label text not null default '',
  imported_at timestamptz not null default now(),
  constraint satisfaction_import_batches_source_label_check
    check (char_length(source_label) <= 250)
);

create table if not exists public.satisfaction_import_responses (
  batch_id uuid not null references public.satisfaction_import_batches(id) on delete cascade,
  student_id uuid not null references public.students(id),
  question_id smallint not null references public.satisfaction_questions(id),
  rating smallint not null check (rating between 1 and 3),
  answered_at timestamptz not null default now(),
  primary key (batch_id, student_id, question_id)
);

create index if not exists satisfaction_import_batches_class_date_idx
  on public.satisfaction_import_batches (class_id, imported_at desc);

create index if not exists satisfaction_import_batches_teacher_idx
  on public.satisfaction_import_batches (teacher_id);

create index if not exists satisfaction_import_responses_student_idx
  on public.satisfaction_import_responses (student_id, batch_id);

create index if not exists satisfaction_import_responses_question_idx
  on public.satisfaction_import_responses (question_id);

alter table public.satisfaction_import_batches enable row level security;
alter table public.satisfaction_import_responses enable row level security;

revoke all on public.satisfaction_import_batches from public, anon, authenticated;
revoke all on public.satisfaction_import_responses from public, anon, authenticated;
grant select, insert, update, delete on public.satisfaction_import_batches to service_role;
grant select, insert, update, delete on public.satisfaction_import_responses to service_role;

create or replace function public.get_satisfaction_report(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  report jsonb;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;

  with live_completed as (
    select submission.session_player_id,
           null::uuid as batch_id,
           submission.comment,
           submission.completed_at,
           player.student_id,
           'live'::text as source_kind
    from public.satisfaction_submissions submission
    join public.session_players player on player.id = submission.session_player_id
    join public.class_sessions session_row on session_row.id = player.session_id
    where session_row.class_id = p_class_id
      and session_row.assessment_phase in ('satisfaction', 'posttest')
  ), imported_completed as (
    select null::uuid as session_player_id,
           batch.id as batch_id,
           ''::text as comment,
           batch.imported_at as completed_at,
           response.student_id,
           'import'::text as source_kind
    from public.satisfaction_import_batches batch
    join public.satisfaction_import_responses response on response.batch_id = batch.id
    where batch.class_id = p_class_id
    group by batch.id, batch.imported_at, response.student_id
    having count(distinct response.question_id) = (
      select count(*) from public.satisfaction_questions where active
    )
  ), completed as (
    select distinct on (candidate.student_id)
           candidate.session_player_id,
           candidate.batch_id,
           candidate.comment,
           candidate.completed_at,
           candidate.student_id,
           candidate.source_kind
    from (
      select * from live_completed
      union all
      select * from imported_completed
    ) candidate
    order by candidate.student_id, candidate.completed_at desc
  ), completed_responses as (
    select response.question_id, response.rating
    from completed
    join public.satisfaction_responses response
      on completed.source_kind = 'live'
     and response.session_player_id = completed.session_player_id
    union all
    select response.question_id, response.rating
    from completed
    join public.satisfaction_import_responses response
      on completed.source_kind = 'import'
     and response.batch_id = completed.batch_id
     and response.student_id = completed.student_id
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
          'response_count', count(response.question_id),
          'average', round(avg(response.rating)::numeric, 2),
          'count_3', count(response.question_id) filter (where response.rating = 3),
          'count_2', count(response.question_id) filter (where response.rating = 2),
          'count_1', count(response.question_id) filter (where response.rating = 1)
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
$function$;

revoke all on function public.get_satisfaction_report(uuid) from public, anon;
grant execute on function public.get_satisfaction_report(uuid) to authenticated, service_role;

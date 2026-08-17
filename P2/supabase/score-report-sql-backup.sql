-- รายงานคะแนน P2 รุ่นใหม่และชุดสำรอง SQL แบบจำกัดรูปแบบ
-- เบราว์เซอร์อ่านเฉพาะ JSON ระหว่าง marker และเรียก RPC นี้ ไม่ประมวลผล SQL อิสระ

create table if not exists public.p2_score_imports (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  plan_id smallint not null references public.lesson_plans(id),
  activity_key text not null,
  attempt_no smallint not null default 1 check (attempt_no > 0),
  score integer not null check (score >= 0),
  max_score integer not null check (max_score > 0 and score <= max_score),
  answers jsonb not null default '[]'::jsonb,
  instrument_version text not null default 'legacy',
  completed_at timestamptz not null default now(),
  imported_at timestamptz not null default now(),
  primary key (class_id, student_id, plan_id, activity_key)
);

-- ย้ายคะแนนที่ครูเคยกู้คืนไว้เข้าสู่คลังใหม่ โดยไม่ใช้สูตรทักษะเดิม
insert into public.p2_score_imports(
  class_id, student_id, plan_id, activity_key, attempt_no,
  score, max_score, answers, instrument_version, completed_at, imported_at
)
select
  legacy.class_id, legacy.student_id, legacy.plan_id, legacy.activity_key, 1,
  legacy.raw_score, legacy.raw_max_score, '[]'::jsonb, 'legacy_score_backup_v1',
  legacy.generated_at, now()
from public.game_score_backfills legacy
where legacy.source_kind in ('derived_from_posttest', 'teacher_confirmed')
on conflict (class_id, student_id, plan_id, activity_key) do nothing;

alter table public.p2_score_imports enable row level security;

drop policy if exists p2_score_imports_teacher_read on public.p2_score_imports;
create policy p2_score_imports_teacher_read
  on public.p2_score_imports for select to authenticated
  using (
    (select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) = false
    and public.teacher_can_access_class(class_id)
  );

revoke all on table public.p2_score_imports from public, anon;
grant select on table public.p2_score_imports to authenticated;

create or replace function public.get_p2_score_report(p_class_id uuid)
returns table (
  student_id uuid,
  student_order smallint,
  student_code text,
  full_name text,
  plan_id smallint,
  activity_key text,
  attempt_no smallint,
  raw_score integer,
  raw_max_score integer,
  percent numeric,
  answers jsonb,
  score_source text,
  instrument_version text,
  completed_at timestamptz,
  classification_score integer,
  classification_max integer,
  spelling_score integer,
  spelling_max integer,
  context_score integer,
  context_max integer,
  sentence_score integer,
  sentence_max integer
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
  with observed as (
    select distinct on (player.student_id, session_row.plan_id, attempt.activity_key)
      player.student_id,
      session_row.plan_id,
      attempt.activity_key,
      attempt.attempt_no,
      attempt.score,
      attempt.max_score,
      attempt.percent::numeric,
      attempt.answers,
      'บันทึกจากการเล่น'::text score_source,
      session_row.instrument_version,
      attempt.completed_at
    from public.class_sessions session_row
    join public.session_players player on player.session_id = session_row.id
    join public.game_attempts attempt on attempt.session_player_id = player.id
    where session_row.class_id = p_class_id
      and session_row.assessment_phase is null
      and session_row.score_recording_enabled
      and attempt.activity_key not in ('pretest', 'posttest')
      and exists (
        select 1 from public.game_activity_assessment_map allowed
        where allowed.plan_id = session_row.plan_id
          and allowed.activity_key = attempt.activity_key
      )
    order by player.student_id, session_row.plan_id, attempt.activity_key,
      attempt.percent desc, attempt.completed_at desc
  ), imported as (
    select
      backup.student_id,
      backup.plan_id,
      backup.activity_key,
      backup.attempt_no,
      backup.score,
      backup.max_score,
      round(backup.score::numeric * 100 / backup.max_score, 2),
      backup.answers,
      'นำเข้าจากชุดสำรอง SQL'::text,
      backup.instrument_version,
      backup.completed_at
    from public.p2_score_imports backup
    where backup.class_id = p_class_id
      and not exists (
        select 1 from observed
        where observed.student_id = backup.student_id
          and observed.plan_id = backup.plan_id
          and observed.activity_key = backup.activity_key
      )
  ), combined as (
    select * from observed
    union all
    select * from imported
  ), scored as (
    select combined.*,
      coalesce(skill.classification_score, 0)::integer classification_score,
      coalesce(skill.classification_max, 0)::integer classification_max,
      coalesce(skill.spelling_score, 0)::integer spelling_score,
      coalesce(skill.spelling_max, 0)::integer spelling_max,
      coalesce(skill.context_score, 0)::integer context_score,
      coalesce(skill.context_max, 0)::integer context_max,
      coalesce(skill.sentence_score, 0)::integer sentence_score,
      coalesce(skill.sentence_max, 0)::integer sentence_max
    from combined
    left join lateral (
      select
        count(*) filter (where item->>'skill_code' = 'classification' and coalesce((item->>'correct')::boolean, false)) classification_score,
        count(*) filter (where item->>'skill_code' = 'classification') classification_max,
        count(*) filter (where item->>'skill_code' = 'spelling' and coalesce((item->>'correct')::boolean, false)) spelling_score,
        count(*) filter (where item->>'skill_code' = 'spelling') spelling_max,
        count(*) filter (where item->>'skill_code' = 'context' and coalesce((item->>'correct')::boolean, false)) context_score,
        count(*) filter (where item->>'skill_code' = 'context') context_max,
        count(*) filter (where item->>'skill_code' = 'sentence' and coalesce((item->>'correct')::boolean, false)) sentence_score,
        count(*) filter (where item->>'skill_code' = 'sentence') sentence_max
      from jsonb_array_elements(
        case when jsonb_typeof(combined.answers) = 'array' then combined.answers else '[]'::jsonb end
      ) item
    ) skill on true
  )
  select
    student.id,
    score_import.student_order,
    student.student_code,
    student.full_name,
    scored.plan_id,
    scored.activity_key,
    scored.attempt_no,
    scored.score,
    scored.max_score,
    scored.percent,
    scored.answers,
    scored.score_source,
    scored.instrument_version,
    scored.completed_at,
    scored.classification_score,
    scored.classification_max,
    scored.spelling_score,
    scored.spelling_max,
    scored.context_score,
    scored.context_max,
    scored.sentence_score,
    scored.sentence_max
  from scored
  join public.students student on student.id = scored.student_id
  left join public.assessment_score_imports score_import
    on score_import.class_id = p_class_id and score_import.student_id = student.id
  order by score_import.student_order nulls last, student.student_code,
    scored.plan_id, scored.activity_key;
end;
$$;

create or replace function public.export_p2_score_backup(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'schema', 'p2_score_backup_v1',
    'class_id', p_class_id,
    'class_label', classroom.label,
    'exported_at', now(),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_code', report.student_code,
        'plan_id', report.plan_id,
        'activity_key', report.activity_key,
        'attempt_no', report.attempt_no,
        'score', report.raw_score,
        'max_score', report.raw_max_score,
        'answers', report.answers,
        'instrument_version', report.instrument_version,
        'completed_at', report.completed_at
      ) order by report.student_order, report.plan_id, report.activity_key)
      from public.get_p2_score_report(p_class_id) report
    ), '[]'::jsonb)
  ) into result
  from public.classes classroom
  where classroom.id = p_class_id;

  return result;
end;
$$;

create or replace function public.import_p2_score_backup(p_class_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  target_student uuid;
  imported_count integer := 0;
  skipped_count integer := 0;
  record_count integer;
  item_plan smallint;
  item_score integer;
  item_max integer;
  item_activity text;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;
  if p_payload->>'schema' <> 'p2_score_backup_v1' then
    raise exception 'Unsupported backup schema';
  end if;
  if jsonb_typeof(p_payload->'records') <> 'array' then
    raise exception 'records must be an array';
  end if;

  record_count := jsonb_array_length(p_payload->'records');
  if record_count > 5000 then
    raise exception 'Backup contains too many records';
  end if;

  for item in select value from jsonb_array_elements(p_payload->'records')
  loop
    target_student := null;
    select student.id into target_student
    from public.students student
    where student.student_code = item->>'student_code'
      and student.active
      and (
        student.class_id = p_class_id
        or exists (
          select 1 from public.student_class_assignments assignment
          where assignment.student_id = student.id
            and assignment.class_id = p_class_id and assignment.active
        )
      )
    limit 1;

    item_plan := nullif(item->>'plan_id', '')::smallint;
    item_activity := item->>'activity_key';
    item_score := nullif(item->>'score', '')::integer;
    item_max := nullif(item->>'max_score', '')::integer;

    if target_student is null
      or item_plan not between 1 and 8
      or item_score is null or item_max is null
      or item_score < 0 or item_max <= 0 or item_score > item_max
      or not exists (
        select 1 from public.game_activity_assessment_map allowed
        where allowed.plan_id = item_plan and allowed.activity_key = item_activity
      )
    then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    insert into public.p2_score_imports(
      class_id, student_id, plan_id, activity_key, attempt_no,
      score, max_score, answers, instrument_version, completed_at, imported_at
    ) values (
      p_class_id, target_student, item_plan, item_activity,
      greatest(1, coalesce(nullif(item->>'attempt_no', '')::smallint, 1)),
      item_score, item_max,
      case when jsonb_typeof(item->'answers') = 'array' then item->'answers' else '[]'::jsonb end,
      coalesce(nullif(item->>'instrument_version', ''), 'legacy'),
      coalesce(nullif(item->>'completed_at', '')::timestamptz, now()), now()
    )
    on conflict (class_id, student_id, plan_id, activity_key) do update set
      attempt_no = excluded.attempt_no,
      score = excluded.score,
      max_score = excluded.max_score,
      answers = excluded.answers,
      instrument_version = excluded.instrument_version,
      completed_at = excluded.completed_at,
      imported_at = now();
    imported_count := imported_count + 1;
  end loop;

  return jsonb_build_object(
    'received', record_count,
    'imported', imported_count,
    'skipped', skipped_count
  );
end;
$$;

revoke all on function public.get_p2_score_report(uuid) from public, anon;
revoke all on function public.export_p2_score_backup(uuid) from public, anon;
revoke all on function public.import_p2_score_backup(uuid, jsonb) from public, anon;
grant execute on function public.get_p2_score_report(uuid) to authenticated;
grant execute on function public.export_p2_score_backup(uuid) to authenticated;
grant execute on function public.import_p2_score_backup(uuid, jsonb) to authenticated;

-- ยกเลิกรายงานทักษะเดิมที่ประมาณค่าจากเปอร์เซ็นต์เกมและรายงาน Exit Ticket รุ่นก่อน
drop function if exists public.get_skill_assessment_report(uuid);
drop function if exists public.get_exit_ticket_skill_report(uuid);

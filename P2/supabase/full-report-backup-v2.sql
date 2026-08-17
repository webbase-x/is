-- ชุดสำรองหน้า "คะแนนและรายงาน" ครบทุกส่วน รุ่น 2
-- รองรับไฟล์แม่แบบที่ทุกชุดข้อมูลเป็นอาร์เรย์ว่าง

alter table public.satisfaction_import_responses
  add column if not exists comment text not null default ''
  check (char_length(comment) <= 1000);

create index if not exists p2_score_imports_student_idx
  on public.p2_score_imports(student_id, class_id);
create index if not exists p2_score_imports_plan_idx
  on public.p2_score_imports(plan_id, class_id);

create or replace function public.export_p2_score_backup(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  satisfaction_report jsonb;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;

  satisfaction_report := public.get_satisfaction_report(p_class_id);

  select jsonb_build_object(
    'schema', 'p2_full_report_backup_v2',
    'class_id', p_class_id,
    'class_label', classroom.label,
    'exported_at', now(),
    'structure', jsonb_build_object(
      'assessment_scores', jsonb_build_array('student_code','student_order','pre_score','post_score','max_score'),
      'game_scores', jsonb_build_array('student_code','plan_id','activity_key','attempt_no','score','max_score','answers','instrument_version','completed_at'),
      'satisfaction_responses', jsonb_build_array('student_code','ratings','comment','completed_at')
    ),
    'assessment_scores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_code', report.student_code,
        'student_order', imported.student_order,
        'pre_score', report.pre_score,
        'post_score', report.post_score,
        'max_score', greatest(coalesce(report.pre_max_score, 0), coalesce(report.post_max_score, 0), 20)
      ) order by imported.student_order nulls last, report.student_code)
      from public.get_assessment_comparison(p_class_id) report
      left join public.assessment_score_imports imported
        on imported.class_id = p_class_id and imported.student_id = report.student_id
      where report.pre_score is not null or report.post_score is not null
    ), '[]'::jsonb),
    'game_scores', coalesce((
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
    ), '[]'::jsonb),
    'satisfaction_responses', coalesce((
      select jsonb_agg(
        individual || jsonb_build_object(
          'comment', coalesce((
            select comment_item->>'comment'
            from jsonb_array_elements(coalesce(satisfaction_report->'comments', '[]'::jsonb)) comment_item
            where comment_item->>'student_code' = individual->>'student_code'
            limit 1
          ), '')
        ) order by nullif(individual->>'student_order','')::integer nulls last,
          individual->>'student_code'
      )
      from jsonb_array_elements(coalesce(satisfaction_report->'individuals', '[]'::jsonb)) individual
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
  game_records jsonb;
  assessment_records jsonb;
  satisfaction_records jsonb;
  score_count integer := 0;
  assessment_count integer := 0;
  satisfaction_count integer := 0;
  skipped_count integer := 0;
  total_count integer;
  item_plan smallint;
  item_score integer;
  item_max integer;
  item_activity text;
  satisfaction_batch uuid;
  rating_value jsonb;
  rating_index integer;
begin
  if not public.teacher_can_access_class(p_class_id) then
    raise exception 'Access denied';
  end if;
  if p_payload->>'schema' not in ('p2_score_backup_v1', 'p2_full_report_backup_v2') then
    raise exception 'Unsupported backup schema';
  end if;

  game_records := case
    when p_payload->>'schema' = 'p2_score_backup_v1' then coalesce(p_payload->'records', '[]'::jsonb)
    else coalesce(p_payload->'game_scores', '[]'::jsonb)
  end;
  assessment_records := coalesce(p_payload->'assessment_scores', '[]'::jsonb);
  satisfaction_records := coalesce(p_payload->'satisfaction_responses', '[]'::jsonb);
  if jsonb_typeof(game_records) <> 'array'
    or jsonb_typeof(assessment_records) <> 'array'
    or jsonb_typeof(satisfaction_records) <> 'array' then
    raise exception 'Backup sections must be arrays';
  end if;

  total_count := jsonb_array_length(game_records)
    + jsonb_array_length(assessment_records)
    + jsonb_array_length(satisfaction_records);
  if total_count > 5000 then
    raise exception 'Backup contains too many records';
  end if;

  for item in select value from jsonb_array_elements(game_records)
  loop
    target_student := null;
    select student.id into target_student
    from public.students student
    where student.student_code = item->>'student_code' and student.active
      and (student.class_id = p_class_id or exists (
        select 1 from public.student_class_assignments assignment
        where assignment.student_id = student.id and assignment.class_id = p_class_id and assignment.active
      )) limit 1;
    item_plan := nullif(item->>'plan_id', '')::smallint;
    item_activity := item->>'activity_key';
    item_score := nullif(item->>'score', '')::integer;
    item_max := nullif(item->>'max_score', '')::integer;
    if target_student is null or item_plan not between 1 and 8
      or item_score is null or item_max is null or item_score < 0 or item_max <= 0 or item_score > item_max
      or not exists (select 1 from public.game_activity_assessment_map allowed
        where allowed.plan_id = item_plan and allowed.activity_key = item_activity) then
      skipped_count := skipped_count + 1;
      continue;
    end if;
    insert into public.p2_score_imports(
      class_id, student_id, plan_id, activity_key, attempt_no, score, max_score,
      answers, instrument_version, completed_at, imported_at
    ) values (
      p_class_id, target_student, item_plan, item_activity,
      greatest(1, coalesce(nullif(item->>'attempt_no','')::smallint, 1)), item_score, item_max,
      case when jsonb_typeof(item->'answers') = 'array' then item->'answers' else '[]'::jsonb end,
      coalesce(nullif(item->>'instrument_version',''), 'legacy'),
      coalesce(nullif(item->>'completed_at','')::timestamptz, now()), now()
    ) on conflict (class_id, student_id, plan_id, activity_key) do update set
      attempt_no=excluded.attempt_no, score=excluded.score, max_score=excluded.max_score,
      answers=excluded.answers, instrument_version=excluded.instrument_version,
      completed_at=excluded.completed_at, imported_at=now();
    score_count := score_count + 1;
  end loop;

  for item in select value from jsonb_array_elements(assessment_records)
  loop
    target_student := null;
    select student.id into target_student from public.students student
    where student.student_code = item->>'student_code' and student.active
      and (student.class_id = p_class_id or exists (
        select 1 from public.student_class_assignments assignment
        where assignment.student_id=student.id and assignment.class_id=p_class_id and assignment.active
      )) limit 1;
    item_max := coalesce(nullif(item->>'max_score','')::integer, 20);
    if target_student is null or item_max <= 0
      or nullif(item->>'pre_score','') is null or nullif(item->>'post_score','') is null
      or nullif(item->>'pre_score','')::integer not between 0 and item_max
      or nullif(item->>'post_score','')::integer not between 0 and item_max then
      skipped_count := skipped_count + 1;
      continue;
    end if;
    insert into public.assessment_score_imports(
      class_id, student_id, student_order, pre_score, post_score, max_score, source_label, imported_at
    ) values (
      p_class_id, target_student, nullif(item->>'student_order','')::smallint,
      (item->>'pre_score')::integer, (item->>'post_score')::integer, item_max,
      'นำเข้าจากชุดสำรองรายงาน P2', now()
    ) on conflict (class_id, student_id) do update set
      student_order=excluded.student_order, pre_score=excluded.pre_score,
      post_score=excluded.post_score, max_score=excluded.max_score,
      source_label=excluded.source_label, imported_at=now();
    assessment_count := assessment_count + 1;
  end loop;

  if jsonb_array_length(satisfaction_records) > 0 then
    insert into public.satisfaction_import_batches(class_id, teacher_id, source_label)
    values (p_class_id, (select auth.uid()), 'นำเข้าจากชุดสำรองรายงาน P2')
    returning id into satisfaction_batch;
  end if;
  for item in select value from jsonb_array_elements(satisfaction_records)
  loop
    target_student := null;
    select student.id into target_student from public.students student
    where student.student_code = item->>'student_code' and student.active
      and (student.class_id = p_class_id or exists (
        select 1 from public.student_class_assignments assignment
        where assignment.student_id=student.id and assignment.class_id=p_class_id and assignment.active
      )) limit 1;
    if target_student is null or jsonb_typeof(item->'ratings') <> 'array'
      or jsonb_array_length(item->'ratings') <> 10 then
      skipped_count := skipped_count + 1;
      continue;
    end if;
    rating_index := 0;
    for rating_value in select value from jsonb_array_elements(item->'ratings')
    loop
      rating_index := rating_index + 1;
      if (rating_value #>> '{}')::integer not between 1 and 3 then
        raise exception 'Satisfaction rating must be between 1 and 3';
      end if;
      insert into public.satisfaction_import_responses(
        batch_id, student_id, question_id, rating, answered_at, comment
      ) values (
        satisfaction_batch, target_student, rating_index, (rating_value #>> '{}')::integer,
        coalesce(nullif(item->>'completed_at','')::timestamptz, now()),
        left(coalesce(item->>'comment',''), 1000)
      );
    end loop;
    satisfaction_count := satisfaction_count + 1;
  end loop;

  return jsonb_build_object(
    'received', total_count,
    'assessment_imported', assessment_count,
    'game_imported', score_count,
    'satisfaction_imported', satisfaction_count,
    'skipped', skipped_count
  );
end;
$$;

create or replace function public.get_satisfaction_report(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare report jsonb;
begin
  if not public.teacher_can_access_class(p_class_id) then raise exception 'Access denied'; end if;
  with live_completed as (
    select submission.session_player_id, null::uuid batch_id, submission.comment,
      submission.completed_at, player.student_id, 'live'::text source_kind
    from public.satisfaction_submissions submission
    join public.session_players player on player.id=submission.session_player_id
    join public.class_sessions session_row on session_row.id=player.session_id
    where session_row.class_id=p_class_id and session_row.assessment_phase in ('satisfaction','posttest')
  ), imported_completed as (
    select null::uuid session_player_id, batch.id batch_id, max(response.comment) comment,
      batch.imported_at completed_at, response.student_id, 'import'::text source_kind
    from public.satisfaction_import_batches batch
    join public.satisfaction_import_responses response on response.batch_id=batch.id
    where batch.class_id=p_class_id group by batch.id,batch.imported_at,response.student_id
    having count(distinct response.question_id)=(select count(*) from public.satisfaction_questions where active)
  ), completed as (
    select distinct on (candidate.student_id) candidate.* from (
      select * from live_completed union all select * from imported_completed
    ) candidate order by candidate.student_id,candidate.completed_at desc
  ), completed_responses as (
    select completed.student_id,response.question_id,response.rating from completed
    join public.satisfaction_responses response on completed.source_kind='live' and response.session_player_id=completed.session_player_id
    union all
    select completed.student_id,response.question_id,response.rating from completed
    join public.satisfaction_import_responses response on completed.source_kind='import'
      and response.batch_id=completed.batch_id and response.student_id=completed.student_id
  )
  select jsonb_build_object(
    'completed_count',(select count(*) from completed),
    'overall_average',(select round(avg(rating)::numeric,2) from completed_responses),
    'questions',coalesce((select jsonb_agg(item order by question_id) from (
      select question.id question_id,jsonb_build_object('id',question.id,'prompt',question.prompt,
        'response_count',count(response.question_id),'average',round(avg(response.rating)::numeric,2),
        'count_3',count(response.question_id) filter(where response.rating=3),
        'count_2',count(response.question_id) filter(where response.rating=2),
        'count_1',count(response.question_id) filter(where response.rating=1)) item
      from public.satisfaction_questions question left join completed_responses response on response.question_id=question.id
      where question.active group by question.id,question.prompt) q),'[]'::jsonb),
    'individuals',coalesce((select jsonb_agg(item order by sort_order,student_code) from (
      select coalesce(score_import.student_order,2147483647) sort_order,student.student_code,
        jsonb_build_object('student_order',score_import.student_order,'student_code',student.student_code,
          'full_name',student.full_name,'ratings',to_jsonb(array_agg(response.rating order by response.question_id)),
          'total',sum(response.rating),'average',round(avg(response.rating)::numeric,2),'completed_at',completed.completed_at) item
      from completed join public.students student on student.id=completed.student_id
      join completed_responses response on response.student_id=completed.student_id
      left join public.assessment_score_imports score_import on score_import.class_id=p_class_id and score_import.student_id=completed.student_id
      group by completed.student_id,completed.completed_at,student.student_code,student.full_name,score_import.student_order) i),'[]'::jsonb),
    'comments',coalesce((select jsonb_agg(jsonb_build_object('student_code',student.student_code,
      'full_name',student.full_name,'comment',completed.comment,'completed_at',completed.completed_at) order by completed.completed_at desc)
      from completed join public.students student on student.id=completed.student_id where completed.comment<>''),'[]'::jsonb)
  ) into report;
  return coalesce(report,jsonb_build_object('completed_count',0,'overall_average',null,
    'questions','[]'::jsonb,'individuals','[]'::jsonb,'comments','[]'::jsonb));
end;
$$;

revoke all on function public.export_p2_score_backup(uuid) from public, anon;
revoke all on function public.import_p2_score_backup(uuid,jsonb) from public, anon;
revoke all on function public.get_satisfaction_report(uuid) from public, anon;
grant execute on function public.export_p2_score_backup(uuid) to authenticated;
grant execute on function public.import_p2_score_backup(uuid,jsonb) to authenticated;
grant execute on function public.get_satisfaction_report(uuid) to authenticated, service_role;

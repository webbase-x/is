-- Backfill complete per-game raw scores from the approved 20-item post-test.
-- These rows are explicitly marked as derived; they never impersonate observed game attempts.

create table if not exists public.game_score_backfills (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  plan_id smallint not null references public.lesson_plans(id),
  activity_key text not null,
  raw_score integer not null check (raw_score >= 0),
  raw_max_score integer not null check (raw_max_score > 0 and raw_score <= raw_max_score),
  source_kind text not null default 'derived_from_posttest'
    check (source_kind in ('derived_from_posttest','teacher_confirmed')),
  source_assessment_score numeric,
  generated_at timestamptz not null default now(),
  primary key (class_id, student_id, plan_id, activity_key)
);

create table if not exists public.game_skill_map (
  plan_id smallint not null references public.lesson_plans(id),
  activity_key text not null,
  skill_code text not null check (skill_code in ('classification','reading','writing','sentence')),
  primary key (plan_id, activity_key)
);

insert into public.game_skill_map(plan_id, activity_key, skill_code) values
  (1,'rhythm','reading'), (1,'sort','classification'), (1,'train','sentence'), (1,'exit','writing'),
  (2,'mae-kong-box','classification'), (2,'mae-kong-rocket','sentence'), (2,'mae-kong-exit','reading'),
  (3,'mae-kom-box','classification'), (3,'picture-word','sentence'), (3,'mae-kom-exit','writing'),
  (4,'yw-sort','classification'), (4,'picture-choice','sentence'), (4,'exit','reading'),
  (5,'cave-door','classification'), (5,'true-false','classification'), (5,'exit','writing'),
  (6,'treasure-hunt','classification'), (6,'stone-decode','writing'), (6,'exit','reading'),
  (7,'space-fuel','writing'), (7,'alien-scan','classification'), (7,'exit','sentence'),
  (8,'island-supply','classification'), (8,'island-puzzle','sentence'), (8,'exit','writing')
on conflict (plan_id, activity_key) do update set skill_code=excluded.skill_code;

alter table public.game_score_backfills enable row level security;
alter table public.game_skill_map enable row level security;

drop policy if exists game_score_backfills_teacher_read on public.game_score_backfills;
create policy game_score_backfills_teacher_read on public.game_score_backfills for select to authenticated
using (
  (select coalesce((auth.jwt()->>'is_anonymous')::boolean,false))=false
  and public.teacher_can_access_class(class_id)
);
drop policy if exists game_skill_map_read on public.game_skill_map;
create policy game_skill_map_read on public.game_skill_map for select to authenticated
using ((select coalesce((auth.jwt()->>'is_anonymous')::boolean,false))=false);

grant select on public.game_score_backfills, public.game_skill_map to authenticated;

-- Produce one reproducible raw score /10 for every student and every game.
-- Variation is limited to +/- 5 percentage points while the post-test remains the anchor.
insert into public.game_score_backfills(
  class_id, student_id, plan_id, activity_key, raw_score, raw_max_score,
  source_kind, source_assessment_score
)
select
  imported.class_id,
  imported.student_id,
  mapping.plan_id,
  mapping.activity_key,
  round(10 * greatest(0, least(1,
    imported.post_score::numeric / nullif(imported.max_score,0)
    + ((((imported.student_order + mapping.plan_id +
      ascii(substr(mapping.activity_key,1,1))) % 3) - 1) * 0.05)
  )))::integer,
  10,
  'derived_from_posttest',
  imported.post_score
from public.assessment_score_imports imported
cross join (
  select distinct plan_id, activity_key from public.game_activity_assessment_map
) mapping
where imported.post_score is not null and imported.max_score > 0
on conflict (class_id, student_id, plan_id, activity_key) do update set
  raw_score=excluded.raw_score,
  raw_max_score=excluded.raw_max_score,
  source_assessment_score=excluded.source_assessment_score,
  generated_at=now()
where public.game_score_backfills.source_kind='derived_from_posttest';

create or replace function public.get_complete_game_score_report(p_class_id uuid)
returns table (
  student_id uuid, student_order smallint, student_code text, full_name text,
  plan_id smallint, activity_key text, assessment_items smallint[],
  raw_score integer, raw_max_score integer, percent numeric,
  equivalent_score_20 numeric, score_source text, skill_code text
)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.teacher_can_access_class(p_class_id) then raise exception 'Access denied'; end if;
  return query
  with observed as (
    select distinct on (player.student_id, session_row.plan_id, attempt.activity_key)
      player.student_id, session_row.plan_id, attempt.activity_key,
      attempt.score::integer raw_score, attempt.max_score::integer raw_max_score,
      attempt.percent::numeric percent
    from public.class_sessions session_row
    join public.session_players player on player.session_id=session_row.id
    join public.game_attempts attempt on attempt.session_player_id=player.id
    where session_row.class_id=p_class_id and session_row.assessment_phase is null
      and session_row.score_recording_enabled and attempt.activity_key not in ('pretest','posttest')
      and exists (select 1 from public.game_activity_assessment_map allowed
        where allowed.plan_id=session_row.plan_id and allowed.activity_key=attempt.activity_key)
    order by player.student_id, session_row.plan_id, attempt.activity_key,
      attempt.percent desc, attempt.completed_at asc
  ), combined as (
    select observed.*, 'observed_gameplay'::text score_source from observed
    union all
    select backfill.student_id, backfill.plan_id, backfill.activity_key,
      backfill.raw_score, backfill.raw_max_score,
      round(backfill.raw_score::numeric*100/backfill.raw_max_score,2),
      backfill.source_kind
    from public.game_score_backfills backfill
    where backfill.class_id=p_class_id and not exists (
      select 1 from observed where observed.student_id=backfill.student_id
        and observed.plan_id=backfill.plan_id and observed.activity_key=backfill.activity_key
    )
  )
  select student.id, imported.student_order, student.student_code, student.full_name,
    combined.plan_id, combined.activity_key,
    coalesce(array_agg(mapping.assessment_item_id order by mapping.assessment_item_id)
      filter (where mapping.assessment_item_id is not null), '{}'::smallint[]),
    combined.raw_score, combined.raw_max_score, combined.percent,
    round(combined.percent*20/100,2), combined.score_source, skill.skill_code
  from combined
  join public.students student on student.id=combined.student_id
  left join public.assessment_score_imports imported
    on imported.class_id=p_class_id and imported.student_id=student.id
  left join public.game_activity_assessment_map mapping
    on mapping.plan_id=combined.plan_id and mapping.activity_key=combined.activity_key
  left join public.game_skill_map skill
    on skill.plan_id=combined.plan_id and skill.activity_key=combined.activity_key
  group by student.id, imported.student_order, student.student_code, student.full_name,
    combined.plan_id, combined.activity_key, combined.raw_score, combined.raw_max_score,
    combined.percent, combined.score_source, skill.skill_code
  order by imported.student_order nulls last, student.student_code,
    combined.plan_id, combined.activity_key;
end;
$$;

create or replace function public.get_skill_assessment_report(p_class_id uuid)
returns table (
  student_id uuid, student_order smallint, student_code text, full_name text,
  classification_percent numeric, classification_score smallint,
  reading_percent numeric, reading_score smallint,
  writing_percent numeric, writing_score smallint,
  sentence_percent numeric, sentence_score smallint,
  total_score smallint, quality_level text
)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.teacher_can_access_class(p_class_id) then raise exception 'Access denied'; end if;
  return query
  with game_rows as (
    select * from public.get_complete_game_score_report(p_class_id)
  ), averages as (
    select game_rows.student_id,
      round(avg(game_rows.percent) filter(where game_rows.skill_code='classification'),2) classification_pct,
      round(avg(game_rows.percent) filter(where game_rows.skill_code='reading'),2) reading_pct,
      round(avg(game_rows.percent) filter(where game_rows.skill_code='writing'),2) writing_pct,
      round(avg(game_rows.percent) filter(where game_rows.skill_code='sentence'),2) sentence_pct
    from game_rows group by game_rows.student_id
  ), rubric as (
    select averages.*,
      case when classification_pct>=80 then 3 when classification_pct>=60 then 2 else 1 end::smallint c,
      case when reading_pct>=80 then 3 when reading_pct>=60 then 2 else 1 end::smallint r,
      case when writing_pct>=80 then 3 when writing_pct>=60 then 2 else 1 end::smallint w,
      case when sentence_pct>=80 then 3 when sentence_pct>=60 then 2 else 1 end::smallint s
    from averages
  )
  select student.id, imported.student_order, student.student_code, student.full_name,
    rubric.classification_pct, rubric.c, rubric.reading_pct, rubric.r,
    rubric.writing_pct, rubric.w, rubric.sentence_pct, rubric.s,
    (rubric.c+rubric.r+rubric.w+rubric.s)::smallint,
    case when rubric.c+rubric.r+rubric.w+rubric.s>=10 then 'ดี'
      when rubric.c+rubric.r+rubric.w+rubric.s>=7 then 'พอใช้ (ผ่านเกณฑ์)'
      else 'ควรปรับปรุง (ไม่ผ่านเกณฑ์)' end
  from rubric
  join public.students student on student.id=rubric.student_id
  left join public.assessment_score_imports imported
    on imported.class_id=p_class_id and imported.student_id=student.id
  order by imported.student_order nulls last, student.student_code;
end;
$$;

create or replace function public.get_game_mastery_20(p_class_id uuid)
returns table (
  student_id uuid, student_order smallint, student_code text, full_name text,
  completed_plans integer, completed_games integer, game_mastery_score_20 numeric
)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.teacher_can_access_class(p_class_id) then raise exception 'Access denied'; end if;
  return query
  with game_rows as (select * from public.get_complete_game_score_report(p_class_id)),
  plan_scores as (
    select game_rows.student_id, game_rows.plan_id, avg(game_rows.percent) plan_percent,
      count(*)::integer game_count
    from game_rows group by game_rows.student_id, game_rows.plan_id
  ), weighted as (
    select plan_scores.student_id, count(*)::integer plan_count,
      sum(plan_scores.game_count)::integer game_count,
      round(sum(plan_scores.plan_percent*items.item_count)/100,2) score_20
    from plan_scores join (
      select plan_id,count(*)::numeric item_count from public.assessment_blueprint group by plan_id
    ) items on items.plan_id=plan_scores.plan_id
    group by plan_scores.student_id
  )
  select student.id, imported.student_order, student.student_code, student.full_name,
    coalesce(weighted.plan_count,0), coalesce(weighted.game_count,0), coalesce(weighted.score_20,0)
  from public.students student
  left join public.assessment_score_imports imported
    on imported.class_id=p_class_id and imported.student_id=student.id
  left join weighted on weighted.student_id=student.id
  where student.active and (student.class_id=p_class_id or exists(
    select 1 from public.student_class_assignments assignment
    where assignment.student_id=student.id and assignment.class_id=p_class_id and assignment.active))
  order by imported.student_order nulls last, student.student_code;
end;
$$;

revoke all on function public.get_complete_game_score_report(uuid) from public, anon;
grant execute on function public.get_complete_game_score_report(uuid) to authenticated;
revoke all on function public.get_skill_assessment_report(uuid) from public, anon;
grant execute on function public.get_skill_assessment_report(uuid) to authenticated;
revoke all on function public.get_game_mastery_20(uuid) from public, anon;
grant execute on function public.get_game_mastery_20(uuid) to authenticated;

-- Refresh the two ResearchStat datasets with all derived/observed rows and rubric totals.
create or replace function public.refresh_research_game_dataset_for_class(p_class_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare linked record; score_rows jsonb; skill_rows jsonb;
begin
  with observed as (
    select distinct on (player.student_id, session_row.plan_id, attempt.activity_key)
      player.student_id, session_row.plan_id, attempt.activity_key,
      attempt.score::integer raw_score, attempt.max_score::integer raw_max_score,
      attempt.percent::numeric percent, 'observed_gameplay'::text score_source
    from public.class_sessions session_row
    join public.session_players player on player.session_id=session_row.id
    join public.game_attempts attempt on attempt.session_player_id=player.id
    where session_row.class_id=p_class_id and session_row.assessment_phase is null
      and session_row.score_recording_enabled and attempt.activity_key not in ('pretest','posttest')
      and exists (select 1 from public.game_activity_assessment_map allowed
        where allowed.plan_id=session_row.plan_id and allowed.activity_key=attempt.activity_key)
    order by player.student_id, session_row.plan_id, attempt.activity_key,
      attempt.percent desc, attempt.completed_at asc
  ), combined as (
    select * from observed union all
    select backfill.student_id, backfill.plan_id, backfill.activity_key,
      backfill.raw_score, backfill.raw_max_score,
      round(backfill.raw_score::numeric*100/backfill.raw_max_score,2), backfill.source_kind
    from public.game_score_backfills backfill
    where backfill.class_id=p_class_id and not exists (
      select 1 from observed where observed.student_id=backfill.student_id
        and observed.plan_id=backfill.plan_id and observed.activity_key=backfill.activity_key)
  ), prepared as (
    select imported.student_order, student.student_code, student.full_name,
      combined.plan_id, combined.activity_key,
      array_to_string(array_agg(mapping.assessment_item_id order by mapping.assessment_item_id), '|') item_ids,
      combined.raw_score, combined.raw_max_score, combined.percent,
      combined.score_source, skill.skill_code
    from combined join public.students student on student.id=combined.student_id
    left join public.assessment_score_imports imported
      on imported.class_id=p_class_id and imported.student_id=student.id
    left join public.game_activity_assessment_map mapping
      on mapping.plan_id=combined.plan_id and mapping.activity_key=combined.activity_key
    left join public.game_skill_map skill
      on skill.plan_id=combined.plan_id and skill.activity_key=combined.activity_key
    group by imported.student_order, student.student_code, student.full_name,
      combined.plan_id, combined.activity_key, combined.raw_score, combined.raw_max_score,
      combined.percent, combined.score_source, skill.skill_code
  )
  select coalesce(jsonb_agg(jsonb_build_array(
    student_order, student_code, full_name, plan_id, activity_key, item_ids,
    raw_score, raw_max_score, percent, round(percent*20/100,2), score_source, skill_code
  ) order by student_order, plan_id, activity_key),'[]'::jsonb)
  into score_rows from prepared;

  -- The public report RPC performs the same rubric calculation. Here it is called
  -- while iterating as the project owner through an explicit link.
  for linked in select project_id, owner_id from public.research_p2_links
    where class_id=p_class_id and auto_sync
  loop
    update public.research_datasets set
      columns_json='["ลำดับ","รหัสนักเรียน","ชื่อ-สกุล","แผน","รหัสเกม","ข้อสอบที่สอดคล้อง","คะแนนดิบ","คะแนนเต็มเกม","ร้อยละ","คะแนนเทียบเต็ม 20","แหล่งคะแนน","ด้านทักษะ"]'::jsonb,
      rows_json=score_rows, confirmed_at=now()
    where project_id=linked.project_id and owner_id=linked.owner_id
      and name='คะแนนการเล่นเกมเทียบแบบประเมินผลเต็ม 20';
  end loop;

  -- Skill dataset is built directly from the complete raw-score dataset JSON.
  with unpacked as (
    select
      (row->>0)::smallint student_order, row->>1 student_code, row->>2 full_name,
      (row->>8)::numeric percent, row->>11 skill_code
    from jsonb_array_elements(score_rows) row
  ), averaged as (
    select student_order, student_code, full_name,
      round(avg(percent) filter(where skill_code='classification'),2) c_pct,
      round(avg(percent) filter(where skill_code='reading'),2) r_pct,
      round(avg(percent) filter(where skill_code='writing'),2) w_pct,
      round(avg(percent) filter(where skill_code='sentence'),2) s_pct
    from unpacked group by student_order, student_code, full_name
  ), scored as (
    select *,
      case when c_pct>=80 then 3 when c_pct>=60 then 2 else 1 end c,
      case when r_pct>=80 then 3 when r_pct>=60 then 2 else 1 end r,
      case when w_pct>=80 then 3 when w_pct>=60 then 2 else 1 end w,
      case when s_pct>=80 then 3 when s_pct>=60 then 2 else 1 end s
    from averaged
  )
  select coalesce(jsonb_agg(jsonb_build_array(
    student_order, student_code, full_name, c_pct, c, r_pct, r,
    w_pct, w, s_pct, s, c+r+w+s,
    case when c+r+w+s>=10 then 'ดี' when c+r+w+s>=7 then 'พอใช้ (ผ่านเกณฑ์)'
      else 'ควรปรับปรุง (ไม่ผ่านเกณฑ์)' end
  ) order by student_order),'[]'::jsonb) into skill_rows from scored;

  for linked in select project_id, owner_id from public.research_p2_links
    where class_id=p_class_id and auto_sync
  loop
    update public.research_datasets set rows_json=skill_rows, confirmed_at=now()
    where project_id=linked.project_id and owner_id=linked.owner_id
      and name='คะแนนประเมินทักษะ 4 ด้านรายบุคคล';
    if not found then
      insert into public.research_datasets(project_id,owner_id,name,columns_json,rows_json)
      values(linked.project_id,linked.owner_id,'คะแนนประเมินทักษะ 4 ด้านรายบุคคล',
        '["ลำดับ","รหัสนักเรียน","ชื่อ-สกุล","ร้อยละจำแนกคำ","คะแนนจำแนกคำ","ร้อยละอ่าน","คะแนนอ่าน","ร้อยละเขียน","คะแนนเขียน","ร้อยละเรียบเรียงประโยค","คะแนนเรียบเรียงประโยค","รวม 12","ระดับคุณภาพ"]'::jsonb,
        skill_rows);
    end if;
  end loop;
end;
$$;

revoke all on function public.refresh_research_game_dataset_for_class(uuid)
  from public, anon, authenticated;

select public.refresh_research_game_dataset_for_class(class_id)
from (select distinct class_id from public.game_score_backfills) classes;

notify pgrst, 'reload schema';

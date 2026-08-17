-- Align every P2 game score with the 20-item achievement assessment.
-- Raw game scores remain unchanged; reports receive normalized /20 scores.

create table if not exists public.assessment_blueprint (
  item_id smallint primary key check (item_id between 1 and 20),
  plan_id smallint not null references public.lesson_plans(id),
  final_group text not null,
  cognitive_level text not null check (cognitive_level in ('remember','understand','apply','analyze')),
  max_score smallint not null default 1 check (max_score = 1),
  created_at timestamptz not null default now()
);

insert into public.assessment_blueprint(item_id, plan_id, final_group, cognitive_level)
values
  (1,1,'แม่ ก กา','remember'), (5,1,'แม่ ก กา','understand'),
  (2,2,'แม่กง','remember'), (16,2,'แม่กง','analyze'),
  (6,3,'แม่กม','understand'), (11,3,'แม่กม','apply'),
  (7,4,'แม่เกย','understand'), (12,4,'แม่เกย','apply'),
  (13,4,'แม่เกอว','apply'), (17,4,'แม่เกอว','analyze'),
  (3,5,'แม่กก','remember'), (8,5,'แม่กก','understand'), (18,5,'แม่กก','analyze'),
  (9,6,'แม่กด','understand'), (14,6,'แม่กด','apply'), (19,6,'แม่กด','analyze'),
  (10,7,'แม่กน','understand'), (20,7,'แม่กน','analyze'),
  (4,8,'แม่กบ','remember'), (15,8,'แม่กบ','apply')
on conflict (item_id) do update set
  plan_id = excluded.plan_id,
  final_group = excluded.final_group,
  cognitive_level = excluded.cognitive_level;

create table if not exists public.game_activity_assessment_map (
  plan_id smallint not null references public.lesson_plans(id),
  activity_key text not null,
  assessment_item_id smallint not null references public.assessment_blueprint(item_id),
  created_at timestamptz not null default now(),
  primary key (plan_id, activity_key, assessment_item_id)
);

with plan_activities(plan_id, activity_key) as (
  values
    (1,'rhythm'), (1,'sort'), (1,'train'), (1,'exit'),
    (2,'mae-kong-box'), (2,'mae-kong-rocket'), (2,'mae-kong-exit'),
    (3,'mae-kom-box'), (3,'picture-word'), (3,'mae-kom-exit'),
    (4,'yw-sort'), (4,'picture-choice'), (4,'exit'),
    (5,'cave-door'), (5,'true-false'), (5,'exit'),
    (6,'treasure-hunt'), (6,'stone-decode'), (6,'exit'),
    (7,'space-fuel'), (7,'alien-scan'), (7,'exit'),
    (8,'island-supply'), (8,'island-puzzle'), (8,'exit')
)
insert into public.game_activity_assessment_map(plan_id, activity_key, assessment_item_id)
select activity.plan_id, activity.activity_key, blueprint.item_id
from plan_activities activity
join public.assessment_blueprint blueprint on blueprint.plan_id = activity.plan_id
on conflict do nothing;

-- Keep the activity constraint synchronized with the actual P2 plan catalog.
alter table public.game_attempts drop constraint if exists game_attempts_activity_key_check;
alter table public.game_attempts add constraint game_attempts_activity_key_check
check (activity_key = any (array[
  'rhythm','wheel','sound','sort','train','vote','exit',
  'mae-kong-box','mae-kong-rocket','mae-kong-exit',
  'mae-kom-box','picture-word','mae-kom-exit',
  'yw-sort','picture-choice','cave-door','true-false',
  'treasure-hunt','stone-decode','space-fuel','alien-scan',
  'island-supply','island-puzzle','pretest','posttest'
]));

alter table public.assessment_blueprint enable row level security;
alter table public.game_activity_assessment_map enable row level security;

drop policy if exists assessment_blueprint_read on public.assessment_blueprint;
create policy assessment_blueprint_read on public.assessment_blueprint for select to authenticated
using (true);
drop policy if exists game_activity_assessment_map_read on public.game_activity_assessment_map;
create policy game_activity_assessment_map_read on public.game_activity_assessment_map for select to authenticated
using (true);

grant select on public.assessment_blueprint, public.game_activity_assessment_map to authenticated;

create or replace function public.get_game_assessment_alignment(p_class_id uuid)
returns table (
  student_id uuid,
  student_order smallint,
  student_code text,
  full_name text,
  plan_id smallint,
  activity_key text,
  activity_title text,
  assessment_items smallint[],
  raw_score integer,
  raw_max_score integer,
  percent numeric,
  equivalent_score_20 numeric,
  completed_at timestamptz
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
  with ranked as (
    select distinct on (player.student_id, session_row.plan_id, attempt.activity_key)
      player.student_id,
      session_row.plan_id,
      attempt.activity_key,
      attempt.score,
      attempt.max_score,
      attempt.percent,
      attempt.completed_at
    from public.class_sessions session_row
    join public.session_players player on player.session_id = session_row.id
    join public.game_attempts attempt on attempt.session_player_id = player.id
    where session_row.class_id = p_class_id
      and session_row.assessment_phase is null
      and session_row.score_recording_enabled
      and attempt.activity_key not in ('pretest','posttest')
    order by player.student_id, session_row.plan_id, attempt.activity_key,
      attempt.percent desc, attempt.completed_at asc
  ), mapped as (
    select
      ranked.*,
      coalesce(array_agg(mapping.assessment_item_id order by mapping.assessment_item_id)
        filter (where mapping.assessment_item_id is not null), '{}'::smallint[]) as item_ids
    from ranked
    left join public.game_activity_assessment_map mapping
      on mapping.plan_id = ranked.plan_id and mapping.activity_key = ranked.activity_key
    group by ranked.student_id, ranked.plan_id, ranked.activity_key, ranked.score,
      ranked.max_score, ranked.percent, ranked.completed_at
  )
  select
    student.id,
    imported.student_order,
    student.student_code,
    student.full_name,
    mapped.plan_id,
    mapped.activity_key,
    mapped.activity_key,
    mapped.item_ids,
    mapped.score,
    mapped.max_score,
    mapped.percent,
    round(mapped.percent * 20 / 100, 2),
    mapped.completed_at
  from mapped
  join public.students student on student.id = mapped.student_id
  left join public.assessment_score_imports imported
    on imported.class_id = p_class_id and imported.student_id = student.id
  order by imported.student_order nulls last, student.student_code, mapped.plan_id, mapped.activity_key;
end;
$$;

create or replace function public.get_game_mastery_20(p_class_id uuid)
returns table (
  student_id uuid,
  student_order smallint,
  student_code text,
  full_name text,
  completed_plans integer,
  completed_games integer,
  game_mastery_score_20 numeric
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
  with game_rows as (
    select * from public.get_game_assessment_alignment(p_class_id)
  ), plan_scores as (
    select
      game_rows.student_id,
      game_rows.plan_id,
      avg(game_rows.percent) as plan_percent,
      count(*)::integer as game_count
    from game_rows
    group by game_rows.student_id, game_rows.plan_id
  ), weighted as (
    select
      plan_scores.student_id,
      count(*)::integer as plan_count,
      sum(plan_scores.game_count)::integer as game_count,
      round(sum(plan_scores.plan_percent * item_counts.item_count) / 100, 2) as score_20
    from plan_scores
    join (
      select blueprint.plan_id, count(*)::numeric as item_count
      from public.assessment_blueprint blueprint
      group by blueprint.plan_id
    ) item_counts on item_counts.plan_id = plan_scores.plan_id
    group by plan_scores.student_id
  )
  select
    student.id,
    imported.student_order,
    student.student_code,
    student.full_name,
    coalesce(weighted.plan_count, 0),
    coalesce(weighted.game_count, 0),
    coalesce(weighted.score_20, 0)
  from public.students student
  left join public.assessment_score_imports imported
    on imported.class_id = p_class_id and imported.student_id = student.id
  left join weighted on weighted.student_id = student.id
  where student.active and (
    student.class_id = p_class_id or exists (
      select 1 from public.student_class_assignments assignment
      where assignment.student_id = student.id and assignment.class_id = p_class_id and assignment.active
    )
  )
  order by imported.student_order nulls last, student.student_code, student.full_name;
end;
$$;

revoke all on function public.get_game_assessment_alignment(uuid) from public, anon;
grant execute on function public.get_game_assessment_alignment(uuid) to authenticated;
revoke all on function public.get_game_mastery_20(uuid) from public, anon;
grant execute on function public.get_game_mastery_20(uuid) to authenticated;

notify pgrst, 'reload schema';

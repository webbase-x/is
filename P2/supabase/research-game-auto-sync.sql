-- Keep the ResearchStat game dataset synchronized after every durable game score.

create table if not exists public.research_p2_links (
  project_id uuid not null references public.research_projects(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  auto_sync boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (project_id, class_id)
);

alter table public.research_p2_links enable row level security;
drop policy if exists research_p2_links_owner_select on public.research_p2_links;
create policy research_p2_links_owner_select on public.research_p2_links for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists research_p2_links_owner_insert on public.research_p2_links;
create policy research_p2_links_owner_insert on public.research_p2_links for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.research_projects project where project.id=project_id and project.owner_id=(select auth.uid()))
  and public.teacher_can_access_class(class_id)
);
drop policy if exists research_p2_links_owner_update on public.research_p2_links;
create policy research_p2_links_owner_update on public.research_p2_links for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
drop policy if exists research_p2_links_owner_delete on public.research_p2_links;
create policy research_p2_links_owner_delete on public.research_p2_links for delete to authenticated
using ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.research_p2_links to authenticated;

create or replace function public.refresh_research_game_dataset_for_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked record;
  score_rows jsonb;
begin
  with ranked as (
    select distinct on (player.student_id, session_row.plan_id, attempt.activity_key)
      player.student_id, session_row.plan_id, attempt.activity_key,
      attempt.score, attempt.max_score, attempt.percent, attempt.completed_at
    from public.class_sessions session_row
    join public.session_players player on player.session_id=session_row.id
    join public.game_attempts attempt on attempt.session_player_id=player.id
    where session_row.class_id=p_class_id
      and session_row.assessment_phase is null
      and session_row.score_recording_enabled
      and attempt.activity_key not in ('pretest','posttest')
    order by player.student_id, session_row.plan_id, attempt.activity_key,
      attempt.percent desc, attempt.completed_at asc
  ), mapped as (
    select ranked.*,
      coalesce(array_agg(mapping.assessment_item_id order by mapping.assessment_item_id)
        filter (where mapping.assessment_item_id is not null), '{}'::smallint[]) item_ids
    from ranked
    left join public.game_activity_assessment_map mapping
      on mapping.plan_id=ranked.plan_id and mapping.activity_key=ranked.activity_key
    group by ranked.student_id, ranked.plan_id, ranked.activity_key, ranked.score,
      ranked.max_score, ranked.percent, ranked.completed_at
  )
  select coalesce(jsonb_agg(jsonb_build_array(
    imported.student_order, student.student_code, student.full_name,
    mapped.plan_id, mapped.activity_key,
    array_to_string(mapped.item_ids, '|'), mapped.score, mapped.max_score,
    mapped.percent, round(mapped.percent*20/100, 2)
  ) order by imported.student_order nulls last, student.student_code, mapped.plan_id, mapped.activity_key), '[]'::jsonb)
  into score_rows
  from mapped
  join public.students student on student.id=mapped.student_id
  left join public.assessment_score_imports imported
    on imported.class_id=p_class_id and imported.student_id=student.id;

  for linked in
    select link.project_id, link.owner_id
    from public.research_p2_links link
    where link.class_id=p_class_id and link.auto_sync
  loop
    update public.research_datasets dataset
    set rows_json=score_rows, confirmed_at=now()
    where dataset.project_id=linked.project_id
      and dataset.owner_id=linked.owner_id
      and dataset.name='คะแนนการเล่นเกมเทียบแบบประเมินผลเต็ม 20';

    if not found then
      insert into public.research_datasets(project_id, owner_id, name, columns_json, rows_json)
      values (
        linked.project_id, linked.owner_id,
        'คะแนนการเล่นเกมเทียบแบบประเมินผลเต็ม 20',
        '["ลำดับ","รหัสนักเรียน","ชื่อ-สกุล","แผน","รหัสเกม","ข้อสอบที่สอดคล้อง","คะแนนดิบ","คะแนนเต็มเกม","ร้อยละ","คะแนนเทียบเต็ม 20"]'::jsonb,
        score_rows
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.refresh_research_game_dataset_for_class(uuid) from public, anon, authenticated;

create or replace function public.sync_research_game_score_after_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_class_id uuid;
begin
  select session_row.class_id into linked_class_id
  from public.session_players player
  join public.class_sessions session_row on session_row.id=player.session_id
  where player.id=new.session_player_id;

  if linked_class_id is not null and new.activity_key not in ('pretest','posttest') then
    perform public.refresh_research_game_dataset_for_class(linked_class_id);
  end if;
  return new;
end;
$$;

revoke all on function public.sync_research_game_score_after_attempt() from public, anon, authenticated;
drop trigger if exists sync_research_game_score_after_attempt on public.game_attempts;
create trigger sync_research_game_score_after_attempt
after insert or update of score, max_score, percent on public.game_attempts
for each row execute function public.sync_research_game_score_after_attempt();

notify pgrst, 'reload schema';

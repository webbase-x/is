-- 0087_assessment_workflow_component_metadata.sql
-- Enrich assessment component metadata for the teacher's nine-step assessment workspace.

begin;

create or replace function public.lao_assessment_component_outcomes(p_book_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_book public.lao_assessment_books%rowtype;
  v_own uuid;
  v_can_manage boolean:=false;
  v_can_approve boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_book
  from public.lao_assessment_books
  where id=p_book_id;

  if not found then raise exception 'ไม่พบสมุดวัดผล'; end if;
  if not public.lao_can_view_academic(v_book.school_id) then raise exception 'Access denied'; end if;

  v_own:=public.lao_my_personnel_id(v_book.school_id);
  v_can_manage:=public.lao_has_work_permission(v_book.school_id,'academics.assessment','edit');
  v_can_approve:=public.lao_has_work_permission(v_book.school_id,'academics.assessment','approve');

  if not (v_can_manage or v_can_approve or v_book.personnel_id=v_own) then
    raise exception 'Access denied';
  end if;

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'component_id',ac.id,
        'label',ac.label,
        'max_score',ac.max_score,
        'component_category',ac.component_category,
        'assessment_method',ac.assessment_method,
        'evidence',ac.evidence,
        'unit_no',ac.unit_no,
        'outcome_codes',ac.outcome_codes,
        'outcomes',coalesce((
          select jsonb_agg(jsonb_build_object(
            'code',o->>'code',
            'type',o->>'type',
            'description',o->>'description'
          ) order by o->>'code')
          from public.lao_course_curricula cc
          cross join lateral jsonb_array_elements(cc.outcomes) o
          where cc.id=v_book.course_curriculum_id
            and exists(
              select 1
              from jsonb_array_elements_text(ac.outcome_codes) oc
              where lower(btrim(oc.value))=lower(btrim(o->>'code'))
            )
        ),'[]'::jsonb)
      ) order by ac.sort_order)
      from public.lao_assessment_components ac
      where ac.book_id=p_book_id
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.lao_assessment_component_outcomes(uuid) from public,anon,authenticated;
grant execute on function public.lao_assessment_component_outcomes(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

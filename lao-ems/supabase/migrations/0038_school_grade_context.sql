-- 0038_school_grade_context.sql
-- Scope shared curriculum choices to the grade levels that actually exist in the school's active LEC class sections.

begin;

CREATE OR REPLACE FUNCTION public.lao_curriculum_preset(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs
    where id=p_program_id and school_id=p_school_id
  ) then raise exception 'Program not found'; end if;

  select jsonb_build_object(
    'preset_code','normal_primary_example',
    'preset_name','ฐานรายวิชาตามระดับชั้นของโรงเรียน',
    'grade_scope','lec_class_sections',
    'school_grade_codes',coalesce((
      select jsonb_agg(g.grade_code order by g.grade_order)
      from (
        select distinct
          c.grade_code,
          case
            when c.grade_code ~ '^K[0-9]+$' then substring(c.grade_code from 2)::int
            when c.grade_code ~ '^P[0-9]+$' then 30+substring(c.grade_code from 2)::int
            when c.grade_code ~ '^M[0-9]+$' then 90+substring(c.grade_code from 2)::int
            else 999
          end as grade_order
        from public.lao_class_sections c
        where c.school_id=p_school_id
          and c.academic_year_id=p_academic_year_id
          and c.source_type='lec'
          and c.is_active
          and c.grade_code is not null
      ) g
    ),'[]'::jsonb),
    'supported_grades',coalesce((
      with logical_items as (
        select p.*
        from public.lao_curriculum_preset_items p
        where p.preset_code='normal_primary_example'
          and p.choice_group is null
          and exists(
            select 1
            from public.lao_class_sections c
            where c.school_id=p_school_id
              and c.academic_year_id=p_academic_year_id
              and c.source_type='lec'
              and c.is_active
              and c.grade_code=p.grade_code
          )
        union all
        select distinct on (p.grade_code,p.choice_group) p.*
        from public.lao_curriculum_preset_items p
        where p.preset_code='normal_primary_example'
          and p.choice_group is not null
          and exists(
            select 1
            from public.lao_class_sections c
            where c.school_id=p_school_id
              and c.academic_year_id=p_academic_year_id
              and c.source_type='lec'
              and c.is_active
              and c.grade_code=p.grade_code
          )
        order by grade_code,choice_group,sort_order
      )
      select jsonb_agg(jsonb_build_object(
        'grade_code',x.grade_code,
        'grade_label',x.grade_label,
        'subject_count',x.subject_count,
        'weekly_total',x.weekly_total,
        'annual_total',x.annual_total,
        'hour_defined_count',x.hour_defined_count,
        'present_count',x.present_count
      ) order by x.grade_order)
      from (
        select
          p.grade_code,
          min(p.grade_label) as grade_label,
          case p.grade_code
            when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4
            when 'P5' then 5 when 'P6' then 6
            when 'M1' then 11 when 'M2' then 12 when 'M3' then 13
            when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
            else 99 end as grade_order,
          count(*) as subject_count,
          sum(p.weekly_periods) as weekly_total,
          sum(p.annual_hours) as annual_total,
          count(p.annual_hours) as hour_defined_count,
          count(*) filter(where exists(
            select 1
            from public.lao_curriculum_courses c
            join public.lao_subjects s on s.id=c.subject_id
            where c.school_id=p_school_id
              and c.academic_year_id=p_academic_year_id
              and c.is_active
              and lower(btrim(c.grade_label))=lower(btrim(p.grade_label))
              and (
                c.program_id is not distinct from p_program_id
                or (
                  p_program_id is not null
                  and c.program_id is null
                  and p.subject_type in ('basic','activity')
                )
              )
              and (
                (p.subject_code is not null and lower(coalesce(s.subject_code,''))=lower(p.subject_code))
                or
                (p.subject_code is null and lower(btrim(s.name_th))=lower(btrim(p.subject_name)) and s.subject_type=p.subject_type)
              )
          )) as present_count
        from logical_items p
        group by p.grade_code
      ) x
    ),'[]'::jsonb),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'grade_code',p.grade_code,
        'grade_label',p.grade_label,
        'program_label',p.program_label,
        'sort_order',p.sort_order,
        'subject_code',p.subject_code,
        'subject_name',p.subject_name,
        'learning_area',p.learning_area,
        'weekly_periods',p.weekly_periods,
        'annual_hours',p.annual_hours,
        'subject_type',p.subject_type,
        'is_national_core',p.is_national_core,
        'choice_group',p.choice_group,
        'choice_key',p.choice_key,
        'auto_apply',p.auto_apply,
        'present',exists(
          select 1
          from public.lao_curriculum_courses c
          join public.lao_subjects s on s.id=c.subject_id
          where c.school_id=p_school_id
            and c.academic_year_id=p_academic_year_id
            and c.is_active
            and lower(btrim(c.grade_label))=lower(btrim(p.grade_label))
            and (
              c.program_id is not distinct from p_program_id
              or (
                p_program_id is not null
                and c.program_id is null
                and p.subject_type in ('basic','activity')
              )
            )
            and (
              (
                p.subject_type='activity'
                and p.subject_code is not null
                and lower(coalesce(s.subject_code,''))=lower(p.subject_code)
                and lower(btrim(s.name_th))=lower(btrim(p.subject_name))
              )
              or
              (
                p.subject_type<>'activity'
                and (
                  (p.subject_code is not null and lower(coalesce(s.subject_code,''))=lower(p.subject_code))
                  or
                  (p.subject_code is null and lower(btrim(s.name_th))=lower(btrim(p.subject_name)) and s.subject_type=p.subject_type)
                )
              )
            )
        )
      ) order by
        case p.grade_code
          when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4
          when 'P5' then 5 when 'P6' then 6
          when 'M1' then 11 when 'M2' then 12 when 'M3' then 13
          when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
          else 99 end,
        p.sort_order)
      from public.lao_curriculum_preset_items p
      where p.preset_code='normal_primary_example'
        and exists(
          select 1
          from public.lao_class_sections c
          where c.school_id=p_school_id
            and c.academic_year_id=p_academic_year_id
            and c.source_type='lec'
            and c.is_active
            and c.grade_code=p.grade_code
        )
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.lao_curriculum_preset(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_preset(uuid,uuid,uuid) to authenticated;

commit;

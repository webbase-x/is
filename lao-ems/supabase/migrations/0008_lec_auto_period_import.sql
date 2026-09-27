
-- LAO-EMS: academic year and term are read from LEC source metadata only.
-- Authenticated clients no longer provide period values manually.

create or replace function public.lao_import_lec_students_auto(
  p_school_id uuid,
  p_file_name text,
  p_file_size bigint,
  p_file_sha256 text,
  p_sheet_name text,
  p_ignored_sheet_count integer,
  p_header_map jsonb,
  p_metadata jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
  v_year integer;
  v_term smallint;
begin
  if v_uid is null or v_anon then
    raise exception 'Permanent authentication required';
  end if;

  if not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can import LEC data';
  end if;

  begin
    v_year:=(p_metadata->>'academic_year_be')::integer;
  exception when others then
    v_year:=null;
  end;

  begin
    v_term:=(p_metadata->>'term_no')::smallint;
  exception when others then
    v_term:=null;
  end;

  if v_year is null or v_year not between 2400 and 2800 then
    raise exception 'LEC source does not contain a valid academic year';
  end if;

  if v_term is null or v_term not between 1 and 4 then
    raise exception 'LEC source does not contain a valid term';
  end if;

  return public.lao_import_lec_students(
    p_school_id,
    v_year,
    v_term,
    p_file_name,
    p_file_size,
    p_file_sha256,
    p_sheet_name,
    p_ignored_sheet_count,
    p_header_map,
    p_metadata,
    p_rows
  );
end;
$$;

revoke all on function public.lao_import_lec_students_auto(uuid,text,bigint,text,text,integer,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.lao_import_lec_students_auto(uuid,text,bigint,text,text,integer,jsonb,jsonb,jsonb) to authenticated;

-- Prevent a client from bypassing source-controlled period values.
revoke execute on function public.lao_import_lec_students(uuid,integer,smallint,text,bigint,text,text,integer,jsonb,jsonb,jsonb)
from authenticated;

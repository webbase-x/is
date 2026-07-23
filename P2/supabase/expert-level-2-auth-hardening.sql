-- Keep school-structure creation available only to signed-in administrators.
revoke all on function public.create_school_structure(text, text, smallint) from public, anon;
grant execute on function public.create_school_structure(text, text, smallint) to authenticated;

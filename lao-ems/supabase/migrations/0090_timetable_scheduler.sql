-- 0090_timetable_scheduler.sql
-- Timetable scheduler for approved teaching workloads. Reuses academic year, terms, LEC class sections,
-- curriculum courses and personnel; supports dated versions, activation, editing, deletion and export-ready reads.

begin;

update public.lao_work_scopes
set route='#/academics/timetable', updated_at=now()
where scope_code='academics.timetable';

create table if not exists public.lao_timetable_versions(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  term_id uuid not null references public.lao_terms(id) on delete cascade,
  version_date date not null default current_date,
  version_no integer not null default 1 check(version_no>0),
  title text,
  note text,
  status text not null default 'draft' check(status in ('draft','active')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,term_id,version_date,version_no)
);

create unique index if not exists lao_timetable_one_active_per_term_idx
on public.lao_timetable_versions(school_id,term_id)
where status='active';

create index if not exists lao_timetable_versions_year_term_idx
on public.lao_timetable_versions(school_id,academic_year_id,term_id,version_date desc,version_no desc);

create table if not exists public.lao_timetable_entries(
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.lao_timetable_versions(id) on delete cascade,
  day_no smallint not null check(day_no between 1 and 7),
  period_no smallint not null check(period_no between 1 and 30),
  class_section_id uuid not null references public.lao_class_sections(id),
  course_id uuid not null references public.lao_curriculum_courses(id),
  personnel_id uuid not null references public.lao_personnel(id),
  room_label text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(version_id,class_section_id,day_no,period_no),
  unique(version_id,personnel_id,day_no,period_no)
);

create index if not exists lao_timetable_entries_version_idx on public.lao_timetable_entries(version_id);
create index if not exists lao_timetable_entries_class_idx on public.lao_timetable_entries(class_section_id,day_no,period_no);
create index if not exists lao_timetable_entries_personnel_idx on public.lao_timetable_entries(personnel_id,day_no,period_no);

alter table public.lao_timetable_versions enable row level security;
alter table public.lao_timetable_entries enable row level security;
revoke all on public.lao_timetable_versions from public,anon,authenticated;
revoke all on public.lao_timetable_entries from public,anon,authenticated;

drop trigger if exists lao_timetable_versions_touch on public.lao_timetable_versions;
create trigger lao_timetable_versions_touch
before update on public.lao_timetable_versions
for each row execute function public.lao_touch_updated_at();

drop trigger if exists lao_timetable_entries_touch on public.lao_timetable_entries;
create trigger lao_timetable_entries_touch
before update on public.lao_timetable_entries
for each row execute function public.lao_touch_updated_at();

create or replace function public.lao_timetable_page(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_term_id uuid default null,
  p_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_year uuid;
  v_term uuid;
  v_version uuid;
  v_can_view boolean:=false;
  v_can_edit boolean:=false;
  v_can_activate boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  v_can_view:=public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.timetable','view')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','edit')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','approve');
  if not v_can_view then raise exception 'ไม่มีสิทธิ์ดูตารางสอน'; end if;

  v_can_edit:=public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.timetable','edit')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','approve');
  v_can_activate:=v_can_edit
    or public.lao_has_work_permission(p_school_id,'academics.timetable','approve');

  select ay.id into v_year
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
  order by case when ay.id=p_academic_year_id then 0 when ay.is_current then 1 else 2 end, ay.year_be desc
  limit 1;

  if v_year is null then
    return jsonb_build_object(
      'can_view',v_can_view,'can_edit',v_can_edit,'can_activate',v_can_activate,
      'years','[]'::jsonb,'terms','[]'::jsonb,'versions','[]'::jsonb,
      'classes','[]'::jsonb,'offerings','[]'::jsonb,'entries','[]'::jsonb
    );
  end if;

  select t.id into v_term
  from public.lao_terms t
  where t.academic_year_id=v_year
  order by case when t.id=p_term_id then 0 when t.is_current then 1 else 2 end, t.term_no
  limit 1;

  if v_term is not null then
    select tv.id into v_version
    from public.lao_timetable_versions tv
    where tv.school_id=p_school_id and tv.term_id=v_term
    order by case when tv.id=p_version_id then 0 when tv.status='active' then 1 else 2 end,
             tv.version_date desc,tv.version_no desc,tv.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'can_view',v_can_view,
    'can_edit',v_can_edit,
    'can_activate',v_can_activate,
    'selected_year_id',v_year,
    'selected_term_id',v_term,
    'selected_version_id',v_version,
    'years',coalesce((
      select jsonb_agg(jsonb_build_object('id',ay.id,'year_be',ay.year_be,'is_current',ay.is_current) order by ay.year_be desc)
      from public.lao_academic_years ay where ay.school_id=p_school_id
    ),'[]'::jsonb),
    'terms',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'term_no',t.term_no,'name',coalesce(t.name,'ภาคเรียนที่ '||t.term_no::text),
        'starts_on',t.starts_on,'ends_on',t.ends_on,'is_current',t.is_current
      ) order by t.term_no)
      from public.lao_terms t where t.academic_year_id=v_year
    ),'[]'::jsonb),
    'versions',case when v_term is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',tv.id,'version_date',tv.version_date,'version_no',tv.version_no,'title',tv.title,'note',tv.note,
        'status',tv.status,'entry_count',(select count(*) from public.lao_timetable_entries te where te.version_id=tv.id),
        'created_at',tv.created_at,'updated_at',tv.updated_at
      ) order by tv.version_date desc,tv.version_no desc,tv.created_at desc)
      from public.lao_timetable_versions tv where tv.school_id=p_school_id and tv.term_id=v_term
    ),'[]'::jsonb) end,
    'settings',coalesce((
      select jsonb_build_object(
        'school_days_per_week',greatest(1,least(7,coalesce(max(f.school_days_per_week),s.school_days_per_week,5))),
        'periods_per_day',greatest(1,least(30,ceil(coalesce(max(f.periods_per_day),s.periods_per_day,8)))),
        'minutes_per_period',coalesce(max(f.minutes_per_period),s.minutes_per_period,50)
      )
      from public.lao_academic_schedule_settings s
      left join public.lao_academic_time_frames f
        on f.school_id=p_school_id and f.academic_year_id=v_year and f.is_active
      where s.school_id=p_school_id and s.academic_year_id=v_year
      group by s.school_days_per_week,s.periods_per_day,s.minutes_per_period
    ),(
      select jsonb_build_object(
        'school_days_per_week',greatest(1,least(7,coalesce(max(f.school_days_per_week),5))),
        'periods_per_day',greatest(1,least(30,ceil(coalesce(max(f.periods_per_day),8)))),
        'minutes_per_period',coalesce(max(f.minutes_per_period),50)
      )
      from public.lao_academic_time_frames f
      where f.school_id=p_school_id and f.academic_year_id=v_year and f.is_active
    ),jsonb_build_object('school_days_per_week',5,'periods_per_day',8,'minutes_per_period',50)),
    'classes',coalesce((
      select jsonb_agg(x.payload order by x.grade_sort,x.section_sort,x.program_code nulls first)
      from (
        select
          case when c.grade_code like 'K%' then 0 when c.grade_code like 'P%' then 100 when c.grade_code like 'M%' then 200 else 900 end
            + coalesce(nullif(regexp_replace(coalesce(c.grade_code,''),'\D','','g'),''),'0')::int as grade_sort,
          coalesce(nullif(regexp_replace(c.section_label,'\D','','g'),''),'999')::int as section_sort,
          ap.code as program_code,
          jsonb_build_object(
            'id',c.id,'grade_code',c.grade_code,'grade_label',c.grade_label,'section_label',c.section_label,
            'room_name',c.room_name,'program_id',c.program_id,'program_code',ap.code,'program_name',ap.name_th,
            'school_days_per_week',coalesce(tf.school_days_per_week,ss.school_days_per_week,5),
            'periods_per_day',ceil(coalesce(tf.periods_per_day,ss.periods_per_day,8)),
            'minutes_per_period',coalesce(tf.minutes_per_period,ss.minutes_per_period,50)
          ) payload
        from public.lao_class_sections c
        left join public.lao_academic_programs ap on ap.id=c.program_id
        left join public.lao_academic_schedule_settings ss
          on ss.school_id=p_school_id and ss.academic_year_id=v_year
        left join lateral (
          select f.school_days_per_week,f.periods_per_day,f.minutes_per_period
          from public.lao_academic_time_frames f
          where f.school_id=p_school_id and f.academic_year_id=v_year and f.is_active
            and (f.program_id=c.program_id or f.is_default)
          order by case when c.program_id is not null and f.program_id=c.program_id then 0 when f.is_default then 1 else 2 end
          limit 1
        ) tf on true
        where c.school_id=p_school_id and c.academic_year_id=v_year and c.source_type='lec' and c.is_active
      ) x
    ),'[]'::jsonb),
    'offerings',case when v_term is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'workload_item_id',wi.id,'personnel_id',w.personnel_id,
        'teacher_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),'position_title',p.position_title,
        'course_id',wi.course_id,'class_section_id',wi.class_section_id,'weekly_periods',wi.weekly_periods,
        'teaching_role',wi.teaching_role,'subject_code',s.subject_code,'subject_name',s.name_th,
        'subject_type',s.subject_type,'learning_area',s.learning_area,
        'grade_code',c.grade_code,'grade_label',c.grade_label,'section_label',cls.section_label,
        'program_code',ap.code,'program_name',ap.name_th
      ) order by c.grade_label,cls.section_label,s.sort_order,s.name_th,concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th))
      from public.lao_teaching_workloads w
      join public.lao_teaching_workload_items wi on wi.workload_id=w.id
      join public.lao_personnel p on p.id=w.personnel_id
      join public.lao_curriculum_courses c on c.id=wi.course_id
      join public.lao_subjects s on s.id=c.subject_id
      join public.lao_class_sections cls on cls.id=wi.class_section_id
      left join public.lao_academic_programs ap on ap.id=cls.program_id
      where w.school_id=p_school_id and w.academic_year_id=v_year and w.term_id=v_term and w.status='approved'
        and p.employment_status='active' and c.is_active and s.is_active and cls.is_active
    ),'[]'::jsonb) end,
    'entries',case when v_version is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',te.id,'version_id',te.version_id,'day_no',te.day_no,'period_no',te.period_no,
        'class_section_id',te.class_section_id,'course_id',te.course_id,'personnel_id',te.personnel_id,
        'room_label',te.room_label,'note',te.note,
        'teacher_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
        'subject_code',s.subject_code,'subject_name',s.name_th,
        'grade_code',c.grade_code,'grade_label',c.grade_label,'section_label',cls.section_label,'program_code',ap.code
      ) order by te.day_no,te.period_no,c.grade_label,cls.section_label)
      from public.lao_timetable_entries te
      join public.lao_personnel p on p.id=te.personnel_id
      join public.lao_curriculum_courses c on c.id=te.course_id
      join public.lao_subjects s on s.id=c.subject_id
      join public.lao_class_sections cls on cls.id=te.class_section_id
      left join public.lao_academic_programs ap on ap.id=cls.program_id
      where te.version_id=v_version
    ),'[]'::jsonb) end
  );
end;
$function$;

create or replace function public.lao_save_timetable_version(
  p_school_id uuid,
  p_term_id uuid,
  p_version_id uuid default null,
  p_version_date date default current_date,
  p_title text default null,
  p_note text default null,
  p_entries jsonb default '[]'::jsonb,
  p_activate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_year uuid;
  v_version public.lao_timetable_versions%rowtype;
  v_next_no integer;
  v_entry jsonb;
  v_day smallint;
  v_period smallint;
  v_class uuid;
  v_course uuid;
  v_personnel uuid;
  v_days smallint;
  v_periods integer;
  v_ss_days smallint;
  v_ss_periods numeric;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (
    public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.timetable','edit')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','approve')
  ) then raise exception 'ไม่มีสิทธิ์แก้ไขตารางสอน'; end if;

  select ay.id into v_year
  from public.lao_terms t
  join public.lao_academic_years ay on ay.id=t.academic_year_id
  where t.id=p_term_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'ไม่พบภาคเรียนที่เลือก'; end if;
  if p_version_date is null then raise exception 'กรุณาระบุวันที่เวอร์ชัน'; end if;
  if p_entries is null or jsonb_typeof(p_entries)<>'array' then raise exception 'ข้อมูลตารางสอนไม่ถูกต้อง'; end if;

  if exists(
    select 1 from (
      select (x->>'class_section_id')::uuid class_id,(x->>'day_no')::smallint day_no,(x->>'period_no')::smallint period_no,count(*) n
      from jsonb_array_elements(p_entries) x group by 1,2,3 having count(*)>1
    ) q
  ) then raise exception 'พบห้องเรียนซ้ำในวันและคาบเดียวกัน'; end if;

  if exists(
    select 1 from (
      select (x->>'personnel_id')::uuid personnel_id,(x->>'day_no')::smallint day_no,(x->>'period_no')::smallint period_no,count(*) n
      from jsonb_array_elements(p_entries) x group by 1,2,3 having count(*)>1
    ) q
  ) then raise exception 'พบครูสอนซ้ำมากกว่า 1 ห้องในวันและคาบเดียวกัน'; end if;

  select ss.school_days_per_week,ss.periods_per_day into v_ss_days,v_ss_periods
  from public.lao_academic_schedule_settings ss
  where ss.school_id=p_school_id and ss.academic_year_id=v_year;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    begin
      v_day:=(v_entry->>'day_no')::smallint;
      v_period:=(v_entry->>'period_no')::smallint;
      v_class:=(v_entry->>'class_section_id')::uuid;
      v_course:=(v_entry->>'course_id')::uuid;
      v_personnel:=(v_entry->>'personnel_id')::uuid;
    exception when others then
      raise exception 'ข้อมูลช่องตารางสอนไม่ครบหรือรูปแบบไม่ถูกต้อง';
    end;

    select coalesce(tf.school_days_per_week,v_ss_days,5),ceil(coalesce(tf.periods_per_day,v_ss_periods,8))::integer
    into v_days,v_periods
    from public.lao_class_sections cls
    left join lateral (
      select f.school_days_per_week,f.periods_per_day
      from public.lao_academic_time_frames f
      where f.school_id=p_school_id and f.academic_year_id=v_year and f.is_active
        and (f.program_id=cls.program_id or f.is_default)
      order by case when cls.program_id is not null and f.program_id=cls.program_id then 0 when f.is_default then 1 else 2 end
      limit 1
    ) tf on true
    where cls.id=v_class and cls.school_id=p_school_id and cls.academic_year_id=v_year and cls.is_active;

    if v_days is null then raise exception 'พบห้องเรียนที่ไม่อยู่ในปีการศึกษานี้'; end if;
    if v_day<1 or v_day>v_days or v_period<1 or v_period>v_periods then
      raise exception 'วันหรือคาบเกินกรอบเวลาเรียนของห้องที่เลือก';
    end if;

    if not exists(
      select 1
      from public.lao_teaching_workloads w
      join public.lao_teaching_workload_items wi on wi.workload_id=w.id
      where w.school_id=p_school_id and w.academic_year_id=v_year and w.term_id=p_term_id and w.status='approved'
        and w.personnel_id=v_personnel and wi.class_section_id=v_class and wi.course_id=v_course
    ) then raise exception 'พบรายการที่ไม่อยู่ในภาระงานสอนที่อนุมัติแล้ว'; end if;
  end loop;

  if p_version_id is null then
    select coalesce(max(tv.version_no),0)+1 into v_next_no
    from public.lao_timetable_versions tv
    where tv.school_id=p_school_id and tv.term_id=p_term_id and tv.version_date=p_version_date;

    insert into public.lao_timetable_versions(
      school_id,academic_year_id,term_id,version_date,version_no,title,note,status,created_by,updated_by
    ) values(
      p_school_id,v_year,p_term_id,p_version_date,v_next_no,
      nullif(btrim(coalesce(p_title,'')),''),nullif(btrim(coalesce(p_note,'')),''),
      'draft',v_uid,v_uid
    ) returning * into v_version;
  else
    select * into v_version
    from public.lao_timetable_versions
    where id=p_version_id and school_id=p_school_id and term_id=p_term_id
    for update;
    if not found then raise exception 'ไม่พบเวอร์ชันตารางสอนที่เลือก'; end if;

    if v_version.version_date<>p_version_date then
      select coalesce(max(tv.version_no),0)+1 into v_next_no
      from public.lao_timetable_versions tv
      where tv.school_id=p_school_id and tv.term_id=p_term_id and tv.version_date=p_version_date and tv.id<>v_version.id;
    else
      v_next_no:=v_version.version_no;
    end if;

    update public.lao_timetable_versions
    set version_date=p_version_date,version_no=v_next_no,
        title=nullif(btrim(coalesce(p_title,'')),''),note=nullif(btrim(coalesce(p_note,'')),''),
        updated_by=v_uid
    where id=v_version.id returning * into v_version;
  end if;

  delete from public.lao_timetable_entries where version_id=v_version.id;

  insert into public.lao_timetable_entries(
    version_id,day_no,period_no,class_section_id,course_id,personnel_id,room_label,note,created_by,updated_by
  )
  select v_version.id,(x->>'day_no')::smallint,(x->>'period_no')::smallint,
         (x->>'class_section_id')::uuid,(x->>'course_id')::uuid,(x->>'personnel_id')::uuid,
         nullif(btrim(coalesce(x->>'room_label','')),''),nullif(btrim(coalesce(x->>'note','')),''),
         v_uid,v_uid
  from jsonb_array_elements(p_entries) x;

  if p_activate then
    update public.lao_timetable_versions set status='draft',updated_by=v_uid
    where school_id=p_school_id and term_id=p_term_id and id<>v_version.id and status='active';
    update public.lao_timetable_versions set status='active',updated_by=v_uid
    where id=v_version.id returning * into v_version;
  end if;

  return jsonb_build_object(
    'id',v_version.id,'version_date',v_version.version_date,'version_no',v_version.version_no,
    'status',v_version.status,'entry_count',(select count(*) from public.lao_timetable_entries te where te.version_id=v_version.id)
  );
end;
$function$;

create or replace function public.lao_activate_timetable_version(p_school_id uuid,p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_version public.lao_timetable_versions%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (
    public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.timetable','edit')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','approve')
  ) then raise exception 'ไม่มีสิทธิ์เปิดใช้ตารางสอน'; end if;

  select * into v_version from public.lao_timetable_versions
  where id=p_version_id and school_id=p_school_id for update;
  if not found then raise exception 'ไม่พบเวอร์ชันตารางสอนที่เลือก'; end if;

  update public.lao_timetable_versions set status='draft',updated_by=v_uid
  where school_id=p_school_id and term_id=v_version.term_id and id<>v_version.id and status='active';
  update public.lao_timetable_versions set status='active',updated_by=v_uid
  where id=v_version.id returning * into v_version;

  return jsonb_build_object('id',v_version.id,'status',v_version.status);
end;
$function$;

create or replace function public.lao_delete_timetable_version(p_school_id uuid,p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_version public.lao_timetable_versions%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (
    public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.timetable','edit')
    or public.lao_has_work_permission(p_school_id,'academics.timetable','approve')
  ) then raise exception 'ไม่มีสิทธิ์ลบเวอร์ชันตารางสอน'; end if;

  select * into v_version from public.lao_timetable_versions
  where id=p_version_id and school_id=p_school_id for update;
  if not found then raise exception 'ไม่พบเวอร์ชันตารางสอนที่เลือก'; end if;

  delete from public.lao_timetable_versions where id=v_version.id;
  return jsonb_build_object('id',v_version.id,'deleted',true,'was_active',v_version.status='active');
end;
$function$;

-- Safe deletion of academic periods must treat timetable versions as protected linked data.
create or replace function public.lao_academic_year_delete_preview(p_school_id uuid,p_academic_year_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path='public'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_year integer; v_current boolean; v_terms integer; v_students integer; v_lec_batches integer;
  v_activities integer; v_classes integer; v_courses integer; v_workloads integer; v_schedule integer;
  v_timetables integer; v_default_inits integer; v_grade_inits integer; v_exclusions integer;
  v_confirmations integer; v_parallel_groups integer; v_blockers integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then raise exception 'Only this school administrator can delete academic periods'; end if;
  select ay.year_be,ay.is_current into v_year,v_current from public.lao_academic_years ay where ay.id=p_academic_year_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'Academic year not found'; end if;
  select count(*) into v_terms from public.lao_terms t where t.academic_year_id=p_academic_year_id;
  select count(*) into v_students from public.lao_student_term_enrollments e where e.school_id=p_school_id and e.academic_year_id=p_academic_year_id;
  select count(*) into v_lec_batches from public.lao_lec_import_batches b where b.school_id=p_school_id and b.academic_year_id=p_academic_year_id;
  select count(*) into v_activities from public.lao_student_activity_enrollments e where e.school_id=p_school_id and e.academic_year_id=p_academic_year_id;
  select count(*) into v_classes from public.lao_class_sections c where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id;
  select count(*) into v_courses from public.lao_curriculum_courses c where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id;
  select count(*) into v_workloads from public.lao_teaching_workloads w where w.school_id=p_school_id and w.academic_year_id=p_academic_year_id;
  select count(*) into v_schedule from public.lao_academic_schedule_settings s where s.school_id=p_school_id and s.academic_year_id=p_academic_year_id;
  select count(*) into v_timetables from public.lao_timetable_versions tv where tv.school_id=p_school_id and tv.academic_year_id=p_academic_year_id;
  select count(*) into v_default_inits from public.lao_curriculum_default_initializations x where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;
  select count(*) into v_grade_inits from public.lao_curriculum_grade_initializations x where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;
  select count(*) into v_exclusions from public.lao_curriculum_program_exclusions x where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;
  select count(*) into v_confirmations from public.lao_curriculum_structure_confirmations x where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;
  select count(*) into v_parallel_groups from public.lao_curriculum_parallel_groups x where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;
  v_blockers:=v_students+v_lec_batches+v_activities+v_classes+v_courses+v_workloads+v_schedule+v_timetables+v_default_inits+v_grade_inits+v_exclusions+v_confirmations+v_parallel_groups;
  return jsonb_build_object(
    'academic_year_id',p_academic_year_id,'year_be',v_year,'is_current',coalesce(v_current,false),
    'confirmation_text','ลบปีการศึกษา '||v_year::text,'can_delete',v_blockers=0,'term_count',v_terms,'blocker_count',v_blockers,
    'blockers',jsonb_build_object(
      'student_enrollments',v_students,'lec_batches',v_lec_batches,'student_activities',v_activities,
      'class_sections',v_classes,'curriculum_courses',v_courses,'teaching_workloads',v_workloads,
      'schedule_settings',v_schedule,'timetable_versions',v_timetables,'default_initializations',v_default_inits,
      'grade_initializations',v_grade_inits,'program_exclusions',v_exclusions,'structure_confirmations',v_confirmations,
      'parallel_groups',v_parallel_groups
    ),
    'safe_message',case when v_blockers=0 then 'ปีการศึกษานี้ไม่มีข้อมูลเชื่อมโยงที่ระบบต้องป้องกัน สามารถลบได้' else 'ยังมีข้อมูลเชื่อมโยง ระบบจะไม่อนุญาตให้ลบปีการศึกษา' end
  );
end;
$function$;

create or replace function public.lao_term_delete_preview(p_school_id uuid,p_term_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path='public'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_year_id uuid; v_year integer; v_term_no smallint; v_name text; v_current boolean;
  v_students integer; v_lec_batches integer; v_activities integer; v_plans integer; v_workloads integer;
  v_timetables integer; v_blockers integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then raise exception 'Only this school administrator can delete academic periods'; end if;
  select ay.id,ay.year_be,t.term_no,t.name,t.is_current into v_year_id,v_year,v_term_no,v_name,v_current
  from public.lao_terms t join public.lao_academic_years ay on ay.id=t.academic_year_id
  where t.id=p_term_id and ay.school_id=p_school_id;
  if v_term_no is null then raise exception 'Term not found'; end if;
  select count(*) into v_students from public.lao_student_term_enrollments e where e.school_id=p_school_id and e.term_id=p_term_id;
  select count(*) into v_lec_batches from public.lao_lec_import_batches b where b.school_id=p_school_id and b.term_id=p_term_id;
  select count(*) into v_activities from public.lao_student_activity_enrollments e where e.school_id=p_school_id and e.term_id=p_term_id;
  select count(*) into v_plans from public.lao_course_term_plans p where p.term_id=p_term_id;
  select count(*) into v_workloads from public.lao_teaching_workloads w where w.school_id=p_school_id and w.term_id=p_term_id;
  select count(*) into v_timetables from public.lao_timetable_versions tv where tv.school_id=p_school_id and tv.term_id=p_term_id;
  v_blockers:=v_students+v_lec_batches+v_activities+v_plans+v_workloads+v_timetables;
  return jsonb_build_object(
    'term_id',p_term_id,'academic_year_id',v_year_id,'year_be',v_year,'term_no',v_term_no,
    'name',coalesce(v_name,'ภาคเรียนที่ '||v_term_no::text),'is_current',coalesce(v_current,false),
    'confirmation_text','ลบภาคเรียนที่ '||v_term_no::text||' ปีการศึกษา '||v_year::text,
    'can_delete',v_blockers=0,'blocker_count',v_blockers,
    'blockers',jsonb_build_object(
      'student_enrollments',v_students,'lec_batches',v_lec_batches,'student_activities',v_activities,
      'course_term_plans',v_plans,'teaching_workloads',v_workloads,'timetable_versions',v_timetables
    ),
    'safe_message',case when v_blockers=0 then 'ภาคเรียนนี้ไม่มีข้อมูลเชื่อมโยงที่ระบบต้องป้องกัน สามารถลบได้' else 'ยังมีข้อมูลเชื่อมโยง ระบบจะไม่อนุญาตให้ลบภาคเรียน' end
  );
end;
$function$;

revoke all on function public.lao_timetable_page(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.lao_save_timetable_version(uuid,uuid,uuid,date,text,text,jsonb,boolean) from public,anon;
revoke all on function public.lao_activate_timetable_version(uuid,uuid) from public,anon;
revoke all on function public.lao_delete_timetable_version(uuid,uuid) from public,anon;
grant execute on function public.lao_timetable_page(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.lao_save_timetable_version(uuid,uuid,uuid,date,text,text,jsonb,boolean) to authenticated;
grant execute on function public.lao_activate_timetable_version(uuid,uuid) to authenticated;
grant execute on function public.lao_delete_timetable_version(uuid,uuid) to authenticated;

notify pgrst,'reload schema';
commit;

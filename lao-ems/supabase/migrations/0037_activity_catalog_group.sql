-- 0037_activity_catalog_group.sql
-- Keep the subject library stable and make learner-development activities explicit.

alter table public.lao_curriculum_preset_items
  add column if not exists id uuid default gen_random_uuid();

update public.lao_curriculum_preset_items
set id=gen_random_uuid()
where id is null;

alter table public.lao_curriculum_preset_items
  alter column id set default gen_random_uuid(),
  alter column id set not null;

create unique index if not exists lao_curriculum_preset_items_id_key
  on public.lao_curriculum_preset_items(id);

-- Correct primary-grade codes in the shared catalog.
update public.lao_curriculum_preset_items
set subject_code = case
  when grade_code='P1' and subject_code='ส12231' and subject_name='หน้าที่พลเมือง' then 'ส11231'
  when grade_code='P3' and subject_code='ส12233' and subject_name='หน้าที่พลเมือง' then 'ส13233'
  when grade_code='P3' and subject_code='อ11213' and subject_name='เสริมทักษะภาษาอังกฤษ' then 'อ13213'
  when grade_code='P4' and subject_code='ส12234' and subject_name='หน้าที่พลเมือง' then 'ส14234'
  else subject_code
end
where preset_code='normal_primary_example'
  and (
    (grade_code='P1' and subject_code='ส12231' and subject_name='หน้าที่พลเมือง')
    or (grade_code='P3' and subject_code='ส12233' and subject_name='หน้าที่พลเมือง')
    or (grade_code='P3' and subject_code='อ11213' and subject_name='เสริมทักษะภาษาอังกฤษ')
    or (grade_code='P4' and subject_code='ส12234' and subject_name='หน้าที่พลเมือง')
  );

-- Rebuild P1-P6 learner-development activities as clear, separate choices.
delete from public.lao_curriculum_preset_items
where preset_code='normal_primary_example'
  and grade_code in ('P1','P2','P3','P4','P5','P6')
  and subject_type='activity';

insert into public.lao_curriculum_preset_items(
  preset_code,grade_code,grade_label,program_label,sort_order,
  subject_code,subject_name,weekly_periods,annual_hours,
  subject_type,learning_area,is_national_core,
  choice_group,choice_key,auto_apply
)
select
  'normal_primary_example',
  g.grade_code,
  g.grade_label,
  'ปกติ',
  v.sort_order,
  case v.item_key
    when 'guidance' then 'ก'||g.level_no||'9'||'01'
    when 'club' then 'ก'||g.level_no||'9'||'03'
    when 'service' then 'ก'||g.level_no||'9'||'04'
    else 'ก'||g.level_no||'9'||'02'
  end,
  v.subject_name,
  v.weekly_periods,
  v.annual_hours,
  'activity',
  'กลุ่มวิชาพัฒนาผู้เรียน',
  false,
  case when v.item_key in ('scout','guide','red_cross_youth') then 'student_activity' else null end,
  case when v.item_key in ('scout','guide','red_cross_youth') then v.item_key else null end,
  case when v.item_key in ('scout','guide','red_cross_youth') then false else true end
from (
  values
    ('P1','ประถมศึกษาปีที่ 1','11'),
    ('P2','ประถมศึกษาปีที่ 2','12'),
    ('P3','ประถมศึกษาปีที่ 3','13'),
    ('P4','ประถมศึกษาปีที่ 4','14'),
    ('P5','ประถมศึกษาปีที่ 5','15'),
    ('P6','ประถมศึกษาปีที่ 6','16')
) as g(grade_code,grade_label,level_no)
cross join (
  values
    (900,'guidance','กิจกรรมแนะแนว',1.00::numeric,40.00::numeric),
    (901,'scout','ลูกเสือ',1.00::numeric,40.00::numeric),
    (902,'guide','เนตรนารี',1.00::numeric,40.00::numeric),
    (903,'red_cross_youth','ยุวกาชาด',1.00::numeric,40.00::numeric),
    (904,'club','ชุมนุม',1.00::numeric,40.00::numeric),
    (905,'service','กิจกรรมเพื่อสังคมและสาธารณประโยชน์',0.25::numeric,10.00::numeric)
) as v(sort_order,item_key,subject_name,weekly_periods,annual_hours);

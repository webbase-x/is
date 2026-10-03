-- 0065_academic_timeline_step_progress.sql
-- Add per-step progress percentages to every unresolved annual academic task.
-- Completed/reused steps are 100%; skipped/not-applicable steps intentionally have no percentage.

begin;

alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v0199;
revoke all on function public.lao_academic_year_setup_timeline_base_v0199(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_year_setup_timeline(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_base jsonb;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
  v_detail jsonb;
  v_status text;
  v_code text;
  v_pct int;
  v_label text;
  v_num numeric;
  v_den numeric;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v0199(
    p_school_id,p_academic_year_id
  );

  for v_step in select value from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
  loop
    v_status:=coalesce(v_step->>'status','queued');
    v_code:=coalesce(v_step->>'step_code','');
    v_detail:=coalesce(v_step->'detail','{}'::jsonb);
    v_pct:=null;
    v_label:=null;

    if v_status in ('completed','reused') then
      v_pct:=100;
      v_label:=case
        when v_status='reused' then 'ตรวจสอบข้อมูลเดิมสำหรับปีนี้แล้ว'
        else 'ขั้นตอนนี้เสร็จแล้ว'
      end;
    elsif v_status in ('skipped','not_applicable') then
      v_pct:=null;
      v_label:=case
        when v_status='skipped' then 'ข้ามปีนี้ · ไม่นับในร้อยละภาพรวม'
        else 'ไม่เกี่ยวข้อง · ไม่นับในร้อยละภาพรวม'
      end;
    else
      case v_code
        when 'periods' then
          v_num:=coalesce((v_detail->>'term_count')::numeric,0);
          v_den:=2;
          v_pct:=least(99,round(least(v_num,v_den)*100.0/v_den)::int);
          v_label:='กำหนดภาคเรียนแล้ว '||v_num::int||' / 2 ภาค';

        when 'programs' then
          v_num:=coalesce((v_detail->>'active_program_count')::numeric,0);
          if v_num>0 then
            -- Two visible milestones: program data exists + annual review/confirmation.
            v_pct:=50;
            v_label:='พบโปรแกรมพิเศษ '||v_num::int||' รายการ · รอยืนยันใช้ต่อสำหรับปีนี้';
          else
            v_pct:=0;
            v_label:='ยังไม่มีโปรแกรมพิเศษที่ต้องตรวจ';
          end if;

        when 'classes' then
          v_num:=coalesce((v_detail->>'class_count')::numeric,0);
          v_pct:=case when v_num>0 then 99 else 0 end;
          v_label:=case when v_num>0
            then 'พบชั้น/ห้องจาก LEC '||v_num::int||' ห้อง · รอเงื่อนไขครบ'
            else 'รอนำเข้าชั้น/ห้องจาก LEC'
          end;

        when 'subjects' then
          v_num:=coalesce((v_detail->>'coverage_percent')::numeric,0);
          v_pct:=least(99,greatest(0,round(v_num)::int));
          v_label:='ผ่านข้อกำหนด '
            ||coalesce((v_detail->>'met_count')::int,0)
            ||' / '
            ||coalesce((v_detail->>'required_count')::int,0)
            ||case when coalesce((v_detail->>'anomaly_count')::int,0)>0
              then ' · พบผิดปกติ '||coalesce((v_detail->>'anomaly_count')::int,0)||' รายการ'
              else ''
            end;

        when 'curriculum' then
          v_num:=coalesce((v_detail->>'confirmed_groups')::numeric,0);
          v_den:=coalesce((v_detail->>'total_groups')::numeric,0);
          v_pct:=case when v_den>0
            then least(99,round(v_num*100.0/v_den)::int)
            else 0
          end;
          v_label:='ยืนยันโครงสร้างแล้ว '||v_num::int||' / '||v_den::int||' กลุ่ม';

        when 'workload' then
          v_num:=coalesce((v_detail->>'approved_count')::numeric,0);
          v_den:=coalesce((v_detail->>'workload_count')::numeric,0);
          v_pct:=case when v_den>0
            then least(99,round(v_num*100.0/v_den)::int)
            else 0
          end;
          v_label:=case when v_den>0
            then 'อนุมัติภาระงานแล้ว '||v_num::int||' / '||v_den::int||' รายการ'
            else 'ยังไม่ได้จัดภาระงานสอน'
          end;

        else
          v_pct:=0;
          v_label:='รอดำเนินการ';
      end case;
    end if;

    v_steps:=v_steps||jsonb_build_array(
      v_step||jsonb_build_object(
        'step_progress_percent',v_pct,
        'step_progress_label',v_label
      )
    );
  end loop;

  return (v_base-'steps')||jsonb_build_object('steps',v_steps);
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid) to authenticated;

commit;

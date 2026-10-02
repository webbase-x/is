-- 0055_central_time_template_security_hardening.sql
-- Trigger helpers are internal-only. User-facing access remains through guarded RPCs.

begin;

revoke all on function public.lao_course_time_course_trigger() from public,anon,authenticated;
revoke all on function public.lao_course_time_plan_trigger() from public,anon,authenticated;

commit;

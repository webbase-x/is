
-- LAO-EMS no longer accepts self-service membership requests or the legacy approval RPC.
-- Auth is shared with other apps, so public Auth signup may remain enabled at project level,
-- but it cannot create LAO-EMS access.

revoke execute on function public.lao_request_membership(uuid,uuid,text,text) from authenticated;
revoke execute on function public.lao_review_membership(uuid,text,text[]) from authenticated;

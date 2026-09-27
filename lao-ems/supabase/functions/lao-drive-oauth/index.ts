import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({
    error: "Google OAuth ยังไม่ได้ตั้งค่าระดับแพลตฟอร์ม กรุณากำหนด Google OAuth Client ก่อนเปิดการเชื่อม Drive",
    configuration_required: true
  }), {
    status: 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});

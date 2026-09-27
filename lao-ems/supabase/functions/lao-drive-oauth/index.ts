import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({
    error: "การเชื่อม Google Drive ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลแพลตฟอร์ม",
    configuration_required: true
  }), {
    status: 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});

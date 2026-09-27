import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const emailOk=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const allowedTypes=new Set(["application/pdf","image/jpeg","image/png"]);

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!service)return json({error:"Server configuration is incomplete"},500);
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const form=await req.formData();
    const token=String(form.get("token")||"").trim();
    const email=String(form.get("email")||"").trim().toLowerCase();
    const prefix=String(form.get("prefix")||"").trim();
    const firstName=String(form.get("first_name_th")||"").trim();
    const lastName=String(form.get("last_name_th")||"").trim();
    const phone=String(form.get("phone")||"").trim();
    const org=String(form.get("claimed_organization_name")||"").trim();
    const school=String(form.get("claimed_school_name")||"").trim();
    const note=String(form.get("applicant_note")||"").trim();
    const document=form.get("document");

    if(!token)return json({error:"ลิงก์คำเชิญไม่ถูกต้อง"},400);
    if(!emailOk(email))return json({error:"กรุณาระบุอีเมลที่ถูกต้อง"},400);
    if(!firstName||!lastName)return json({error:"กรุณาระบุชื่อและนามสกุล"},400);
    if(!org||!school)return json({error:"กรุณาระบุ อปท. และสถานศึกษาตามเอกสาร"},400);
    if(!(document instanceof File))return json({error:"ต้องแนบเอกสารยืนยัน"},400);
    if(!allowedTypes.has(document.type))return json({error:"รองรับเอกสาร PDF, JPG และ PNG เท่านั้น"},400);
    if(document.size<=0||document.size>10*1024*1024)return json({error:"เอกสารต้องมีขนาดไม่เกิน 10 MB"},400);

    const {data:link,error:linkError}=await admin.from("lao_school_admin_invite_links")
      .select("id,is_active,expires_at").eq("token",token).maybeSingle();
    if(linkError)throw linkError;
    if(!link||!link.is_active)return json({error:"ลิงก์คำเชิญนี้ปิดใช้งานแล้ว"},410);
    if(link.expires_at&&new Date(link.expires_at).getTime()<=Date.now())return json({error:"ลิงก์คำเชิญหมดอายุแล้ว"},410);

    const appId=crypto.randomUUID();
    const safeName=(document.name||"document").replace(/[^A-Za-z0-9._-]+/g,"_").slice(-120);
    const objectPath="applications/"+appId+"/"+safeName;
    const bytes=new Uint8Array(await document.arrayBuffer());
    const upload=await admin.storage.from("lao-ems-admin-verification").upload(objectPath,bytes,{
      contentType:document.type,upsert:false
    });
    if(upload.error)throw upload.error;

    const {error:insertError}=await admin.from("lao_school_admin_applications").insert({
      id:appId,invite_link_id:link.id,email,prefix:prefix||null,first_name_th:firstName,last_name_th:lastName,
      phone:phone||null,claimed_organization_name:org,claimed_school_name:school,applicant_note:note||null,
      document_object_path:objectPath,document_file_name:document.name||safeName,
      document_mime_type:document.type,document_size:document.size,status:"pending"
    });
    if(insertError){
      await admin.storage.from("lao-ems-admin-verification").remove([objectPath]);
      if(insertError.code==="23505")return json({error:"อีเมลนี้มีคำขอรอตรวจสอบอยู่แล้ว"},409);
      throw insertError;
    }

    return json({ok:true,application_id:appId,status:"pending"});
  }catch(error){
    console.error(error);
    return json({error:error instanceof Error?error.message:String(error)},400);
  }
});

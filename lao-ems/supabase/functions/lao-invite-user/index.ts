import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: "Server configuration is incomplete" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authMailer = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);
    const caller = userData.user;

    const payload = await req.json().catch(() => ({}));
    const email = normalizeEmail(payload.email);
    const schoolId = String(payload.school_id ?? "").trim() || null;
    const roleCode = String(payload.role_code ?? "").trim();

    if (!isEmail(email)) return json({ error: "กรุณาระบุอีเมลที่ถูกต้อง" }, 400);

    const allowedRoles = [
      "school_admin", "school_executive", "registrar", "academic_officer",
      "teacher", "staff", "student", "guardian"
    ];
    if (!allowedRoles.includes(roleCode)) return json({ error: "บทบาทไม่ถูกต้อง" }, 400);

    const { data: callerPlatform, error: platformError } = await admin
      .from("lao_platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    if (platformError) throw platformError;

    const { data: schoolAdminRole, error: roleError } = await admin
      .from("lao_roles").select("id").eq("code", "school_admin").single();
    if (roleError || !schoolAdminRole) throw roleError || new Error("School Admin role missing");

    let school: any = null;
    let callerIsSchoolAdmin = false;
    let schoolHasAdmin = false;
    let invitationMode: "platform_first_admin" | "school_admin";

    if (schoolId) {
      const { data: schoolData, error: schoolError } = await admin
        .from("lao_schools")
        .select("id,organization_id,name_th,is_active,source_system,lec_last_batch_id")
        .eq("id", schoolId)
        .maybeSingle();
      if (schoolError || !schoolData || !schoolData.is_active) {
        return json({ error: "ไม่พบสถานศึกษาที่ใช้งานได้" }, 404);
      }
      school = schoolData;

      const { data: callerMemberships, error: cmError } = await admin
        .from("lao_memberships").select("id")
        .eq("user_id", caller.id).eq("school_id", schoolId).eq("status", "active");
      if (cmError) throw cmError;

      if ((callerMemberships || []).length) {
        const ids = callerMemberships!.map((m: any) => m.id);
        const { data: grants, error: grantError } = await admin
          .from("lao_membership_roles").select("membership_id")
          .in("membership_id", ids).eq("role_id", schoolAdminRole.id).limit(1);
        if (grantError) throw grantError;
        callerIsSchoolAdmin = Boolean(grants?.length);
      }

      const { data: activeSchoolMemberships, error: asmError } = await admin
        .from("lao_memberships").select("id")
        .eq("school_id", schoolId).eq("status", "active");
      if (asmError) throw asmError;

      if ((activeSchoolMemberships || []).length) {
        const ids = activeSchoolMemberships!.map((m: any) => m.id);
        const { data: grants, error: grantError } = await admin
          .from("lao_membership_roles").select("membership_id")
          .in("membership_id", ids).eq("role_id", schoolAdminRole.id).limit(1);
        if (grantError) throw grantError;
        schoolHasAdmin = Boolean(grants?.length);
      }

      if (callerIsSchoolAdmin) {
        const [{ data: settings, error: settingsError }, { data: drive, error: driveError }] = await Promise.all([
          admin.from("lao_school_settings").select("setup_confirmed_at").eq("school_id", schoolId).maybeSingle(),
          admin.from("lao_drive_connections").select("status,root_folder_id").eq("school_id", schoolId).maybeSingle(),
        ]);
        if (settingsError) throw settingsError;
        if (driveError) throw driveError;

        const lecReady = school.source_system === "LEC" && Boolean(school.lec_last_batch_id);
        const settingsReady = Boolean(settings?.setup_confirmed_at);
        const driveReady = drive?.status === "connected" && Boolean(drive?.root_folder_id);

        if (!lecReady || !settingsReady || !driveReady) {
          return json({
            error: "กรุณาตั้งค่าสถานศึกษาให้ครบก่อนเชิญผู้ใช้",
            setup_required: true,
            missing_steps: [
              ...(!lecReady ? ["lec"] : []),
              ...(!settingsReady ? ["settings"] : []),
              ...(!driveReady ? ["google_drive"] : []),
            ],
          }, 409);
        }

        invitationMode = "school_admin";
      } else if (callerPlatform) {
        if (schoolHasAdmin) {
          return json({ error: "โรงเรียนนี้มี School Admin แล้ว การเพิ่มผู้ใช้เป็นหน้าที่ของ School Admin โรงเรียน" }, 403);
        }
        if (roleCode !== "school_admin") {
          return json({ error: "Platform Admin เชิญได้เฉพาะ School Admin คนแรกของโรงเรียน" }, 403);
        }
        invitationMode = "platform_first_admin";
      } else {
        return json({ error: "ไม่มีสิทธิ์เชิญผู้ใช้ของสถานศึกษานี้" }, 403);
      }
    } else {
      if (!callerPlatform) {
        return json({ error: "เฉพาะ Platform Admin เท่านั้นที่เชิญ School Admin คนแรกก่อนผูก LEC ได้" }, 403);
      }
      if (roleCode !== "school_admin") {
        return json({ error: "คำเชิญก่อนผูก LEC ใช้ได้เฉพาะ School Admin คนแรก" }, 403);
      }
      invitationMode = "platform_first_admin";
    }

    const existingUser = await findUserByEmail(admin, email);
    if (existingUser && schoolId) {
      const { data: existingMembership } = await admin
        .from("lao_memberships").select("id,status")
        .eq("user_id", existingUser.id).eq("school_id", schoolId)
        .in("status", ["active", "pending", "suspended"]).maybeSingle();
      if (existingMembership?.status === "active") {
        return json({ error: "อีเมลนี้เป็นผู้ใช้ของโรงเรียนนี้อยู่แล้ว" }, 409);
      }
    }

    let pendingQuery = admin.from("lao_user_invitations")
      .select("id,role_code,auth_user_id,status")
      .eq("email", email)
      .in("status", ["pending", "onboarding"]);

    pendingQuery = schoolId ? pendingQuery.eq("school_id", schoolId) : pendingQuery.is("school_id", null);
    const { data: pendingInvite, error: pendingError } = await pendingQuery.maybeSingle();
    if (pendingError) throw pendingError;

    if (pendingInvite?.status === "onboarding") {
      return json({ error: "ผู้ใช้ยืนยันบัญชีแล้วและกำลังรอนำเข้า LEC เพื่อสร้างสถานศึกษา" }, 409);
    }
    if (pendingInvite && pendingInvite.role_code !== roleCode) {
      return json({ error: "อีเมลนี้มีคำเชิญค้างอยู่ด้วยบทบาทอื่น กรุณายกเลิกคำเชิญเดิมก่อน" }, 409);
    }

    const redirectTo = "https://webbase-x.github.io/is/lao-ems/";
    let invitedUserId: string | null = existingUser?.id ?? null;
    let delivery: "invite" | "magic_link";

    if (existingUser) {
      const { error: otpError } = await authMailer.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      if (otpError) throw otpError;
      delivery = "magic_link";
    } else {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          lao_ems_invited: true,
          lao_school_id: schoolId,
          lao_role_code: roleCode,
          lao_first_school_admin_unbound: !schoolId,
        },
      });
      if (inviteError) throw inviteError;
      invitedUserId = invited.user?.id ?? null;
      delivery = "invite";
    }

    let invitationId: string;
    if (pendingInvite) {
      const { data: updated, error: updateError } = await admin
        .from("lao_user_invitations")
        .update({
          auth_user_id: invitedUserId,
          invited_by: caller.id,
          invitation_mode: invitationMode,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", pendingInvite.id)
        .select("id").single();
      if (updateError) throw updateError;
      invitationId = updated.id;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("lao_user_invitations")
        .insert({
          organization_id: school?.organization_id ?? null,
          school_id: schoolId,
          email,
          role_code: roleCode,
          auth_user_id: invitedUserId,
          invitation_mode: invitationMode,
          invited_by: caller.id,
          status: "pending",
        })
        .select("id").single();
      if (insertError) throw insertError;
      invitationId = inserted.id;
    }

    await admin.from("lao_audit_logs").insert({
      organization_id: school?.organization_id ?? null,
      school_id: schoolId,
      actor_user_id: caller.id,
      action: pendingInvite ? "user_invitation_resent" : "user_invited",
      entity_type: "user_invitation",
      entity_id: invitationId,
      after_data: {
        email,
        role_code: roleCode,
        invitation_mode: invitationMode,
        delivery,
        awaiting_lec_school_binding: !schoolId,
      },
    });

    return json({
      ok: true,
      invitation_id: invitationId,
      delivery,
      email,
      school_name: school?.name_th ?? null,
      awaiting_lec_school_binding: !schoolId,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

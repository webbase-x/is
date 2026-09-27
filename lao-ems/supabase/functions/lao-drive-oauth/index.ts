import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const ROOT_FOLDER_NAME = "LAO-EMS";
const DEFAULT_RETURN_URL = "https://webbase-x.github.io/is/lao-ems/";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const bytesToBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const bytesToBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

async function encryptTokenPayload(value: unknown, keyMaterial: string, schoolId: string) {
  const seed = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("lao-ems-google-drive-v1:" + keyMaterial),
  );
  const key = await crypto.subtle.importKey("raw", seed, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(schoolId),
    },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

function redirectToApp(status: "connected" | "error", message?: string) {
  const target = new URL(Deno.env.get("LAO_DRIVE_RETURN_URL") || DEFAULT_RETURN_URL);
  target.searchParams.set("drive", status);
  if (message) target.searchParams.set("message", message.slice(0, 220));
  target.hash = "#/setup";
  return Response.redirect(target.toString(), 303);
}

function config() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const googleClientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") || "";
  const googleClientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") || "";
  const tokenKey = Deno.env.get("GOOGLE_DRIVE_TOKEN_KEY") || serviceKey;
  const redirectUri = supabaseUrl ? supabaseUrl + "/functions/v1/lao-drive-oauth" : "";
  return {
    supabaseUrl,
    serviceKey,
    anonKey,
    googleClientId,
    googleClientSecret,
    tokenKey,
    redirectUri,
    ready: Boolean(supabaseUrl && serviceKey && anonKey && googleClientId && googleClientSecret && tokenKey),
  };
}

async function getGoogleJson(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: "Bearer " + accessToken,
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || "Google API request failed";
    throw new Error(message);
  }
  return data;
}

async function findOrCreateRootFolder(accessToken: string) {
  const q = [
    "name = '" + ROOT_FOLDER_NAME.replace(/'/g, "\\'") + "'",
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ].join(" and ");
  const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("spaces", "drive");
  searchUrl.searchParams.set("pageSize", "100");
  searchUrl.searchParams.set("fields", "files(id,name,parents)");
  const found = await getGoogleJson(searchUrl.toString(), accessToken);
  if (Array.isArray(found.files) && found.files.length) return found.files[0];

  return await getGoogleJson(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,parents",
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ROOT_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cfg = config();
  const requestUrl = new URL(req.url);

  if (req.method === "POST") {
    try {
      if (!cfg.ready) {
        return json({
          error: "Google Drive OAuth ยังตั้งค่าไม่ครบใน Edge Function",
          configuration_required: true,
          redirect_uri: cfg.redirectUri,
          required_secrets: ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET"],
        }, 503);
      }

      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "Authentication required" }, 401);

      const admin = createClient(cfg.supabaseUrl, cfg.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const userClient = createClient(cfg.supabaseUrl, cfg.anonKey, {
        global: { headers: { Authorization: "Bearer " + token } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData.user) return json({ error: "Invalid session" }, 401);
      const caller = userData.user;

      const payload = await req.json().catch(() => ({}));
      const schoolId = String(payload?.school_id || "").trim();
      if (!schoolId) return json({ error: "กรุณาระบุสถานศึกษา" }, 400);

      const { data: setup, error: setupError } = await userClient
        .rpc("lao_ensure_school_settings", { p_school_id: schoolId });
      if (setupError) return json({ error: setupError.message }, 403);
      if (!setup?.lec_ready || !setup?.settings_ready) {
        return json({ error: "กรุณานำเข้า LEC และบันทึกการตั้งค่าสถานศึกษาให้ครบก่อนเชื่อม Google Drive" }, 409);
      }

      const rawState = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const stateHash = await sha256Hex(rawState);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: stateError } = await admin.from("lao_drive_oauth_states").insert({
        state_hash: stateHash,
        school_id: schoolId,
        user_id: caller.id,
        expires_at: expiresAt,
      });
      if (stateError) throw stateError;

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", cfg.googleClientId);
      authUrl.searchParams.set("redirect_uri", cfg.redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", DRIVE_SCOPE);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", rawState);

      return json({ authorization_url: authUrl.toString() });
    } catch (error) {
      console.error("Drive OAuth start error", error);
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (req.method === "GET") {
    try {
      if (!cfg.ready) return redirectToApp("error", "Google Drive OAuth ยังตั้งค่าไม่ครบ");

      const rawState = requestUrl.searchParams.get("state") || "";
      if (!rawState) return redirectToApp("error", "ไม่พบ OAuth state");
      const stateHash = await sha256Hex(rawState);

      const admin = createClient(cfg.supabaseUrl, cfg.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const now = new Date().toISOString();
      const { data: stateRow, error: stateError } = await admin
        .from("lao_drive_oauth_states")
        .update({ used_at: now })
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", now)
        .select("id,school_id,user_id")
        .maybeSingle();

      if (stateError) throw stateError;
      if (!stateRow) return redirectToApp("error", "OAuth state หมดอายุหรือถูกใช้งานแล้ว");

      const googleError = requestUrl.searchParams.get("error");
      if (googleError) {
        return redirectToApp("error", googleError === "access_denied" ? "ยกเลิกการอนุญาต Google Drive" : googleError);
      }

      const code = requestUrl.searchParams.get("code") || "";
      if (!code) return redirectToApp("error", "Google ไม่ส่ง authorization code กลับมา");

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: cfg.googleClientId,
          client_secret: cfg.googleClientSecret,
          redirect_uri: cfg.redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokens.access_token) {
        throw new Error(tokens.error_description || tokens.error || "แลก Google OAuth token ไม่สำเร็จ");
      }
      if (!tokens.refresh_token) {
        throw new Error("Google ไม่ส่ง refresh token กรุณาเชื่อมใหม่และอนุญาตสิทธิ์อีกครั้ง");
      }

      const about = await getGoogleJson(
        "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId)",
        tokens.access_token,
      );
      const folder = await findOrCreateRootFolder(tokens.access_token);

      const encrypted = await encryptTokenPayload({
        refresh_token: tokens.refresh_token,
        scope: tokens.scope || DRIVE_SCOPE,
        token_type: tokens.token_type || "Bearer",
      }, cfg.tokenKey, stateRow.school_id);

      const { error: credentialError } = await admin.from("lao_drive_credentials").upsert({
        school_id: stateRow.school_id,
        token_ciphertext: encrypted.ciphertext,
        token_iv: encrypted.iv,
        updated_at: now,
      }, { onConflict: "school_id" });
      if (credentialError) throw credentialError;

      const { data: school, error: schoolError } = await admin
        .from("lao_schools")
        .select("id,organization_id")
        .eq("id", stateRow.school_id)
        .single();
      if (schoolError) throw schoolError;

      const googleEmail = String(about?.user?.emailAddress || "").trim().toLowerCase() || null;
      const permissionId = String(about?.user?.permissionId || "").trim();
      const { error: connectionError } = await admin.from("lao_drive_connections").upsert({
        school_id: stateRow.school_id,
        provider: "google_drive",
        google_account_email: googleEmail,
        root_folder_id: folder.id,
        root_folder_name: ROOT_FOLDER_NAME,
        connection_ref: permissionId ? "google:" + permissionId : "google_drive",
        status: "connected",
        connected_by: stateRow.user_id,
        connected_at: now,
        last_sync_at: now,
        last_error: null,
        provisioned_at: now,
        folder_schema_version: 1,
      }, { onConflict: "school_id" });
      if (connectionError) throw connectionError;

      await admin.from("lao_audit_logs").insert({
        organization_id: school.organization_id,
        school_id: stateRow.school_id,
        actor_user_id: stateRow.user_id,
        action: "google_drive_connected",
        entity_type: "drive_connection",
        entity_id: stateRow.school_id,
        after_data: {
          provider: "google_drive",
          google_account_email: googleEmail,
          root_folder_id: folder.id,
          root_folder_name: ROOT_FOLDER_NAME,
          scope: DRIVE_SCOPE,
        },
        context: { oauth_state_id: stateRow.id },
      });

      return redirectToApp("connected");
    } catch (error) {
      console.error("Drive OAuth callback error", error);
      return redirectToApp("error", error instanceof Error ? error.message : String(error));
    }
  }

  return json({ error: "Method not allowed" }, 405);
});

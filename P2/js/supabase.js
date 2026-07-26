import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8/+esm";
import { APP_CONFIG } from "./config.js";

const pageQuery = new URLSearchParams(window.location.search);
const authScope = pageQuery.get("authScope") || pageQuery.get("embed");
const safeAuthScope = String(authScope || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
const isolatedStorageKey = safeAuthScope.startsWith("reviewer-")
  ? `thai-game-p2-${safeAuthScope}-auth`
  : safeAuthScope === "expert-teacher"
    ? "thai-game-p2-expert-teacher-auth"
    : safeAuthScope === "expert-student"
      ? "thai-game-p2-expert-student-auth"
      : undefined;

export const supabase = createClient(
  APP_CONFIG.supabaseUrl,
  APP_CONFIG.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      ...(isolatedStorageKey ? { storageKey: isolatedStorageKey } : {}),
    },
    realtime: {
      params: { eventsPerSecond: 12 },
    },
  },
);

export async function ensureAnonymousAuth() {
  const { data: current, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (current.session) return current.session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export function isMissingSchema(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("could not find") || text.includes("schema cache");
}

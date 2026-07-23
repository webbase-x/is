import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { APP_CONFIG } from "./config.js";

const embedRole = new URLSearchParams(window.location.search).get("embed");
const isolatedStorageKey = embedRole === "expert-teacher"
  ? "thai-game-p2-expert-teacher-auth"
  : embedRole === "expert-student"
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

function standardAuthStorageKey() {
  const projectRef = new URL(APP_CONFIG.supabaseUrl).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

/**
 * Copies an already-authenticated teacher session into the isolated Expert
 * iframe. Tokens stay in browser storage and are never placed in markup,
 * URLs, or source code.
 */
export async function useExistingTeacherSessionForExpert() {
  if (embedRole !== "expert-teacher") return null;

  let storedSession;
  try {
    storedSession = JSON.parse(window.localStorage.getItem(standardAuthStorageKey()) || "null");
  } catch {
    return null;
  }

  if (!storedSession?.access_token || !storedSession?.refresh_token || storedSession?.user?.is_anonymous) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: storedSession.access_token,
    refresh_token: storedSession.refresh_token,
  });
  if (error) throw error;
  if (data.session?.user?.is_anonymous) {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }
  return data.session;
}

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

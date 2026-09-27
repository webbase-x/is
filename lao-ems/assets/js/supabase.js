import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { CONFIG } from "./config.js";

const authStorage = {
  getItem(key) {
    return (localStorage.getItem("lao_remember_login")==="1" ? localStorage : sessionStorage).getItem(key);
  },
  setItem(key, value) {
    const remember = localStorage.getItem("lao_remember_login")==="1";
    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    other.removeItem(key);
    target.setItem(key, value);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage
  }
});

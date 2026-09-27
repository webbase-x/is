import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { CONFIG } from "./config.js";

const scopedKey = key => "lao-ems:" + key;

const authStorage = {
  getItem(key) {
    const target = localStorage.getItem("lao_remember_login")==="1" ? localStorage : sessionStorage;
    const scoped = target.getItem(scopedKey(key));
    if(scoped)return scoped;
    if(localStorage.getItem("lao_legacy_session_rejected")==="1")return null;
    const legacy = sessionStorage.getItem(key) || localStorage.getItem(key);
    if(legacy){
      target.setItem(scopedKey(key),legacy);
      return legacy;
    }
    return null;
  },
  setItem(key, value) {
    const remember = localStorage.getItem("lao_remember_login")==="1";
    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    other.removeItem(scopedKey(key));
    target.setItem(scopedKey(key), value);
  },
  removeItem(key) {
    localStorage.removeItem(scopedKey(key));
    sessionStorage.removeItem(scopedKey(key));
  }
};

export function clearLaoAuthSession(){
  for(const storage of [localStorage,sessionStorage]){
    const remove=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(key&&key.startsWith("lao-ems:"))remove.push(key);
    }
    remove.forEach(key=>storage.removeItem(key));
  }
}

export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage
  }
});

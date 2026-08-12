import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SHARED_SUPABASE_URL = "https://xnpzkhjodokvcgzovlxx.supabase.co";
const SHARED_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_r0M5jKyJcrQAKstRlmYOdQ_J_0aLofN";

export default defineConfig({
  root: "github-pages",
  base: "/is/rs/",
  plugins: [react()],
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? SHARED_SUPABASE_URL,
    ),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        SHARED_SUPABASE_PUBLISHABLE_KEY,
    ),
  },
  build: {
    outDir: "../github-pages-dist",
    emptyOutDir: true,
  },
});

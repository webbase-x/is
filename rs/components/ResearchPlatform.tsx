"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import LoginScreen from "./LoginScreen";
import ProjectManager from "./ProjectManager";
import ResearchStatsApp from "./ResearchStatsApp";
import type { ResearchProject } from "../lib/supabase/types";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../lib/supabase/client";

export default function ResearchPlatform() {
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(() => !isSupabaseConfigured);
  const [analysisProject, setAnalysisProject] =
    useState<ResearchProject | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setReady(true);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    if (demo) {
      setDemo(false);
      setAnalysisProject(null);
      return;
    }
    await getSupabaseClient()?.auth.signOut();
    setAnalysisProject(null);
  }

  if (!ready)
    return (
      <div className="app-loading">
        <div className="brand-mark">R</div>
        <span>กำลังเปิดพื้นที่ทำงาน…</span>
      </div>
    );
  if (!user && !demo) return <LoginScreen onDemo={() => setDemo(true)} />;
  if (analysisProject)
    return (
      <ResearchStatsApp
        project={analysisProject}
        initialAnalysisId={analysisId}
        onBack={() => {
          setAnalysisProject(null);
          setAnalysisId(null);
        }}
      />
    );
  return (
    <ProjectManager
      user={user}
      demo={demo}
      onAnalyze={(project, nextAnalysisId) => {
        setAnalysisId(nextAnalysisId ?? null);
        setAnalysisProject(project);
      }}
      onSignOut={signOut}
    />
  );
}

import { APP_CONFIG } from "./config.js";
import { supabase } from "./supabase.js?v=20260727-reviewer-links-1";
import { isReviewerEmail, reviewerByEmail } from "./reviewer-access.js?v=20260727-reviewer-links-1";
import { PLAN_CATALOG } from "./plan-catalog.js?v=20260731-assessment-research-1";
import {
  $, $$, assessmentActivityForPhase, activitiesForPlan, activityForKey, downloadCsv, escapeHtml, hide, isAssessmentSession, modeLabel, playerStatusLabel,
  EXPERT_SCORE_EVENT, EXPERT_SCOREBOARD_EVENT, EXPERT_SCOREBOARD_REQUEST_EVENT,
  GAME_STATE_EVENT, GAME_STATE_REQUEST_EVENT, gameStateChannelName, gameStatePayload, randomAvatar,
  lessonFlowForPlan, lessonStepForKey, renderPlanTimeline, sanitizeGameMarkup, show, toast, updateConnectionBadge,
} from "./common.js?v=20260816-satisfaction-3";
import { classTeamGoal } from "./gamification.js?v=20260807-primary-copy-1";
import { satisfactionLevel } from "./satisfaction-survey.js?v=20260817-research-levels-2";
import { EXIT_TICKET_INSTRUMENT_VERSION } from "./exit-ticket-bank.js?v=20260817-four-skills-1";

const TEACHER_BUILD_VERSION = "20260817-session-report-backup-4";
const TEACHER_BUILD_CHECK_INTERVAL_MS = 60_000;
let teacherBuildReloadRequested = false;

async function checkForTeacherUpdate() {
  if (teacherBuildReloadRequested) return;
  try {
    const manifestUrl = new URL("app-version.json", window.location.href);
    manifestUrl.searchParams.set("checkedAt", Date.now().toString());
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) return;
    const deployedVersion = String((await response.json())?.teacher || "");
    if (!deployedVersion || deployedVersion === TEACHER_BUILD_VERSION) return;

    const latestUrl = new URL(window.location.href);
    if (latestUrl.searchParams.get("appBuild") === deployedVersion) return;
    teacherBuildReloadRequested = true;
    latestUrl.searchParams.set("appBuild", deployedVersion);
    window.location.replace(latestUrl.href);
  } catch {
    // ‡∏Å‡∏≤‡∏£‡∏ï‡∏£‡∏ß‡∏à‡∏£‡∏∏‡πà‡∏ô‡∏ï‡πâ‡∏≠‡∏á‡πÑ‡∏°‡πà‡∏Ç‡∏±‡∏î‡∏Ç‡∏ß‡∏≤‡∏á‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô‡πÄ‡∏°‡∏∑‡πà‡∏≠‡∏≠‡∏¥‡∏ô‡πÄ‡∏ó‡∏≠‡∏£‡πå‡πÄ‡∏ô‡πá‡∏ï‡πÑ‡∏°‡πà‡πÄ‡∏™‡∏ñ‡∏µ‡∏¢‡∏£
  }
}

void checkForTeacherUpdate();
window.setInterval(checkForTeacherUpdate, TEACHER_BUILD_CHECK_INTERVAL_MS);

const projectorClockFormatter = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function updateProjectorWallClock() {
  const output = $("#projectorWallClock");
  if (output) output.textContent = projectorClockFormatter.format(new Date());
}

updateProjectorWallClock();
window.setInterval(updateProjectorWallClock, 1000);

const state = {
  user: null,
  profile: null,
  classes: [],
  plans: [],
  session: null,
  players: [],
  attempts: [],
  expertAttemptIds: new Set(),
  leaderboard: [],
  sentenceSubmissions: [],
  sessionChannel: null,
  presenceChannel: null,
  displayChannel: null,
  importRows: [],
  rosterCounts: new Map(),
  flowStep: "class",
  selectedPlanId: null,
  selectedAssessmentPhase: null,
  assessmentReport: [],
  gameAlignmentReport: [],
  sessionActivityReport: [],
  classReportContext: null,
  satisfactionReport: { completed_count: 0, overall_average: null, questions: [], individuals: [], comments: [] },
  satisfactionResponses: [],
  satisfactionSubmissions: [],
  playerSelfieUrls: new Map(),
  lobbyPage: 1,
  lobbyZoomStep: 0,
  celebrationActivityKey: null,
  celebrationReason: null,
  competitionSoundEnabled: true,
  liveRankingEnabled: true,
  activityTimerId: null,
  activityRemainingMs: 0,
  activityTimerLastTickAt: null,
  activityStartedAt: null,
  finishingActivity: false,
  studentScreens: new Map(),
  studentScreenView: "grid",
  selectedStudentScreenId: null,
  studentScreenFocusMarkup: "",
  watchedStudentScreenId: null,
  studentScreenWatchTimer: null,
  lateJoinMode: false,
  lateJoinResumeStatus: "paused",
  lessonStepKey: null,
  lessonRoundId: null,
  lessonShareStudents: false,
  lessonTimerExpired: false,
  teacherNotesCollapsed: false,
  lessonCardIndex: 0,
};

function assessmentStepForSession(session = state.session) {
  const activity = assessmentActivityForPhase(session?.assessment_phase);
  if (!activity) return null;
  const minutes = Number(session?.assessment_duration_minutes) || activity.minutes;
  const isSurvey = activity.phase === "satisfaction";
  const phase = activity.phase === "posttest" ? "‡∏´‡∏•‡∏±‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô" : "‡∏Å‡πà‡∏≠‡∏ô‡πÄ‡∏£‡∏µ‡∏¢‡∏ô";
  return {
    key: `assessment-${activity.phase}`,
    stage: "‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô",
    kind: "assessment",
    activityKey: activity.key,
    icon: activity.icon,
    title: activity.title,
    minutes,
    studentVisibleDefault: true,
    teacherNotes: isSurvey ? [
      `‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ï‡∏≠‡∏ö‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡∏Ñ‡∏ß‡∏≤‡∏°‡∏û‡∏∂‡∏á‡∏û‡∏≠‡πÉ‡∏à 10 ‡∏Ç‡πâ‡∏≠‡∏†‡∏≤‡∏¢‡πÉ‡∏ô ${minutes} ‡∏ô‡∏≤‡∏ó‡∏µ`,
      "‡∏Ñ‡∏£‡∏π‡∏≠‡πà‡∏≤‡∏ô‡∏Ç‡πâ‡∏≠‡∏Ñ‡∏ß‡∏≤‡∏°‡πÉ‡∏´‡πâ‡∏ü‡∏±‡∏á‡∏ó‡∏µ‡∏•‡∏∞‡∏Ç‡πâ‡∏≠ ‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡πÄ‡∏•‡∏∑‡∏≠‡∏Å 3 = ‡∏°‡∏≤‡∏Å, 2 = ‡∏õ‡∏≤‡∏ô‡∏Å‡∏•‡∏≤‡∏á ‡∏´‡∏£‡∏∑‡∏≠ 1 = ‡∏ô‡πâ‡∏≠‡∏¢",
      "‡∏£‡∏∞‡∏ö‡∏ö‡∏ö‡∏±‡∏ô‡∏ó‡∏∂‡∏Å‡∏ó‡∏∏‡∏Å‡∏Ç‡πâ‡∏≠‡∏ó‡∏±‡∏ô‡∏ó‡∏µ‡πÅ‡∏•‡∏∞‡∏™‡∏£‡∏∏‡∏õ‡∏Ñ‡πà‡∏≤‡πÄ‡∏â‡∏•‡∏µ‡πà‡∏¢‡πÉ‡∏ô‡∏£‡∏≤‡∏¢‡∏á‡∏≤‡∏ô‡∏Ñ‡∏£‡∏π ‡πÇ‡∏î‡∏¢‡πÑ‡∏°‡πà‡πÄ‡∏ä‡∏∑‡πà‡∏≠‡∏°‡∏Å‡∏±‡∏ö‡∏Ñ‡∏∞‡πÅ‡∏ô‡∏ô‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö",
    ] : [
      `‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏≥‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö${phase} 20 ‡∏Ç‡πâ‡∏≠‡∏î‡πâ‡∏ß‡∏¢‡∏ï‡∏ô‡πÄ‡∏≠‡∏á‡∏†‡∏≤‡∏¢‡πÉ‡∏ô ${minutes} ‡∏ô‡∏≤‡∏ó‡∏µ`,
      "‡∏£‡∏∞‡∏ö‡∏ö‡∏™‡∏•‡∏±‡∏ö‡∏•‡∏≥‡∏î‡∏±‡∏ö‡∏Ç‡πâ‡∏≠‡πÅ‡∏•‡∏∞‡∏ï‡∏±‡∏ß‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏ö‡∏ô‡∏à‡∏≠‡πÅ‡∏ï‡πà‡∏•‡∏∞‡∏Ñ‡∏ô ‡πÅ‡∏ï‡πà‡∏ö‡∏±‡∏ô‡∏ó‡∏∂‡∏Å‡∏£‡∏´‡∏±‡∏™‡∏Ç‡πâ‡∏≠‡πÄ‡∏î‡∏¥‡∏°‡πÄ‡∏û‡∏∑‡πà‡∏≠‡πÄ‡∏ó‡∏µ‡∏¢‡∏ö‡∏ú‡∏•‡πÑ‡∏î‡πâ‡∏ñ‡∏π‡∏Å‡∏ï‡πâ‡∏≠‡∏á",
      "‡∏´‡∏•‡∏±‡∏á‡∏à‡∏ö‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö‡πÑ‡∏°‡πà‡∏õ‡∏£‡∏∞‡∏Å‡∏≤‡∏®‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö ‡∏Ñ‡∏∞‡πÅ‡∏ô‡∏ô‡∏à‡∏∞‡∏õ‡∏£‡∏≤‡∏Å‡∏è‡πÉ‡∏ô‡∏£‡∏≤‡∏¢‡∏á‡∏≤‡∏ô‡∏Ñ‡∏£‡∏π‡πÅ‡∏•‡∏∞‡∏™‡πà‡∏á‡∏≠‡∏≠‡∏Å‡πÄ‡∏õ‡πá‡∏ô‡∏ï‡∏≤‡∏£‡∏≤‡∏á‡πÑ‡∏î‡πâ",
    ],
    screen: {
      eyebrow: isSurvey ? "‡∏Å‡∏≤‡∏£‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡∏Ñ‡∏ß‡∏≤‡∏°‡∏û‡∏∂‡∏á‡∏û‡∏≠‡πÉ‡∏à" : `‡∏Å‡∏≤‡∏£‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô${phase}`,
      title: activity.title,
      message: isSurvey
        ? `‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏£‡∏±‡∏ö‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô 10 ‡∏Ç‡πâ‡∏≠ ¬∑ ‡πÄ‡∏´‡∏•‡∏∑‡∏≠‡πÄ‡∏ß‡∏•‡∏≤ ${minutes} ‡∏ô‡∏≤‡∏ó‡∏µ ¬∑ ‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏Ñ‡∏≥‡∏ï‡∏≠‡∏ö‡∏ú‡∏¥‡∏î‡∏´‡∏£‡∏∑‡∏≠‡∏ñ‡∏π‡∏Å`
        : `‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏£‡∏±‡∏ö‡∏Ñ‡∏≥‡∏ï‡∏≠‡∏ö 20 ‡∏Ç‡πâ‡∏≠ ¬∑ ‡πÄ‡∏´‡∏•‡∏∑‡∏≠‡πÄ‡∏ß‡∏•‡∏≤ ${minutes} ‡∏ô‡∏≤‡∏ó‡∏µ ¬∑ ‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏Å‡∏≤‡∏£‡πÅ‡∏™‡∏î‡∏á‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö`,
      icon: activity.icon,
      bullets: isSurvey
        ? ["‡∏ï‡∏≠‡∏ö‡∏ï‡∏≤‡∏°‡∏Ñ‡∏ß‡∏≤‡∏°‡∏£‡∏π‡πâ‡∏™‡∏∂‡∏Å‡∏à‡∏£‡∏¥‡∏á", "‡∏Ñ‡∏£‡∏π‡∏≠‡πà‡∏≤‡∏ô‡∏Ç‡πâ‡∏≠‡∏Ñ‡∏ß‡∏≤‡∏°‡∏ó‡∏µ‡∏•‡∏∞‡∏Ç‡πâ‡∏≠", "‡∏ö‡∏±‡∏ô‡∏ó‡∏∂‡∏Å‡∏ú‡∏•‡πÅ‡∏¢‡∏Å‡∏à‡∏≤‡∏Å‡∏Ñ‡∏∞‡πÅ‡∏ô‡∏ô‡∏™‡∏≠‡∏ö"]
        : ["‡∏ó‡∏≥‡∏î‡πâ‡∏ß‡∏¢‡∏ï‡∏ô‡πÄ‡∏≠‡∏á", "‡πÑ‡∏°‡πà‡∏°‡∏µ‡πÄ‡∏â‡∏•‡∏¢‡∏£‡∏∞‡∏´‡∏ß‡πà‡∏≤‡∏á‡∏ó‡∏≥", "‡∏ö‡∏±‡∏ô‡∏ó‡∏∂‡∏Å‡πÄ‡∏û‡∏∑‡πà‡∏≠‡πÄ‡∏õ‡∏£‡∏µ‡∏¢‡∏ö‡πÄ‡∏ó‡∏µ‡∏¢‡∏ö‡∏ú‡∏•‡∏Å‡πà‡∏≠‡∏ô‚Äì‡∏´‡∏•‡∏±‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô"],
    },
  };
}

function currentActivities(planId = state.session?.plan_id || state.selectedPlanId || 1) {
  const assessment = assessmentStepForSession();
  if (assessment) return [assessmentActivityForPhase(state.session.assessment_phase)];
  const activities = activitiesForPlan(planId);
  if (Number(planId) !== 1) return activities;
  const included = new Set(currentLessonFlow(planId).map(step => step.activityKey).filter(Boolean));
  return activities.filter(activity => included.has(activity.key));
}

function currentLessonFlow(planId = state.session?.plan_id || state.selectedPlanId || 1) {
  const assessment = assessmentStepForSession();
  if (assessment) return [assessment];
  return lessonFlowForPlan(planId);
}

function currentLessonStep() {
  const assessment = assessmentStepForSession();
  if (assessment) return assessment;
  return lessonStepForKey(state.lessonStepKey, state.session?.plan_id || state.selectedPlanId || 1);
}

function lessonFlowStorageKey() {
  return state.session?.id ? `thai-game-lesson-flow-${state.session.id}` : "";
}

function saveLessonFlowState() {
  const key = lessonFlowStorageKey();
  if (!key || !state.lessonStepKey) return;
  try {
    localStorage.setItem(key, JSON.stringify({
      stepKey: state.lessonStepKey,
      roundId: state.lessonRoundId,
      shareStudents: state.lessonShareStudents,
      cardIndex: state.lessonCardIndex,
    }));
  } catch { /* Realtime continues even if local storage is unavailable. */ }
}

function restoreLessonFlowState() {
  const flow = currentLessonFlow();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(lessonFlowStorageKey()) || "null"); } catch { saved = null; }
  const savedStep = flow.find(step => step.key === saved?.stepKey);
  const activityStep = flow.find(step => step.activityKey === state.session?.current_activity_key);
  const step = savedStep || activityStep || flow[0] || null;
  state.lessonStepKey = step?.key || null;
  state.lessonRoundId = saved?.roundId || `${Date.now()}-${Math.random()}`;
  state.lessonShareStudents = step?.kind === "game" ? true : Boolean(savedStep ? saved?.shareStudents : step?.studentVisibleDefault);
  state.lessonCardIndex = Math.max(0, Number(savedStep ? saved?.cardIndex : 0) || 0);
  state.celebrationActivityKey = step?.kind === "results" ? step.activityKey : null;
  state.celebrationReason = step?.kind === "results" ? "manual" : null;
  state.lessonTimerExpired = false;
}

function lessonStepBroadcastPayload() {
  const step = currentLessonStep();
  if (!step) return null;
  return {
    key: step.key,
    round_id: state.lessonRoundId,
    stage: step.stage,
    kind: step.kind,
    activity_key: step.activityKey || null,
    title: step.title,
    icon: step.icon,
    minutes: step.minutes,
    show_on_students: step.kind === "game" ? true : state.lessonShareStudents,
    show_leaderboard: Boolean(step.showLeaderboard),
    card_index: state.lessonCardIndex,
    screen: step.screen,
  };
}

function lessonTimerBroadcastPayload() {
  return {
    remaining_ms: Math.max(0, state.activityRemainingMs),
    running: Boolean(state.activityTimerId && state.session?.status === "active" && !state.lessonTimerExpired),
    expired: state.lessonTimerExpired,
    issued_at: Date.now(),
  };
}

const teacherPageQuery = new URLSearchParams(window.location.search);
const expertTeacherEmbed = teacherPageQuery.get("embed") === "expert-teacher";
const expertReviewMode = teacherPageQuery.get("expertReview") === "1";
const requestedReviewerEmail = String(teacherPageQuery.get("reviewer") || "").trim().toLowerCase();
const expertReviewEmail = isReviewerEmail(requestedReviewerEmail) ? requestedReviewerEmail : "expert@webbase.x";
if (expertTeacherEmbed) document.body.classList.add("expert-embed", "expert-teacher-embed");
if (expertReviewMode) {
  $("#teacherEmail").value = expertReviewEmail;
  $("#teacherPassword").value = "";
}

const FLOW_STEPS = ["class", "qr", "lobby", "plan", "live", "summary"];
const FLOW_TITLES = {
  class: "‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡πÇ‡∏£‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡πÅ‡∏•‡∏∞‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô",
  qr: "QR ‡πÅ‡∏•‡∏∞‡∏£‡∏´‡∏±‡∏™‡πÄ‡∏Ç‡πâ‡∏≤‡∏´‡πâ‡∏≠‡∏á",
  lobby: "‡∏ï‡∏£‡∏ß‡∏à‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡πÄ‡∏Ç‡πâ‡∏≤‡∏´‡πâ‡∏≠‡∏á",
  plan: "‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡πÅ‡∏ú‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô",
  live: "‡∏Ñ‡∏ß‡∏ö‡∏Ñ‡∏∏‡∏°‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô‡πÅ‡∏•‡∏∞‡∏ú‡∏•‡∏Å‡∏≤‡∏£‡πÅ‡∏Ç‡πà‡∏á‡∏Ç‡∏±‡∏ô",
  summary: "‡∏™‡∏£‡∏∏‡∏õ‡∏ú‡∏•‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏£‡∏µ‡∏¢‡∏ô",
};

const LOBBY_LAYOUTS = [
  { key: "overview", label: "‡∏†‡∏≤‡∏û‡∏£‡∏ß‡∏°", minWidth: 108, rowHeight: 76 },
  { key: "compact", label: "‡∏Å‡∏∞‡∏ó‡∏±‡∏î‡∏£‡∏±‡∏î", minWidth: 160, rowHeight: 92 },
  { key: "normal", label: "‡∏°‡∏≤‡∏ï‡∏£‡∏ê‡∏≤‡∏ô", minWidth: 250, rowHeight: 112 },
  { key: "large", label: "‡πÉ‡∏´‡∏ç‡πà", minWidth: 350, rowHeight: 170 },
  { key: "xlarge", label: "‡πÉ‡∏´‡∏ç‡πà‡∏°‡∏≤‡∏Å", minWidth: 480, rowHeight: 240 },
  { key: "inspect", label: "‡∏ï‡∏£‡∏ß‡∏à‡πÉ‡∏ö‡∏´‡∏ô‡πâ‡∏≤", minWidth: 680, rowHeight: 310 },
];

function connectionUpdate() {
  updateConnectionBadge($("#teacherConnection"), navigator.onLine, navigator.onLine ? "‡πÄ‡∏ä‡∏∑‡πà‡∏≠‡∏°‡∏ï‡πà‡∏≠‡πÅ‡∏•‡πâ‡∏ß" : "‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏≠‡∏¥‡∏ô‡πÄ‡∏ó‡∏≠‡∏£‡πå‡πÄ‡∏ô‡πá‡∏ï");
}

function selectedClassroom() {
  return state.classes.find(item => item.id === (state.session?.class_id || $("#classSelect")?.value));
}

function classContext(classroom = selectedClassroom()) {
  if (!classroom) return "‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡πÑ‡∏î‡πâ‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô";
  const scoreMode = state.session?.score_recording_enabled === false ? " ¬∑ ‡πÇ‡∏´‡∏°‡∏î‡∏ï‡∏£‡∏ß‡∏à‡∏™‡∏∑‡πà‡∏≠ ‡∏à‡∏±‡∏î‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö‡∏™‡∏î‡πÑ‡∏î‡πâ ‡πÑ‡∏°‡πà‡∏ö‡∏±‡∏ô‡∏ó‡∏∂‡∏Å‡∏Ñ‡∏∞‡πÅ‡∏ô‡∏ô‡∏´‡∏•‡∏±‡∏á‡∏à‡∏ö‡∏Ñ‡∏≤‡∏ö" : "";
  return `${classroom.school?.name || "‡πÇ‡∏£‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô"} ¬∑ ${classroom.label} ¬∑ ‡∏Ñ‡∏£‡∏π${state.profile?.full_name || "‡∏ú‡∏π‡πâ‡∏™‡∏≠‡∏ô"}${scoreMode}`;
}

function sessionRecordsScores(session = state.session) {
  return session?.score_recording_enabled !== false;
}

function renderScoreRecordingNotice() {
  $("#scoreRecordingNotice")?.classList.toggle("hidden", sessionRecordsScores());
}

function setTeacherFlowStep(step) {
  if (!FLOW_STEPS.includes(step)) return;
  if (step !== "live") setClassroomStageExpanded(false);
  state.flowStep = step;
  show($("#teacherFlowProgress"));
  hide($("#resumeSessionView"));
  $$("[data-flow-step]").forEach(panel => panel.classList.toggle("hidden", panel.dataset.flowStep !== step));
  $$("[data-progress-step]").forEach((item, index) => {
    const targetIndex = FLOW_STEPS.indexOf(step);
    item.classList.toggle("active", index === targetIndex);
    item.classList.toggle("done", index < targetIndex);
  });
  $("#flowStepTitle").textContent = FLOW_TITLES[step];
  $("#flowContext").textContent = step === "class" ? "‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏à‡∏≤‡∏Å‡πÇ‡∏£‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡πÅ‡∏•‡∏∞‡∏´‡πâ‡∏≠‡∏á‡∏ó‡∏µ‡πà‡∏Ñ‡∏∏‡∏ì‡∏Ñ‡∏£‡∏π‡∏£‡∏±‡∏ö‡∏ú‡∏¥‡∏î‡∏ä‡∏≠‡∏ö" : classContext();
  if (step === "lobby") {
    syncLateJoinControls();
    requestAnimationFrame(renderPlayerPage);
  }
  if (step === "live" && state.session) renderCurrentLessonStep();
  else stopProjectorGamePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncLateJoinControls() {
  const active = Boolean(state.lateJoinMode || (state.session?.status === "lobby" && state.session?.current_activity_key));
  if (active) state.lateJoinMode = true;
  $("#lobbyBackButton").textContent = active ? "‚Üê ‡∏õ‡∏¥‡∏î‡∏£‡∏±‡∏ö‡πÅ‡∏•‡∏∞‡∏Å‡∏•‡∏±‡∏ö‡πÑ‡∏õ‡πÄ‡∏Å‡∏°" : "‚Üê ‡∏Å‡∏•‡∏±‡∏ö‡πÑ‡∏õ‡∏´‡∏ô‡πâ‡∏≤ QR";
  $("#lobbyNextButton").textContent = active ? "‡∏õ‡∏¥‡∏î‡∏£‡∏±‡∏ö‡πÅ‡∏•‡∏∞‡∏Å‡∏•‡∏±‡∏ö‡πÑ‡∏õ‡πÄ‡∏Å‡∏° ‚Üí" : "‡∏ï‡πà‡∏≠‡πÑ‡∏õ: ‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡πÅ‡∏ú‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô ‚Üí";
  $("#lateJoinRoomCode").textContent = state.session?.room_code || "------";
  $("#lateJoinNotice").classList.toggle("hidden", !active);
}

async function bootstrap() {
  connectionUpdate();
  renderPlanTimeline($("#planTimeline"), 1);
  const { data } = await supabase.auth.getSession();
  if (data.session && !data.session.user.is_anonymous) {
    if (expertReviewMode && String(data.session.user.email || "").toLowerCase() !== expertReviewEmail) {
      await supabase.auth.signOut();
      $("#teacherEmail").value = expertReviewEmail;
      $("#teacherPassword").value = "";
      return;
    }
    state.user = data.session.user;
    await loadTeacherWorkspace();
  }
}

function applyRolePermissions() {
  const administrator = state.profile?.role === "admin" && Number(state.profile?.access_level) === 1;
  $$('[data-admin-only]').forEach(element => element.classList.toggle("hidden", !administrator));
  if (!administrator && $("#rosterPanel")?.classList.contains("active")) showPanel("sessionPanel");
}

async function signIn(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡πÄ‡∏Ç‡πâ‡∏≤‡∏™‡∏π‡πà‡∏£‡∏∞‡∏ö‡∏ö...";
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $("#teacherEmail").value.trim(),
      password: $("#teacherPassword").value,
    });
    if (error) throw error;
    state.user = data.user;
    await loadTeacherWorkspace();
  } catch (error) {
    toast(error.message || "‡πÄ‡∏Ç‡πâ‡∏≤‡∏™‡∏π‡πà‡∏£‡∏∞‡∏ö‡∏ö‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à", "error");
  } finally {
    button.disabled = false;
    button.textContent = "‡πÄ‡∏Ç‡πâ‡∏≤‡∏™‡∏π‡πà‡∏£‡∏∞‡∏ö‡∏ö";
  }
}

async function loadTeacherWorkspace() {
  const { data: profile, error } = await supabase.from("teacher_profiles").select("*").eq("user_id", state.user.id).maybeSingle();
  if (error || !profile?.active) {
    await supabase.auth.signOut();
    state.user = null;
    return toast("‡∏ö‡∏±‡∏ç‡∏ä‡∏µ‡∏ô‡∏µ‡πâ‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡πÑ‡∏î‡πâ‡∏£‡∏±‡∏ö‡∏™‡∏¥‡∏ó‡∏ò‡∏¥‡πå‡∏Ñ‡∏£‡∏π ‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡πÉ‡∏´‡πâ‡∏ú‡∏π‡πâ‡∏î‡∏π‡πÅ‡∏•‡πÄ‡∏õ‡∏¥‡∏î‡∏™‡∏¥‡∏ó‡∏ò‡∏¥‡πå‡∏Å‡πà‡∏≠‡∏ô", "error");
  }
  if (expertReviewMode) {
    const signedInEmail = String(state.user.email || "").trim().toLowerCase();
    const reviewOnly = signedInEmail === expertReviewEmail
      && isReviewerEmail(signedInEmail)
      && Number(profile.access_level) === 2
      && profile.can_record_scores === false;
    if (!reviewOnly) {
      await supabase.auth.signOut();
      state.user = null;
      $("#teacherEmail").value = expertReviewEmail;
      $("#teacherPassword").value = "";
      return toast("‡∏ö‡∏±‡∏ç‡∏ä‡∏µ‡∏ô‡∏µ‡πâ‡πÑ‡∏°‡πà‡πÑ‡∏î‡πâ‡∏£‡∏±‡∏ö‡∏™‡∏¥‡∏ó‡∏ò‡∏¥‡πå‡πÇ‡∏´‡∏°‡∏î‡∏ï‡∏£‡∏ß‡∏à‡∏™‡∏∑‡πà‡∏≠", "error");
    }
    const reviewer = reviewerByEmail(signedInEmail);
    if (reviewer) profile.full_name = reviewer.label;
  }
  state.profile = profile;
  applyRolePermissions();
  $("#teacherName").textContent = profile.full_name;
  hide($("#teacherLoginView"));
  show($("#teacherDashboard"));
  show($("#signOutButton"));
  await loadClasses();
  await loadRoster();
  await loadPlans();
  await restoreActiveSession();
}

async function signOut() {
  await supabase.auth.signOut();
  location.reload();
}

async function loadClasses() {
  const { data, error } = await supabase.rpc("get_teacher_classes");
  if (error) {
    state.classes = [];
    renderSchoolOptions();
    toast("‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡∏£‡∏±‡∏ô‡πÑ‡∏ü‡∏•‡πå‡∏≠‡∏±‡∏õ‡πÄ‡∏Å‡∏£‡∏î‡∏ê‡∏≤‡∏ô‡∏Ç‡πâ‡∏≠‡∏°‡∏π‡∏•‡∏™‡∏≥‡∏´‡∏£‡∏±‡∏ö‡∏´‡∏ô‡πâ‡∏≤‡∏Ñ‡∏£‡∏π‡∏Å‡πà‡∏≠‡∏ô‡πÉ‡∏ä‡πâ‡∏á‡∏≤‡∏ô", "error");
    return;
  }
  state.classes = (data || []).map(item => ({
    id: item.class_id,
    label: item.class_label,
    grade: item.grade,
    room_no: item.room_no,
    academic_year: item.academic_year,
    school_id: item.school_id,
    school: { id: item.school_id, name: item.school_name, code: item.school_code },
  }));
  const rosterOptions = `<option value="">‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏´‡πâ‡∏≠‡∏á</option>${state.classes.map(item => `<option value="${item.id}">${escapeHtml(item.school?.name)} ¬∑ ${escapeHtml(item.label)}</option>`).join("")}`;
  $("#rosterClassSelect").innerHTML = rosterOptions;
}

async function loadPlans() {
  const { data, error } = await supabase.from("lesson_plans").select("*").order("sequence_no");
  if (error) {
    console.warn("‡πÉ‡∏ä‡πâ‡∏Ç‡πâ‡∏≠‡∏°‡∏π‡∏•‡πÅ‡∏ú‡∏ô‡∏™‡∏≥‡∏£‡∏≠‡∏á‡∏à‡∏≤‡∏Å‡πÄ‡∏ß‡πá‡∏ö‡πÑ‡∏ã‡∏ï‡πå ‡πÄ‡∏ô‡∏∑‡πà‡∏≠‡∏á‡∏à‡∏≤‡∏Å‡πÇ‡∏´‡∏•‡∏î‡∏£‡∏≤‡∏¢‡∏Å‡∏≤‡∏£‡πÅ‡∏ú‡∏ô‡∏à‡∏≤‡∏Å‡∏ê‡∏≤‡∏ô‡∏Ç‡πâ‡∏≠‡∏°‡∏π‡∏•‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à", error.code);
    state.plans = PLAN_CATALOG.map(plan => ({
      id: plan.sequence,
      sequence_no: plan.sequence,
      title: plan.title,
      published: plan.published,
    }));
  } else {
    state.plans = data || [];
  }
  state.selectedPlanId = state.plans.find(plan => plan.published)?.id || null;
  renderPlanChoices();
}

function readyClasses() {
  return state.classes.filter(item => (state.rosterCounts.get(item.id) || 0) > 0);
}

function renderSchoolOptions() {
  const availableClasses = readyClasses();
  const schools = [...new Map(availableClasses.map(item => [item.school?.id, item.school])).values()].filter(Boolean);
  $("#schoolSelect").innerHTML = `<option value="">‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡πÇ‡∏£‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô</option>${schools.map(school => `<option value="${school.id}">${escapeHtml(school.name)}</option>`).join("")}`;
  $("#classSelect").innerHTML = `<option value="">‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô</option>`;
  $("#classSelect").disabled = true;
  if (schools.length === 1) {
    $("#schoolSelect").value = schools[0].id;
    renderClassOptions(schools[0].id);
  }
  $("#classOwnershipNote").textContent = availableClasses.length
    ? `‚úÖ ‡πÅ‡∏™‡∏î‡∏á‡πÄ‡∏â‡∏û‡∏≤‡∏∞ ${availableClasses.length} ‡∏´‡πâ‡∏≠‡∏á‡∏ó‡∏µ‡πà‡∏°‡∏µ‡∏£‡∏≤‡∏¢‡∏ä‡∏∑‡πà‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏û‡∏£‡πâ‡∏≠‡∏°‡πÄ‡∏õ‡∏¥‡∏î‡∏Ñ‡∏≤‡∏ö`
    : "‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏µ‡πà‡∏°‡∏µ‡∏£‡∏≤‡∏¢‡∏ä‡∏∑‡πà‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏û‡∏£‡πâ‡∏≠‡∏°‡πÄ‡∏õ‡∏¥‡∏î‡∏Ñ‡∏≤‡∏ö";
}

function renderClassOptions(schoolId) {
  const classrooms = readyClasses().filter(item => item.school?.id === schoolId);
  $("#classSelect").innerHTML = `<option value="">‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô</option>${classrooms.map(item => `<option value="${item.id}">${escapeHtml(item.label)} ¬∑ ${state.rosterCounts.get(item.id) || 0} ‡∏Ñ‡∏ô</option>`).join("")}`;
  $("#classSelect").disabled = !classrooms.length;
  if (classrooms.length === 1) $("#classSelect").value = classrooms[0].id;
  updateSelectedClassRosterNote();
}

function updateSelectedClassRosterNote() {
  const note = $("#classOwnershipNote");
  const classId = $("#classSelect").value;
  const classroom = state.classes.find(item => item.id === classId);
  if (!classroom) {
    note.textContent = readyClasses().length
      ? "‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏µ‡πà‡∏û‡∏£‡πâ‡∏≠‡∏°‡πÉ‡∏ä‡πâ‡∏á‡∏≤‡∏ô‡πÄ‡∏û‡∏∑‡πà‡∏≠‡πÄ‡∏õ‡∏¥‡∏î‡∏Ñ‡∏≤‡∏ö"
      : "‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏µ‡πà‡∏°‡∏µ‡∏£‡∏≤‡∏¢‡∏ä‡∏∑‡πà‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏û‡∏£‡πâ‡∏≠‡∏°‡πÄ‡∏õ‡∏¥‡∏î‡∏Ñ‡∏≤‡∏ö";
    note.classList.remove("warning", "success");
    return;
  }
  const count = state.rosterCounts.get(classId) || 0;
  note.textContent = count
    ? `‚úÖ ${classroom.school?.name} ¬∑ ${classroom.label} ‡∏°‡∏µ‡∏£‡∏≤‡∏¢‡∏ä‡∏∑‡πà‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏µ‡πà‡πÉ‡∏ä‡πâ‡∏á‡∏≤‡∏ô ${count} ‡∏Ñ‡∏ô ‡∏û‡∏£‡πâ‡∏≠‡∏°‡∏™‡∏£‡πâ‡∏≤‡∏á QR`
    : `‚ö†Ô∏è ${classroom.school?.name} ¬∑ ${classroom.label} ‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏£‡∏≤‡∏¢‡∏ä‡∏∑‡πà‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô ‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡πÄ‡∏û‡∏¥‡πà‡∏°‡∏´‡∏£‡∏∑‡∏≠‡∏ô‡∏≥‡πÄ‡∏Ç‡πâ‡∏≤‡∏£‡∏≤‡∏¢‡∏ä‡∏∑‡πà‡∏≠‡∏Å‡πà‡∏≠‡∏ô‡∏™‡∏£‡πâ‡∏≤‡∏á QR`;
  note.classList.toggle("warning", count === 0);
  note.classList.toggle("success", count > 0);
}

function renderPlanChoices() {
  const container = $("#planChoices");
  if (!container) return;
  renderAssessmentChoices();
  container.innerHTML = state.plans.map(plan => {
    const flow = lessonFlowForPlan(plan.id);
    const totalMinutes = flow.reduce((sum, item) => sum + item.minutes, 0);
    return `
    <button type="button" class="flow-plan-choice ${!state.selectedAssessmentPhase && Number(state.selectedPlanId) === Number(plan.id) ? "selected" : ""}" data-plan-id="${plan.id}" ${plan.published ? "" : "disabled"}>
      <span>${plan.published ? `‡πÅ‡∏ú‡∏ô ${plan.sequence_no}` : "üîí"}</span>
      <strong>${escapeHtml(plan.title)}</strong>
      <small>${plan.published ? `${flow.length} ‡∏Ç‡∏±‡πâ‡∏ô ¬∑ ‡∏™‡∏∑‡πà‡∏≠‡πÅ‡∏•‡∏∞‡πÄ‡∏Å‡∏° ${totalMinutes} ‡∏ô‡∏≤‡∏ó‡∏µ` : "‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡πÄ‡∏õ‡∏¥‡∏î‡πÉ‡∏ä‡πâ‡∏á‡∏≤‡∏ô"}</small>
    </button>
  `;
  }).join("");
  container.querySelectorAll("[data-plan-id]").forEach(button => button.addEventListener("click", () => selectPlan(Number(button.dataset.planId))));
  if (state.selectedAssessmentPhase) selectAssessment(state.selectedAssessmentPhase, false);
  else if (state.selectedPlanId) selectPlan(Number(state.selectedPlanId), false);
}

function renderAssessmentChoices() {
  ["pretest", "posttest", "satisfaction"].forEach(phase => {
    const activity = assessmentActivityForPhase(phase);
    const button = $(`[data-assessment-phase="${phase}"]`);
    if (!button || !activity) return;
    button.classList.toggle("selected", state.selectedAssessmentPhase === phase);
    const detail = phase === "pretest"
      ? "‡∏ó‡∏≥‡∏Å‡πà‡∏≠‡∏ô‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà 1 ¬∑ 20 ‡∏Ç‡πâ‡∏≠"
      : phase === "posttest"
        ? "‡∏ó‡∏≥‡∏´‡∏•‡∏±‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏Ñ‡∏£‡∏ö‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà 8 ¬∑ 20 ‡∏Ç‡πâ‡∏≠"
        : "‡πÄ‡∏õ‡∏¥‡∏î‡πÅ‡∏¢‡∏Å‡∏à‡∏≤‡∏Å‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö ¬∑ 10 ‡∏Ç‡πâ‡∏≠ ¬∑ 3 ‡∏£‡∏∞‡∏î‡∏±‡∏ö";
    button.innerHTML = `<span>${activity.icon}</span><strong>${escapeHtml(activity.title)}</strong><small>${detail}</small>`;
  });
}

function selectAssessment(phase, rerender = true) {
  const activity = assessmentActivityForPhase(phase);
  if (!activity) return;
  const isSurvey = phase === "satisfaction";
  state.selectedAssessmentPhase = phase;
  $("#selectedPlanTitle").textContent = `${activity.title} ¬∑ ‡∏Ñ‡∏≤‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡πÅ‡∏¢‡∏Å‡∏à‡∏≤‡∏Å‡πÅ‡∏ú‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô`;
  $("#activityPreview").innerHTML = `<article class="${isSurvey ? "satisfaction-preview-step" : ""}"><span>${activity.icon}</span><div><small>${isSurvey ? "‡∏Å‡∏¥‡∏à‡∏Å‡∏£‡∏£‡∏°‡∏≠‡∏¥‡∏™‡∏£‡∏∞ ¬∑ ‡πÑ‡∏°‡πà‡πÄ‡∏ä‡∏∑‡πà‡∏≠‡∏°‡∏Å‡∏±‡∏ö‡∏Ñ‡∏∞‡πÅ‡∏ô‡∏ô‡∏™‡∏≠‡∏ö" : "‡∏Å‡∏≤‡∏£‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡∏ú‡∏•‡∏™‡∏±‡∏°‡∏§‡∏ó‡∏ò‡∏¥‡πå ¬∑ ‡πÑ‡∏°‡πà‡∏à‡∏±‡∏î‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö"}</small><strong>${escapeHtml(activity.title)} ${isSurvey ? "10" : "20"} ‡∏Ç‡πâ‡∏≠</strong><em>${isSurvey ? "‡∏ï‡∏≠‡∏ö‡∏ó‡∏µ‡∏•‡∏∞‡∏Ç‡πâ‡∏≠ ¬∑ ‡∏ö‡∏±‡∏ô‡∏ó‡∏∂‡∏Å‡∏ó‡∏±‡∏ô‡∏ó‡∏µ ¬∑ 3 ‡∏£‡∏∞‡∏î‡∏±‡∏ö" : "‡∏Ñ‡∏£‡∏π‡∏Å‡∏≥‡∏´‡∏ô‡∏î‡πÄ‡∏ß‡∏•‡∏≤‡∏ó‡∏≥‡πÑ‡∏î‡πâ‡∏î‡πâ‡∏≤‡∏ô‡∏•‡πà‡∏≤‡∏á"}</em></div></article>`;
  $("#planSettings")?.classList.add("hidden");
  $("#assessmentDurationPanel")?.classList.remove("hidden");
  $("#assessmentDurationEyebrow").textContent = isSurvey ? "‡∏ï‡∏±‡πâ‡∏á‡πÄ‡∏ß‡∏•‡∏≤‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô" : "‡∏ï‡∏±‡πâ‡∏á‡πÄ‡∏ß‡∏•‡∏≤‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö";
  $("#assessmentDurationTitle").textContent = isSurvey ? "‡∏Å‡∏≥‡∏´‡∏ô‡∏î‡πÄ‡∏ß‡∏•‡∏≤‡∏ï‡∏≠‡∏ö‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô" : "‡∏Å‡∏≥‡∏´‡∏ô‡∏î‡πÄ‡∏ß‡∏•‡∏≤‡∏ó‡∏≥‡πÇ‡∏î‡∏¢‡∏Ñ‡∏£‡∏π";
  $("#assessmentDurationHelp").textContent = isSurvey ? "‡πÄ‡∏ß‡∏•‡∏≤‡∏à‡∏∞‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏û‡∏£‡πâ‡∏≠‡∏°‡∏Å‡∏±‡∏ô‡πÄ‡∏°‡∏∑‡πà‡∏≠‡∏Ñ‡∏£‡∏π‡∏Å‡∏î‡πÄ‡∏õ‡∏¥‡∏î‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô" : "‡πÄ‡∏ß‡∏•‡∏≤‡∏à‡∏∞‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏û‡∏£‡πâ‡∏≠‡∏°‡∏Å‡∏±‡∏ô‡πÄ‡∏°‡∏∑‡πà‡∏≠‡∏Ñ‡∏£‡∏π‡∏Å‡∏î‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö";
  $("#assessmentDuration").value = activity.minutes;
  $("#startPlanButton").textContent = `‚ñ∂ ‡πÄ‡∏£‡∏¥‡πà‡∏°${activity.title}`;
  if (rerender) renderPlanChoices();
}

function selectPlan(planId, rerender = true) {
  const plan = state.plans.find(item => Number(item.id) === Number(planId) && item.published);
  if (!plan) return;
  state.selectedAssessmentPhase = null;
  state.selectedPlanId = plan.id;
  $("#planSelect").value = plan.id;
  $("#selectedPlanTitle").textContent = `‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà ${plan.sequence_no} ¬∑ ${plan.title}`;
  $("#activityPreview").innerHTML = lessonFlowForPlan(plan.id).map((step, index) => `<article><span>${step.icon}</span><div><small>${step.kind === "game" ? "‡πÄ‡∏Å‡∏°‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô" : step.kind === "results" ? "‡∏õ‡∏£‡∏∞‡∏Å‡∏≤‡∏®‡∏ú‡∏•‡∏Å‡∏≤‡∏£‡πÅ‡∏Ç‡πà‡∏á‡∏Ç‡∏±‡∏ô" : "‡∏™‡∏∑‡πà‡∏≠/‡∏Ñ‡∏≥‡∏™‡∏±‡πà‡∏á‡∏Ñ‡∏£‡∏π"} ¬∑ ‡∏•‡∏≥‡∏î‡∏±‡∏ö ${index + 1}</small><strong>${escapeHtml(step.title)}</strong><em>${step.kind === "results" ? "‡∏´‡∏•‡∏±‡∏á‡∏à‡∏ö‡πÄ‡∏Å‡∏°" : `${step.minutes} ‡∏ô‡∏≤‡∏ó‡∏µ`}</em></div></article>`).join("");
  $("#planSettings")?.classList.remove("hidden");
  $("#assessmentDurationPanel")?.classList.add("hidden");
  $("#startPlanButton").textContent = "‚ñ∂ ‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏Ç‡∏±‡πâ‡∏ô‡πÅ‡∏£‡∏Å";
  if (rerender) renderPlanChoices();
}

async function setupSchool(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const { error } = await supabase.rpc("create_school_structure", {
      p_school_name: $("#schoolName").value.trim(),
      p_school_code: $("#schoolCode").value.trim(),
      p_academic_year: Number($("#academicYear").value),
    });
    if (error) throw error;
    toast("‡∏™‡∏£‡πâ‡∏≤‡∏á‡∏´‡πâ‡∏≠‡∏á ‡∏õ.1/1 ‡∏ñ‡∏∂‡∏á ‡∏õ.6/4 ‡πÄ‡∏£‡∏µ‡∏¢‡∏ö‡∏£‡πâ‡∏≠‡∏¢", "success");
    await loadClasses();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function createSession(event) {
  event.preventDefault();
  const button = event.submitter;
  if (state.session && state.session.status !== "closed") return toast("‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡∏õ‡∏¥‡∏î‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏î‡∏¥‡∏°‡∏Å‡πà‡∏≠‡∏ô‡πÄ‡∏õ‡∏¥‡∏î‡∏Ñ‡∏≤‡∏ö‡πÉ‡∏´‡∏°‡πà", "warning");
  const classId = $("#classSelect").value;
  if (!classId) return toast("‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô", "warning");
  if (!(state.rosterCounts.get(classId) > 0)) return toast("‡∏´‡πâ‡∏≠‡∏á‡∏ô‡∏µ‡πâ‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏£‡∏≤‡∏¢‡∏ä‡∏∑‡πà‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô ‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡πÄ‡∏û‡∏¥‡πà‡∏°‡∏´‡∏£‡∏∑‡∏≠‡∏ô‡∏≥‡πÄ‡∏Ç‡πâ‡∏≤‡∏£‡∏≤‡∏¢‡∏ä‡∏∑‡πà‡∏≠‡∏Å‡πà‡∏≠‡∏ô‡∏™‡∏£‡πâ‡∏≤‡∏á QR", "warning");
  const firstPlan = state.plans.find(plan => plan.published);
  if (!firstPlan) return toast("‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡∏°‡∏µ‡πÅ‡∏ú‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô‡∏ó‡∏µ‡πà‡πÄ‡∏õ‡∏¥‡∏î‡πÉ‡∏ä‡πâ‡∏á‡∏≤‡∏ô", "warning");
  button.disabled = true;
  button.textContent = "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡πÄ‡∏õ‡∏¥‡∏î‡∏´‡πâ‡∏≠‡∏á...";
  try {
    const attemptMode = $("#attemptMode").value;
    const maxAttempts = attemptMode === "single" ? 1 : Number($("#maxAttempts").value);
    const sessionRpc = state.profile?.can_record_scores === false ? "create_expert_class_session" : "create_class_session";
    const { data, error } = await supabase.rpc(sessionRpc, {
      p_class_id: classId,
      p_plan_id: Number(firstPlan.id),
      p_play_mode: $("#playMode").value,
      p_attempt_mode: attemptMode,
      p_max_attempts: maxAttempts,
      p_score_policy: $("#scorePolicy").value,
      p_leaderboard_mode: $("#leaderboardMode").value,
      p_pass_percent: Number($("#passPercent").value),
    });
    if (error) throw error;
    state.session = data;
    if (state.profile?.can_record_scores !== false && data.instrument_version !== EXIT_TICKET_INSTRUMENT_VERSION) {
      const { data: versionedSession, error: versionError } = await supabase.from("class_sessions")
        .update({ experiment_round: 2, instrument_version: EXIT_TICKET_INSTRUMENT_VERSION })
        .eq("id", data.id)
        .select()
        .single();
      if (versionError) throw versionError;
      state.session = versionedSession;
    }
    state.selectedPlanId = state.session.plan_id;
    const joinedSharedSession = state.session.teacher_id !== state.user.id;
    if (joinedSharedSession || state.session.status !== "lobby" || state.session.current_activity_key) {
      showResumeSession();
      toast(
        joinedSharedSession
          ? "‡πÄ‡∏Ç‡πâ‡∏≤‡∏£‡πà‡∏ß‡∏°‡∏Ñ‡∏≤‡∏ö‡∏ó‡∏µ‡πà‡∏Ñ‡∏£‡∏π‡πÉ‡∏ô‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏õ‡∏¥‡∏î‡πÑ‡∏ß‡πâ‡πÅ‡∏•‡πâ‡∏ß ‡∏™‡∏≤‡∏°‡∏≤‡∏£‡∏ñ‡∏Ñ‡∏ß‡∏ö‡∏Ñ‡∏∏‡∏°‡∏Ñ‡∏≤‡∏ö‡∏£‡πà‡∏ß‡∏°‡∏Å‡∏±‡∏ô‡πÑ‡∏î‡πâ"
          : "‡∏û‡∏ö‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏î‡∏¥‡∏°‡∏ó‡∏µ‡πà‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡∏à‡∏ö ‡∏£‡∏∞‡∏ö‡∏ö‡∏û‡∏≤‡∏Å‡∏•‡∏±‡∏ö‡∏°‡∏≤‡∏ó‡∏µ‡πà‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏î‡∏¥‡∏°‡πÅ‡∏•‡πâ‡∏ß",
        "success",
      );
    } else {
      await showLiveSession("qr");
      toast(`‡∏™‡∏£‡πâ‡∏≤‡∏á‡∏£‡∏´‡∏±‡∏™‡∏™‡∏≥‡∏´‡∏£‡∏±‡∏ö ${classContext()} ‡πÅ‡∏•‡πâ‡∏ß`, "success");
    }
  } catch (error) {
    const recovered = await recoverOpenClassSession(classId);
    if (!recovered) toast(error.message || "‡∏™‡∏£‡πâ‡∏≤‡∏á‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à", "error");
  } finally {
    button.disabled = false;
    button.textContent = "‡∏™‡∏£‡πâ‡∏≤‡∏á‡∏´‡πâ‡∏≠‡∏á‡πÅ‡∏•‡∏∞‡πÅ‡∏™‡∏î‡∏á QR ‚Üí";
  }
}

async function recoverOpenClassSession(classId) {
  const { data, error } = await supabase.from("class_sessions")
    .select("*")
    .eq("class_id", classId)
    .neq("status", "closed")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return false;

  state.session = data;
  state.selectedPlanId = data.plan_id;
  showResumeSession();
  toast(
    data.teacher_id === state.user.id
      ? "‡∏û‡∏ö‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏î‡∏¥‡∏°‡∏ó‡∏µ‡πà‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡∏õ‡∏¥‡∏î ‡∏£‡∏∞‡∏ö‡∏ö‡∏û‡∏≤‡∏Å‡∏•‡∏±‡∏ö‡∏°‡∏≤‡∏ó‡∏µ‡πà‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏î‡∏¥‡∏°‡πÅ‡∏•‡πâ‡∏ß"
      : "‡πÄ‡∏Ç‡πâ‡∏≤‡∏£‡πà‡∏ß‡∏°‡∏Ñ‡∏≤‡∏ö‡∏ó‡∏µ‡πà‡∏Ñ‡∏£‡∏π‡πÉ‡∏ô‡∏´‡πâ‡∏≠‡∏á‡πÄ‡∏õ‡∏¥‡∏î‡πÑ‡∏ß‡πâ‡πÅ‡∏•‡πâ‡∏ß ‡∏™‡∏≤‡∏°‡∏≤‡∏£‡∏ñ‡∏Ñ‡∏ß‡∏ö‡∏Ñ‡∏∏‡∏°‡∏Ñ‡∏≤‡∏ö‡∏£‡πà‡∏ß‡∏°‡∏Å‡∏±‡∏ô‡πÑ‡∏î‡πâ",
    data.teacher_id === state.user.id ? "warning" : "success",
  );
  return true;
}

async function restoreActiveSession() {
  const classIds = state.classes.map(item => item.id);
  if (!classIds.length) return;
  const { data, error } = await supabase.from("class_sessions")
    .select("*")
    .in("class_id", classIds)
    .neq("status", "closed")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("‡πÇ‡∏´‡∏•‡∏î‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏î‡∏¥‡∏°‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à", error.code);
    return;
  }
  if (!data) return;
  state.session = data;
  state.selectedPlanId = data.plan_id;
  restoreLessonFlowState();
  showResumeSession();
}

function showResumeSession() {
  const classroom = selectedClassroom();
  const lessonStep = currentLessonStep();
  const activity = activityForKey(state.session.current_activity_key, state.session.plan_id);
  const statusLabels = { lobby: "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏£‡∏±‡∏ö‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô", active: "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏î‡∏≥‡πÄ‡∏ô‡∏¥‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô", paused: "‡∏û‡∏±‡∏Å‡∏Å‡∏¥‡∏à‡∏Å‡∏£‡∏£‡∏°‡∏ä‡∏±‡πà‡∏ß‡∏Ñ‡∏£‡∏≤‡∏ß" };
  state.flowStep = "resume";
  hide($("#teacherFlowProgress"));
  hide($("#sessionSetup"));
  hide($("#liveSession"));
  $$("[data-flow-step]").forEach(hide);
  show($("#resumeSessionView"));
  $("#flowStepTitle").textContent = "‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏™‡∏¥‡πà‡∏á‡∏ó‡∏µ‡πà‡∏ï‡πâ‡∏≠‡∏á‡∏Å‡∏≤‡∏£‡∏ó‡∏≥‡∏Å‡∏±‡∏ö‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏î‡∏¥‡∏°";
  $("#flowContext").textContent = classContext(classroom);
  $("#resumeClassContext").textContent = classContext(classroom);
  $("#resumeRoomCode").textContent = state.session.room_code;
  $("#resumeStatus").textContent = statusLabels[state.session.status] || state.session.status;
  $("#resumeActivity").textContent = lessonStep?.title || activity?.title || "‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô";
  $("#resumeSessionButton").textContent = state.session.status === "lobby" ? "‡∏Å‡∏•‡∏±‡∏ö‡πÑ‡∏õ‡∏´‡∏ô‡πâ‡∏≤ QR ‚Üí" : "‡∏Å‡∏•‡∏±‡∏ö‡πÑ‡∏õ‡∏ú‡∏•‡∏™‡∏î ‚Üí";
  $("#resumeSummaryButton").classList.toggle("hidden", state.session.status === "lobby");
}

async function showLiveSession(step = "qr") {
  hide($("#sessionSetup"));
  hide($("#resumeSessionView"));
  show($("#liveSession"));
  $("#liveRoomCode").textContent = state.session.room_code;
  $("#liveHeaderRoomCode").textContent = state.session.room_code;
  $("#liveJoinRoomCode").textContent = state.session.room_code;
  $("#lobbyRoomCode").textContent = state.session.room_code;
  $("#qrClassContext").textContent = classContext();
  $("#liveClassContext").textContent = classContext();
  $("#summaryClassContext").textContent = classContext();
  renderScoreRecordingNotice();
  await renderStudentAccess();
  $("#openDisplayButton").href = `display.html?room=${state.session.room_code}`;
  $("#pauseSessionButton").textContent = state.session.status === "paused" ? "‡πÄ‡∏•‡πà‡∏ô‡∏ï‡πà‡∏≠" : "‡∏û‡∏±‡∏Å‡πÄ‡∏Å‡∏°";
  state.lateJoinMode = state.session.status === "lobby" && Boolean(state.session.current_activity_key);
  if (state.lateJoinMode) state.lateJoinResumeStatus = "paused";
  syncLateJoinControls();
  renderLiveModeSwitch();
  if (isAssessmentSession(state.session)) {
    state.selectedAssessmentPhase = state.session.assessment_phase;
  } else {
    selectPlan(Number(state.session.plan_id || state.selectedPlanId), false);
  }
  restoreLessonFlowState();
  renderActivityControls();
  subscribeToSession();
  subscribePresence();
  await subscribeDisplay();
  restoreActivityTimer();
  await refreshSessionData();
  setTeacherFlowStep(step);
  if (step === "summary") renderSummary();
}

function studentJoinUrl() {
  const url = new URL("student.html", location.href);
  url.searchParams.set("room", state.session.room_code);
  return url.href;
}

async function renderStudentAccess() {
  const url = studentJoinUrl();
  $("#openStudentJoinButton").href = url;
  const image = $("#studentJoinQr");
  const frame = image.closest(".session-qr-frame");
  frame.dataset.state = "loading";
  image.removeAttribute("src");
  try {
    const { default: QRCode } = await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm");
    image.src = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      width: 320,
      margin: 1,
      color: { dark: "#17203b", light: "#ffffff" },
    });
    frame.dataset.state = "ready";
  } catch {
    frame.dataset.state = "error";
    toast("‡∏™‡∏£‡πâ‡∏≤‡∏á QR ‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à ‡∏¢‡∏±‡∏á‡πÉ‡∏ä‡πâ‡∏£‡∏´‡∏±‡∏™‡∏´‡πâ‡∏≠‡∏á‡∏´‡∏£‡∏∑‡∏≠‡∏•‡∏¥‡∏á‡∏Å‡πå‡πÑ‡∏î‡πâ‡∏ï‡∏≤‡∏°‡∏õ‡∏Å‡∏ï‡∏¥", "warning");
  }
}

function renderActivityControls() {
  const flow = currentLessonFlow();
  if (isAssessmentSession(state.session)) {
    const step = flow[0];
    const isSurvey = state.session?.assessment_phase === "satisfaction";
    $("#activityControls").innerHTML = `<div class="activity-control lesson-flow-control active assessment-flow-control"><span>${escapeHtml(step.icon)}</span><span><small>${isSurvey ? "‡∏Å‡∏¥‡∏à‡∏Å‡∏£‡∏£‡∏°‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡∏Ñ‡∏ß‡∏≤‡∏°‡∏û‡∏∂‡∏á‡∏û‡∏≠‡πÉ‡∏à" : "‡∏Ñ‡∏≤‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡∏ú‡∏•‡∏™‡∏±‡∏°‡∏§‡∏ó‡∏ò‡∏¥‡πå"}</small><strong>${escapeHtml(step.title)}</strong><em>${step.minutes} ‡∏ô‡∏≤‡∏ó‡∏µ ¬∑ ${isSurvey ? "10 ‡∏Ç‡πâ‡∏≠ ¬∑ 3 ‡∏£‡∏∞‡∏î‡∏±‡∏ö" : "20 ‡∏Ç‡πâ‡∏≠ ¬∑ ‡πÑ‡∏°‡πà‡∏à‡∏±‡∏î‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö"}</em></span><i>‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏£‡∏±‡∏ö‡∏Ñ‡∏≥‡∏ï‡∏≠‡∏ö</i></div>`;
    renderCurrentLessonStep();
    updateNextActivityButton();
    return;
  }
  const activeIndex = Math.max(0, flow.findIndex(step => step.key === state.lessonStepKey));
  $("#activityControls").innerHTML = flow.map((step, index) => `
    <button class="activity-control lesson-flow-control ${step.key === state.lessonStepKey ? "active" : ""} ${index < activeIndex ? "done" : ""}" data-lesson-step="${escapeHtml(step.key)}">
      <span>${step.icon}</span>
      <span>
        <small>‡∏Ç‡∏±‡πâ‡∏ô ${step.stage} ¬∑ ${step.kind === "game" ? "‡πÄ‡∏Å‡∏°‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô" : step.kind === "results" ? "‡∏õ‡∏£‡∏∞‡∏Å‡∏≤‡∏®‡∏ú‡∏•‡∏Å‡∏≤‡∏£‡πÅ‡∏Ç‡πà‡∏á‡∏Ç‡∏±‡∏ô" : "‡∏™‡∏∑‡πà‡∏≠/‡∏Ñ‡∏≥‡∏™‡∏±‡πà‡∏á‡∏Ñ‡∏£‡∏π"}</small>
        <strong>${index + 1}. ${escapeHtml(step.title)}</strong>
        <em>${step.kind === "results" ? "‡∏•‡∏≥‡∏î‡∏±‡∏ö‡∏ñ‡∏±‡∏î‡πÑ‡∏õ‡∏´‡∏•‡∏±‡∏á‡∏à‡∏ö‡πÄ‡∏Å‡∏°" : `${step.minutes} ‡∏ô‡∏≤‡∏ó‡∏µ`}</em>
      </span>
      <i>${step.key === state.lessonStepKey ? "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡πÉ‡∏ä‡πâ" : "‡πÄ‡∏õ‡∏¥‡∏î ‚Üí"}</i>
    </button>
  `).join("");
  $("#activityControls").querySelectorAll("button").forEach(button => button.addEventListener("click", () => startLessonStep(button.dataset.lessonStep)));
  renderCurrentLessonStep();
  updateNextActivityButton();
}

function lessonScreenDetailsMarkup(screen = {}) {
  if (screen.presentation === "video" && screen.videoId) {
    const videoId = String(screen.videoId).replace(/[^A-Za-z0-9_-]/g, "");
    if (videoId) {
      return `<div class="lesson-video-frame">
        <iframe src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1" title="${escapeHtml(screen.title || "‡∏ß‡∏¥‡∏î‡∏µ‡πÇ‡∏≠‡∏õ‡∏£‡∏∞‡∏Å‡∏≠‡∏ö‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô")}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>`;
    }
  }
  if (Array.isArray(screen.cards) && screen.cards.length) {
    if (screen.presentation === "flashcards") {
      const cardIndex = Math.min(screen.cards.length - 1, Math.max(0, Number(state.lessonCardIndex) || 0));
      const card = screen.cards[cardIndex];
      return `<div class="lesson-flashcard-deck">
        <button class="lesson-flashcard-nav" type="button" data-lesson-card-direction="-1" aria-label="‡∏Ñ‡∏≥‡∏Å‡πà‡∏≠‡∏ô‡∏´‡∏ô‡πâ‡∏≤" ${cardIndex <= 0 ? "disabled" : ""}>‚Äπ</button>
        <article class="lesson-flashcard-card" aria-live="polite">
          <small>‡∏Ñ‡∏≥‡∏ó‡∏µ‡πà ${cardIndex + 1} ‡∏à‡∏≤‡∏Å ${screen.cards.length}</small>
          <strong>${escapeHtml(card.word || "")}</strong>
          <span>${escapeHtml(card.detail || "")}</span>
          <i style="--flashcard-progress:${((cardIndex + 1) / screen.cards.length) * 100}%"></i>
        </article>
        <button class="lesson-flashcard-nav" type="button" data-lesson-card-direction="1" aria-label="‡∏Ñ‡∏≥‡∏ñ‡∏±‡∏î‡πÑ‡∏õ" ${cardIndex >= screen.cards.length - 1 ? "disabled" : ""}>‚Ä∫</button>
      </div>`;
    }
    return `<div class="lesson-screen-card-list">${screen.cards.map(card => `<span><strong>${escapeHtml(card.word || "")}</strong><small>${escapeHtml(card.detail || "")}</small></span>`).join("")}</div>`;
  }
  if (Array.isArray(screen.bullets) && screen.bullets.length) {
    return `<ul class="lesson-screen-bullets">${screen.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }
  return "";
}

function stopProjectorGamePreview() {
  const gameFrame = $("#lessonGamePreviewFrame");
  if (!gameFrame) return;
  if (gameFrame.dataset.previewSrc || gameFrame.src !== "about:blank") gameFrame.src = "about:blank";
  delete gameFrame.dataset.previewSrc;
}

function renderProjectorLessonContent(step) {
  const media = $("#lessonScreenPreview");
  const gamePreview = $("#lessonGamePreview");
  const gameFrame = $("#lessonGamePreviewFrame");
  const results = $("#competitionArena");
  const modeLabel = $("#projectorModeLabel");
  const planId = Number(state.session?.plan_id || state.selectedPlanId || 1);
  const activity = step?.activityKey ? activityForKey(step.activityKey, planId) : null;
  const lessonStageVisible = state.flowStep === "live";
  const showGame = lessonStageVisible && state.session?.status === "active" && step?.kind === "game" && Boolean(activity);
  const showResults = lessonStageVisible && (step?.kind === "results" || step?.kind === "assessment") && Boolean(activity);
  const showAssessment = step?.kind === "assessment";
  const showSurvey = showAssessment && state.session?.assessment_phase === "satisfaction";

  media.classList.toggle("hidden", showGame || showResults);
  gamePreview.classList.toggle("hidden", !showGame);
  results.classList.toggle("hidden", !showResults);
  modeLabel.textContent = showAssessment
    ? showSurvey ? "üíú ‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏£‡∏±‡∏ö‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡∏Ñ‡∏ß‡∏≤‡∏°‡∏û‡∏∂‡∏á‡∏û‡∏≠‡πÉ‡∏à" : "üìù ‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏£‡∏±‡∏ö‡∏Ñ‡∏≥‡∏ï‡∏≠‡∏ö‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö ¬∑ ‡πÑ‡∏°‡πà‡πÅ‡∏™‡∏î‡∏á‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö"
    : showResults
    ? "‚ú® ‡∏õ‡∏£‡∏∞‡∏Å‡∏≤‡∏®‡∏ú‡∏•‡∏Å‡∏≤‡∏£‡πÅ‡∏Ç‡πà‡∏á‡∏Ç‡∏±‡∏ô ‚ú®"
    : showGame
      ? "‡πÄ‡∏Å‡∏°‡∏ï‡∏±‡∏ß‡∏≠‡∏¢‡πà‡∏≤‡∏á ¬∑ ‡πÑ‡∏°‡πà‡∏ö‡∏±‡∏ô‡∏ó‡∏∂‡∏Å‡∏Ñ‡∏∞‡πÅ‡∏ô‡∏ô"
      : step?.kind === "game"
        ? state.session?.status === "paused" ? "‡πÄ‡∏Å‡∏°‡∏û‡∏±‡∏Å‡∏≠‡∏¢‡∏π‡πà ¬∑ ‡∏Å‡∏î‡πÄ‡∏•‡πà‡∏ô‡∏ï‡πà‡∏≠‡πÄ‡∏°‡∏∑‡πà‡∏≠‡∏û‡∏£‡πâ‡∏≠‡∏°" : "‡∏£‡∏≠‡∏Ñ‡∏£‡∏π‡∏Å‡∏î‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÄ‡∏Å‡∏°"
        : "‡∏™‡∏∑‡πà‡∏≠‡∏û‡∏£‡πâ‡∏≠‡∏°‡∏â‡∏≤‡∏¢";

  if (!showGame) {
    stopProjectorGamePreview();
    return;
  }

  const previewUrl = new URL("student.html", window.location.href);
  previewUrl.search = "";
  previewUrl.searchParams.set("preview", "projector");
  previewUrl.searchParams.set("plan", String(planId));
  previewUrl.searchParams.set("activity", activity.key);
  previewUrl.searchParams.set("round", state.lessonRoundId || step.key);
  const previewSrc = previewUrl.href;
  if (gameFrame.dataset.previewSrc === previewSrc) return;
  gameFrame.dataset.previewSrc = previewSrc;
  gameFrame.src = previewSrc;
}

async function changeLessonFlashcard(direction) {
  const step = currentLessonStep();
  const cards = step?.screen?.presentation === "flashcards" ? step.screen.cards : null;
  if (!Array.isArray(cards) || !cards.length) return;
  const nextIndex = Math.min(cards.length - 1, Math.max(0, state.lessonCardIndex + direction));
  if (nextIndex === state.lessonCardIndex) return;
  state.lessonCardIndex = nextIndex;
  saveLessonFlowState();
  renderCurrentLessonStep();
  await broadcastDisplay("lesson-flashcard-changed");
}

function renderCurrentLessonStep() {
  const step = currentLessonStep();
  const flow = currentLessonFlow();
  const index = flow.findIndex(item => item.key === step?.key);
  const screen = step?.screen || {};
  const isSatisfaction = step?.kind === "assessment" && state.session?.assessment_phase === "satisfaction";
  $("#currentActivityLabel").textContent = step?.title || "‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏Å‡∏¥‡∏à‡∏Å‡∏£‡∏£‡∏°";
  $("#lessonStageLabel").textContent = step ? `‡∏Ç‡∏±‡πâ‡∏ô‡∏ó‡∏µ‡πà ${step.stage} ¬∑ ‡∏£‡∏≤‡∏¢‡∏Å‡∏≤‡∏£ ${index + 1} ‡∏à‡∏≤‡∏Å ${flow.length}` : "‡∏•‡∏≥‡∏î‡∏±‡∏ö‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô";
  $("#lessonStepTitle").textContent = step?.title || "‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏Ç‡∏±‡πâ‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô";
  $("#lessonStepMeta").textContent = step
    ? step.kind === "assessment"
      ? isSatisfaction ? `${step.minutes} ‡∏ô‡∏≤‡∏ó‡∏µ ¬∑ ‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô 10 ‡∏Ç‡πâ‡∏≠ ¬∑ 3 ‡∏£‡∏∞‡∏î‡∏±‡∏ö` : `${step.minutes} ‡∏ô‡∏≤‡∏ó‡∏µ ¬∑ ‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö 20 ‡∏Ç‡πâ‡∏≠ ¬∑ ‡πÑ‡∏°‡πà‡∏à‡∏±‡∏î‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö`
      : step.kind === "results"
      ? "‡∏•‡∏≥‡∏î‡∏±‡∏ö‡∏ñ‡∏±‡∏î‡πÑ‡∏õ‡∏´‡∏•‡∏±‡∏á‡∏à‡∏ö‡πÄ‡∏Å‡∏° ¬∑ ‡∏õ‡∏£‡∏∞‡∏Å‡∏≤‡∏®‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö‡∏ö‡∏ô‡∏à‡∏≠‡πÇ‡∏õ‡∏£‡πÄ‡∏à‡∏Å‡πÄ‡∏ï‡∏≠‡∏£‡πå"
      : `${step.minutes} ‡∏ô‡∏≤‡∏ó‡∏µ ¬∑ ${step.kind === "game" ? "‡πÄ‡∏Å‡∏°‡∏ö‡∏ô‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô" : "‡∏™‡∏∑‡πà‡∏≠‡∏´‡∏£‡∏∑‡∏≠‡∏Ñ‡∏≥‡∏™‡∏±‡πà‡∏á‡∏™‡∏≥‡∏´‡∏£‡∏±‡∏ö‡∏Ñ‡∏£‡∏π"}`
    : "‡∏™‡∏∑‡πà‡∏≠ ‡πÄ‡∏Å‡∏° ‡πÅ‡∏•‡∏∞‡∏Ñ‡∏≥‡∏™‡∏±‡πà‡∏á‡∏à‡∏∞‡πÄ‡∏£‡∏µ‡∏¢‡∏á‡∏ï‡∏≤‡∏°‡πÅ‡∏ú‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô 60 ‡∏ô‡∏≤‡∏ó‡∏µ";
  $("#lessonStepKind").textContent = step?.kind === "assessment" ? isSatisfaction ? "üíú ‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô" : "üìù ‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö" : step?.kind === "game" ? "üéÆ ‡πÄ‡∏Å‡∏°‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô" : step?.kind === "results" ? "üèÜ ‡∏õ‡∏£‡∏∞‡∏Å‡∏≤‡∏®‡∏ú‡∏•" : "üì∫ ‡∏™‡∏∑‡πà‡∏≠/‡∏Ñ‡∏≥‡∏™‡∏±‡πà‡∏á";
  $("#lessonStepKind").classList.toggle("is-game", step?.kind === "game" || step?.kind === "assessment");
  $("#lessonStepKind").classList.toggle("is-results", step?.kind === "results");
  $("#lessonTeacherNotes").innerHTML = step?.teacherNotes?.length
    ? step.teacherNotes.map(note => `<li>${escapeHtml(note)}</li>`).join("")
    : "<li>‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏Ç‡∏±‡πâ‡∏ô‡πÅ‡∏£‡∏Å‡πÄ‡∏û‡∏∑‡πà‡∏≠‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏™‡∏≠‡∏ô</li>";
  $("#lessonScreenPreview").innerHTML = step
    ? `<span>${escapeHtml(screen.icon || step.icon)}</span><div><small>${escapeHtml(screen.eyebrow || "‡∏™‡∏∑‡πà‡∏≠‡∏ö‡∏ô‡∏à‡∏≠‡∏â‡∏≤‡∏¢")}</small><strong>${escapeHtml(screen.title || step.title)}</strong><p>${escapeHtml(screen.message || "")}</p>${lessonScreenDetailsMarkup(screen)}</div>`
    : `<span>üó∫Ô∏è</span><div><small>‡∏ï‡∏±‡∏ß‡∏≠‡∏¢‡πà‡∏≤‡∏á‡∏™‡∏∑‡πà‡∏≠‡∏ö‡∏ô‡∏à‡∏≠‡∏â‡∏≤‡∏¢</small><strong>‡∏û‡∏£‡πâ‡∏≠‡∏°‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà 1</strong><p>‡∏Ñ‡∏£‡∏π‡πÄ‡∏õ‡πá‡∏ô‡∏ú‡∏π‡πâ‡∏Ñ‡∏ß‡∏ö‡∏Ñ‡∏∏‡∏°‡∏ó‡∏∏‡∏Å‡∏´‡∏ô‡πâ‡∏≤‡∏î‡πâ‡∏ß‡∏¢‡∏ï‡∏ô‡πÄ‡∏≠‡∏á</p></div>`;
  $("#lessonScreenPreview").classList.toggle("is-flashcard-screen", screen.presentation === "flashcards");
  $("#lessonScreenPreview").querySelectorAll("[data-lesson-card-direction]").forEach(button => {
    button.addEventListener("click", () => { void changeLessonFlashcard(Number(button.dataset.lessonCardDirection)); });
  });
  const shareLabel = $("#shareLessonToStudentsLabel");
  const shareInput = $("#shareLessonToStudents");
  const isAssessment = step?.kind === "assessment";
  const isGame = step?.kind === "game" || isAssessment;
  const isResults = step?.kind === "results";
  shareLabel.classList.toggle("is-forced", isGame || isResults);
  shareInput.disabled = !step || isGame || isResults;
  shareInput.checked = Boolean(step && (isGame || (!isResults && state.lessonShareStudents)));
  shareLabel.querySelector("strong").textContent = isAssessment
    ? isSatisfaction ? "‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡πÅ‡∏™‡∏î‡∏á‡∏ö‡∏ô‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏∏‡∏Å‡∏Ñ‡∏ô" : "‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö‡πÅ‡∏™‡∏î‡∏á‡∏ö‡∏ô‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏∏‡∏Å‡∏Ñ‡∏ô"
    : isGame
    ? "‡πÄ‡∏Å‡∏°‡∏ô‡∏µ‡πâ‡πÅ‡∏™‡∏î‡∏á‡∏ö‡∏ô‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏∏‡∏Å‡∏Ñ‡∏ô"
    : isResults
      ? "‡∏ú‡∏•‡∏Å‡∏≤‡∏£‡πÅ‡∏Ç‡πà‡∏á‡∏Ç‡∏±‡∏ô‡πÅ‡∏™‡∏î‡∏á‡∏ö‡∏ô‡∏à‡∏≠‡πÇ‡∏õ‡∏£‡πÄ‡∏à‡∏Å‡πÄ‡∏ï‡∏≠‡∏£‡πå"
      : "‡πÅ‡∏™‡∏î‡∏á‡∏™‡∏∑‡πà‡∏≠‡∏ô‡∏µ‡πâ‡∏ö‡∏ô‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏î‡πâ‡∏ß‡∏¢";
  shareLabel.querySelector("small").textContent = isAssessment
    ? isSatisfaction ? "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ï‡∏≠‡∏ö‡∏ï‡∏≤‡∏°‡∏Ñ‡∏ß‡∏≤‡∏°‡∏£‡∏π‡πâ‡∏™‡∏∂‡∏Å‡∏à‡∏£‡∏¥‡∏á‡πÅ‡∏•‡∏∞‡∏£‡∏∞‡∏ö‡∏ö‡∏ö‡∏±‡∏ô‡∏ó‡∏∂‡∏Å‡∏ó‡∏∏‡∏Å‡∏Ç‡πâ‡∏≠‡∏ó‡∏±‡∏ô‡∏ó‡∏µ" : "‡πÑ‡∏°‡πà‡∏°‡∏µ‡πÄ‡∏â‡∏•‡∏¢‡πÅ‡∏•‡∏∞‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏Å‡∏≤‡∏£‡πÅ‡∏™‡∏î‡∏á‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö ‡∏ú‡∏•‡∏™‡πà‡∏á‡πÉ‡∏´‡πâ‡∏Ñ‡∏£‡∏π‡πÄ‡∏õ‡πá‡∏ô‡∏ï‡∏≤‡∏£‡∏≤‡∏á"
    : isGame
    ? "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ï‡πâ‡∏≠‡∏á‡πÉ‡∏ä‡πâ‡∏´‡∏ô‡πâ‡∏≤‡∏à‡∏≠‡∏Ç‡∏≠‡∏á‡∏ï‡∏ô‡πÄ‡∏≠‡∏á‡πÄ‡∏û‡∏∑‡πà‡∏≠‡∏ó‡∏≥‡∏†‡∏≤‡∏£‡∏Å‡∏¥‡∏à"
    : isResults
      ? "‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏´‡∏¢‡∏∏‡∏î‡∏£‡∏≠ ‡∏™‡πà‡∏ß‡∏ô‡∏Ñ‡∏£‡∏π‡∏õ‡∏£‡∏∞‡∏Å‡∏≤‡∏®‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö‡∏à‡∏≤‡∏Å‡∏´‡∏ô‡πâ‡∏≤‡∏à‡∏≠‡∏ô‡∏µ‡πâ"
    : "‡∏à‡∏≠‡∏â‡∏≤‡∏¢‡∏à‡∏∞‡πÅ‡∏™‡∏î‡∏á‡πÄ‡∏™‡∏°‡∏≠ ‡∏™‡πà‡∏ß‡∏ô‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏Ñ‡∏£‡∏π‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡πÑ‡∏î‡πâ";
  $("#previousLessonStepButton").disabled = index <= 0;
  const previousStep = index > 0 ? flow[index - 1] : null;
  $("#previousLessonStepButton").innerHTML = `<span class="lesson-nav-title">${escapeHtml(previousStep?.title || "‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏ï‡πâ‡∏ô")}</span><span class="lesson-nav-direction">‚Üê ‡∏Ç‡∏±‡πâ‡∏ô‡∏Å‡πà‡∏≠‡∏ô‡∏´‡∏ô‡πâ‡∏≤</span>`;
  $("#previousLessonStepButton").title = previousStep ? `‡∏¢‡πâ‡∏≠‡∏ô‡∏Å‡∏•‡∏±‡∏ö‡πÑ‡∏õ: ${previousStep.title}` : "‡∏ô‡∏µ‡πà‡∏Ñ‡∏∑‡∏≠‡∏£‡∏≤‡∏¢‡∏Å‡∏≤‡∏£‡πÅ‡∏£‡∏Å";
  $("#restartLessonTimerButton").disabled = !step || isResults || isAssessment;
  $("#finishActivityButton").classList.toggle("hidden", !isGame);
  $("#pauseSessionButton")?.classList.toggle("hidden", isResults || isAssessment);
  renderProjectorLessonContent(step);
}

function renderLiveModeSwitch() {
  $$('[data-live-mode]').forEach(button => {
    const active = button.dataset.liveMode === state.session?.play_mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderScoreRecordingNotice();
}

async function setLivePlayMode(mode) {
  if (!state.session || !["practice", "real"].includes(mode) || state.session.play_mode === mode) return;
  const buttons = $$('[data-live-mode]');
  buttons.forEach(button => { button.disabled = true; });
  const { data, error } = await supabase.from("class_sessions").update({ play_mode: mode }).eq("id", state.session.id).select().single();
  buttons.forEach(button => { button.disabled = false; });
  if (error) return toast(error.message, "error");
  state.session = data;
  $("#playMode").value = mode;
  renderLiveModeSwitch();
  await broadcastDisplay("play-mode-changed");
  const labels = { practice: "‡πÇ‡∏´‡∏°‡∏î‡∏ó‡∏î‡∏•‡∏≠‡∏á", real: "‡πÇ‡∏´‡∏°‡∏î‡∏à‡∏£‡∏¥‡∏á" };
  toast(`‡πÄ‡∏õ‡∏•‡∏µ‡πà‡∏¢‡∏ô‡πÄ‡∏õ‡πá‡∏ô${labels[mode]}‡πÅ‡∏•‡πâ‡∏ß`, "success");
}

async function savePlanSettings() {
  const attemptMode = $("#attemptMode").value;
  const updates = {
    plan_id: Number(state.selectedPlanId),
    play_mode: $("#playMode").value,
    attempt_mode: attemptMode,
    max_attempts: attemptMode === "single" ? 1 : Number($("#maxAttempts").value),
    score_policy: $("#scorePolicy").value,
    leaderboard_mode: $("#leaderboardMode").value,
    pass_percent: Number($("#passPercent").value),
  };
  const { data, error } = await supabase.from("class_sessions").update(updates).eq("id", state.session.id).select().single();
  if (error) throw error;
  state.session = data;
  renderLiveModeSwitch();
}

function activityTimerStorageKey() {
  return state.session?.id ? `thai-game-activity-timer-${state.session.id}` : "";
}

function activityDurationMs(stepKey = state.lessonStepKey) {
  if (isAssessmentSession(state.session) && state.session?.assessment_ends_at) {
    return Math.max(0, Date.parse(state.session.assessment_ends_at) - Date.now());
  }
  const step = lessonStepForKey(stepKey, state.session?.plan_id);
  return (step ? Number(step.minutes) : 10) * 60 * 1000;
}

function updateActivityCountdown(label) {
  const output = $("#activityCountdown");
  const card = $("#activityTimerCard");
  if (!output || !card) return;
  card.classList.remove("is-urgent", "is-paused", "is-finished");
  if (label) {
    output.textContent = label;
    if (label === "‡∏û‡∏±‡∏Å‡∏≠‡∏¢‡∏π‡πà") card.classList.add("is-paused");
    if (label === "‡∏à‡∏ö‡πÄ‡∏Å‡∏°" || label === "00:00") card.classList.add("is-finished");
    return;
  }
  const seconds = Math.max(0, Math.ceil(state.activityRemainingMs / 1000));
  output.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  card.classList.toggle("is-urgent", seconds > 0 && seconds <= 60);
}

function saveActivityTimer(running = state.session?.status === "active") {
  const key = activityTimerStorageKey();
  if (!key || !state.lessonStepKey) return;
  try {
    localStorage.setItem(key, JSON.stringify({
      lessonStepKey: state.lessonStepKey,
      lessonRoundId: state.lessonRoundId,
      remainingMs: Math.max(0, state.activityRemainingMs),
      startedAt: state.activityStartedAt,
      savedAt: Date.now(),
      running: Boolean(running && !state.lessonTimerExpired),
      expired: state.lessonTimerExpired,
    }));
  } catch { /* The countdown still works if storage is unavailable. */ }
}

function removeSavedActivityTimer() {
  const key = activityTimerStorageKey();
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* Ignore unavailable storage. */ }
}

function stopActivityTimer({ clearSaved = false, label = "" } = {}) {
  clearInterval(state.activityTimerId);
  state.activityTimerId = null;
  state.activityTimerLastTickAt = null;
  if (clearSaved) removeSavedActivityTimer();
  updateActivityCountdown(label);
}

function tickActivityTimer() {
  if (!state.lessonStepKey || state.celebrationActivityKey || state.lessonTimerExpired) return;
  if (state.session.status !== "active") {
    state.activityTimerLastTickAt = null;
    updateActivityCountdown("‡∏û‡∏±‡∏Å‡∏≠‡∏¢‡∏π‡πà");
    saveActivityTimer(false);
    return;
  }
  const now = Date.now();
  if (state.activityTimerLastTickAt) state.activityRemainingMs -= now - state.activityTimerLastTickAt;
  state.activityTimerLastTickAt = now;
  updateActivityCountdown();
  saveActivityTimer(true);
  if (state.activityRemainingMs > 0) return;
  state.activityRemainingMs = 0;
  state.lessonTimerExpired = true;
  stopActivityTimer({ label: "00:00" });
  saveActivityTimer(false);
  void broadcastDisplay("lesson-time-ended");
  toast("‡∏´‡∏°‡∏î‡πÄ‡∏ß‡∏•‡∏≤‡∏ó‡∏µ‡πà‡πÅ‡∏ô‡∏∞‡∏ô‡∏≥‡πÅ‡∏•‡πâ‡∏ß ¬∑ ‡∏Ñ‡∏£‡∏π‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏Ç‡∏±‡πâ‡∏ô‡∏ñ‡∏±‡∏î‡πÑ‡∏õ‡πÄ‡∏°‡∏∑‡πà‡∏≠‡∏´‡πâ‡∏≠‡∏á‡∏û‡∏£‡πâ‡∏≠‡∏°", "warning");
}

function startActivityTimer(stepKey = state.lessonStepKey, reset = true) {
  clearInterval(state.activityTimerId);
  if (reset) {
    state.activityRemainingMs = activityDurationMs(stepKey);
    state.activityStartedAt = new Date().toISOString();
    state.lessonTimerExpired = false;
  }
  state.activityTimerLastTickAt = Date.now();
  updateActivityCountdown();
  saveActivityTimer(true);
  state.activityTimerId = setInterval(tickActivityTimer, 1000);
}

function restoreActivityTimer() {
  if (!state.lessonStepKey || state.celebrationActivityKey) {
    updateActivityCountdown("--:--");
    return;
  }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(activityTimerStorageKey()) || "null"); } catch { saved = null; }
  if (saved?.lessonStepKey === state.lessonStepKey) {
    const elapsed = saved.running && state.session.status === "active" ? Date.now() - Number(saved.savedAt || Date.now()) : 0;
    state.activityRemainingMs = Math.max(0, Number(saved.remainingMs || 0) - elapsed);
    state.activityStartedAt = saved.startedAt || null;
    state.lessonTimerExpired = Boolean(saved.expired || state.activityRemainingMs <= 0);
  } else {
    state.activityRemainingMs = activityDurationMs();
    state.activityStartedAt = new Date().toISOString();
    state.lessonTimerExpired = false;
  }
  if (state.session.status !== "active") {
    updateActivityCountdown("‡∏û‡∏±‡∏Å‡∏≠‡∏¢‡∏π‡πà");
    saveActivityTimer(false);
    return;
  }
  if (state.activityRemainingMs <= 0) {
    state.lessonTimerExpired = true;
    updateActivityCountdown("00:00");
    saveActivityTimer(false);
    return;
  }
  startActivityTimer(state.lessonStepKey, false);
}

async function startSelectedPlan() {
  if (state.selectedAssessmentPhase) return startAssessment(state.selectedAssessmentPhase);
  if (!state.selectedPlanId) return toast("‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡πÅ‡∏ú‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô", "warning");
  const button = $("#startPlanButton");
  button.disabled = true;
  button.textContent = "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡πÄ‡∏õ‡∏¥‡∏î‡∏•‡∏≥‡∏î‡∏±‡∏ö‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô...";
  try {
    await savePlanSettings();
    const firstStep = currentLessonFlow()[0];
    const started = firstStep ? await startLessonStep(firstStep.key) : false;
    if (!started) return;
    setTeacherFlowStep("live");
  } catch (error) {
    toast(error.message || "‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÅ‡∏ú‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à", "error");
  } finally {
    button.disabled = false;
    button.textContent = "‚ñ∂ ‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏Ç‡∏±‡πâ‡∏ô‡πÅ‡∏£‡∏Å";
  }
}

function assessmentDurationMinutes() {
  const field = $("#assessmentDuration");
  const value = Math.round(Number(field?.value) || 20);
  const normalized = Math.max(1, Math.min(180, value));
  if (field) field.value = normalized;
  return normalized;
}

async function startAssessment(phase) {
  const activity = assessmentActivityForPhase(phase);
  if (!activity || !state.session) return toast("‡πÑ‡∏°‡πà‡∏û‡∏ö‡∏£‡∏≤‡∏¢‡∏Å‡∏≤‡∏£‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡∏ó‡∏µ‡πà‡πÄ‡∏•‡∏∑‡∏≠‡∏Å", "warning");
  const isSurvey = phase === "satisfaction";
  const button = $("#startPlanButton");
  button.disabled = true;
  button.textContent = isSurvey ? "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡πÄ‡∏õ‡∏¥‡∏î‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô..." : "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡πÄ‡∏õ‡∏¥‡∏î‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö...";
  try {
    const { data, error } = await supabase.rpc("start_class_assessment", {
      p_session_id: state.session.id,
      p_assessment_phase: phase,
      p_duration_minutes: assessmentDurationMinutes(),
    });
    if (error) throw error;
    state.session = data;
    state.selectedAssessmentPhase = phase;
    state.lessonStepKey = `assessment-${phase}`;
    state.lessonRoundId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    state.lessonShareStudents = true;
    state.lessonCardIndex = 0;
    state.celebrationActivityKey = null;
    state.celebrationReason = null;
    state.lessonTimerExpired = false;
    saveLessonFlowState();
    startActivityTimer(state.lessonStepKey, true);
    renderActivityControls();
    renderLiveModeSwitch();
    renderLiveResults();
    $("#pauseSessionButton").textContent = isSurvey ? "‡∏û‡∏±‡∏Å‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô" : "‡∏û‡∏±‡∏Å‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö";
    await broadcastDisplay("assessment-started");
    setTeacherFlowStep("live");
    setClassroomStageExpanded(true);
    toast(`‡πÄ‡∏£‡∏¥‡πà‡∏°${activity.title}‡πÅ‡∏•‡πâ‡∏ß ¬∑ ‡πÄ‡∏ß‡∏•‡∏≤ ${state.session.assessment_duration_minutes} ‡∏ô‡∏≤‡∏ó‡∏µ`, "success");
  } catch (error) {
    toast(error.message || (isSurvey ? "‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à" : "‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à"), "error");
  } finally {
    button.disabled = false;
    button.textContent = activity ? `‚ñ∂ ‡πÄ‡∏£‡∏¥‡πà‡∏°${activity.title}` : "‚ñ∂ ‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏Ç‡∏±‡πâ‡∏ô‡πÅ‡∏£‡∏Å";
  }
}

async function startLessonStep(stepKey, options = {}) {
  const step = lessonStepForKey(stepKey, state.session?.plan_id || state.selectedPlanId || 1);
  if (!step) {
    toast("‡πÑ‡∏°‡πà‡∏û‡∏ö‡∏Ç‡∏±‡πâ‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô‡∏ô‡∏µ‡πâ ‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏à‡∏≤‡∏Å‡∏•‡∏≥‡∏î‡∏±‡∏ö‡πÉ‡∏ô‡πÅ‡∏ú‡∏ô", "warning");
    return false;
  }
  prepareVictoryAudio();
  const isResults = step.kind === "results";
  if (!options.preserveCelebration) {
    state.celebrationActivityKey = isResults ? step.activityKey : null;
    state.celebrationReason = isResults ? (options.reason || "manual") : null;
  }
  state.lessonStepKey = step.key;
  state.lessonRoundId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  state.lessonShareStudents = step.kind === "game" ? true : Boolean(step.studentVisibleDefault);
  state.lessonCardIndex = 0;
  state.lessonTimerExpired = false;
  const updates = {
    status: isResults ? "paused" : "active",
    current_activity_key: step.kind === "game" || isResults ? step.activityKey : null,
  };
  if (!state.session.started_at) updates.started_at = new Date().toISOString();
  const { data, error } = await supabase.from("class_sessions").update(updates).eq("id", state.session.id).select().single();
  if (error) {
    toast(error.message, "error");
    return false;
  }
  state.session = data;
  saveLessonFlowState();
  if (isResults) {
    state.activityRemainingMs = 0;
    stopActivityTimer({ clearSaved: true, label: "‡∏õ‡∏£‡∏∞‡∏Å‡∏≤‡∏®‡∏ú‡∏•" });
  } else {
    startActivityTimer(step.key, true);
  }
  renderActivityControls();
  renderLiveModeSwitch();
  renderLiveResults();
  $("#pauseSessionButton").textContent = "‡∏û‡∏±‡∏Å‡∏Å‡∏¥‡∏à‡∏Å‡∏£‡∏£‡∏°";
  await broadcastDisplay("lesson-step-started");
  setClassroomStageExpanded(true);
  if (!options.silent) toast(`‡πÄ‡∏õ‡∏¥‡∏î ${step.title} ‡πÅ‡∏•‡πâ‡∏ß`, "success");
  return true;
}

function updateNextActivityButton() {
  const button = $("#nextActivityButton");
  if (!button || !state.session) return;
  const flow = currentLessonFlow();
  const index = flow.findIndex(item => item.key === state.lessonStepKey);
  if (flow[index]?.kind === "assessment") {
    const isSurvey = state.session?.assessment_phase === "satisfaction";
    button.innerHTML = `<span class="lesson-nav-direction">${isSurvey ? "‡∏à‡∏ö‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô" : "‡∏à‡∏ö‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö"} ‚Üí</span><span class="lesson-nav-title">${isSurvey ? "‡πÄ‡∏õ‡∏¥‡∏î‡∏£‡∏≤‡∏¢‡∏á‡∏≤‡∏ô‡∏Ñ‡∏ß‡∏≤‡∏°‡∏û‡∏∂‡∏á‡∏û‡∏≠‡πÉ‡∏à" : "‡πÄ‡∏õ‡∏¥‡∏î‡∏£‡∏≤‡∏¢‡∏á‡∏≤‡∏ô‡∏Ñ‡∏∞‡πÅ‡∏ô‡∏ô"}</span>`;
    button.title = isSurvey ? "‡∏´‡∏¢‡∏∏‡∏î‡∏£‡∏±‡∏ö‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡πÅ‡∏•‡∏∞‡πÄ‡∏õ‡∏¥‡∏î‡∏£‡∏≤‡∏¢‡∏á‡∏≤‡∏ô‡∏Ñ‡∏£‡∏π" : "‡∏´‡∏¢‡∏∏‡∏î‡∏£‡∏±‡∏ö‡∏Ñ‡∏≥‡∏ï‡∏≠‡∏ö‡πÅ‡∏•‡∏∞‡πÄ‡∏õ‡∏¥‡∏î‡∏£‡∏≤‡∏¢‡∏á‡∏≤‡∏ô‡∏Ñ‡∏£‡∏π‡πÇ‡∏î‡∏¢‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏Å‡∏≤‡∏£‡∏à‡∏±‡∏î‡∏≠‡∏±‡∏ô‡∏î‡∏±‡∏ö";
    return;
  }
  const nextStep = flow[Math.max(index + 1, 0)] || flow[0];
  const nextTitle = index >= flow.length - 1 ? "‡∏™‡∏£‡∏∏‡∏õ‡∏ú‡∏•‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏£‡∏µ‡∏¢‡∏ô" : nextStep?.title || "‡∏î‡∏≥‡πÄ‡∏ô‡∏¥‡∏ô‡∏Å‡∏≤‡∏£‡∏™‡∏≠‡∏ô‡∏ï‡πà‡∏≠";
  button.innerHTML = `<span class="lesson-nav-direction">‡∏ñ‡∏±‡∏î‡πÑ‡∏õ ‚Üí</span><span class="lesson-nav-title">${escapeHtml(nextTitle)}</span>`;
  button.title = index >= flow.length - 1
    ? "‡πÄ‡∏õ‡∏¥‡∏î‡∏´‡∏ô‡πâ‡∏≤‡∏™‡∏£‡∏∏‡∏õ‡∏ú‡∏•‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏£‡∏µ‡∏¢‡∏ô"
    : `‡∏Ç‡∏±‡πâ‡∏ô‡∏ñ‡∏±‡∏î‡πÑ‡∏õ: ${nextTitle}`;
}

async function goToNextActivity() {
  const flow = currentLessonFlow();
  const index = flow.findIndex(item => item.key === state.lessonStepKey);
  if (["game", "assessment"].includes(flow[index]?.kind)) {
    await finishActivity("manual");
    return;
  }
  if (index >= flow.length - 1) return showSessionSummary();
  await startLessonStep(flow[Math.max(index + 1, 0)].key);
}

async function goToPreviousLessonStep() {
  const flow = currentLessonFlow();
  const index = flow.findIndex(item => item.key === state.lessonStepKey);
  if (index <= 0) return;
  await startLessonStep(flow[index - 1].key);
}

function restartLessonTimer() {
  const step = currentLessonStep();
  if (!step) return;
  if (step.kind === "assessment") return toast(state.session?.assessment_phase === "satisfaction" ? "‡πÄ‡∏ß‡∏•‡∏≤‡πÅ‡∏ö‡∏ö‡∏õ‡∏£‡∏∞‡πÄ‡∏°‡∏¥‡∏ô‡∏Å‡∏≥‡∏´‡∏ô‡∏î‡∏à‡∏≤‡∏Å‡∏ï‡∏≠‡∏ô‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏Å‡∏¥‡∏à‡∏Å‡∏£‡∏£‡∏° ‡∏à‡∏∂‡∏á‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÄ‡∏ß‡∏•‡∏≤‡πÉ‡∏´‡∏°‡πà‡πÑ‡∏°‡πà‡πÑ‡∏î‡πâ" : "‡πÄ‡∏ß‡∏•‡∏≤‡πÅ‡∏ö‡∏ö‡∏ó‡∏î‡∏™‡∏≠‡∏ö‡∏Å‡∏≥‡∏´‡∏ô‡∏î‡∏à‡∏≤‡∏Å‡∏ï‡∏≠‡∏ô‡πÄ‡∏£‡∏¥‡πà‡∏°‡∏Ñ‡∏≤‡∏ö ‡∏à‡∏∂‡∏á‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÄ‡∏ß‡∏•‡∏≤‡πÉ‡∏´‡∏°‡πà‡πÑ‡∏°‡πà‡πÑ‡∏î‡πâ", "warning");
  startActivityTimer(step.key, true);
  void broadcastDisplay("lesson-timer-restarted");
  toast(`‡πÄ‡∏£‡∏¥‡πà‡∏°‡πÄ‡∏ß‡∏•‡∏≤ ${step.minutes} ‡∏ô‡∏≤‡∏ó‡∏µ‡πÉ‡∏´‡∏°‡πà‡πÅ‡∏•‡πâ‡∏ß`, "success");
}

function setLessonStudentVisibility(visible) {
  const step = currentLessonStep();
  if (!step || ["game", "assessment"].includes(step.kind)) return;
  state.lessonShareStudents = Boolean(visible);
  saveLessonFlowState();
  renderCurrentLessonStep();
  void broadcastDisplay("lesson-student-visibility");
  toast(state.lessonShareStudents ? "‡πÅ‡∏™‡∏î‡∏á‡∏™‡∏∑‡πà‡∏≠‡∏ö‡∏ô‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡πÅ‡∏•‡πâ‡∏ß" : "‡∏™‡∏∑‡πà‡∏≠‡∏ô‡∏µ‡πâ‡πÅ‡∏™‡∏î‡∏á‡πÄ‡∏â‡∏û‡∏≤‡∏∞‡∏à‡∏≠‡∏â‡∏≤‡∏¢‡πÅ‡∏•‡∏∞‡∏´‡∏ô‡πâ‡∏≤‡∏Ñ‡∏£‡∏π", "success");
}

function showSessionSummary() {
  renderSummary();
  setTeacherFlowStep("summary");
}

async function togglePause() {
  const wasCelebrating = state.celebrationActivityKey === state.session.current_activity_key;
  if (state.session.status === "active") tickActivityTimer();
  if (state.finishingActivity) return;
  const status = state.session.status === "paused" ? "active" : "paused";
  const { data, error } = await supabase.from("class_sessions").update({ status }).eq("id", state.session.id).select().single();
  if (error) return toast(error.message, "error");
  state.session = data;
  if (status === "active") {
    state.celebrationActivityKey = null;
    state.celebrationReason = null;
    if (wasCelebrating || (state.activityRemainingMs <= 0 && !state.lessonTimerExpired)) startActivityTimer(state.lessonStepKey, true);
    else if (!state.lessonTimerExpired) startActivityTimer(state.lessonStepKey, false);
  } else {
    state.activityTimerLastTickAt = null;
    updateActivityCountdown("‡∏û‡∏±‡∏Å‡∏≠‡∏¢‡∏π‡πà");
    saveActivityTimer(false);
  }
  $("#pauseSessionButton").textContent = status === "paused" ? "‡πÄ‡∏•‡πà‡∏ô‡∏ï‡πà‡∏≠" : "‡∏û‡∏±‡∏Å‡πÄ‡∏Å‡∏°";
  renderCurrentLessonStep();
  renderLiveResults();
  broadcastDisplay();
}

function openLateJoin() {
  const pending = pendingLiveJoinPlayers();
  if (!pending.length) {
    toast(`‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡∏°‡∏µ‡∏Ñ‡∏≥‡∏Ç‡∏≠‡πÄ‡∏Ç‡πâ‡∏≤‡πÉ‡∏´‡∏°‡πà ¬∑ ‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡πÉ‡∏ä‡πâ‡∏£‡∏´‡∏±‡∏™ ${state.session?.room_code || "------"} ‡πÑ‡∏î‡πâ‡∏ï‡∏•‡∏≠‡∏î‡∏Ñ‡∏≤‡∏ö`, "default");
    return;
  }
  $("#liveJoinRequests")?.classList.remove("hidden");
  $("#liveJoinRequests")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function closeLateJoin() {
  if (!state.lateJoinMode) return false;
  const resumeStatus = state.lateJoinResumeStatus === "active" ? "active" : "paused";
  const { data, error } = await supabase.from("class_sessions").update({ status: resumeStatus }).eq("id", state.session.id).select().single();
  if (error) {
    toast(error.message, "error");
    return true;
  }
  state.session = data;
  state.lateJoinMode = false;
  if (resumeStatus === "active" && state.activityRemainingMs > 0) startActivityTimer(state.lessonStepKey, false);
  else {
    state.activityTimerLastTickAt = null;
    updateActivityCountdown("‡∏û‡∏±‡∏Å‡∏≠‡∏¢‡∏π‡πà");
    saveActivityTimer(false);
  }
  $("#pauseSessionButton").textContent = resumeStatus === "active" ? "‡∏û‡∏±‡∏Å‡πÄ‡∏Å‡∏°" : "‡πÄ‡∏•‡πà‡∏ô‡∏ï‡πà‡∏≠";
  syncLateJoinControls();
  renderLiveResults();
  broadcastDisplay();
  setTeacherFlowStep("live");
  toast(resumeStatus === "active" ? "‡∏õ‡∏¥‡∏î‡∏£‡∏±‡∏ö‡πÅ‡∏•‡∏∞‡∏Å‡∏•‡∏±‡∏ö‡∏°‡∏≤‡πÄ‡∏•‡πà‡∏ô‡πÄ‡∏Å‡∏°‡πÅ‡∏•‡πâ‡∏ß" : "‡∏õ‡∏¥‡∏î‡∏£‡∏±‡∏ö‡πÅ‡∏•‡πâ‡∏ß ‡∏Å‡∏î‡πÄ‡∏•‡πà‡∏ô‡∏ï‡πà‡∏≠‡πÄ‡∏°‡∏∑‡πà‡∏≠‡∏û‡∏£‡πâ‡∏≠‡∏°", "success");
  return true;
}

async function handleLobbyBack() {
  if (await closeLateJoin()) return;
  setTeacherFlowStep("qr");
}

async function handleLobbyNext() {
  if (await closeLateJoin()) return;
  renderPlanChoices();
  setTeacherFlowStep("plan");
}

function subscribeToSession() {
  state.sessionChannel?.unsubscribe();
  state.sessionChannel = supabase.channel(`teacher-session-${state.session.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${state.session.id}` }, async payload => {
      const needsApproval = payload.new?.status === "waiting" && payload.old?.status !== "waiting";
      await refreshSessionData();
      if (needsApproval) {
        const player = state.players.find(item => item.id === payload.new.id);
        const name = player?.student?.full_name || "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô";
        toast(`üîî ${name} ‡∏Ç‡∏≠‡πÄ‡∏Ç‡πâ‡∏≤‡∏´‡πâ‡∏≠‡∏á ¬∑ ‡∏≠‡∏ô‡∏∏‡∏°‡∏±‡∏ï‡∏¥‡πÑ‡∏î‡πâ‡∏à‡∏≤‡∏Å‡∏´‡∏ô‡πâ‡∏≤‡∏™‡∏≠‡∏ô‡∏õ‡∏±‡∏à‡∏à‡∏∏‡∏ö‡∏±‡∏ô`, "success");
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "game_attempts" }, payload => {
      const playerIds = new Set(state.players.map(player => player.id));
      if (playerIds.has(payload.new?.session_player_id || payload.old?.session_player_id)) refreshSessionData();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "satisfaction_responses" }, payload => {
      const playerIds = new Set(state.players.map(player => player.id));
      if (playerIds.has(payload.new?.session_player_id || payload.old?.session_player_id)) refreshSessionData();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "satisfaction_submissions" }, payload => {
      const playerIds = new Set(state.players.map(player => player.id));
      if (playerIds.has(payload.new?.session_player_id || payload.old?.session_player_id)) {
        void refreshSessionData().then(() => loadAssessmentReport());
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "sentence_submissions", filter: `session_id=eq.${state.session.id}` }, () => {
      if (state.session?.current_activity_key === "vote") loadSentenceSubmissions();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "sentence_votes" }, () => {
      if (state.session?.current_activity_key === "vote") loadSentenceSubmissions();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${state.session.id}` }, payload => {
      const activityChanged = state.session?.current_activity_key !== payload.new.current_activity_key;
      state.session = payload.new;
      if (state.session.status !== "lobby") state.lateJoinMode = false;
      if (activityChanged) {
        state.celebrationActivityKey = null;
        state.celebrationReason = null;
        restoreActivityTimer();
      }
      renderActivityControls();
      syncLateJoinControls();
      renderLiveModeSwitch();
      renderLiveResults();
    })
    .subscribe();
}

function screenTimestamp(screen) {
  const timestamp = Date.parse(String(screen?.updated_at || screen?.online_at || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeStudentScreen(previous, incoming) {
  if (!incoming?.player_id) return previous || null;
  if (previous && screenTimestamp(incoming) < screenTimestamp(previous)) return previous;
  return {
    ...previous,
    ...incoming,
    player_id: String(incoming.player_id),
    game_markup: incoming.game_markup || previous?.game_markup || "",
  };
}

function upsertStudentScreen(incoming) {
  const playerId = String(incoming?.player_id || "");
  if (!playerId) return;
  const merged = mergeStudentScreen(state.studentScreens.get(playerId), incoming);
  if (merged) state.studentScreens.set(playerId, merged);
}

function subscribePresence() {
  stopStudentScreenWatch();
  state.presenceChannel?.unsubscribe();
  state.presenceChannel = supabase.channel(`classroom-${state.session.id}`, { config: { presence: { key: `teacher-${state.user.id}` } } })
    .on("broadcast", { event: "student-screen" }, message => {
      const screen = message?.payload || message;
      if (screen?.role !== "student" || !screen.player_id) return;
      upsertStudentScreen(screen);
      $("#onlineCount").textContent = state.studentScreens.size;
      renderStudentScreens();
    })
    .on("presence", { event: "sync" }, () => {
      const presence = state.presenceChannel.presenceState();
      const students = Object.values(presence).flat().filter(item => item.role === "student");
      // Keep the most recent broadcast while Presence catches up. Presence
      // deliberately omits game_markup, so replacing the map wholesale can
      // make a live screen jump back to a stale placeholder.
      const latestScreens = new Map([...state.studentScreens].filter(([, screen]) => {
        const timestamp = screenTimestamp(screen);
        return timestamp > 0 && Date.now() - timestamp < 15000;
      }));
      students.forEach(screen => {
        const playerId = String(screen.player_id || "");
        if (!playerId) return;
        const previous = latestScreens.get(playerId) || state.studentScreens.get(playerId);
        const merged = mergeStudentScreen(previous, screen);
        if (merged) latestScreens.set(playerId, merged);
      });
      state.studentScreens = latestScreens;
      $("#onlineCount").textContent = latestScreens.size;
      renderStudentScreens();
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") state.presenceChannel.track({ role: "teacher", online_at: new Date().toISOString() });
    });
}

function studentScreenEntries() {
  const entries = state.players.filter(player => player.status === "approved").map(player => ({
    player,
    student: player.student || {},
    screen: state.studentScreens.get(String(player.id)) || null,
    online: state.studentScreens.has(String(player.id)),
  }));
  const knownPlayerIds = new Set(entries.map(entry => String(entry.player.id)));
  state.studentScreens.forEach((screen, playerId) => {
    if (knownPlayerIds.has(String(playerId))) return;
    entries.push({
      player: { id: playerId, student_id: screen.student_id, status: "approved" },
      student: {
        id: screen.student_id,
        full_name: screen.display_name || "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏≠‡∏≠‡∏ô‡πÑ‡∏•‡∏ô‡πå",
        nickname: screen.display_name || "",
        avatar: screen.avatar || "üôÇ",
      },
      screen,
      online: true,
    });
  });
  return entries.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return String(a.student.full_name || a.student.nickname || "").localeCompare(String(b.student.full_name || b.student.nickname || ""), "th");
  });
}

function studentScreenModeLabel(mode) {
  return ({ practice: "‡∏ó‡∏î‡∏•‡∏≠‡∏á", real: "‡∏à‡∏£‡∏¥‡∏á" })[mode] || "‡∏ó‡∏î‡∏•‡∏≠‡∏á";
}

function studentScreenIcon(entry) {
  if (!entry.online) return "üí§";
  return ({ result: "üèÜ", paused: "‚è∏Ô∏è", playing: "üéÆ", ready: "üó∫Ô∏è", waiting: "‚è≥" })[entry.screen?.screen_state] || "üì±";
}

function studentMirrorHtml(entry, large = false) {
  const screen = entry.screen || {};
  const activity = activityForKey(screen.activity_key, state.session?.plan_id);
  const title = screen.activity_title || activity?.title || (entry.online ? "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡πÄ‡∏ä‡∏∑‡πà‡∏≠‡∏°‡∏ï‡πà‡∏≠‡∏à‡∏≠" : "‡πÑ‡∏°‡πà‡πÑ‡∏î‡πâ‡∏≠‡∏≠‡∏ô‡πÑ‡∏•‡∏ô‡πå");
  const label = entry.online ? (screen.screen_label || "‡∏≠‡∏¢‡∏π‡πà‡∏´‡∏ô‡πâ‡∏≤‡πÄ‡∏Å‡∏°") : "‡∏≠‡∏≠‡∏ü‡πÑ‡∏•‡∏ô‡πå";
  const detail = screen.detail || (entry.online ? "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏ó‡∏≥‡∏Å‡∏¥‡∏à‡∏Å‡∏£‡∏£‡∏°" : "‡πÄ‡∏°‡∏∑‡πà‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏Å‡∏•‡∏±‡∏ö‡πÄ‡∏Ç‡πâ‡∏≤‡πÄ‡∏Å‡∏° ‡∏à‡∏≠‡∏à‡∏∞‡πÄ‡∏ä‡∏∑‡πà‡∏≠‡∏°‡∏ï‡πà‡∏≠‡πÉ‡∏´‡∏°‡πà");
  const rawProgress = Number(screen.progress_percent || 0);
  const rawScore = Number(screen.score || 0);
  const progress = Number.isFinite(rawProgress) ? Math.min(100, Math.max(0, rawProgress)) : 0;
  const score = Number.isFinite(rawScore) ? rawScore : 0;
  const streamMarkup = large ? sanitizeGameMarkup(screen.game_markup) : "";
  const screenContent = streamMarkup
    ? `<div class="student-device-stream"><div class="display-student-mirror-canvas game-canvas" style="--game-zoom:${Math.max(.75, Math.min(1.3, Number(screen.game_zoom) || 1))}">${streamMarkup}</div></div>`
    : `<div class="student-device-stage" data-screen-state="${escapeHtml(screen.screen_state || "offline")}">
      <span class="student-device-icon">${studentScreenIcon(entry)}</span>
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(detail)}</p>
      <div class="student-device-progress"><i style="width:${progress}%"></i></div>
    </div>`;
  return `<div class="student-device ${large ? "student-device-large" : ""} ${entry.online ? "is-online" : "is-offline"}">
    <div class="student-device-top"><span>${entry.online ? "‚óè ‡∏™‡∏î" : "‚óã ‡∏≠‡∏≠‡∏ü‡πÑ‡∏•‡∏ô‡πå"}</span><small>${escapeHtml(studentScreenModeLabel(screen.mode || state.session?.play_mode))}</small></div>
    ${screenContent}
    <div class="student-device-bottom"><span>‚≠ê ${score}</span><span>${escapeHtml(screen.progress_text || "‡∏£‡∏≠‡∏Ç‡πâ‡∏≠‡∏°‡∏π‡∏•‡∏Ñ‡∏ß‡∏≤‡∏°‡∏Ñ‡∏∑‡∏ö‡∏´‡∏ô‡πâ‡∏≤")}</span></div>
  </div>`;
}

function stopStudentScreenWatch() {
  clearInterval(state.studentScreenWatchTimer);
  state.studentScreenWatchTimer = null;
  const playerId = state.watchedStudentScreenId;
  state.watchedStudentScreenId = null;
  if (playerId && state.presenceChannel) {
    void state.presenceChannel.send({
      type: "broadcast",
      event: "screen-stream-control",
      payload: { role: "teacher", player_id: playerId, active: false },
    });
  }
}

function watchStudentScreen(playerId) {
  if (!playerId || !state.presenceChannel) return;
  if (state.watchedStudentScreenId === playerId && state.studentScreenWatchTimer) return;
  stopStudentScreenWatch();
  state.watchedStudentScreenId = playerId;
  const requestStream = () => void state.presenceChannel?.send({
    type: "broadcast",
    event: "screen-stream-control",
    payload: { role: "teacher", player_id: playerId, active: true, expires_at: Date.now() + 6500 },
  });
  requestStream();
  state.studentScreenWatchTimer = setInterval(requestStream, 4000);
}

function postStudentMirrorFrame(frame, markup) {
  if (!frame?.contentWindow || typeof markup !== "string") return;
  frame.contentWindow.postMessage({ type: "student-game-mirror-frame", markup }, window.location.origin);
}

window.addEventListener("message", event => {
  if (event.origin !== window.location.origin || event.data?.type !== "student-game-mirror-ready") return;
  const frame = $(".student-focus-game-frame", $("#studentScreenFocusContent"));
  if (frame?.contentWindow !== event.source) return;
  postStudentMirrorFrame(frame, state.studentScreenFocusMarkup);
});

function renderStudentScreenFocus(entries) {
  const selected = entries.find(entry => String(entry.player.id) === String(state.selectedStudentScreenId)) || entries[0];
  if (!selected) return;
  state.selectedStudentScreenId = String(selected.player.id);
  watchStudentScreen(String(selected.player.id));
  const screen = state.studentScreens.get(String(selected.player.id)) || selected.screen || {};
  const profileUrl = state.playerSelfieUrls.get(selected.player.id) || "";
  const profileVisual = profileUrl
    ? `<img src="${escapeHtml(profileUrl)}" alt="‡∏£‡∏π‡∏õ‡πÇ‡∏õ‡∏£‡πÑ‡∏ü‡∏•‡πå ${escapeHtml(selected.student.full_name || "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô")}">`
    : `<span>${escapeHtml(selected.student.avatar || randomAvatar(selected.student.nickname))}</span>`;
  const playerName = selected.student.full_name || selected.student.nickname || "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô";
  const streamMarkup = sanitizeGameMarkup(screen.game_markup);
  const focusContent = $("#studentScreenFocusContent");
  const existingFrame = $(".student-focus-game-frame", focusContent);
  const sameStudent = focusContent?.dataset.playerId === String(selected.player.id);
  // Keep a dedicated mirror document alive for the whole watch session. It
  // uses the student game's own full-screen CSS, so Broadcast updates never
  // inherit dashboard styles or restart an unchanged animation.
  if (sameStudent && existingFrame && streamMarkup) {
    if (state.studentScreenFocusMarkup !== streamMarkup) {
      state.studentScreenFocusMarkup = streamMarkup;
      postStudentMirrorFrame(existingFrame, streamMarkup);
    }
    $("#studentScreenPrevious").disabled = entries.length < 2;
    $("#studentScreenNext").disabled = entries.length < 2;
    return;
  }
  const gameContent = streamMarkup
    ? `<iframe class="student-focus-game-frame" data-player-id="${escapeHtml(String(selected.player.id))}" src="mirror.html" title="‡∏ñ‡πà‡∏≤‡∏¢‡∏ó‡∏≠‡∏î‡∏™‡∏î‡∏´‡∏ô‡πâ‡∏≤‡∏à‡∏≠ ${escapeHtml(playerName)}"></iframe>`
    : `<div class="student-focus-waiting"><span>${studentScreenIcon(selected)}</span><h2>${escapeHtml(screen.activity_title || "‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏£‡∏≠‡∏†‡∏≤‡∏û‡πÄ‡∏Å‡∏°")}</h2><p>${escapeHtml(screen.detail || "‡∏†‡∏≤‡∏û‡πÄ‡∏Å‡∏°‡∏à‡∏∞‡∏õ‡∏£‡∏≤‡∏Å‡∏è‡∏≠‡∏±‡∏ï‡πÇ‡∏ô‡∏°‡∏±‡∏ï‡∏¥")}</p></div>`;
  focusContent.innerHTML = `<div class="student-focus-stream">
    <div class="student-focus-overlay">
      <button class="student-focus-back" type="button" aria-label="‡∏Å‡∏•‡∏±‡∏ö‡πÑ‡∏õ‡∏î‡∏π‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏ó‡∏±‡πâ‡∏á‡∏´‡∏°‡∏î">‚Äπ</button>
      <div class="student-focus-player">${profileVisual}<strong>${escapeHtml(playerName)}</strong><i aria-label="‡∏ñ‡πà‡∏≤‡∏¢‡∏ó‡∏≠‡∏î‡∏™‡∏î"></i></div>
    </div>
    <main class="student-focus-game-window">${gameContent}</main>
  </div>`;
  focusContent.dataset.playerId = String(selected.player.id);
  state.studentScreenFocusMarkup = streamMarkup;
  const focusProfileImage = $(".student-focus-player > img", focusContent);
  focusProfileImage?.addEventListener("error", () => {
    const fallback = document.createElement("span");
    fallback.textContent = selected.student.avatar || randomAvatar(selected.student.nickname);
    fallback.setAttribute("aria-label", `‡∏≠‡∏ß‡∏ï‡∏≤‡∏£ ${playerName}`);
    focusProfileImage.replaceWith(fallback);
  }, { once: true });
  $(".student-focus-back", focusContent)?.addEventListener("click", () => setStudentScreenView("grid"));
  const mirrorFrame = $(".student-focus-game-frame", focusContent);
  mirrorFrame?.addEventListener("load", () => {
    if (mirrorFrame.dataset.playerId !== String(state.selectedStudentScreenId)) return;
    postStudentMirrorFrame(mirrorFrame, state.studentScreenFocusMarkup);
  });
  $("#studentScreenPrevious").disabled = entries.length < 2;
  $("#studentScreenNext").disabled = entries.length < 2;
}

function openStudentScreenFullscreen() {
  const focus = $("#studentScreenFocus");
  if (!focus) return;
  focus.classList.add("student-screen-full-window");
  if (!document.fullscreenElement) focus.requestFullscreen?.().catch(() => {});
}

function closeStudentScreenFullscreen() {
  $("#studentScreenFocus")?.classList.remove("student-screen-full-window");
  if (document.fullscreenElement?.id === "studentScreenFocus") document.exitFullscreen?.().catch(() => {});
}

function renderStudentScreens() {
  const entries = state.session ? studentScreenEntries() : [];
  const onlineCount = entries.filter(entry => entry.online).length;
  $("#studentScreensOnlineBadge").textContent = onlineCount;
  $("#studentScreensOnlineSummary").textContent = `‡∏≠‡∏≠‡∏ô‡πÑ‡∏•‡∏ô‡πå ${onlineCount} ‡∏à‡∏≤‡∏Å ${entries.length} ‡∏Ñ‡∏ô`;
  $("#studentScreensContext").textContent = state.session ? `${classContext()} ¬∑ ‡∏£‡∏´‡∏±‡∏™‡∏´‡πâ‡∏≠‡∏á ${state.session.room_code}` : "‡πÄ‡∏õ‡∏¥‡∏î‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏Å‡πà‡∏≠‡∏ô‡πÄ‡∏û‡∏∑‡πà‡∏≠‡∏î‡∏π‡∏à‡∏≠‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô";
  $("#studentScreensGridButton").classList.toggle("active", state.studentScreenView === "grid");
  $("#studentScreensFocusButton").classList.toggle("active", state.studentScreenView === "focus");
  $("#studentScreensGridButton").setAttribute("aria-pressed", String(state.studentScreenView === "grid"));
  $("#studentScreensFocusButton").setAttribute("aria-pressed", String(state.studentScreenView === "focus"));
  if (!entries.length) {
    show($("#studentScreensEmpty"));
    hide($("#studentScreensGrid"));
    hide($("#studentScreenFocus"));
    $("#studentScreensFocusButton").disabled = true;
    return;
  }
  hide($("#studentScreensEmpty"));
  if (!state.selectedStudentScreenId || !entries.some(entry => String(entry.player.id) === String(state.selectedStudentScreenId))) state.selectedStudentScreenId = String(entries.find(entry => entry.online)?.player.id || entries[0].player.id);
  $("#studentScreensFocusButton").disabled = false;
  if (state.studentScreenView === "focus") {
    hide($("#studentScreensGrid"));
    show($("#studentScreenFocus"));
    renderStudentScreenFocus(entries);
    return;
  }
  hide($("#studentScreenFocus"));
  show($("#studentScreensGrid"));
  $("#studentScreensGrid").innerHTML = entries.map(entry => `<button class="student-screen-card ${entry.online ? "is-online" : "is-offline"}" type="button" data-screen-player="${entry.player.id}">
    ${studentMirrorHtml(entry)}
    <span class="student-screen-card-name"><strong>${escapeHtml(entry.student.full_name || "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô")}</strong><small>${entry.online ? "‡πÅ‡∏ï‡∏∞‡πÄ‡∏û‡∏∑‡πà‡∏≠‡∏î‡∏π‡∏à‡∏≠‡∏£‡∏≤‡∏¢‡∏Ñ‡∏ô" : "‡∏≠‡∏≠‡∏ü‡πÑ‡∏•‡∏ô‡πå"}</small></span>
  </button>`).join("");
  $("#studentScreensGrid").querySelectorAll("[data-screen-player]").forEach(button => button.addEventListener("click", () => {
    state.selectedStudentScreenId = String(button.dataset.screenPlayer);
    state.studentScreenView = "focus";
    renderStudentScreens();
    requestAnimationFrame(openStudentScreenFullscreen);
  }));
}

function setStudentScreenView(view) {
  if (!state.session) return toast("‡∏Å‡∏£‡∏∏‡∏ì‡∏≤‡πÄ‡∏õ‡∏¥‡∏î‡∏Ñ‡∏≤‡∏ö‡πÄ‡∏£‡∏µ‡∏¢‡∏ô‡∏Å‡πà‡∏≠‡∏ô", "warning");
  state.studentScreenView = view === "focus" ? "focus" : "grid";
  if (state.studentScreenView === "grid") {
    stopStudentScreenWatch();
    state.studentScreenFocusMarkup = "";
    $("#studentScreenFocusContent")?.removeAttribute("data-player-id");
  }
  if (state.studentScreenView === "grid") closeStudentScreenFullscreen();
  renderStudentScreens();
}

function moveStudentScreen(direction) {
  const entries = studentScreenEntries();
  if (!entries.length) return;
  const currentIndex = Math.max(0, entries.findIndex(entry => String(entry.player.id) === String(state.selectedStudentScreenId)));
  state.selectedStudentScreenId = entries[(currentIndex + direction + entries.length) % entries.length].player.id;
  renderStudentScreens();
}

function selectScoreAttempt(attempts, policy = state.session?.score_policy || "best") {
  const ordered = [...attempts].sort((a, b) => Number(a.attempt_no || 0) - Number(b.attempt_no || 0) || String(a.completed_at || "").localeCompare(String(b.completed_at || "")));
  if (!ordered.length) return null;
  if (policy === "first") return ordered[0];
  if (policy === "latest") return ordered[ordered.length - 1];
  return ordered.reduce((best, attempt) => Number(attempt.score || 0) > Number(best.score || 0) ? attempt : best, ordered[0]);
}

function liveLeaderboardDisplayName(player) {
  const student = player.student || {};
  if (state.session?.leaderboard_mode === "real_name") return student.full_name || "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô";
  if (state.session?.leaderboard_mode === "student_code") return student.student_code || "‡πÑ‡∏°‡πà‡∏£‡∏∞‡∏ö‡∏∏‡∏£‡∏´‡∏±‡∏™";
  if (state.session?.leaderboard_mode === "hidden") return "‡∏ô‡∏±‡∏Å‡∏ú‡∏à‡∏ç‡∏†‡∏±‡∏¢";
  return student.nickname || student.full_name || "‡∏ô‡∏±‡∏Å‡πÄ‡∏£‡∏µ‡∏¢‡∏ô";
}

function buildExpertLeaderboard() {
  return state.players.filter(player => player.status === "approved").map(player => {
    const selected = new Map();
    state.attempts.filter(attempt => attempt.session_player_id === player.id).forEach(attempt => {
      const list = selected.get(attempt.activity_key) || [];
      list.push(attempt);
      selected.set(attempt.activity_key, list);
    });
    const bestAttempts = [...selected.values()]
      .map(attempts => selectScoreAttempt(attempts))
      .filter(Boolean);
    const totalScore = bestAttempts.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0);
    const averagePercent = bestAttempts.length
      ? Math.round((bestAttempts.reduce((sum, attempt) => sum + Number(attempt.percent || 0), 0) / bestAttempts.length) * 100) / 100
      : 0;
    return {
      player_id: player.id,
      display_name: liveLeaderboardDisplayName(player),
      avatar: player.student?.avatar || randomAvatar(player.student?.nickname),
      total_score: totalScore,
      average_percent: averagePercent,
      completed_activities: bestAttempts.length,
    };
  }).sort((a, b) => Number(b.total_score) - Number(a.total_score) || String(a.display_name).localeCompare(String(b.display_name), "th"));
}

function applyExpertLiveScore(message) {
  if (sessionRecordsScores() || !state.session) return;
  const payload = message?.payload || message;
  if (!payload || payload.session_id !== state.session.id) return;
  const player = state.players.find(item => item.id === payload.session_player_id && item.}Ωﬂo-¢Gß≤⁄Óù∆≠y€ò~äàéã>òâûà"¬.òà.ã^ä.âí˛äÆãàâB"¬.òâ^ò~ääÆãàâB"¬.ò>àÆòûàNã>â^ã.äâÆä>ãNâÆâr"¬.òâ^ò~äâÆä>ãNâÆâr"¬.òä>ã^ä.âÆòä>ã^ä.à~âæä>ãò.ä.àB"¬.òâ^ò~äâæä>ãò.ä.àB"¬.òäæä^òéà~à.òûäﬁäãûäR%’”∞¢7FFRÊv÷T∆ñvÊ÷VÁE&W˜'BÊf˜$V6ÇÇÜóFV“¬ñÊFWÇí”‚&˜w2ÁW6ÇÖ∞¢óFV“Á7GVFVÁEˆ˜&FW"ÛÚñÊFWÇ≤¬óFV“Á7GVFVÁEˆ6ˆFR«¬""¬óFV“ÊgV∆≈ˆÊ÷R«¬""¬óFV“Á∆ÂˆñB¿¢óFV“Ê7FófóGïˆ∂Wí¬óFV“ÊGFV◊EˆÊÚ«¬¬óFV“Á&u˜66˜&R¬óFV“Á&uˆ÷Ö˜66˜&R¬óFV“ÁW&6VÁB¿¢óFV“Ê6∆76ñfñ6FñˆÂ˜66˜&R¬óFV“Ê6∆76ñfñ6FñˆÂˆ÷Ç¬óFV“Á7V∆∆ñÊu˜66˜&R¬óFV“Á7V∆∆ñÊuˆ÷Ç¿¢óFV“Ê6ˆÁFWáE˜66˜&R¬óFV“Ê6ˆÁFWáEˆ÷Ç¬óFV“Á6VÁFVÊ6U˜66˜&R¬óFV“Á6VÁFVÊ6Uˆ÷Ç¬óFV“Á66˜&U˜6˜W&6R¿¢“íì∞¢F˜vÊ∆ˆD77bÇ.àNãòâûâûòàäòä^ãâ~ãàäûã”BﬁâNòûã.âíÊ77b"¬&˜w2ì∞ß–†¶gVÊ7Fñˆ‚F˜vÊ∆ˆEFWáDfñ∆RÜfñ∆VÊ÷R¬6ˆÁFVÁB¬GóR“'FWáB˜∆ñ„∂6Ü'6WC◊WFb”Ç"í∞¢6ˆÁ7BW&¬“U$¬Ê7&VFTˆ&¶V7EU$¬ÜÊWr&∆ˆ"Ö∂6ˆÁFVÁE“¬≤GóR“íì∞¢6ˆÁ7B∆ñÊ≤“Fˆ7V÷VÁBÊ7&VFTV∆V÷VÁBÇ&"ì∞¢∆ñÊ≤Êá&Vb“W&√∞¢∆ñÊ≤ÊF˜vÊ∆ˆB“fñ∆VÊ÷S∞¢Fˆ7V÷VÁBÊ&ˆGíÊVÊD6Üñ∆BÜ∆ñÊ≤ì∞¢∆ñÊ≤Ê6∆ñ6≤Çì∞¢∆ñÊ≤Á&V÷˜fRÇì∞¢U$¬Á&Wfˆ∂Tˆ&¶V7EU$¬áW&¬ì∞ß–†¶7ñÊ2gVÊ7Fñˆ‚Wá˜'E66˜&U7ƒ&6∑WÇí∞¢6ˆÁ7B6∆74ñB“7FFRÁ6W76ñˆ„ÚÊ6∆75ˆñB«¬BÇ"66∆756V∆V7B"ìÚÁf«VS∞¢ñbÇ6∆74ñBí&WGW&‚Fˆ7BÇ.àä>ãéâ>ã.òä^ã~äﬁàäæòûäﬁà~òä>ã^ä.âí"¬'v&ÊñÊr"ì∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6RÁ'2Ç&Wá˜'E˜%˜66˜&Uˆ&6∑W"¬≤ˆ6∆75ˆñC¢6∆74ñB“ì∞¢ñbÜW'&˜"«¬FFí∞¢6ˆÁ6ˆ∆RÁv&‚Ç.äÆòéà~äﬁäﬁààÆãéâNäÆã>ä>äﬁà~àNãòâûâûòNäòéäÆã>òä>ò~àÇ"¬W'&˜#ÚÊ6ˆFRì∞¢&WGW&‚Fˆ7BÇ.äÆòéà~äﬁäﬁà5¬òNäòéäÆã>òä>ò~àÇ"¬&W'&˜""ì∞¢–¢F˜vÊ∆ˆDgV∆≈&W˜'E7¬ÜFFì∞¢6ˆÁ7BF˜F¬“ÜFFÊ76W76÷VÁE˜66˜&W3ÚÊ∆VÊwFÇ«¬í≤ÜFFÊv÷U˜66˜&W3ÚÊ∆VÊwFÇ«¬í≤ÜFFÁ6Fó6f7FñˆÂ˜&W7ˆÁ6W3ÚÊ∆VÊwFÇ«¬í≤ÜFFÁ6W76ñˆÂˆ7FófóGï˜&W7V«G3ÚÊ∆VÊwFÇ«¬ì∞¢Fˆ7BÜäÆòéà~äﬁäﬁààÆãéâNäÆã>ä>äﬁà~àNä>âÆâ~ãéàäÆòéä~âíG∑F˜F«“ä>ã.ä.àã.ä>òä^òûäv¬'7V66W72"ì∞ß–†¶gVÊ7Fñˆ‚F˜vÊ∆ˆDgV∆≈&W˜'E7¬áñ∆ˆB¬7VffóÇ“'66˜&W2÷ÊB◊&W˜'G2"í∞¢6ˆÁ7Bß6ˆ‚“•4Ù‚Á7G&ñÊvñgíáñ∆ˆB¬ÁV∆¬¬"ì∞¢ñbÜß6ˆ‚ÊñÊ6«VFW2Ç"G%˜66˜&Uˆ&6∑WB"íí&WGW&‚Fˆ7BÇ.à.òûäﬁäãûä^äã^äﬁãàà.ä>ãâ~ã^òéòNäòéä>äﬁà~ä>ãâÆàã.ä>äÆòéà~äﬁäﬁà"¬&W'&˜""ì∞¢6ˆÁ7B7¬“∞¢"““"eTƒ¬$Uı%B$4µUc"+räÆä>òûã.à~ò.âNä.ä>ãâÆâ¢ı"Ú"¿¢"““äæòûã.äòàòûòNà"÷&∂W"äæä>ã~äﬁò.àNä>à~äÆä>òûã.àr•4Ù‚"¿¢"““%ı44ı$UÙ$4µUÙ•4ÙÂÙ$Ttî‚"¿¢ß6ˆ‚¿¢"““%ı44ı$UÙ$4µUÙ•4ÙÂÙT‰B"¿¢""¿¢6V∆V7BV&∆ñ2Êñ◊˜'E˜%˜66˜&Uˆ&6∑WÇrG∑ñ∆ˆBÊ6∆75ˆñG“s£ßWVñB¬G%˜66˜&Uˆ&6∑WF¿¢ß6ˆ‚¿¢"G%˜66˜&Uˆ&6∑WC£¶ß6ˆÊ"ì≤"¿¢""¿¢“Ê¶ˆñ‚Ç%∆‚"ì∞¢6ˆÁ7B&ˆˆ‘6ˆFR“7FFRÁ6W76ñˆ„ÚÁ&ˆˆ’ˆ6ˆFR«¬7FFRÊ6∆75&W˜'D6ˆÁFWáCÚÁ&ˆˆ’ˆ6ˆFR«¬'&ˆˆ“#∞¢F˜vÊ∆ˆEFWáDfñ∆RÜ"“G∑&ˆˆ‘6ˆFW““G∑7Vffóá“Á7∆¬7¬¬&∆ñ6Fñˆ‚˜7√∂6Ü'6WC◊WFb”Ç"ì∞ß–†¶gVÊ7Fñˆ‚Wá˜'DV◊Gï66˜&U7≈FV◊∆FRÇí∞¢6ˆÁ7B6∆74ñB“7FFRÁ6W76ñˆ„ÚÊ6∆75ˆñB«¬BÇ"66∆756V∆V7B"ìÚÁf«VR«¬#””””#∞¢6ˆÁ7B6∆77&ˆˆ““6V∆V7FVD6∆77&ˆˆ“Çì∞¢F˜vÊ∆ˆDgV∆≈&W˜'E7¬á∞¢66ÜV÷¢'%ˆgV∆≈˜&W˜'Eˆ&6∑W˜c""¿¢6∆75ˆñC¢6∆74ñB¿¢6∆75ˆ∆&V√¢6∆77&ˆˆ”ÚÊ∆&V¬«¬""¿¢Wá˜'FVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢7G'V7GW&S¢∞¢76W76÷VÁE˜66˜&W3¢≤'7GVFVÁEˆ6ˆFR"¬'7GVFVÁEˆ˜&FW""¬'&U˜66˜&R"¬'˜7E˜66˜&R"¬&÷Ö˜66˜&R%“¿¢v÷U˜66˜&W3¢≤'7GVFVÁEˆ6ˆFR"¬'∆ÂˆñB"¬&7FófóGïˆ∂Wí"¬&GFV◊EˆÊÚ"¬'66˜&R"¬&÷Ö˜66˜&R"¬&Á7vW'2"¬&ñÁ7G'V÷VÁE˜fW'6ñˆ‚"¬&6ˆ◊∆WFVEˆB%“¿¢6Fó6f7FñˆÂ˜&W7ˆÁ6W3¢≤'7GVFVÁEˆ6ˆFR"¬'&FñÊw2"¬&6ˆ÷÷VÁB"¬&6ˆ◊∆WFVEˆB%“¿¢6W76ñˆÂˆ7FófóGï˜&W7V«G3¢≤'6˜W&6U˜6W76ñˆÂˆ∂Wí"¬'&ˆˆ’ˆ6ˆFR"¬'∆ÂˆñB"¬&˜VÊVEˆB"¬'7GVFVÁEˆ6ˆFR"¬&7FófóFñW5ˆ6ˆ◊∆WFVB"¬&7FófóGïˆ6˜VÁB"¬&fó'7EˆfW&vR"¬&&W7EˆfW&vR%“¿¢“¿¢76W76÷VÁE˜66˜&W3¢µ“¿¢v÷U˜66˜&W3¢µ“¿¢6Fó6f7FñˆÂ˜&W7ˆÁ6W3¢µ“¿¢6W76ñˆÂˆ7FófóGï˜&W7V«G3¢µ“¿¢“¬&V◊Gí◊FV◊∆FR"ì∞¢Fˆ7BÇ.âNã.ä~âûòŒò.äæä^âNòäòéòâÆâ¢5¬ä~òéã.à~òä^òûär"¬'7V66W72"ì∞ß–†¶gVÊ7Fñˆ‚'6U66˜&U7ƒ&6∑WáFWáBí∞¢6ˆÁ7B÷F6Ç“FWáBÊ÷F6ÇÇÚ““%ı44ı$UÙ$4µUÙ•4ÙÂÙ$TtîÂ«2•∆‚Öµ«5≈5“£Úï∆‚““%ı44ı$UÙ$4µUÙ•4ÙÂÙT‰BÚì∞¢ñbÇ÷F6ÇíFá&˜rÊWrW'&˜"Ç.òNäòéâÓâ¢÷&∂W"à.äﬁà~àÆãéâNäÆã>ä>äﬁàr""ì∞¢6ˆÁ7Bñ∆ˆB“•4Ù‚Á'6RÜ÷F6Ö≥“ì∞¢6ˆÁ7Bc“ñ∆ˆCÚÁ66ÜV÷””“'%˜66˜&Uˆ&6∑W˜c"bb'&íÊó4'&íáñ∆ˆBÁ&V6˜&G2ì∞¢6ˆÁ7Bc"“ñ∆ˆCÚÁ66ÜV÷””“'%ˆgV∆≈˜&W˜'Eˆ&6∑W˜c" ¢bb'&íÊó4'&íáñ∆ˆBÊ76W76÷VÁE˜66˜&W2íbb'&íÊó4'&íáñ∆ˆBÊv÷U˜66˜&W2ê¢bb'&íÊó4'&íáñ∆ˆBÁ6Fó6f7FñˆÂ˜&W7ˆÁ6W2ê¢bbáñ∆ˆBÁ6W76ñˆÂˆ7FófóGï˜&W7V«G2””“VÊFVfñÊVB«¬'&íÊó4'&íáñ∆ˆBÁ6W76ñˆÂˆ7FófóGï˜&W7V«G2íì∞¢ñbÇcbbc"íFá&˜rÊWrW'&˜"Ç.ä>ãéòéâûàÆãéâNäÆã>ä>äﬁà~òNäòéânãûàâ^òûäﬁàr"ì∞¢ñbác"bbñ∆ˆBÁ6W76ñˆÂˆ7FófóGï˜&W7V«G2””“VÊFVfñÊVBíñ∆ˆBÁ6W76ñˆÂˆ7FófóGï˜&W7V«G2“µ”∞¢6ˆÁ7BF˜F¬“cÚñ∆ˆBÁ&V6˜&G2Ê∆VÊwFÇ¢ñ∆ˆBÊ76W76÷VÁE˜66˜&W2Ê∆VÊwFÇ≤ñ∆ˆBÊv÷U˜66˜&W2Ê∆VÊwFÇ≤ñ∆ˆBÁ6Fó6f7FñˆÂ˜&W7ˆÁ6W2Ê∆VÊwFÇ≤ñ∆ˆBÁ6W76ñˆÂˆ7FófóGï˜&W7V«G2Ê∆VÊwFÉ∞¢ñbáF˜F¬‚SíFá&˜rÊWrW'&˜"Ç.àéã>âûä~âûä>ã.ä.àã.ä>òàãNâíR√ä>ã.ä.àã.ä2"ì∞¢&WGW&‚ñ∆ˆC∞ß–†¶7ñÊ2gVÊ7Fñˆ‚ñ◊˜'E66˜&U7ƒ&6∑WÇí∞¢6ˆÁ7B6∆74ñB“7FFRÁ6W76ñˆ„ÚÊ6∆75ˆñB«¬BÇ"66∆756V∆V7B"ìÚÁf«VS∞¢ñbÇ6∆74ñBí&WGW&‚Fˆ7BÇ.àä>ãéâ>ã.òä^ã~äﬁàäæòûäﬁà~òä>ã^ä.âí"¬'v&ÊñÊr"ì∞¢6ˆÁ7BñÁWB“Fˆ7V÷VÁBÊ7&VFTV∆V÷VÁBÇ&ñÁWB"ì∞¢ñÁWBÁGóR“&fñ∆R#∞¢ñÁWBÊ66WB“"Á7¬«FWáB˜∆ñ‚∆∆ñ6Fñˆ‚˜7¬#∞¢ñÁWBÊFDWfVÁD∆ó7FVÊW"Ç&6ÜÊvR"¬7ñÊ2Çí”‚∞¢6ˆÁ7Bfñ∆R“ñÁWBÊfñ∆W3ÚÂ≥”∞¢ñbÇfñ∆Rí&WGW&„∞¢G'í∞¢6ˆÁ7Bñ∆ˆB“'6U66˜&U7ƒ&6∑WÜvóBfñ∆RÁFWáBÇíì∞¢6ˆÁ7Bv÷W2“ñ∆ˆBÊv÷U˜66˜&W2«¬ñ∆ˆBÁ&V6˜&G2«¬µ”∞¢6ˆÁ7B76W76÷VÁG2“ñ∆ˆBÊ76W76÷VÁE˜66˜&W2«¬µ”∞¢6ˆÁ7B6Fó6f7Fñˆ‚“ñ∆ˆBÁ6Fó6f7FñˆÂ˜&W7ˆÁ6W2«¬µ”∞¢6ˆÁ7B6W76ñˆÁ2“ñ∆ˆBÁ6W76ñˆÂˆ7FófóGï˜&W7V«G2«¬µ”∞¢6ˆÁ7B∆≈&V6˜&G2“≤‚‚Êv÷W2¬‚‚Ê76W76÷VÁG2¬‚‚Á6Fó6f7Fñˆ‚¬‚‚Á6W76ñˆÁ5”∞¢6ˆÁ7B7GVFVÁG2“ÊWr6WBÜ∆≈&V6˜&G2Ê÷ÜóFV“”‚óFV“Á7GVFVÁEˆ6ˆFRíÊfñ«FW"Ñ&ˆˆ∆V‚ííÁ6ó¶S∞¢6ˆÁ7B∆Á2“ÊWr6WBÜv÷W2Ê÷ÜóFV“”‚óFV“Á∆ÂˆñBíÊfñ«FW"Ñ&ˆˆ∆V‚ííÁ6ó¶S∞¢6ˆÁ7B6∂ñ∆ƒóFV◊2“v÷W2Á&VGV6RÇá7V“¬óFV“í”‚7V“≤Ñ'&íÊó4'&íÜóFV“ÊÁ7vW'2íÚóFV“ÊÁ7vW'2Êfñ«FW"ÜÁ7vW"”‚Á7vW#ÚÁ6∂ñ∆≈ˆ6ˆFRíÊ∆VÊwFÇ¢í¬ì∞¢6ˆÁ7B66WFVB“vñÊF˜rÊ6ˆÊfó&“Ö∞¢.â^ä>ä~àéâÓâÆàÆãéâNäÆã>ä>äﬁà~àNãòâûâí""¿¢äæòûäﬁà~â^òûâûâ~ã.às¢G∑ñ∆ˆBÊ6∆75ˆ∆&V¬«¬ñ∆ˆBÊ6∆75ˆñB«¬.(	B'÷¿¢âûãàòä>ã^ä.âì¢G∑7GVFVÁG7“àNâñ¿¢àòéäﬁâûòä>ã^ä.âû(	>äæä^ãà~òä>ã^ä.âì¢G∂76W76÷VÁG2Ê∆VÊwFá“àNâñ¿¢àNãòâûâûòàä¢G∂v÷W2Ê∆VÊwFá“ä>ã.ä.àã.ä6¿¢àNä~ã.äâÓãnà~âÓäﬁò>àÉ¢G∑6Fó6f7Fñˆ‚Ê∆VÊwFá“àNâñ¿¢âŒä^àãNàéàä>ä>ää>ã.ä.àNã.â£¢G∑6W76ñˆÁ2Ê∆VÊwFá“ä>ã.ä.àã.ä6¿¢òâŒâûâ~ã^òéâÓâ£¢G∑∆Á7“ÛÜ¿¢àNã>â^äﬁâÆâ~ã^òéäã^âæòûã.ä.â~ãàäûã¢G∑6∂ñ∆ƒóFV◊7“à.òûä÷¿¢""¿¢.ä.ã~âûä.ãâûâûã>òà.òûã.òNâæä.ãà~äæòûäﬁà~â~ã^òéàã>ä^ãà~òä^ã~äﬁàäæä>ã~äﬁòNäòÉÚà.òûäﬁäãûä^ä>äæãäÆâûãàòä>ã^ä.âí˛òâŒâí˛òàäâ~ã^òéòNäòéâ^ä>à~àéãânãûàà.òûã.ä"¿¢“Ê¶ˆñ‚Ç%∆‚"íì∞¢ñbÇ66WFVBí&WGW&„∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6RÁ'2Ç&ñ◊˜'E˜%˜66˜&Uˆ&6∑W"¬≤ˆ6∆75ˆñC¢6∆74ñB¬˜ñ∆ˆC¢ñ∆ˆB“ì∞¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢Fˆ7BÜâûã>òà.òûã.òä^òûäs¢àòéäﬁâû(	>äæä^ãàrG¥ÁV÷&W"ÜFFÚÊ76W76÷VÁEˆñ◊˜'FVB«¬ó“+ròàäG¥ÁV÷&W"ÜFFÚÊv÷Uˆñ◊˜'FVBÛÚFFÚÊñ◊˜'FVBÛÚó“+ràNä~ã.äâÓãnà~âÓäﬁò>àÇG¥ÁV÷&W"ÜFFÚÁ6Fó6f7FñˆÂˆñ◊˜'FVB«¬ó“+rä>ã.ä.àNã.â¢G¥ÁV÷&W"ÜFFÚÁ6W76ñˆÂ˜&W7V«G5ˆñ◊˜'FVB«¬ó“+rà.òûã.äG¥ÁV÷&W"ÜFFÚÁ6∂óVB«¬ó÷¬'7V66W72"ì∞¢vóB∆ˆD76W76÷VÁE&W˜'BÇì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÁv&‚Ç.âûã>òà.òûã.àÆãéâNäÆã>ä>äﬁà~àNãòâûâûòNäòéäÆã>òä>ò~àÇ"¬W'&˜#ÚÊ÷W76vR«¬W'&˜"ì∞¢Fˆ7BÜâûã>òà.òûã.òNäòéòNâNòì¢G∂W'&˜#ÚÊ÷W76vR«¬.òNâ˛ä^òŒòNäòéânãûàâ^òûäﬁàr'÷¬&W'&˜""ì∞¢–¢“¬≤ˆÊ6S¢G'VR“ì∞¢ñÁWBÊ6∆ñ6≤Çì∞ß–†¶gVÊ7Fñˆ‚&ñÊE&W6V&6Ö&W˜'D7FñˆÁ2Çí∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÁVW'ï6V∆V7F˜$∆¬Ç%∂FF÷Wá˜'B÷76W76÷VÁE“"íÊf˜$V6ÇÜ'WGFˆ‚”‚'WGFˆ‚ÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚Wá˜'D76W76÷VÁE&W˜'BÜ'WGFˆ‚ÊFF6WBÊWá˜'D76W76÷VÁBííì∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÁVW'ï6V∆V7F˜"Ç%∂FF÷Wá˜'B◊6Fó6f7FñˆÂ“"ìÚÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Wá˜'E6Fó6f7FñˆÂ&W˜'Bì∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÁVW'ï6V∆V7F˜"Ç%∂FF÷Wá˜'B÷v÷R÷∆ñvÊ÷VÁE“"ìÚÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Wá˜'Dv÷T∆ñvÊ÷VÁE&W˜'Bì∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÁVW'ï6V∆V7F˜"Ç%∂FF÷Wá˜'B◊66˜&R◊7≈“"ìÚÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Wá˜'E66˜&U7ƒ&6∑Wì∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÁVW'ï6V∆V7F˜"Ç%∂FF÷Wá˜'B÷V◊Gí◊66˜&R◊7≈“"ìÚÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Wá˜'DV◊Gï66˜&U7≈FV◊∆FRì∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÁVW'ï6V∆V7F˜"Ç%∂FF÷ñ◊˜'B◊66˜&R◊7≈“"ìÚÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬ñ◊˜'E66˜&U7ƒ&6∑Wì∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÁVW'ï6V∆V7F˜"Ç%∂FF÷6∆V"÷ñ◊˜'FVB÷v÷R◊66˜&W5“"ìÚÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬WfVÁB”‚6∆V$ñ◊˜'FVDv÷U66˜&W2ÜWfVÁBÊ7W'&VÁEF&vWBíì∞ß–†¶gVÊ7Fñˆ‚&VÊFW%&W˜'BÇí∞¢6ˆÁ7B∆V&ÊñÊu&W˜'G2“6W76ñˆÂ&V6˜&G566˜&W2Çê¢ÚG∑&VÊFW$76W76÷VÁE&W6V&6Ö&W˜'BÇó“G∑&VÊFW$v÷T76W76÷VÁE&W˜'BÇó“G∑&VÊFW%6W76ñˆ‰7FófóGï&W˜'BÇó“G∑&VÊFW%6Fó6f7FñˆÂ&W6V&6Ö&W˜'BÇó÷ ¢¢«6∆73“&f∆˜r◊66˜&R◊&V6˜&FñÊr÷Ê˜Fñ6R#Ô	˙z¢àNã.âÆâ^ä>ä~àéäÆã~òéäﬁòNäòéâÆãâûâ~ãnààNãòâûâíàéãnà~òNäòéäã^ä>ã.ä.à~ã.âûä~ãNàéãä.ò>äæòûäÆòéà~äﬁäﬁà¬˜Ê∞¢ñbÇ7FFRÁ6W76ñˆ‚í∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÊñÊÊW$ÖD‘¬“∆V&ÊñÊu&W˜'G3∞¢&ñÊE&W6V&6Ö&W˜'D7FñˆÁ2Çì∞¢&WGW&„∞¢–¢ñbÜó476W76÷VÁE6W76ñˆ‚á7FFRÁ6W76ñˆ‚íí∞¢BÇ"7&W˜'D6ˆÁFVÁB"íÊñÊÊW$ÖD‘¬“∆V&ÊñÊu&W˜'G3∞¢&ñÊE&W6V&6Ö&W˜'D7FñˆÁ2Çì∞¢&WGW&„∞¢–¢BÇ"7&W˜'D6ˆÁFVÁB"íÊñÊÊW$ÖD‘¬“∆V&ÊñÊu&W˜'G3∞¢&ñÊE&W6V&6Ö&W˜'D7FñˆÁ2Çì∞ß–†¶gVÊ7Fñˆ‚Wá˜'D7W'&VÁE&W˜'BÇí∞¢ñbÇ7FFRÁ6W76ñˆ‚í&WGW&‚Fˆ7BÇ.ä.ãà~òNäòéäã^àNã.âÆòä>ã^ä.âûò>äæòûäÆòéà~äﬁäﬁà"¬'v&ÊñÊr"ì∞¢ñbá7FFRÁ6W76ñˆ‚Ê76W76÷VÁE˜Ü6R””“'6Fó6f7Fñˆ‚"í&WGW&‚Wá˜'E6Fó6f7FñˆÂ&W˜'BÇì∞¢ñbÜó476W76÷VÁE6W76ñˆ‚á7FFRÁ6W76ñˆ‚íí&WGW&‚Wá˜'D76W76÷VÁE&W˜'BÇ&ñÊFófñGV¬"ì∞¢ñbÇ6W76ñˆÂ&V6˜&G566˜&W2Çíí&WGW&‚Fˆ7BÇ.àNãòâûâûäÆâNà.äﬁà~àNã.âÆâ^ä>ä~àéäÆã~òéäﬁòNäòéäÆã.äã.ä>ânäÆòéà~äﬁäﬁàä>ã.ä.à~ã.âûòNâNòí"¬'v&ÊñÊr"ì∞¢6ˆÁ7B&˜w2“µ≤.äæòûäﬁàr"¬.òä^à.âæä>ãàéã>â^ãär"¬.àÆã~òéä“ﬁâûã.ääÆàãéäR"¬.àÆã~òéäﬁòä^òéâí"¬.àãNàéàä>ä>ä"¬.àNä>ãòûà~â~ã^òÇ"¬.àNãòâûâí"¬.àNãòâûâûòâ^ò~ä"¬.ä>òûäﬁä.ä^ã"¬.âŒòéã.âí"¬.òä~ä^ã"%’”∞¢7FFRÊGFV◊G2Êf˜$V6ÇÜGFV◊B”‚∞¢6ˆÁ7B∆ñW"“7FFRÁ∆ñW'2ÊfñÊBÜóFV“”‚óFV“ÊñB””“GFV◊BÁ6W76ñˆÂ˜∆ñW%ˆñBì∞¢6ˆÁ7B7GVFVÁB“∆ñW#ÚÁ7GVFVÁB«¬∑”∞¢&˜w2ÁW6ÇÖ∞¢7FFRÊ6∆76W2ÊfñÊBÜóFV“”‚óFV“ÊñB””“7FFRÁ6W76ñˆ‚Ê6∆75ˆñBìÚÊ∆&V¬«¬""¿¢7GVFVÁBÁ7GVFVÁEˆ6ˆFR¬7GVFVÁBÊgV∆≈ˆÊ÷R¬7GVFVÁBÊÊñ6∂Ê÷R¿¢7FófóGîf˜$∂WíÜGFV◊BÊ7FófóGïˆ∂Wí¬7FFRÁ6W76ñˆ‚Á∆ÂˆñBìÚÁFóF∆R«¬GFV◊BÊ7FófóGïˆ∂Wí¿¢GFV◊BÊGFV◊EˆÊÚ¬GFV◊BÁ66˜&R¬GFV◊BÊ÷Ö˜66˜&R¬GFV◊BÁW&6VÁB¿¢GFV◊BÁ76VBÚ.âŒòéã.âí"¢.òNäòéâŒòéã.âí"¬GFV◊BÊ6ˆ◊∆WFVEˆB¿¢“ì∞¢“ì∞¢F˜vÊ∆ˆD77bÜä>ã.ä.à~ã.âí“G∑7FFRÁ6W76ñˆ‚Á&ˆˆ’ˆ6ˆFW“Ê77f¬&˜w2ì∞ß–†¶gVÊ7Fñˆ‚7vóF6ÖÊV¬áÊVƒñBí∞¢BBÇ"6F6Ü&ˆ&DÊb'WGFˆ‚"íÊf˜$V6ÇÜ'WGFˆ‚”‚'WGFˆ‚Ê6∆74∆ó7BÁFˆvv∆RÇ&7FófR"¬'WGFˆ‚ÊFF6WBÁÊV¬””“ÊVƒñBíì∞¢BBÇ"ÊF6Ü&ˆ&B◊ÊV¬"íÊf˜$V6ÇáÊV¬”‚ÊV¬Ê6∆74∆ó7BÁFˆvv∆RÇ&7FófR"¬ÊV¬ÊñB””“ÊVƒñBíì∞¢ñbáÊVƒñB””“'7GVFVÁE67&VVÁ5ÊV¬"í∞¢7FFRÁ7GVFVÁE67&VVÂfñWr“&w&ñB#∞¢7F˜7GVFVÁE67&VVÂvF6ÇÇì∞¢&VÊFW%7GVFVÁE67&VVÁ2Çì∞¢“V«6R7F˜7GVFVÁE67&VVÂvF6ÇÇì∞¢ñbáÊVƒñB””“'&W˜'G5ÊV¬"bb6W76ñˆÂ&V6˜&G566˜&W2ÇíífˆñB∆ˆD76W76÷VÁE&W˜'BÇì∞ß–†¢BÇ"7FV6ÜW$∆ˆvñ‰f˜&“"íÊFDWfVÁD∆ó7FVÊW"Ç'7V&÷óB"¬6ñv‰ñ‚ì∞¢BÇ"76ñv‰˜WD'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬6ñv‰˜WBì∞¢BÇ"76W76ñˆÂ6WGW"íÊFDWfVÁD∆ó7FVÊW"Ç'7V&÷óB"¬7&VFU6W76ñˆ‚ì∞¢BÇ"766Üˆˆ≈6V∆V7B"íÊFDWfVÁD∆ó7FVÊW"Ç&6ÜÊvR"¬WfVÁB”‚&VÊFW$6∆74˜FñˆÁ2ÜWfVÁBÁF&vWBÁf«VRíì∞¢BÇ"66∆756V∆V7B"íÊFDWfVÁD∆ó7FVÊW"Ç&6ÜÊvR"¬Çí”‚∞¢WFFU6V∆V7FVD6∆75&˜7FW$Ê˜FRÇì∞¢ñbÇBÇ"66∆756V∆V7B"íÁf«VRífˆñB∆ˆD76W76÷VÁE&W˜'BÇì∞ß“ì∞¢BÇ"766Üˆˆ≈6WGWf˜&“"íÊFDWfVÁD∆ó7FVÊW"Ç'7V&÷óB"¬6WGW66Üˆˆ¬ì∞¢BÇ"6÷ÁV≈7GVFVÁDf˜&“"íÊFDWfVÁD∆ó7FVÊW"Ç'7V&÷óB"¬FE7GVFVÁBì∞¢BÇ"677dfñ∆R"íÊFDWfVÁD∆ó7FVÊW"Ç&6ÜÊvR"¬ÜÊF∆Tñ◊˜'Dfñ∆Rì∞¢BÇ"6&˜fT∆ƒ'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬&˜fT∆¬ì∞¢BÇ"6∆ˆ&'ï¶ˆˆ‘˜WD'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚∞¢ñbá7FFRÊ∆ˆ&'ï¶ˆˆ’7FW√“í&WGW&„∞¢7FFRÊ∆ˆ&'ï¶ˆˆ’7FW”“∞¢7FFRÊ∆ˆ&'ïvR“∞¢&VÊFW%∆ñW%vRÇì∞ß“ì∞¢BÇ"6∆ˆ&'ï¶ˆˆ‘ñ‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚∞¢6ˆÁ7BfñWr“∆ˆ&'ïfñWrÇì∞¢ñbáfñWrÊ∆WfVƒñÊFWÇ„“ƒÙ$%ïÙƒîıUE2Ê∆VÊwFÇ“í&WGW&„∞¢7FFRÊ∆ˆ&'ï¶ˆˆ’7FW≥“∞¢7FFRÊ∆ˆ&'ïvR“∞¢&VÊFW%∆ñW%vRÇì∞ß“ì∞¢BÇ"6∆ˆ&'ï&WevT'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚∞¢7FFRÊ∆ˆ&'ïvR“÷FÇÊ÷ÇÉ¬7FFRÊ∆ˆ&'ïvR“ì∞¢&VÊFW%∆ñW%vRÇì∞¢BÇ"7∆ñW$∆ó7B"íÁ67&ˆ∆ƒñÁFıfñWrá≤&VÜfñ˜#¢'6÷ˆ˜FÇ"¬&∆ˆ6≥¢&ÊV&W7B"“ì∞ß“ì∞¢BÇ"6∆ˆ&'îÊWáEvT'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚∞¢7FFRÊ∆ˆ&'ïvR“÷FÇÊ÷ñ‚Ü∆ˆ&'ïfñWrÇíÁvT6˜VÁB¬7FFRÊ∆ˆ&'ïvR≤ì∞¢&VÊFW%∆ñW%vRÇì∞¢BÇ"7∆ñW$∆ó7B"íÁ67&ˆ∆ƒñÁFıfñWrá≤&VÜfñ˜#¢'6÷ˆ˜FÇ"¬&∆ˆ6≥¢&ÊV&W7B"“ì∞ß“ì∞¢BÇ"7W6U6W76ñˆ‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Fˆvv∆UW6Rì∞¢BÇ"6˜V‰∆FT¶ˆñ‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬˜V‰∆FT¶ˆñ‚ì∞¢BÇ"66∆˜6U6W76ñˆ‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬6∆˜6U6W76ñˆ‚ì∞¢BÇ"7$6∆˜6T'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬6∆˜6U6W76ñˆ‚ì∞¢BÇ"7$ÊWáD'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6WEFV6ÜW$f∆˜u7FWÇ&∆ˆ&'í"íì∞¢BÇ"6∆ˆ&'î&6¥'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬ÜÊF∆T∆ˆ&'î&6≤ì∞¢BÇ"6∆ˆ&'îÊWáD'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬ÜÊF∆T∆ˆ&'îÊWáBì∞¢BÇ"7∆‰&6¥'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6WEFV6ÜW$f∆˜u7FWÇ&∆ˆ&'í"íì∞¢BBÇu∂FF÷76W76÷VÁB◊Ü6U“ríÊf˜$V6ÇÜ'WGFˆ‚”‚'WGFˆ‚ÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6V∆V7D76W76÷VÁBÜ'WGFˆ‚ÊFF6WBÊ76W76÷VÁEÜ6Rííì∞¢BÇ"77F'E∆‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬7F'E6V∆V7FVE∆‚ì∞¢BÇ"6fñÊó6Ñ7FófóGî'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚fñÊó6Ñ7FófóGíÇ&÷ÁV¬"íì∞¢BÇ"7&Wfñ˜W4∆W76ˆÂ7FW'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬vıFı&Wfñ˜W4∆W76ˆÂ7FWì∞¢BÇ"7&W7F'D∆W76ˆÂFñ÷W$'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬&W7F'D∆W76ˆÂFñ÷W"ì∞¢BÇ"76Ü&T∆W76ˆÂFı7GVFVÁG2"íÊFDWfVÁD∆ó7FVÊW"Ç&6ÜÊvR"¬WfVÁB”‚6WD∆W76ˆÂ7GVFVÁEfó6ñ&ñ∆óGíÜWfVÁBÁF&vWBÊ6ÜV6∂VBíì∞¢BÇ"6ÊWáD7FófóGî'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬vıFÙÊWáD7FófóGíì∞¢BÇ"66ˆ◊WFóFñˆ‰gV∆«67&VV‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Fˆvv∆T6ˆ◊WFóFñˆ‰WáÊFVBì∞¢BÇ"7Fˆvv∆UFV6ÜW$Ê˜FW4'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Fˆvv∆UFV6ÜW$Ê˜FW2ì∞¢BÇ"66ˆ◊WFóFñˆÂ6˜VÊD'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Fˆvv∆T6ˆ◊WFóFñˆÂ6˜VÊBì∞¢BÇ"6∆ófU&Ê∂ñÊtVÊ&∆VB"íÊFDWfVÁD∆ó7FVÊW"Ç&6ÜÊvR"¬WfVÁB”‚≤7FFRÊ∆ófU&Ê∂ñÊtVÊ&∆VB“WfVÁBÁF&vWBÊ6ÜV6∂VC≤&VÊFW$∆ófU&W7V«G2Çì≤'&ˆF67DFó7∆íÇ'&Ê∂ñÊr◊fó6ñ&ñ∆óGí÷6ÜÊvVB"ì≤“ì∞¢BBÇu∂FF÷∆ófR÷÷ˆFU“ríÊf˜$V6ÇÜ'WGFˆ‚”‚'WGFˆ‚ÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6WD∆ófU∆î÷ˆFRÜ'WGFˆ‚ÊFF6WBÊ∆ófT÷ˆFRííì∞¢BÇ"76Ü˜u7V÷÷'î'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬6Ü˜u6W76ñˆÂ7V÷÷'íì∞¢BÇ"77V÷÷'î&6¥'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6WEFV6ÜW$f∆˜u7FWÇ&∆ófR"íì∞¢BÇ"77V÷÷'îWá˜'D'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Wá˜'D7W'&VÁE&W˜'Bì∞¢BÇ"7&W7V÷U6W76ñˆ‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6Ü˜t∆ófU6W76ñˆ‚á7FFRÁ6W76ñˆ‚Á7FGW2””“&∆ˆ&'í"Úá7FFRÁ6W76ñˆ‚Ê7W'&VÁEˆ7FófóGïˆ∂WíÚ&∆ˆ&'í"¢'""í¢&∆ófR"íì∞¢BÇ"7&W7V÷U7V÷÷'î'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6Ü˜t∆ófU6W76ñˆ‚Ç'7V÷÷'í"íì∞¢BÇ"7&W7F'E6W76ñˆ‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬6∆˜6U6W76ñˆ‚ì∞¢BÇ"66˜ï&ˆˆ‘6ˆFR"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬7ñÊ2Çí”‚≤vóBÊfñvF˜"Ê6∆ó&ˆ&BÁw&óFUFWáBá7FFRÁ6W76ñˆ‚Á&ˆˆ’ˆ6ˆFRì≤Fˆ7BÇ.àNãâNä^äﬁàä>äæãäÆäæòûäﬁà~òä^òûär"¬'7V66W72"ì≤“ì∞¢BÇ"66˜ï7GVFVÁD∆ñÊ≤"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬7ñÊ2Çí”‚≤vóBÊfñvF˜"Ê6∆ó&ˆ&BÁw&óFUFWáBá7GVFVÁD¶ˆñÂW&¬Çíì≤Fˆ7BÇ.àNãâNä^äﬁàä^ãNà~àòŒâûãàòä>ã^ä.âûòä^òûär"¬'7V66W72"ì≤“ì∞¢BÇ"7&WGW&‰f˜&“"íÊFDWfVÁD∆ó7FVÊW"Ç'7V&÷óB"¬&WGW&Â∆ñW"ì∞¢BÇ"66Ê6V≈&WGW&‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚ÜñFRÇBÇ"7&WGW&‰Fñ∆ˆr"ííì∞¢BÇ"6Wá˜'D77d'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Wá˜'D7W'&VÁE&W˜'Bì∞¢BÇ"6&6µFı6W76ñˆ‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚7vóF6ÖÊV¬Ç'6W76ñˆÂÊV¬"íì∞¢BÇ"77GVFVÁE67&VVÁ4w&ñD'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6WE7GVFVÁE67&VVÂfñWrÇ&w&ñB"íì∞¢BÇ"77GVFVÁE67&VVÁ4fˆ7W4'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚∞¢6WE7GVFVÁE67&VVÂfñWrÇ&fˆ7W2"ì∞¢&WVW7DÊñ÷Fñˆ‰g&÷RÜ˜VÂ7GVFVÁE67&VV‰gV∆«67&VV‚ì∞ß“ì∞¢BÇ"77GVFVÁE67&VV‰&6µFÙw&ñB"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚6WE7GVFVÁE67&VVÂfñWrÇ&w&ñB"íì∞¢BÇ"77GVFVÁE67&VVÂ&Wfñ˜W2"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚÷˜fU7GVFVÁE67&VV‚Ç”íì∞¢BÇ"77GVFVÁE67&VV‰ÊWáB"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚÷˜fU7GVFVÁE67&VV‚Éíì∞¢BÇ"77GVFVÁE67&VV‰gV∆«67&VV‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬˜VÂ7GVFVÁE67&VV‰gV∆«67&VV‚ì∞¶Fˆ7V÷VÁBÊFDWfVÁD∆ó7FVÊW"Ç&gV∆«67&VVÊ6ÜÊvR"¬Çí”‚∞¢ñbÇFˆ7V÷VÁBÊgV∆«67&VV‰V∆V÷VÁBíBÇ"77GVFVÁE67&VV‰fˆ7W2"ìÚÊ6∆74∆ó7BÁ&V÷˜fRÇ'7GVFVÁB◊67&VV‚÷gV∆¬◊vñÊF˜r"ì∞ß“ì∞¶Fˆ7V÷VÁBÊFDWfVÁD∆ó7FVÊW"Ç&∂WñF˜v‚"¬WfVÁB”‚∞¢ñbÜWfVÁBÊ∂Wí””“$W66R"bbBÇ"77GVFVÁE67&VV‰fˆ7W2"ìÚÊ6∆74∆ó7BÊ6ˆÁFñÁ2Ç'7GVFVÁB◊67&VV‚÷gV∆¬◊vñÊF˜r"íí6WE7GVFVÁE67&VVÂfñWrÇ&w&ñB"ì∞ß“ì∞¢BÇ"6ÊWu6W76ñˆ‰'WGFˆ‚"íÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚≤ñbá7FFRÁ6W76ñˆ‚íFˆ7BÇ.âæãNâNàNã.âÆâæãàéàéãéâÆãâûàòéäﬁâûòâæãNâNàNã.âÆò>äæäòÇ"¬'v&ÊñÊr"ì≤V«6R≤6Ü˜rÇBÇ"76W76ñˆÂ6WGW"íì≤BÇ"76W76ñˆÂ6WGW"íÁ67&ˆ∆ƒñÁFıfñWrá≤&VÜfñ˜#¢'6÷ˆ˜FÇ"“ì≤““ì∞¢BÇ"6GFV◊D÷ˆFR"íÊFDWfVÁD∆ó7FVÊW"Ç&6ÜÊvR"¬WfVÁB”‚≤BÇ"6÷ÑGFV◊G2"íÊFó6&∆VB“WfVÁBÁF&vWBÁf«VR”“&∆ñ÷óFVB#≤ñbÜWfVÁBÁF&vWBÁf«VR””“'6ñÊv∆R"íBÇ"6÷ÑGFV◊G2"íÁf«VR“≤“ì∞¢BBÇr6F6Ü&ˆ&DÊb'WGFˆ‚ríÊf˜$V6ÇÜ'WGFˆ‚”‚'WGFˆ‚ÊFDWfVÁD∆ó7FVÊW"Ç&6∆ñ6≤"¬Çí”‚7vóF6ÖÊV¬Ü'WGFˆ‚ÊFF6WBÁÊV¬ííì∞ßvñÊF˜rÊFDWfVÁD∆ó7FVÊW"Ç&ˆÊ∆ñÊR"¬6ˆÊÊV7FñˆÂWFFRì∞ßvñÊF˜rÊFDWfVÁD∆ó7FVÊW"Ç&ˆff∆ñÊR"¬6ˆÊÊV7FñˆÂWFFRì∞ßvñÊF˜rÊFDWfVÁD∆ó7FVÊW"Ç&∂WñF˜v‚"¬WfVÁB”‚∞¢ñbÜWfVÁBÊ∂Wí””“$W66R"bbBÇ"6∆W76ˆÂ7FWÊV¬"ìÚÊ6∆74∆ó7BÊ6ˆÁFñÁ2Ç&6∆77&ˆˆ“◊7FvR÷WáÊFVB"ííFˆvv∆T6ˆ◊WFóFñˆ‰WáÊFVBÇì∞ß“ì∞¶∆WB∆ˆ&'ï&W6ó¶UFñ÷W#∞ßvñÊF˜rÊFDWfVÁD∆ó7FVÊW"Ç'&W6ó¶R"¬Çí”‚∞¢6∆V%Fñ÷V˜WBÜ∆ˆ&'ï&W6ó¶UFñ÷W"ì∞¢∆ˆ&'ï&W6ó¶UFñ÷W"“6WEFñ÷V˜WBÇÇí”‚∞¢ñbá7FFRÊf∆˜u7FW””“&∆ˆ&'í"í&VÊFW%∆ñW%vRÇì∞¢“¬#ì∞ß“ì∞¶&ˆ˜G7G&Çì∞†
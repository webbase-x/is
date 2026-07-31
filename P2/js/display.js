import { supabase, ensureAnonymousAuth } from "./supabase.js?v=20260726-plan1-teaching-flow-1";
import {
  $, activitiesForPlan, activityForKey, escapeHtml, EXPERT_SCOREBOARD_EVENT, EXPERT_SCOREBOARD_REQUEST_EVENT,
  GAME_STATE_EVENT, GAME_STATE_REQUEST_EVENT, gameStateChannelName, hide,
  roomCodeFromUrl, sanitizeGameMarkup, show, toast,
} from "./common.js?v=20260731-assessment-research-1";

const state = {
  roomCode: "",
  snapshot: null,
  broadcastChannel: null,
  presenceChannel: null,
  presenceKey: `display-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
  studentScreens: new Map(),
  studentScreenMarkupSignature: "",
  leaderboard: [],
  expertScoreboardSessionId: null,
  view: "screens",
  lessonStep: null,
  lessonTimer: null,
};

const activityMessages = {
  rhythm: "แตะเฉพาะคำแม่ ก กา ให้ตรงจังหวะ",
  wheel: "สังเกตเสียงท้ายคำ แล้วเลือกคำตอบ",
  sound: "ฟังให้ชัด แล้วสืบหาคำที่ไม่มีตัวสะกด",
  sort: "พาคำแต่ละคำกลับบ้านให้ถูกหลัง",
  train: "เรียงโบกี้คำให้เป็นประโยคที่สมบูรณ์",
  vote: "ช่วยกันสร้างประโยคและมอบหัวใจให้เพื่อน",
  exit: "ตอบให้ถูกอย่างน้อย 2 ใน 3 ข้อ เพื่อเปิดหีบสมบัติ",
  "mae-kong-box": "อ่านคำแล้วเลือกให้ถูกว่าเป็นคำมาตราแม่กงหรือไม่",
  "mae-kong-rocket": "อ่านโจทย์แล้วเลือกคำแม่กงเพื่อเติมจรวด",
  "mae-kong-exit": "ตอบแบบทดสอบท้ายคาบแม่กงให้ผ่านด่าน",
  "mae-kom-box": "อ่านคำแล้วเลือกให้ถูกว่าเป็นคำมาตราแม่กมหรือไม่",
  "picture-word": "ดูภาพและคำใบ้ แล้วเลือกคำมาตราแม่กมให้ถูกต้อง",
  "mae-kom-exit": "ตอบแบบทดสอบท้ายคาบแม่กมให้ผ่านด่าน",
  "yw-sort": "แยกคำลงกลุ่มแม่เกยหรือแม่เกอว",
  "picture-choice": "ดูภาพแล้วเลือกคำที่สะกดถูกต้อง",
  "cave-door": "เลือกคำมาตราแม่กกเพื่อเปิดประตูถ้ำ",
  "treasure-hunt": "เลือกคำมาตราแม่กดเพื่อเก็บสมบัติ",
  "island-supply": "เลือกคำมาตราแม่กบเพื่อเก็บเสบียง",
  "space-fuel": "เลือกคำมาตราแม่กนเพื่อเติมเชื้อเพลิง",
  "true-false": "วิเคราะห์ข้อความแล้วเลือกจริงหรือไม่จริง",
};

const screenStateMeta = {
  ready: { icon: "🗺️", label: "รอเริ่มเกม" },
  paused: { icon: "⏸️", label: "พักเกม" },
  result: { icon: "🏁", label: "ส่งผลแล้ว" },
  playing: { icon: "🎮", label: "กำลังเล่น" },
};

function modeLabel(mode) {
  return ({ practice: "ทดลอง", real: "รอบจริง", retry: "ทำซ้ำ", single: "รอบเดียว" })[mode] || "ทดลอง";
}

function setDisplayView(view) {
  state.view = view === "activity" ? "activity" : "screens";
  $("#displayViewSwitch")?.querySelectorAll("[data-display-view]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.displayView === state.view));
  });
  $("#displayActivityView").classList.toggle("hidden", state.view !== "activity");
  $("#displayScreensView").classList.toggle("hidden", state.view !== "screens");
}

async function connectDisplay(event) {
  event?.preventDefault();
  const code = String($("#displayRoomInput").value).replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) return;
  try {
    await ensureAnonymousAuth();
    state.roomCode = code;
    const found = await refreshBoard();
    if (!found) throw new Error("ไม่พบห้องเรียน หรือครูปิดคาบแล้ว");
    localStorage.setItem("thaiGameDisplayRoom", code);
    hide($("#displayJoinView"));
    show($("#displayBoard"));
    show($("#displayViewSwitch"));
    setDisplayView("screens");
    subscribeBroadcast();
    subscribePresence();
  } catch (error) {
    toast(error.message || "เชื่อมต่อจอไม่สำเร็จ", "error");
  }
}

async function refreshBoard() {
  if (!state.roomCode) return false;
  const previousSessionId = state.snapshot?.session_id;
  const [{ data: snapshots, error }, { data: leaderboard }] = await Promise.all([
    supabase.rpc("get_display_snapshot", { p_room_code: state.roomCode }),
    supabase.rpc("get_display_leaderboard", { p_room_code: state.roomCode }),
  ]);
  if (error || !snapshots?.length) {
    if (state.snapshot) showClosed();
    return false;
  }
  state.snapshot = snapshots[0];
  if (state.expertScoreboardSessionId !== state.snapshot.session_id) state.leaderboard = leaderboard || [];
  renderSnapshot(state.leaderboard);
  if (previousSessionId && previousSessionId !== state.snapshot.session_id) {
    subscribeBroadcast();
    subscribePresence();
  }
  return true;
}

function displayLessonCountdownMilliseconds() {
  const timer = state.lessonTimer;
  if (!timer) return null;
  const elapsed = timer.running ? Math.max(0, Date.now() - Number(timer.issued_at || Date.now())) : 0;
  return Math.max(0, Number(timer.remaining_ms || 0) - elapsed);
}

function displayLessonCountdownLabel() {
  const remaining = displayLessonCountdownMilliseconds();
  if (remaining === null) return "--:--";
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function updateDisplayLessonCountdown() {
  const wrap = $("#displayLessonCountdown");
  wrap?.classList.toggle("hidden", !state.lessonStep);
  document.querySelectorAll("[data-lesson-countdown]").forEach(element => {
    element.textContent = displayLessonCountdownLabel();
    element.classList.toggle("is-expired", displayLessonCountdownMilliseconds() === 0);
  });
}

function displayLessonDetailsMarkup(screen = {}) {
  if (screen.presentation === "video" && screen.videoId) {
    const videoId = String(screen.videoId).replace(/[^A-Za-z0-9_-]/g, "");
    if (videoId) {
      return `<div class="display-lesson-video">
        <iframe src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1" title="${escapeHtml(screen.title || "วิดีโอประกอบการสอน")}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>`;
    }
  }
  if (Array.isArray(screen.cards) && screen.cards.length) {
    if (screen.presentation === "flashcards") {
      const cardIndex = Math.min(screen.cards.length - 1, Math.max(0, Number(state.lessonStep?.card_index) || 0));
      const card = screen.cards[cardIndex];
      return `<div class="display-lesson-flashcard" aria-live="polite">
        <small>คำที่ ${cardIndex + 1} จาก ${screen.cards.length}</small>
        <strong>${escapeHtml(card.word || "")}</strong>
        <span>${escapeHtml(card.detail || "")}</span>
        <i style="--flashcard-progress:${((cardIndex + 1) / screen.cards.length) * 100}%"></i>
      </div>`;
    }
    return `<div class="display-lesson-card-grid">${screen.cards.map(card => `<article><strong>${escapeHtml(card.word || "")}</strong><small>${escapeHtml(card.detail || "")}</small></article>`).join("")}</div>`;
  }
  if (Array.isArray(screen.bullets) && screen.bullets.length) {
    return `<ul>${screen.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }
  return "";
}

function renderSnapshot(leaderboard) {
  const snapshot = state.snapshot;
  const activities = activitiesForPlan(snapshot.plan_id);
  const activity = activityForKey(snapshot.current_activity_key, snapshot.plan_id);
  const lesson = state.lessonStep;
  const showingResults = lesson?.kind === "results";
  const screen = lesson?.screen || {};
  const paused = snapshot.session_status === "paused";
  $("#displayRoomCode").textContent = snapshot.room_code;
  $("#displayClassName").textContent = `${snapshot.school_name} · ${snapshot.class_label}`;
  $("#displayStageStep").textContent = lesson
    ? `แผนที่ ${snapshot.plan_id} · ขั้นที่ ${lesson.stage} · ${lesson.kind === "game" ? "เกม" : showingResults ? "ประกาศผลการแข่งขัน" : "สื่อการสอน"}`
    : `แผนที่ ${snapshot.plan_id}${activity ? ` · ภารกิจ ${activities.findIndex(item => item.key === activity.key) + 1}/${activities.length}` : ""}`;
  $("#displayStageTitle").textContent = showingResults ? lesson.title : paused ? "พักกิจกรรมสักครู่" : screen.title || lesson?.title || activity?.title || "รอนักเรียนเข้าห้อง";
  $("#displayStageMessage").textContent = showingResults ? "ขอเสียงปรบมือให้ผู้เข้าแข่งขันทุกคน" : paused ? "ครูจะดำเนินการต่อเมื่อทุกคนพร้อม" : screen.message || activityMessages[activity?.key] || "เมื่อทุกคนพร้อม ครูจะเริ่มกิจกรรมแรก";
  $("#displayActivityVisual").innerHTML = `<span>${showingResults ? "🏆" : paused ? "⏸️" : screen.icon || lesson?.icon || activity?.icon || "🗺️"}</span>`;
  const details = $("#displayLessonDetails");
  const detailsMarkup = lesson ? displayLessonDetailsMarkup(screen) : "";
  details.classList.toggle("hidden", !detailsMarkup);
  details.innerHTML = detailsMarkup;
  const mediaWithoutLeaderboard = lesson?.kind === "media" && !lesson.show_leaderboard;
  $("#displayActivityView").classList.toggle("lesson-media-active", mediaWithoutLeaderboard);
  $("#displayApproved").textContent = snapshot.approved_count;
  const progress = snapshot.total_students ? Math.min(100, (snapshot.approved_count / snapshot.total_students) * 100) : 0;
  $("#displayProgressBar").style.width = `${progress}%`;
  const hideLiveRanking = snapshot.session_status === "active" && snapshot.live_ranking_enabled !== true;
  $(".leaderboard-panel")?.classList.toggle("hidden", mediaWithoutLeaderboard);
  if (!mediaWithoutLeaderboard) renderLeaderboard(hideLiveRanking ? [] : leaderboard, snapshot.leaderboard_mode, hideLiveRanking);
  updateDisplayLessonCountdown();
  renderStudentScreens();
}

function renderLeaderboard(items, mode, hideLiveRanking = false) {
  const list = $("#leaderboardList");
  if (hideLiveRanking) {
    $("#leaderboardTitle").textContent = "กำลังแข่งขัน";
    $("#leaderboardModeCaption").textContent = "ครูจะประกาศอันดับเมื่อจบกิจกรรม";
    list.innerHTML = `<li class="empty-leaderboard">ตั้งใจทำเกมให้เต็มที่นะ ⭐</li>`;
    return;
  }
  if (mode === "hidden") {
    $("#leaderboardTitle").textContent = "ความก้าวหน้าของทั้งห้อง";
    list.innerHTML = `<li class="empty-leaderboard">ครูเลือกซ่อนรายชื่อนักเรียนในคาบนี้</li>`;
    $("#leaderboardModeCaption").textContent = "ไม่แสดงรายชื่อและอันดับ";
    return;
  }
  $("#leaderboardTitle").textContent = "นักผจญภัยดาวเด่น";
  $("#leaderboardModeCaption").textContent = ({ nickname_avatar: "แสดงชื่อเล่นและอวตาร", real_name: "แสดงชื่อจริง", student_code: "แสดงรหัสนักเรียน" })[mode] || "";
  list.innerHTML = items.length
    ? items.map((item, index) => `<li><span class="rank">${index + 1}</span><strong>${escapeHtml(item.avatar || "⭐")} ${escapeHtml(item.display_name)}</strong><span class="score">${Number(item.total_score) || 0} ★</span></li>`).join("")
    : `<li class="empty-leaderboard">ยังไม่มีคะแนน</li>`;
}

function screenIdentity(screen, index) {
  if (state.snapshot?.leaderboard_mode === "hidden") return { name: `นักผจญภัย ${index + 1}`, avatar: "⭐" };
  return {
    name: String(screen.display_name || `นักเรียน ${index + 1}`).slice(0, 60),
    avatar: String(screen.avatar || "🙂").slice(0, 8),
  };
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
    // Presence is intentionally lightweight and does not contain the live
    // game markup. Never let it erase a newer broadcast frame.
    game_markup: incoming.game_markup || previous?.game_markup || "",
  };
}

function updateStudentScreenCard(card, screen, index) {
  if (!card) return;
  const identity = screenIdentity(screen, index);
  const screenState = screenStateMeta[screen.screen_state] ? screen.screen_state : "ready";
  card.dataset.screenState = screenState;
  const avatar = card.querySelector(".display-student-avatar");
  const name = card.querySelector("header div strong");
  if (avatar) avatar.textContent = identity.avatar;
  if (name) name.textContent = identity.name;
  const score = Math.max(0, Number(screen.score) || 0);
  const percent = Math.max(0, Math.min(100, Number(screen.progress_percent) || 0));
  const scoreElement = card.querySelector(".display-student-score");
  if (scoreElement) scoreElement.textContent = `${score} ⭐`;
  const progressElement = card.querySelector(".display-student-progress i");
  if (progressElement) progressElement.style.width = `${percent}%`;
  const footerText = card.querySelector("footer > span");
  if (footerText) footerText.textContent = screen.progress_text || `${Math.round(percent)}%`;
  const stage = card.querySelector(".display-student-stage");
  if (stage) {
    const activity = activityForKey(screen.activity_key, state.snapshot?.plan_id);
    const meta = screenStateMeta[screenState];
    stage.dataset.screenState = screenState;
    const small = stage.querySelector("small");
    const title = stage.querySelector("h2");
    const detail = stage.querySelector("p");
    if (small) small.textContent = screen.screen_label || meta.label;
    if (title) title.textContent = screen.activity_title || activity?.title || "";
    if (detail) detail.textContent = screen.detail || "";
  }
}

function renderStudentScreens() {
  const grid = $("#displayStudentScreens");
  if (!grid) return;
  const screens = [...state.studentScreens.values()].sort((a, b) => {
    const nameCompare = String(a.display_name || "").localeCompare(String(b.display_name || ""), "th");
    return nameCompare || String(a.player_id).localeCompare(String(b.player_id));
  });
  $("#displayOnlineCount").textContent = screens.length;
  const sanitizedMarkups = screens.map(screen => sanitizeGameMarkup(screen.game_markup));
  const markupSignature = screens.map((screen, index) => `${String(screen.player_id)}:${sanitizedMarkups[index]}`).join("\u0001");
  grid.classList.toggle("is-single", screens.length === 1);
  grid.classList.toggle("has-live-mirrors", sanitizedMarkups.some(Boolean));
  $("#displayScreensView").classList.toggle("is-single-screen", screens.length === 1 && Boolean(sanitizedMarkups[0]));
  if (!screens.length) {
    state.studentScreenMarkupSignature = "";
    grid.innerHTML = `<div class="display-students-empty"><span>📡</span><h2>กำลังรอนักเรียนออนไลน์</h2><p>เมื่อนักเรียนได้รับอนุมัติและเปิดหน้าเกม จอจะปรากฏที่นี่ทันที</p></div>`;
    return;
  }
  const existingCards = [...grid.querySelectorAll("[data-player-id]")];
  const sameCards = existingCards.length === screens.length
    && screens.every((screen, index) => existingCards[index]?.dataset.playerId === String(screen.player_id));
  const canPatchFrames = sameCards && screens.every((screen, index) => {
    const hasMarkup = Boolean(sanitizedMarkups[index]);
    const hasMirror = Boolean(existingCards[index]?.querySelector(".display-student-mirror-canvas"));
    return hasMarkup === hasMirror;
  });
  if (canPatchFrames) {
    state.studentScreenMarkupSignature = markupSignature;
    screens.forEach((screen, index) => {
      const card = existingCards[index];
      const frame = card.querySelector(".display-student-mirror-canvas");
      if (frame) {
        frame.style.setProperty("--game-zoom", Math.max(.75, Math.min(1.3, Number(screen.game_zoom) || 1)));
        const nextMarkup = sanitizedMarkups[index];
        if (frame.innerHTML !== nextMarkup) frame.innerHTML = nextMarkup;
      }
      updateStudentScreenCard(card, screen, index);
    });
    return;
  }
  state.studentScreenMarkupSignature = markupSignature;
  grid.innerHTML = screens.map((screen, index) => {
    const identity = screenIdentity(screen, index);
    const screenState = screenStateMeta[screen.screen_state] ? screen.screen_state : "ready";
    const meta = screenStateMeta[screenState];
    const activity = activityForKey(screen.activity_key, state.snapshot?.plan_id);
    const percent = Math.max(0, Math.min(100, Number(screen.progress_percent) || 0));
    const score = Math.max(0, Number(screen.score) || 0);
    const gameMarkup = sanitizedMarkups[index];
    const gameZoom = Math.max(.75, Math.min(1.3, Number(screen.game_zoom) || 1));
    const screenContent = gameMarkup
      ? `<div class="display-student-mirror"><div class="display-student-mirror-canvas game-canvas" style="--game-zoom:${gameZoom}">${gameMarkup}</div></div>`
      : `<div class="display-student-stage"><span class="display-student-icon">${activity?.icon || meta.icon}</span><small>${escapeHtml(screen.screen_label || meta.label)}</small><h2>${escapeHtml(screen.activity_title || activity?.title || "รอครูเริ่มกิจกรรม")}</h2><p>${escapeHtml(screen.detail || "กำลังเตรียมพร้อม")}</p></div>`;
    return `<article class="display-student-card${gameMarkup ? " has-live-mirror" : ""}" data-player-id="${escapeHtml(String(screen.player_id))}" data-screen-state="${screenState}">
      <header>
        <span class="display-student-avatar">${escapeHtml(identity.avatar)}</span>
        <div><strong>${escapeHtml(identity.name)}</strong><small><i></i> หน้าจอสด</small></div>
        <span class="display-student-score">${score} ★</span>
        <button class="display-student-fullscreen" type="button" data-display-fullscreen aria-label="เต็มจอ ${escapeHtml(identity.name)}" title="เต็มจอ">⛶</button>
      </header>
      ${screenContent}
      <footer>
        <div class="display-student-progress"><i style="width:${percent}%"></i></div>
        <span>${escapeHtml(screen.progress_text || `${Math.round(percent)}%`)}</span>
        <b>${escapeHtml(modeLabel(screen.mode))}</b>
      </footer>
    </article>`;
  }).join("");
}

function syncFullscreenButtons() {
  const activeCard = document.fullscreenElement?.closest?.(".display-student-card");
  document.querySelectorAll("[data-display-fullscreen]").forEach(button => {
    const isActive = activeCard && button.closest(".display-student-card") === activeCard;
    button.setAttribute("aria-pressed", String(Boolean(isActive)));
    button.textContent = isActive ? "×" : "⛶";
  });
}

function toggleStudentFullscreen(button) {
  const card = button.closest(".display-student-card");
  if (!card) return;
  if (card.classList.contains("display-card-fullscreen-fallback")) {
    card.classList.remove("display-card-fullscreen-fallback");
    syncFullscreenButtons();
    return;
  }
  if (document.fullscreenElement === card) {
    void document.exitFullscreen?.();
    return;
  }
  if (typeof card.requestFullscreen === "function") {
    card.requestFullscreen().catch(() => card.classList.add("display-card-fullscreen-fallback"));
  } else {
    card.classList.add("display-card-fullscreen-fallback");
  }
  syncFullscreenButtons();
}

function syncStudentPresence() {
  if (!state.presenceChannel) return;
  const latest = new Map([...state.studentScreens].filter(([, screen]) => {
    const timestamp = screenTimestamp(screen);
    return timestamp > 0 && Date.now() - timestamp < 15000;
  }));
  Object.values(state.presenceChannel.presenceState()).flat().forEach(screen => {
    if (screen.role !== "student" || !screen.player_id) return;
    const playerId = String(screen.player_id);
    const merged = mergeStudentScreen(latest.get(playerId), screen);
    if (merged) latest.set(playerId, merged);
  });
  state.studentScreens = latest;
  renderStudentScreens();
}

function receiveStudentScreen(message) {
  const screen = message?.payload || message;
  if (screen?.role !== "student" || !screen.player_id) return;
  const playerId = String(screen.player_id);
  const merged = mergeStudentScreen(state.studentScreens.get(playerId), screen);
  if (merged) state.studentScreens.set(playerId, merged);
  renderStudentScreens();
}

function receiveExpertScoreboard(message) {
  const update = message?.payload || message;
  if (!update || update.session_id !== state.snapshot?.session_id || !Array.isArray(update.leaderboard)) return;
  state.expertScoreboardSessionId = update.session_id;
  state.leaderboard = update.leaderboard;
  renderSnapshot(state.leaderboard);
}

function subscribeBroadcast() {
  state.broadcastChannel?.unsubscribe();
  state.broadcastChannel = supabase.channel(gameStateChannelName(state.snapshot.session_id))
    .on("broadcast", { event: GAME_STATE_EVENT }, message => {
      const update = message?.payload || message;
      const session = update?.session;
      if (!session || session.id !== state.snapshot?.session_id) return;
      const lessonChanged = update.lesson_step?.round_id && (
        update.lesson_step.round_id !== state.lessonStep?.round_id
        || update.lesson_step.card_index !== state.lessonStep?.card_index
      );
      state.snapshot = {
        ...state.snapshot,
        session_status: session.status,
        current_activity_key: session.current_activity_key,
        plan_id: session.plan_id,
        leaderboard_mode: session.leaderboard_mode,
        live_ranking_enabled: update.live_ranking_enabled !== false,
      };
      state.lessonStep = update.lesson_step || state.lessonStep;
      state.lessonTimer = update.lesson_timer || state.lessonTimer;
      if (lessonChanged) setDisplayView("activity");
      // Render the command immediately; refresh scores in the background.
      renderSnapshot(state.leaderboard);
      void refreshBoard();
    })
    .on("broadcast", { event: EXPERT_SCOREBOARD_EVENT }, receiveExpertScoreboard)
    .subscribe(status => {
      if (status === "SUBSCRIBED") {
        void state.broadcastChannel.send({
          type: "broadcast",
          event: GAME_STATE_REQUEST_EVENT,
          payload: { session_id: state.snapshot?.session_id, role: "display" },
        });
        void state.broadcastChannel.send({
          type: "broadcast",
          event: EXPERT_SCOREBOARD_REQUEST_EVENT,
          payload: { session_id: state.snapshot?.session_id },
        });
      }
      if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) void refreshBoard();
    });
}

function subscribePresence() {
  state.presenceChannel?.unsubscribe();
  state.studentScreens.clear();
  state.studentScreenMarkupSignature = "";
  state.expertScoreboardSessionId = null;
  renderStudentScreens();
  state.presenceChannel = supabase.channel(`classroom-${state.snapshot.session_id}`, {
    config: { presence: { key: state.presenceKey } },
  })
    .on("broadcast", { event: "student-screen" }, receiveStudentScreen)
    .on("presence", { event: "sync" }, syncStudentPresence)
    .on("presence", { event: "join" }, syncStudentPresence)
    .on("presence", { event: "leave" }, syncStudentPresence)
    .subscribe(status => {
      if (status === "SUBSCRIBED") {
        void state.presenceChannel.track({ role: "display", room_code: state.roomCode, online_at: new Date().toISOString() });
      }
    });
}

function showClosed() {
  state.broadcastChannel?.unsubscribe();
  state.presenceChannel?.unsubscribe();
  state.studentScreens.clear();
  state.lessonStep = null;
  state.lessonTimer = null;
  state.studentScreenMarkupSignature = "";
  renderStudentScreens();
  $("#displayStageTitle").textContent = "จบคาบเรียนแล้ว";
  $("#displayStageMessage").textContent = "ขอบคุณนักผจญภัยทุกคน แล้วพบกันในแผนถัดไป";
  $("#displayActivityVisual").innerHTML = `<span>🎉</span>`;
}

function updateClock() {
  $("#displayClock").textContent = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
}

$("#displayJoinForm").addEventListener("submit", connectDisplay);
$("#displayRoomInput").addEventListener("input", event => { event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6); });
$("#displayViewSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-display-view]");
  if (button) setDisplayView(button.dataset.displayView);
});
$("#displayStudentScreens").addEventListener("click", event => {
  const button = event.target.closest("[data-display-fullscreen]");
  if (button) toggleStudentFullscreen(button);
});
document.addEventListener("fullscreenchange", syncFullscreenButtons);
const initialRoom = roomCodeFromUrl() || localStorage.getItem("thaiGameDisplayRoom") || "";
$("#displayRoomInput").value = initialRoom;
if (initialRoom) void connectDisplay();
setInterval(updateClock, 1000);
setInterval(updateDisplayLessonCountdown, 1000);
updateClock();

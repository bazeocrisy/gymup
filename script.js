/* ==========================================================
   GymUp — Workout Tracker
   Version: 3.0.0
   Build:   2026-04-18
   Changes in v3.0.0:
   - Per-exercise counts instead of booleans
   - TOTAL_ROUNDS constant replaces hardcoded "4"s
   - Optional duration + calories metrics
   - Four explicit workout statuses
   - Status tag shown in history
   - Build info footer
   ========================================================== */

const APP_VERSION = "3.0.0";
const BUILD_DATE  = "2026-04-18";

const STORAGE_KEY  = "gymup_workouts";
const TOTAL_ROUNDS = 4;

// ---------- Exercise definitions (used by guided mode) ----------
const EXERCISES = [
  { id: "pushups", name: "Push-ups", target: "12 reps", icon: "💪", timer: null },
  { id: "situps",  name: "Sit-ups",  target: "15 reps", icon: "🔥", timer: null },
  { id: "squats",  name: "Squats",   target: "15 reps", icon: "🦵", timer: null },
  { id: "plank",   name: "Plank",    target: "20 sec",  icon: "🧱", timer: 20 }
];

// ---------- Mode toggle ----------
const modeButtons  = document.querySelectorAll(".mode-btn");
const quickModeEl  = document.getElementById("quickMode");
const guidedModeEl = document.getElementById("guidedMode");

modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    modeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const mode = btn.dataset.mode;
    if (mode === "quick") {
      quickModeEl.classList.remove("hidden");
      guidedModeEl.classList.add("hidden");
    } else {
      quickModeEl.classList.add("hidden");
      guidedModeEl.classList.remove("hidden");
      resetGuided();
    }
  });
});

/* ==========================================================
   QUICK LOG MODE
   ========================================================== */

const dateInput      = document.getElementById("workoutDate");
const pushupsEl      = document.getElementById("pushups");
const situpsEl       = document.getElementById("situps");
const squatsEl       = document.getElementById("squats");
const plankEl        = document.getElementById("plank");
const walkEl         = document.getElementById("walk");
const milesEl        = document.getElementById("miles");
const notesEl        = document.getElementById("notes");
const durationEl     = document.getElementById("duration");
const caloriesEl     = document.getElementById("calories");
const roundChecks    = document.querySelectorAll(".round-check");
const roundStatusEl  = document.getElementById("roundStatus");

const saveBtn        = document.getElementById("saveBtn");
const resetFormBtn   = document.getElementById("resetFormBtn");
const clearAllBtn    = document.getElementById("clearAllBtn");

const summarySection = document.getElementById("summarySection");
const summaryContent = document.getElementById("summaryContent");
const historyList    = document.getElementById("historyList");

// ---------- Initialize on load ----------
document.addEventListener("DOMContentLoaded", () => {
  setTodayAsDefault();
  updateRoundStatus();
  renderHistory();
  renderBuildInfo();
});

// Show app version + build date in footer
function renderBuildInfo() {
  const el = document.getElementById("buildInfo");
  if (el) {
    el.textContent = `GymUp v${APP_VERSION} \u2022 Build ${BUILD_DATE}`;
  }
}

function setTodayAsDefault() {
  dateInput.value = isoDateFromDate(new Date());
}

function isoDateFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

roundChecks.forEach(cb => cb.addEventListener("change", updateRoundStatus));

function updateRoundStatus() {
  const count = Array.from(roundChecks).filter(cb => cb.checked).length;
  roundStatusEl.textContent = `${count} of ${TOTAL_ROUNDS} rounds complete`;
}

saveBtn.addEventListener("click", () => {
  const workout = gatherQuickData();
  commitWorkout(workout);
  renderSummary(workout, summaryContent, summarySection);
  summarySection.scrollIntoView({ behavior: "smooth", block: "start" });
});

function gatherQuickData() {
  // For Quick Log, per-round counts aren't tracked, so we infer:
  // if the exercise box is checked, assume it was done in every completed round.
  const roundsCompleted = Array.from(roundChecks).filter(cb => cb.checked).length;
  return {
    date:              dateInput.value || isoDateFromDate(new Date()),
    roundsCompleted:   roundsCompleted,
    exerciseCounts: {
      pushups: pushupsEl.checked ? roundsCompleted : 0,
      situps:  situpsEl.checked  ? roundsCompleted : 0,
      squats:  squatsEl.checked  ? roundsCompleted : 0,
      plank:   plankEl.checked   ? roundsCompleted : 0
    },
    pushupsCompleted:  pushupsEl.checked && roundsCompleted === TOTAL_ROUNDS,
    situpsCompleted:   situpsEl.checked  && roundsCompleted === TOTAL_ROUNDS,
    squatsCompleted:   squatsEl.checked  && roundsCompleted === TOTAL_ROUNDS,
    plankCompleted:    plankEl.checked   && roundsCompleted === TOTAL_ROUNDS,
    walkCompleted:     walkEl.checked,
    milesWalked:       parseFloat(milesEl.value) || 0,
    durationMinutes:   parseInt(durationEl?.value, 10) || 0,
    caloriesBurned:    parseInt(caloriesEl?.value, 10) || 0,
    notes:             notesEl.value.trim(),
    mode:              "quick",
    timestamp:         Date.now()
  };
}

resetFormBtn.addEventListener("click", () => {
  pushupsEl.checked = false;
  situpsEl.checked  = false;
  squatsEl.checked  = false;
  plankEl.checked   = false;
  walkEl.checked    = false;
  milesEl.value     = "";
  notesEl.value     = "";
  if (durationEl) durationEl.value = "";
  if (caloriesEl) caloriesEl.value = "";
  roundChecks.forEach(cb => cb.checked = false);
  updateRoundStatus();
  summarySection.classList.add("hidden");
  setTodayAsDefault();
});

clearAllBtn.addEventListener("click", () => {
  const confirmed = confirm("This will permanently delete all saved workouts. Continue?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  summarySection.classList.add("hidden");
});

/* ==========================================================
   GUIDED WORKOUT MODE
   ========================================================== */

const screens = {
  start:      document.getElementById("guidedStart"),
  roundIntro: document.getElementById("guidedRoundIntro"),
  exercise:   document.getElementById("guidedExercise"),
  rest:       document.getElementById("guidedRest"),
  walk:       document.getElementById("guidedWalk"),
  finish:     document.getElementById("guidedFinish"),
  summary:    document.getElementById("guidedSummary")
};

const startWorkoutBtn    = document.getElementById("startWorkoutBtn");
const beginRoundBtn      = document.getElementById("beginRoundBtn");
const exerciseDoneBtn    = document.getElementById("exerciseDoneBtn");
const exerciseBackBtn    = document.getElementById("exerciseBackBtn");
const nextRoundBtn       = document.getElementById("nextRoundBtn");
const walkDoneBtn        = document.getElementById("walkDoneBtn");
const walkSkipBtn        = document.getElementById("walkSkipBtn");
const guidedSaveBtn      = document.getElementById("guidedSaveBtn");
const guidedNewBtn       = document.getElementById("guidedNewBtn");
const timerStartBtn      = document.getElementById("timerStartBtn");

const roundLabel         = document.getElementById("roundLabel");
const roundNumber        = document.getElementById("roundNumber");
const exerciseRoundLabel = document.getElementById("exerciseRoundLabel");
const exerciseIcon       = document.getElementById("exerciseIcon");
const exerciseName       = document.getElementById("exerciseName");
const exerciseTarget     = document.getElementById("exerciseTarget");
const timerSection       = document.getElementById("timerSection");
const timerDisplay       = document.getElementById("timerDisplay");
const restTitle          = document.getElementById("restTitle");
const restTimer          = document.getElementById("restTimer");
const guidedMiles        = document.getElementById("guidedMiles");
const guidedNotes        = document.getElementById("guidedNotes");
const guidedDuration     = document.getElementById("guidedDuration");
const guidedCalories     = document.getElementById("guidedCalories");
const guidedSummaryContent = document.getElementById("guidedSummaryContent");

let guidedState = freshGuidedState();
let timerInterval = null;
let restInterval  = null;

function freshGuidedState() {
  return {
    currentRound: 0,
    currentExercise: 0,
    roundsCompleted: 0,
    // Counts each "Done" tap per exercise across all rounds
    exerciseCounts: {
      pushups: 0, situps: 0, squats: 0, plank: 0
    },
    walkCompleted: false,
    milesWalked: 0,
    notes: "",
    startedAt: null
  };
}

function showScreen(key) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  if (screens[key]) screens[key].classList.remove("hidden");
}

function resetGuided() {
  stopAllTimers();
  guidedState = freshGuidedState();
  showScreen("start");
}

// ---------- Start ----------
startWorkoutBtn.addEventListener("click", () => {
  guidedState = freshGuidedState();
  guidedState.startedAt = Date.now();
  guidedState.currentRound = 1;
  showRoundIntro();
});

function showRoundIntro() {
  roundLabel.textContent = `Round ${guidedState.currentRound} of ${TOTAL_ROUNDS}`;
  roundNumber.textContent = guidedState.currentRound;
  guidedState.currentExercise = 0;
  showScreen("roundIntro");
  stopRestTimer();
}

beginRoundBtn.addEventListener("click", () => {
  guidedState.currentExercise = 0;
  showExercise();
});

function showExercise() {
  const ex = EXERCISES[guidedState.currentExercise];
  exerciseRoundLabel.textContent = `Round ${guidedState.currentRound} of ${TOTAL_ROUNDS}`;
  exerciseIcon.textContent = ex.icon;
  exerciseName.textContent = ex.name;
  exerciseTarget.textContent = ex.target;

  stopExerciseTimer();
  if (ex.timer) {
    timerSection.classList.remove("hidden");
    timerDisplay.textContent = ex.timer;
    timerDisplay.classList.remove("running");
    timerStartBtn.textContent = "Start Timer";
    timerStartBtn.disabled = false;
  } else {
    timerSection.classList.add("hidden");
  }

  showScreen("exercise");
}

// ---------- Plank timer ----------
timerStartBtn.addEventListener("click", () => {
  const ex = EXERCISES[guidedState.currentExercise];
  if (!ex.timer) return;

  let remaining = ex.timer;
  timerDisplay.textContent = remaining;
  timerDisplay.classList.add("running");
  timerStartBtn.disabled = true;
  timerStartBtn.textContent = "Running...";

  timerInterval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      timerDisplay.textContent = "0";
      stopExerciseTimer();
      timerStartBtn.textContent = "Done!";
      timerStartBtn.disabled = true;
      if (navigator.vibrate) navigator.vibrate(200);
    } else {
      timerDisplay.textContent = remaining;
    }
  }, 1000);
});

function stopExerciseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerDisplay.classList.remove("running");
}

// ---------- Exercise controls ----------
exerciseDoneBtn.addEventListener("click", () => {
  const ex = EXERCISES[guidedState.currentExercise];
  // Increment count for the exercise just completed
  guidedState.exerciseCounts[ex.id] += 1;
  stopExerciseTimer();

  if (guidedState.currentExercise < EXERCISES.length - 1) {
    guidedState.currentExercise += 1;
    showExercise();
  } else {
    guidedState.roundsCompleted = guidedState.currentRound;
    showRest();
  }
});

exerciseBackBtn.addEventListener("click", () => {
  stopExerciseTimer();
  if (guidedState.currentExercise > 0) {
    // Back means the previous Done was a mistake; decrement that exercise's count
    const prevEx = EXERCISES[guidedState.currentExercise - 1];
    if (guidedState.exerciseCounts[prevEx.id] > 0) {
      guidedState.exerciseCounts[prevEx.id] -= 1;
    }
    guidedState.currentExercise -= 1;
    showExercise();
  } else {
    showRoundIntro();
  }
});

// ---------- Rest / Round complete ----------
function showRest() {
  const isLast = guidedState.currentRound >= TOTAL_ROUNDS;
  restTitle.textContent = isLast
    ? "All Rounds Complete"
    : `Round ${guidedState.currentRound} Complete`;
  nextRoundBtn.textContent = isLast ? "Continue to Walk" : "Next Round";
  startRestTimer();
  showScreen("rest");
}

function startRestTimer() {
  stopRestTimer();
  const start = Date.now();
  restTimer.textContent = "0:00";
  restInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    restTimer.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
  }, 1000);
}

function stopRestTimer() {
  if (restInterval) {
    clearInterval(restInterval);
    restInterval = null;
  }
}

nextRoundBtn.addEventListener("click", () => {
  stopRestTimer();
  if (guidedState.currentRound >= TOTAL_ROUNDS) {
    showScreen("walk");
  } else {
    guidedState.currentRound += 1;
    showRoundIntro();
  }
});

// ---------- Walk ----------
walkDoneBtn.addEventListener("click", () => {
  guidedState.walkCompleted = true;
  guidedState.milesWalked = parseFloat(guidedMiles.value) || 0;
  showScreen("finish");
});

walkSkipBtn.addEventListener("click", () => {
  guidedState.walkCompleted = false;
  guidedState.milesWalked = 0;
  showScreen("finish");
});

// ---------- Finish / Save ----------
guidedSaveBtn.addEventListener("click", () => {
  guidedState.notes = guidedNotes.value.trim();
  const counts = guidedState.exerciseCounts;

  // Completion only when count matches every round
  const workout = {
    date:              isoDateFromDate(new Date()),
    roundsCompleted:   guidedState.roundsCompleted,
    exerciseCounts:    { ...counts },
    pushupsCompleted:  counts.pushups === TOTAL_ROUNDS,
    situpsCompleted:   counts.situps  === TOTAL_ROUNDS,
    squatsCompleted:   counts.squats  === TOTAL_ROUNDS,
    plankCompleted:    counts.plank   === TOTAL_ROUNDS,
    walkCompleted:     guidedState.walkCompleted,
    milesWalked:       guidedState.milesWalked,
    durationMinutes:   parseInt(guidedDuration?.value, 10) || 0,
    caloriesBurned:    parseInt(guidedCalories?.value, 10) || 0,
    notes:             guidedState.notes,
    mode:              "guided",
    timestamp:         Date.now()
  };
  commitWorkout(workout);
  renderSummary(workout, guidedSummaryContent, screens.summary);
  showScreen("summary");
});

guidedNewBtn.addEventListener("click", () => {
  guidedNotes.value = "";
  guidedMiles.value = "";
  if (guidedDuration) guidedDuration.value = "";
  if (guidedCalories) guidedCalories.value = "";
  resetGuided();
});

function stopAllTimers() {
  stopExerciseTimer();
  stopRestTimer();
}

/* ==========================================================
   STATUS LOGIC (centralized)
   ========================================================== */

function computeStatus(w) {
  const allExercises = w.pushupsCompleted && w.situpsCompleted &&
                       w.squatsCompleted && w.plankCompleted;
  const fullWorkout  = allExercises && w.roundsCompleted === TOTAL_ROUNDS;
  const anyWorkout   = w.roundsCompleted > 0 ||
                       w.pushupsCompleted || w.situpsCompleted ||
                       w.squatsCompleted  || w.plankCompleted;

  if (fullWorkout && w.walkCompleted) {
    return { label: "Full Workout + Walk Complete", cls: "complete" };
  }
  if (fullWorkout && !w.walkCompleted) {
    return { label: "Workout Complete (No Walk)", cls: "complete" };
  }
  if (!anyWorkout && w.walkCompleted) {
    return { label: "Walk Only", cls: "partial" };
  }
  return { label: "Partial Workout", cls: "partial" };
}

/* ==========================================================
   SHARED: save / summary / history
   ========================================================== */

function commitWorkout(workout) {
  const workouts = loadWorkouts();
  const existingIndex = workouts.findIndex(w => w.date === workout.date);
  if (existingIndex !== -1) {
    workouts[existingIndex] = workout;
  } else {
    workouts.unshift(workout);
  }
  saveWorkouts(workouts);
  renderHistory();
}

function loadWorkouts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load workouts:", e);
    return [];
  }
}

function saveWorkouts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function renderSummary(w, targetEl, containerEl) {
  const status = computeStatus(w);
  const milesText = w.milesWalked > 0 ? ` (${w.milesWalked} mi)` : "";
  const counts = w.exerciseCounts || {};

  // If counts are available, show "X/TOTAL_ROUNDS"; otherwise fall back to Yes/No
  const exerciseRow = (label, id, doneBool) => {
    const n = counts[id];
    if (typeof n === "number") {
      const full = n === TOTAL_ROUNDS;
      const cls  = full ? "yes" : (n > 0 ? "" : "no");
      return `
        <div class="summary-row">
          <span class="label-text">${label}</span>
          <span class="value ${cls}">${n}/${TOTAL_ROUNDS}</span>
        </div>`;
    }
    return `
      <div class="summary-row">
        <span class="label-text">${label}</span>
        ${yesNo(doneBool)}
      </div>`;
  };

  // Optional metrics rows
  let metricsHtml = "";
  const metricParts = [];
  if (w.durationMinutes > 0) metricParts.push(`
    <div class="summary-row">
      <span class="label-text">⏱️ Duration</span>
      <span class="value">${w.durationMinutes} min</span>
    </div>`);
  if (w.caloriesBurned > 0) metricParts.push(`
    <div class="summary-row">
      <span class="label-text">🔥 Calories</span>
      <span class="value">${w.caloriesBurned}</span>
    </div>`);
  metricsHtml = metricParts.join("");

  targetEl.innerHTML = `
    <div class="summary-date">${formatDate(w.date)}</div>
    <div class="summary-headline ${status.cls}">${status.label}</div>

    <div class="summary-row">
      <span class="label-text">Rounds completed</span>
      <span class="value">${w.roundsCompleted} of ${TOTAL_ROUNDS}</span>
    </div>
    ${exerciseRow("Push-ups", "pushups", w.pushupsCompleted)}
    ${exerciseRow("Sit-ups",  "situps",  w.situpsCompleted)}
    ${exerciseRow("Squats",   "squats",  w.squatsCompleted)}
    ${exerciseRow("Plank",    "plank",   w.plankCompleted)}
    <div class="summary-row">
      <span class="label-text">Walk${milesText}</span>
      ${yesNo(w.walkCompleted)}
    </div>
    ${metricsHtml}

    ${w.notes ? `<div class="summary-notes">${escapeHtml(w.notes)}</div>` : ""}
  `;

  containerEl.classList.remove("hidden");
}

function yesNo(bool) {
  return bool
    ? `<span class="value yes">Yes</span>`
    : `<span class="value no">No</span>`;
}

function renderHistory() {
  const workouts = loadWorkouts();

  if (workouts.length === 0) {
    historyList.innerHTML = `<p class="empty-text">No workouts saved yet.</p>`;
    return;
  }

  workouts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  historyList.innerHTML = workouts.map(w => {
    const status = computeStatus(w);
    const walkText = w.walkCompleted
      ? (w.milesWalked > 0 ? `Walk: ${w.milesWalked} mi` : "Walk: Yes")
      : "Walk: No";
    const modeTag = w.mode === "guided" ? " &bull; Guided" : "";

    // Optional metrics in history
    const metricBits = [];
    if (w.durationMinutes > 0) metricBits.push(`${w.durationMinutes} min`);
    if (w.caloriesBurned > 0)  metricBits.push(`${w.caloriesBurned} cal`);
    const metricText = metricBits.length
      ? ` &nbsp;&bull;&nbsp; ${metricBits.join(" &bull; ")}`
      : "";

    const notePreview = w.notes
      ? `<div class="history-note">"${escapeHtml(truncate(w.notes, 80))}"</div>`
      : "";

    return `
      <div class="history-item">
        <div class="history-date">${formatDate(w.date)}</div>
        <div class="history-meta">
          Rounds: ${w.roundsCompleted}/${TOTAL_ROUNDS} &nbsp;&bull;&nbsp; ${walkText}${modeTag}${metricText}
        </div>
        <span class="status-tag ${status.cls}">${status.label}</span>
        ${notePreview}
      </div>
    `;
  }).join("");
}

/* ==========================================================
   Utilities
   ========================================================== */

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

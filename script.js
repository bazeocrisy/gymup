/* ==========================================================
   GymUp v2 — Workout Tracker with Quick Log + Guided Modes
   ========================================================== */

const STORAGE_KEY = "gymup_workouts";

// ---------- Exercise definitions (used by guided mode) ----------
const EXERCISES = [
  { id: "pushups", name: "Push-ups", target: "12 reps", icon: "💪", timer: null },
  { id: "situps",  name: "Sit-ups",  target: "15 reps", icon: "🔥", timer: null },
  { id: "squats",  name: "Squats",   target: "15 reps", icon: "🦵", timer: null },
  { id: "plank",   name: "Plank",    target: "20 sec",  icon: "🧱", timer: 20 }
];

const TOTAL_ROUNDS = 4;

// ---------- Mode toggle ----------
const modeButtons = document.querySelectorAll(".mode-btn");
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
   QUICK LOG MODE (original flow)
   ========================================================== */

const dateInput      = document.getElementById("workoutDate");
const pushupsEl      = document.getElementById("pushups");
const situpsEl       = document.getElementById("situps");
const squatsEl       = document.getElementById("squats");
const plankEl        = document.getElementById("plank");
const walkEl         = document.getElementById("walk");
const milesEl        = document.getElementById("miles");
const notesEl        = document.getElementById("notes");
const roundChecks    = document.querySelectorAll(".round-check");
const roundStatusEl  = document.getElementById("roundStatus");

const saveBtn        = document.getElementById("saveBtn");
const resetFormBtn   = document.getElementById("resetFormBtn");
const clearAllBtn    = document.getElementById("clearAllBtn");

const summarySection = document.getElementById("summarySection");
const summaryContent = document.getElementById("summaryContent");
const historyList    = document.getElementById("historyList");

document.addEventListener("DOMContentLoaded", () => {
  setTodayAsDefault();
  updateRoundStatus();
  renderHistory();
});

function setTodayAsDefault() {
  const today = new Date();
  dateInput.value = isoDateFromDate(today);
}

function isoDateFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

roundChecks.forEach(cb => cb.addEventListener("change", updateRoundStatus));

function updateRoundStatus() {
  const count = Array.from(roundChecks).filter(cb => cb.checked).length;
  roundStatusEl.textContent = `${count} of 4 rounds complete`;
}

saveBtn.addEventListener("click", () => {
  const workout = gatherQuickData();
  commitWorkout(workout);
  renderSummary(workout, summaryContent, summarySection);
  summarySection.scrollIntoView({ behavior: "smooth", block: "start" });
});

function gatherQuickData() {
  return {
    date:              dateInput.value || isoDateFromDate(new Date()),
    roundsCompleted:   Array.from(roundChecks).filter(cb => cb.checked).length,
    pushupsCompleted:  pushupsEl.checked,
    situpsCompleted:   situpsEl.checked,
    squatsCompleted:   squatsEl.checked,
    plankCompleted:    plankEl.checked,
    walkCompleted:     walkEl.checked,
    milesWalked:       parseFloat(milesEl.value) || 0,
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

// Screens
const screens = {
  start:      document.getElementById("guidedStart"),
  roundIntro: document.getElementById("guidedRoundIntro"),
  exercise:   document.getElementById("guidedExercise"),
  rest:       document.getElementById("guidedRest"),
  walk:       document.getElementById("guidedWalk"),
  finish:     document.getElementById("guidedFinish"),
  summary:    document.getElementById("guidedSummary")
};

// Buttons & elements
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
const guidedSummaryContent = document.getElementById("guidedSummaryContent");

// Guided state
let guidedState = freshGuidedState();
let timerInterval = null;
let restInterval  = null;

function freshGuidedState() {
  return {
    currentRound: 0,          // 1..4 once started
    currentExercise: 0,       // index into EXERCISES
    roundsCompleted: 0,
    exerciseCompletions: {
      pushups: false, situps: false, squats: false, plank: false
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

// ---------- Begin round ----------
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

  // Timer handling (plank only)
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
      // Brief haptic-style visual cue: tap Done to continue
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
  guidedState.exerciseCompletions[ex.id] = true;
  stopExerciseTimer();

  // Advance to next exercise, or finish round
  if (guidedState.currentExercise < EXERCISES.length - 1) {
    guidedState.currentExercise += 1;
    showExercise();
  } else {
    // Round complete
    guidedState.roundsCompleted = guidedState.currentRound;
    showRest();
  }
});

exerciseBackBtn.addEventListener("click", () => {
  stopExerciseTimer();
  if (guidedState.currentExercise > 0) {
    guidedState.currentExercise -= 1;
    showExercise();
  } else {
    // Back from first exercise returns to round intro
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
    // Go to walk screen
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
  const workout = {
    date:              isoDateFromDate(new Date()),
    roundsCompleted:   guidedState.roundsCompleted,
    pushupsCompleted:  guidedState.exerciseCompletions.pushups,
    situpsCompleted:   guidedState.exerciseCompletions.situps,
    squatsCompleted:   guidedState.exerciseCompletions.squats,
    plankCompleted:    guidedState.exerciseCompletions.plank,
    walkCompleted:     guidedState.walkCompleted,
    milesWalked:       guidedState.milesWalked,
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
  resetGuided();
});

function stopAllTimers() {
  stopExerciseTimer();
  stopRestTimer();
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
  const allExercises = w.pushupsCompleted && w.situpsCompleted &&
                       w.squatsCompleted && w.plankCompleted;
  const fullWorkout  = allExercises && w.roundsCompleted === 4;
  const fullDay      = fullWorkout && w.walkCompleted;

  let headlineClass = "partial";
  let headlineText  = "Partial workout logged. Progress is progress.";
  if (fullDay) {
    headlineClass = "complete";
    headlineText  = "Full workout and walk complete.";
  } else if (fullWorkout) {
    headlineClass = "complete";
    headlineText  = "All rounds complete. Walk not logged.";
  }

  const milesText = w.milesWalked > 0 ? ` (${w.milesWalked} mi)` : "";

  targetEl.innerHTML = `
    <div class="summary-date">${formatDate(w.date)}</div>
    <div class="summary-headline ${headlineClass}">${headlineText}</div>

    <div class="summary-row">
      <span class="label-text">Rounds completed</span>
      <span class="value">${w.roundsCompleted} of 4</span>
    </div>
    <div class="summary-row">
      <span class="label-text">Push-ups</span>
      ${yesNo(w.pushupsCompleted)}
    </div>
    <div class="summary-row">
      <span class="label-text">Sit-ups</span>
      ${yesNo(w.situpsCompleted)}
    </div>
    <div class="summary-row">
      <span class="label-text">Squats</span>
      ${yesNo(w.squatsCompleted)}
    </div>
    <div class="summary-row">
      <span class="label-text">Plank</span>
      ${yesNo(w.plankCompleted)}
    </div>
    <div class="summary-row">
      <span class="label-text">Walk${milesText}</span>
      ${yesNo(w.walkCompleted)}
    </div>

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
    const walkText = w.walkCompleted
      ? (w.milesWalked > 0 ? `Walk: ${w.milesWalked} mi` : "Walk: Yes")
      : "Walk: No";
    const modeTag = w.mode === "guided" ? " &bull; Guided" : "";
    const notePreview = w.notes
      ? `<div class="history-note">"${escapeHtml(truncate(w.notes, 80))}"</div>`
      : "";
    return `
      <div class="history-item">
        <div class="history-date">${formatDate(w.date)}</div>
        <div class="history-meta">
          Rounds: ${w.roundsCompleted}/4 &nbsp;&bull;&nbsp; ${walkText}${modeTag}
        </div>
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

/* ==========================================================
   GymUp — Workout Tracker
   Version: 3.1.0
   Build:   2026-04-18

   New in v3.1.0:
   - Per-exercise live timing (captures seconds per set)
   - Per-round rest timing
   - Effort rating (RPE 1-10)
   - Exercise info modal with muscle images + descriptions
   - Round-by-round timing breakdown in summary
   ========================================================== */

const APP_VERSION = "3.1.0";
const BUILD_DATE  = "2026-04-18";

const STORAGE_KEY  = "gymup_workouts";
const TOTAL_ROUNDS = 4;

// ---------- Exercise definitions ----------
// Image URLs are Wikimedia Commons public domain anatomy images.
// If a URL fails to load, a fallback emoji is shown.
const EXERCISES = [
  {
    id: "pushups",
    name: "Push-ups",
    target: "12 reps",
    icon: "💪",
    timer: null,
    muscles: "Chest • Shoulders • Triceps • Core",
    description: "Push-ups build pressing strength across the chest (pectoralis major), shoulders (anterior deltoids), and triceps, while the core works isometrically to keep the body rigid. Progressive overload with push-ups develops upper-body pushing power and scapular stability that transfers to almost every lifting and carrying task.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Pushup-2.svg/500px-Pushup-2.svg.png"
  },
  {
    id: "situps",
    name: "Sit-ups",
    target: "15 reps",
    icon: "🔥",
    timer: null,
    muscles: "Rectus Abdominis • Hip Flexors • Obliques",
    description: "Sit-ups train the full abdominal wall, particularly the rectus abdominis (the 'six-pack' muscle), along with the hip flexors that lift the torso and the obliques that stabilize the spine. A strong midsection protects the lower back, improves posture, and transfers force efficiently between upper and lower body.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Sit-up.svg/500px-Sit-up.svg.png"
  },
  {
    id: "squats",
    name: "Squats",
    target: "15 reps",
    icon: "🦵",
    timer: null,
    muscles: "Quadriceps • Glutes • Hamstrings • Calves",
    description: "Squats build the largest muscles in the body — the quadriceps on the front of the thigh, the gluteus maximus, and the hamstrings — along with strong calves and a braced core. They drive functional lower-body strength for running, climbing, jumping, and carrying, and trigger a strong systemic hormonal response.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Squats.svg/500px-Squats.svg.png"
  },
  {
    id: "plank",
    name: "Plank",
    target: "20 sec",
    icon: "🧱",
    timer: 20,
    muscles: "Core • Shoulders • Glutes • Back",
    description: "The plank is an isometric hold that trains the entire core to resist movement rather than create it — building exactly the kind of stability your spine needs for heavy lifting, sports, and daily life. Shoulders, glutes, and upper back all contribute to holding a straight, rigid line from head to heels.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Plank.svg/500px-Plank.svg.png"
  }
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

// Quick RPE
let quickRpe = null;
const quickRpeScale = document.getElementById("quickRpeScale");
initRpeScale(quickRpeScale, (val) => { quickRpe = val; });

document.addEventListener("DOMContentLoaded", () => {
  setTodayAsDefault();
  updateRoundStatus();
  renderHistory();
  renderBuildInfo();
});

function renderBuildInfo() {
  const el = document.getElementById("buildInfo");
  if (el) el.textContent = `GymUp v${APP_VERSION} \u2022 Build ${BUILD_DATE}`;
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
    // Quick mode does not track per-round timing
    exerciseTimings: null,
    restTimings: null,
    pushupsCompleted:  pushupsEl.checked && roundsCompleted === TOTAL_ROUNDS,
    situpsCompleted:   situpsEl.checked  && roundsCompleted === TOTAL_ROUNDS,
    squatsCompleted:   squatsEl.checked  && roundsCompleted === TOTAL_ROUNDS,
    plankCompleted:    plankEl.checked   && roundsCompleted === TOTAL_ROUNDS,
    walkCompleted:     walkEl.checked,
    milesWalked:       parseFloat(milesEl.value) || 0,
    durationMinutes:   parseInt(durationEl?.value, 10) || 0,
    caloriesBurned:    parseInt(caloriesEl?.value, 10) || 0,
    exertionRating:    quickRpe,
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
  quickRpe = null;
  clearRpeScale(quickRpeScale);
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
   RPE SCALE HELPERS
   ========================================================== */

function initRpeScale(scaleEl, onSelect) {
  if (!scaleEl) return;
  const buttons = scaleEl.querySelectorAll(".rpe-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      onSelect(parseInt(btn.dataset.rpe, 10));
    });
  });
}

function clearRpeScale(scaleEl) {
  if (!scaleEl) return;
  scaleEl.querySelectorAll(".rpe-btn").forEach(b => b.classList.remove("selected"));
}

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
const exerciseInfoBtn    = document.getElementById("exerciseInfoBtn");
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
const exerciseLiveTimer  = document.getElementById("exerciseLiveTimer");
const timerSection       = document.getElementById("timerSection");
const timerDisplay       = document.getElementById("timerDisplay");
const restTitle          = document.getElementById("restTitle");
const restTimer          = document.getElementById("restTimer");
const guidedMiles        = document.getElementById("guidedMiles");
const guidedNotes        = document.getElementById("guidedNotes");
const guidedDuration     = document.getElementById("guidedDuration");
const guidedCalories     = document.getElementById("guidedCalories");
const guidedSummaryContent = document.getElementById("guidedSummaryContent");

// Modal elements
const infoModal       = document.getElementById("infoModal");
const modalCloseBtn   = document.getElementById("modalCloseBtn");
const modalTitle      = document.getElementById("modalTitle");
const modalImage      = document.getElementById("modalImage");
const modalFallback   = document.getElementById("modalFallback");
const modalMuscles    = document.getElementById("modalMuscles");
const modalDescription = document.getElementById("modalDescription");

// Guided RPE
let guidedRpe = null;
const guidedRpeScale = document.getElementById("guidedRpeScale");
initRpeScale(guidedRpeScale, (val) => { guidedRpe = val; });

let guidedState = freshGuidedState();
let timerInterval    = null;  // plank countdown
let restInterval     = null;  // between-round rest counter
let exerciseInterval = null;  // live per-exercise timer
let exerciseStartMs  = 0;     // when current exercise started
let restStartMs      = 0;     // when current rest started

function freshGuidedState() {
  return {
    currentRound: 0,
    currentExercise: 0,
    roundsCompleted: 0,
    exerciseCounts:  { pushups: 0, situps: 0, squats: 0, plank: 0 },
    // NEW: array of seconds per round for each exercise
    exerciseTimings: { pushups: [], situps: [], squats: [], plank: [] },
    // NEW: seconds of rest between rounds (length = rounds - 1 after completion)
    restTimings: [],
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
  guidedRpe = null;
  clearRpeScale(guidedRpeScale);
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

  // Start live timing for this exercise
  startExerciseLiveTimer();
  showScreen("exercise");
}

// ---------- Live per-exercise timer (counts up) ----------
function startExerciseLiveTimer() {
  stopExerciseLiveTimer();
  exerciseStartMs = Date.now();
  exerciseLiveTimer.textContent = "0:00";
  exerciseInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - exerciseStartMs) / 1000);
    exerciseLiveTimer.textContent = formatSeconds(elapsed);
  }, 1000);
}

function stopExerciseLiveTimer() {
  if (exerciseInterval) {
    clearInterval(exerciseInterval);
    exerciseInterval = null;
  }
}

function captureExerciseTime() {
  if (!exerciseStartMs) return 0;
  const secs = Math.max(1, Math.floor((Date.now() - exerciseStartMs) / 1000));
  exerciseStartMs = 0;
  return secs;
}

// ---------- Info modal ----------
exerciseInfoBtn.addEventListener("click", () => {
  const ex = EXERCISES[guidedState.currentExercise];
  openInfoModal(ex);
});

function openInfoModal(ex) {
  modalTitle.textContent = ex.name;
  modalMuscles.textContent = ex.muscles;
  modalDescription.textContent = ex.description;

  // Image with graceful fallback
  modalFallback.classList.add("hidden");
  modalImage.classList.remove("hidden");
  modalFallback.textContent = ex.icon;
  modalImage.onerror = () => {
    modalImage.classList.add("hidden");
    modalFallback.classList.remove("hidden");
  };
  modalImage.onload = () => {
    modalImage.classList.remove("hidden");
    modalFallback.classList.add("hidden");
  };
  modalImage.src = ex.image;
  modalImage.alt = `${ex.name} anatomy`;

  infoModal.classList.remove("hidden");
}

function closeInfoModal() {
  infoModal.classList.add("hidden");
}

modalCloseBtn.addEventListener("click", closeInfoModal);
infoModal.addEventListener("click", (e) => {
  if (e.target === infoModal) closeInfoModal();
});

// ---------- Plank countdown timer ----------
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
  const elapsed = captureExerciseTime();
  stopExerciseLiveTimer();
  stopExerciseTimer();

  guidedState.exerciseCounts[ex.id] += 1;
  guidedState.exerciseTimings[ex.id].push(elapsed);

  if (guidedState.currentExercise < EXERCISES.length - 1) {
    guidedState.currentExercise += 1;
    showExercise();
  } else {
    guidedState.roundsCompleted = guidedState.currentRound;
    showRest();
  }
});

exerciseBackBtn.addEventListener("click", () => {
  stopExerciseLiveTimer();
  stopExerciseTimer();
  if (guidedState.currentExercise > 0) {
    // Undo the previous exercise's count and its last timing
    const prevEx = EXERCISES[guidedState.currentExercise - 1];
    if (guidedState.exerciseCounts[prevEx.id] > 0) {
      guidedState.exerciseCounts[prevEx.id] -= 1;
      guidedState.exerciseTimings[prevEx.id].pop();
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
  restStartMs = Date.now();
  restTimer.textContent = "0:00";
  restInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - restStartMs) / 1000);
    restTimer.textContent = formatSeconds(elapsed);
  }, 1000);
}

function stopRestTimer() {
  if (restInterval) {
    clearInterval(restInterval);
    restInterval = null;
  }
}

function captureRestTime() {
  if (!restStartMs) return 0;
  const secs = Math.max(0, Math.floor((Date.now() - restStartMs) / 1000));
  restStartMs = 0;
  return secs;
}

nextRoundBtn.addEventListener("click", () => {
  // Capture rest duration (skip capturing if this was the final "Continue to Walk" press;
  // we still save the last rest so you see how long you rested before the walk)
  const restSecs = captureRestTime();
  stopRestTimer();
  guidedState.restTimings.push(restSecs);

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

  const workout = {
    date:              isoDateFromDate(new Date()),
    roundsCompleted:   guidedState.roundsCompleted,
    exerciseCounts:    { ...counts },
    exerciseTimings:   JSON.parse(JSON.stringify(guidedState.exerciseTimings)),
    restTimings:       [...guidedState.restTimings],
    pushupsCompleted:  counts.pushups === TOTAL_ROUNDS,
    situpsCompleted:   counts.situps  === TOTAL_ROUNDS,
    squatsCompleted:   counts.squats  === TOTAL_ROUNDS,
    plankCompleted:    counts.plank   === TOTAL_ROUNDS,
    walkCompleted:     guidedState.walkCompleted,
    milesWalked:       guidedState.milesWalked,
    durationMinutes:   parseInt(guidedDuration?.value, 10) || 0,
    caloriesBurned:    parseInt(guidedCalories?.value, 10) || 0,
    exertionRating:    guidedRpe,
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
  stopExerciseLiveTimer();
}

/* ==========================================================
   STATUS LOGIC
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
   SUMMARY + HISTORY
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
  const timings = w.exerciseTimings || {};

  // Exercise row: shows count + optional per-round timing breakdown
  const exerciseRow = (label, id, doneBool) => {
    const n = counts[id];
    const roundTimes = timings[id];
    const hasCount = typeof n === "number";

    // Basic summary line
    const countCls = hasCount
      ? (n === TOTAL_ROUNDS ? "yes" : (n > 0 ? "" : "no"))
      : "";
    const countText = hasCount ? `${n}/${TOTAL_ROUNDS}` : null;

    let html = `
      <div class="summary-row">
        <span class="label-text">${label}</span>
        ${countText ? `<span class="value ${countCls}">${countText}</span>` : yesNo(doneBool)}
      </div>`;

    // If we have per-round times, render a breakdown card
    if (Array.isArray(roundTimes) && roundTimes.length > 0) {
      const chips = [];
      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const t = roundTimes[i];
        chips.push(`
          <div class="round-time-chip">
            R${i + 1}
            <strong>${typeof t === "number" ? formatSeconds(t) : "—"}</strong>
          </div>`);
      }
      const validTimes = roundTimes.filter(t => typeof t === "number" && t > 0);
      const total = validTimes.reduce((a, b) => a + b, 0);
      const avg = validTimes.length > 0 ? Math.round(total / validTimes.length) : 0;
      html += `
        <div class="exercise-breakdown">
          <div class="exercise-breakdown-title">
            <span>${label} — Round Times</span>
          </div>
          <div class="exercise-breakdown-rounds">${chips.join("")}</div>
          <div class="exercise-breakdown-totals">
            Total: ${formatSeconds(total)} &bull; Avg: ${formatSeconds(avg)}
          </div>
        </div>`;
    }

    return html;
  };

  // Rest timing breakdown
  let restHtml = "";
  if (Array.isArray(w.restTimings) && w.restTimings.length > 0) {
    const chips = w.restTimings.map((secs, i) => `
      <div class="round-time-chip">
        Rest ${i + 1}
        <strong>${formatSeconds(secs)}</strong>
      </div>`);
    // Pad with empty chips if fewer than 4 rests
    while (chips.length < TOTAL_ROUNDS) {
      chips.push(`<div class="round-time-chip">Rest ${chips.length + 1}<strong>—</strong></div>`);
    }
    const validRests = w.restTimings.filter(t => typeof t === "number");
    const totalRest = validRests.reduce((a, b) => a + b, 0);
    restHtml = `
      <div class="exercise-breakdown">
        <div class="exercise-breakdown-title">
          <span>Rest Between Rounds</span>
        </div>
        <div class="exercise-breakdown-rounds">${chips.slice(0, TOTAL_ROUNDS).join("")}</div>
        <div class="exercise-breakdown-totals">
          Total rest: ${formatSeconds(totalRest)}
        </div>
      </div>`;
  }

  // Optional metrics
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
  if (typeof w.exertionRating === "number") metricParts.push(`
    <div class="summary-row">
      <span class="label-text">💥 Effort</span>
      <span class="value">${w.exertionRating}/10</span>
    </div>`);
  const metricsHtml = metricParts.join("");

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
    ${restHtml}
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

    const metricBits = [];
    if (w.durationMinutes > 0) metricBits.push(`${w.durationMinutes} min`);
    if (w.caloriesBurned > 0)  metricBits.push(`${w.caloriesBurned} cal`);
    if (typeof w.exertionRating === "number") metricBits.push(`RPE ${w.exertionRating}`);
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

function formatSeconds(totalSecs) {
  if (typeof totalSecs !== "number" || isNaN(totalSecs)) return "0:00";
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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

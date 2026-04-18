/* ==========================================================
   GymUp — Workout Tracker
   Version: 3.2.0
   Build:   2026-04-18

   Changes in v3.2.0:
   - Landing page with two wizard cards (Pick Your Workout / Guided)
   - Wizard 1: custom workout builder (exercises + rounds + reps)
   - Wizard 2: guided beginner plan (coached)
   - Both wizards share the coached flow + timing + info modal
   - Metrics (duration, calories) moved into wizard finish step
   - RPE effort rating removed
   ========================================================== */

const APP_VERSION = "3.2.0";
const BUILD_DATE  = "2026-04-18";

const STORAGE_KEY  = "gymup_workouts";

// Default guided plan (fixed beginner workout)
const GUIDED_ROUNDS = 4;
const GUIDED_PLAN = [
  { id: "pushups", name: "Push-ups", reps: 12,  unit: "reps", icon: "💪", timer: null },
  { id: "situps",  name: "Sit-ups",  reps: 15,  unit: "reps", icon: "🔥", timer: null },
  { id: "squats",  name: "Squats",   reps: 15,  unit: "reps", icon: "🦵", timer: null },
  { id: "plank",   name: "Plank",    reps: 20,  unit: "sec",  icon: "🧱", timer: 20 }
];

// Exercise reference library (for info modal)
const EXERCISE_INFO = {
  pushups: {
    icon: "💪",
    muscles: "Chest • Shoulders • Triceps • Core",
    description: "Push-ups build pressing strength across the chest (pectoralis major), shoulders (anterior deltoids), and triceps, while the core works isometrically to keep the body rigid. Progressive overload with push-ups develops upper-body pushing power and scapular stability that transfers to almost every lifting and carrying task.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Pushup-2.svg/500px-Pushup-2.svg.png"
  },
  situps: {
    icon: "🔥",
    muscles: "Rectus Abdominis • Hip Flexors • Obliques",
    description: "Sit-ups train the full abdominal wall, particularly the rectus abdominis (the 'six-pack' muscle), along with the hip flexors that lift the torso and the obliques that stabilize the spine. A strong midsection protects the lower back, improves posture, and transfers force efficiently between upper and lower body.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Sit-up.svg/500px-Sit-up.svg.png"
  },
  squats: {
    icon: "🦵",
    muscles: "Quadriceps • Glutes • Hamstrings • Calves",
    description: "Squats build the largest muscles in the body — the quadriceps on the front of the thigh, the gluteus maximus, and the hamstrings — along with strong calves and a braced core. They drive functional lower-body strength for running, climbing, jumping, and carrying, and trigger a strong systemic hormonal response.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Squats.svg/500px-Squats.svg.png"
  },
  plank: {
    icon: "🧱",
    muscles: "Core • Shoulders • Glutes • Back",
    description: "The plank is an isometric hold that trains the entire core to resist movement rather than create it — building exactly the kind of stability your spine needs for heavy lifting, sports, and daily life. Shoulders, glutes, and upper back all contribute to holding a straight, rigid line from head to heels.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Plank.svg/500px-Plank.svg.png"
  }
};

/* ==========================================================
   VIEW ROUTING
   ========================================================== */

const landingView = document.getElementById("landingView");
const customView  = document.getElementById("customView");
const guidedView  = document.getElementById("guidedView");

function showView(name) {
  landingView.classList.add("hidden");
  customView.classList.add("hidden");
  guidedView.classList.add("hidden");
  if (name === "landing") landingView.classList.remove("hidden");
  if (name === "custom")  customView.classList.remove("hidden");
  if (name === "guided")  guidedView.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
}

// Wizard picker buttons
document.querySelectorAll(".wizard-card").forEach(btn => {
  btn.addEventListener("click", () => {
    const w = btn.dataset.wizard;
    if (w === "custom") {
      resetCustomWizard();
      showView("custom");
    } else if (w === "guided") {
      resetGuided();
      showView("guided");
    }
  });
});

// Back buttons
document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => {
    stopAllTimers();
    showView("landing");
    renderHistory();
  });
});

// Clear all data
document.getElementById("clearAllBtn").addEventListener("click", () => {
  const confirmed = confirm("This will permanently delete all saved workouts. Continue?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
});

document.addEventListener("DOMContentLoaded", () => {
  renderBuildInfo();
  renderHistory();
  initCustomWizard();
  initGuidedWizard();
});

function renderBuildInfo() {
  const el = document.getElementById("buildInfo");
  if (el) el.textContent = `GymUp v${APP_VERSION} \u2022 Build ${BUILD_DATE}`;
}

/* ==========================================================
   SHARED STATE + UTILITIES
   ========================================================== */

// Shared timers across whichever wizard is active
let exerciseInterval = null;
let exerciseStartMs  = 0;
let plankInterval    = null;
let restInterval     = null;
let restStartMs      = 0;

function stopAllTimers() {
  if (exerciseInterval) { clearInterval(exerciseInterval); exerciseInterval = null; }
  if (plankInterval)    { clearInterval(plankInterval); plankInterval = null; }
  if (restInterval)     { clearInterval(restInterval); restInterval = null; }
}

function isoDateFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function todayISO() { return isoDateFromDate(new Date()); }

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
    weekday: "short", year: "numeric", month: "short", day: "numeric"
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

/* ==========================================================
   INFO MODAL (shared)
   ========================================================== */

const infoModal         = document.getElementById("infoModal");
const modalCloseBtn     = document.getElementById("modalCloseBtn");
const modalTitle        = document.getElementById("modalTitle");
const modalImage        = document.getElementById("modalImage");
const modalFallback     = document.getElementById("modalFallback");
const modalMuscles      = document.getElementById("modalMuscles");
const modalDescription  = document.getElementById("modalDescription");

function openInfoModal(exerciseId, displayName) {
  const info = EXERCISE_INFO[exerciseId];
  if (!info) return;
  modalTitle.textContent = displayName || exerciseId;
  modalMuscles.textContent = info.muscles;
  modalDescription.textContent = info.description;

  modalFallback.textContent = info.icon;
  modalFallback.classList.add("hidden");
  modalImage.classList.remove("hidden");
  modalImage.onerror = () => {
    modalImage.classList.add("hidden");
    modalFallback.classList.remove("hidden");
  };
  modalImage.onload = () => {
    modalImage.classList.remove("hidden");
    modalFallback.classList.add("hidden");
  };
  modalImage.src = info.image;
  modalImage.alt = `${displayName} anatomy`;

  infoModal.classList.remove("hidden");
}

function closeInfoModal() { infoModal.classList.add("hidden"); }

modalCloseBtn.addEventListener("click", closeInfoModal);
infoModal.addEventListener("click", (e) => {
  if (e.target === infoModal) closeInfoModal();
});

/* ==========================================================
   COACH ENGINE
   A single reusable engine that drives a coached workout for
   any given plan. Both wizards instantiate one of these.
   ========================================================== */

function createCoachEngine(config) {
  // config: { plan, rounds, includeWalk, walkMiles, elements, onFinishReady }
  const plan = config.plan;         // array of { id, name, reps, unit, icon, timer? }
  const totalRounds = config.rounds;
  const includeWalk = config.includeWalk;
  const walkMilesGoal = config.walkMiles;
  const el = config.elements;

  const state = {
    currentRound: 1,
    currentExercise: 0,
    roundsCompleted: 0,
    exerciseCounts:  {},
    exerciseTimings: {},
    restTimings: [],
    walkCompleted: false,
    milesWalked: 0
  };
  plan.forEach(p => {
    state.exerciseCounts[p.id]  = 0;
    state.exerciseTimings[p.id] = [];
  });

  // ---------- Round intro ----------
  function showRoundIntro() {
    stopAllTimers();
    el.roundLabel.textContent  = `Round ${state.currentRound} of ${totalRounds}`;
    el.roundNumber.textContent = state.currentRound;
    state.currentExercise = 0;
    el.showScreen("roundIntro");
  }

  // ---------- Exercise screen ----------
  function showExercise() {
    const ex = plan[state.currentExercise];
    el.exerciseRoundLabel.textContent = `Round ${state.currentRound} of ${totalRounds}`;
    el.exerciseIcon.textContent = ex.icon || "🔥";
    el.exerciseName.textContent = ex.name;
    el.exerciseTarget.textContent = `${ex.reps} ${ex.unit}`;

    // Plank timer visible only when exercise has a timer
    if (ex.timer) {
      el.timerSection.classList.remove("hidden");
      el.timerDisplay.textContent = ex.timer;
      el.timerDisplay.classList.remove("running");
      el.timerStartBtn.textContent = "Start Timer";
      el.timerStartBtn.disabled = false;
    } else {
      el.timerSection.classList.add("hidden");
    }

    startExerciseLiveTimer();
    el.showScreen("exercise");
  }

  function startExerciseLiveTimer() {
    if (exerciseInterval) clearInterval(exerciseInterval);
    exerciseStartMs = Date.now();
    el.exerciseLiveTimer.textContent = "0:00";
    exerciseInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - exerciseStartMs) / 1000);
      el.exerciseLiveTimer.textContent = formatSeconds(elapsed);
    }, 1000);
  }

  function captureExerciseTime() {
    if (!exerciseStartMs) return 0;
    const secs = Math.max(1, Math.floor((Date.now() - exerciseStartMs) / 1000));
    exerciseStartMs = 0;
    if (exerciseInterval) { clearInterval(exerciseInterval); exerciseInterval = null; }
    return secs;
  }

  // ---------- Plank countdown ----------
  function startPlankTimer() {
    const ex = plan[state.currentExercise];
    if (!ex.timer) return;
    let remaining = ex.timer;
    el.timerDisplay.textContent = remaining;
    el.timerDisplay.classList.add("running");
    el.timerStartBtn.disabled = true;
    el.timerStartBtn.textContent = "Running...";
    if (plankInterval) clearInterval(plankInterval);
    plankInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        el.timerDisplay.textContent = "0";
        clearInterval(plankInterval); plankInterval = null;
        el.timerDisplay.classList.remove("running");
        el.timerStartBtn.textContent = "Done!";
        if (navigator.vibrate) navigator.vibrate(200);
      } else {
        el.timerDisplay.textContent = remaining;
      }
    }, 1000);
  }

  // ---------- Done / Back ----------
  function handleDone() {
    const ex = plan[state.currentExercise];
    const elapsed = captureExerciseTime();
    if (plankInterval) { clearInterval(plankInterval); plankInterval = null; }
    state.exerciseCounts[ex.id] += 1;
    state.exerciseTimings[ex.id].push(elapsed);

    if (state.currentExercise < plan.length - 1) {
      state.currentExercise += 1;
      showExercise();
    } else {
      state.roundsCompleted = state.currentRound;
      showRest();
    }
  }

  function handleBack() {
    if (exerciseInterval) { clearInterval(exerciseInterval); exerciseInterval = null; }
    if (plankInterval)    { clearInterval(plankInterval); plankInterval = null; }
    exerciseStartMs = 0;
    if (state.currentExercise > 0) {
      const prevEx = plan[state.currentExercise - 1];
      if (state.exerciseCounts[prevEx.id] > 0) {
        state.exerciseCounts[prevEx.id] -= 1;
        state.exerciseTimings[prevEx.id].pop();
      }
      state.currentExercise -= 1;
      showExercise();
    } else {
      showRoundIntro();
    }
  }

  // ---------- Rest ----------
  function showRest() {
    const isLast = state.currentRound >= totalRounds;
    el.restTitle.textContent = isLast ? "All Rounds Complete" : `Round ${state.currentRound} Complete`;
    el.nextRoundBtn.textContent = isLast
      ? (includeWalk ? "Continue to Walk" : "Finish Workout")
      : "Next Round";
    startRestTimer();
    el.showScreen("rest");
  }

  function startRestTimer() {
    if (restInterval) clearInterval(restInterval);
    restStartMs = Date.now();
    el.restTimer.textContent = "0:00";
    restInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - restStartMs) / 1000);
      el.restTimer.textContent = formatSeconds(elapsed);
    }, 1000);
  }

  function captureRestTime() {
    if (!restStartMs) return 0;
    const secs = Math.max(0, Math.floor((Date.now() - restStartMs) / 1000));
    restStartMs = 0;
    if (restInterval) { clearInterval(restInterval); restInterval = null; }
    return secs;
  }

  function handleNextRound() {
    const restSecs = captureRestTime();
    state.restTimings.push(restSecs);

    if (state.currentRound >= totalRounds) {
      if (includeWalk) {
        el.showScreen("walk");
      } else {
        el.showScreen("finish");
      }
    } else {
      state.currentRound += 1;
      showRoundIntro();
    }
  }

  function handleWalkDone(miles) {
    state.walkCompleted = true;
    state.milesWalked = miles;
    el.showScreen("finish");
  }

  function handleWalkSkip() {
    state.walkCompleted = false;
    state.milesWalked = 0;
    el.showScreen("finish");
  }

  function getState() {
    return state;
  }

  function getWalkGoal() {
    return walkMilesGoal;
  }

  return {
    start: () => { state.currentRound = 1; showRoundIntro(); },
    showExercise,
    startPlankTimer,
    handleDone,
    handleBack,
    handleNextRound,
    handleWalkDone,
    handleWalkSkip,
    getState,
    getWalkGoal,
    getCurrentExercise: () => plan[state.currentExercise],
    getPlan: () => plan
  };
}

/* ==========================================================
   CUSTOM WIZARD (Wizard 1)
   ========================================================== */

let customEngine = null;
let customDateValue = todayISO();
let customRounds = 4;

function initCustomWizard() {
  const customDate = document.getElementById("customDate");
  customDate.value = customDateValue;
  customDate.addEventListener("change", () => { customDateValue = customDate.value; });

  // Rounds stepper
  const stepper = document.getElementById("customRoundsStepper");
  const valueEl = document.getElementById("customRoundsValue");
  stepper.querySelectorAll(".stepper-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "inc" && customRounds < 10) customRounds++;
      if (btn.dataset.action === "dec" && customRounds > 1)  customRounds--;
      valueEl.textContent = customRounds;
    });
  });

  // Start workout
  document.getElementById("customStartBtn").addEventListener("click", () => {
    startCustomWorkout();
  });

  // Wire up coached screen buttons (custom)
  const customEl = {
    showScreen: (key) => showCustomScreen(key),
    roundLabel:         document.getElementById("customRoundLabel"),
    roundNumber:        document.getElementById("customRoundNumber"),
    exerciseRoundLabel: document.getElementById("customExerciseRoundLabel"),
    exerciseIcon:       document.getElementById("customExerciseIcon"),
    exerciseName:       document.getElementById("customExerciseName"),
    exerciseTarget:     document.getElementById("customExerciseTarget"),
    exerciseLiveTimer:  document.getElementById("customExerciseLiveTimer"),
    timerSection:       document.getElementById("customTimerSection"),
    timerDisplay:       document.getElementById("customTimerDisplay"),
    timerStartBtn:      document.getElementById("customTimerStartBtn"),
    restTitle:          document.getElementById("customRestTitle"),
    restTimer:          document.getElementById("customRestTimer"),
    nextRoundBtn:       document.getElementById("customNextRoundBtn")
  };
  // Store element refs on the custom wizard for reuse
  window.__customEl = customEl;

  document.getElementById("customBeginRoundBtn").addEventListener("click", () => {
    if (customEngine) customEngine.showExercise();
  });
  document.getElementById("customExerciseDoneBtn").addEventListener("click", () => {
    if (customEngine) customEngine.handleDone();
  });
  document.getElementById("customExerciseBackBtn").addEventListener("click", () => {
    if (customEngine) customEngine.handleBack();
  });
  document.getElementById("customExerciseInfoBtn").addEventListener("click", () => {
    if (!customEngine) return;
    const ex = customEngine.getCurrentExercise();
    openInfoModal(ex.id, ex.name);
  });
  document.getElementById("customTimerStartBtn").addEventListener("click", () => {
    if (customEngine) customEngine.startPlankTimer();
  });
  document.getElementById("customNextRoundBtn").addEventListener("click", () => {
    if (customEngine) customEngine.handleNextRound();
  });
  document.getElementById("customWalkDoneBtn").addEventListener("click", () => {
    if (!customEngine) return;
    const miles = parseFloat(document.getElementById("customWalkActual").value) || 0;
    customEngine.handleWalkDone(miles);
  });
  document.getElementById("customWalkSkipBtn").addEventListener("click", () => {
    if (customEngine) customEngine.handleWalkSkip();
  });
  document.getElementById("customSaveBtn").addEventListener("click", () => {
    saveCustomWorkout();
  });
}

function resetCustomWizard() {
  stopAllTimers();
  customDateValue = todayISO();
  customRounds = 4;
  customEngine = null;
  const customDate = document.getElementById("customDate");
  customDate.value = customDateValue;
  document.getElementById("customRoundsValue").textContent = customRounds;

  // Reset exercise rows to defaults
  const defaults = { pushups: 12, situps: 15, squats: 15, plank: 20 };
  document.querySelectorAll(".ex-enable").forEach(cb => cb.checked = true);
  document.querySelectorAll(".reps-input").forEach(inp => {
    const id = inp.dataset.ex;
    if (id && defaults[id] !== undefined) inp.value = defaults[id];
  });
  document.getElementById("customWalkEnable").checked = false;
  document.getElementById("customWalkMiles").value = "3.0";
  document.getElementById("customWalkActual").value = "";
  document.getElementById("customNotes").value = "";
  document.getElementById("customDuration").value = "";
  document.getElementById("customCalories").value = "";

  showCustomScreen("plan");
}

function showCustomScreen(key) {
  const map = {
    plan:       "customStepPlan",
    roundIntro: "customRoundIntro",
    exercise:   "customExercise",
    rest:       "customRest",
    walk:       "customWalk",
    finish:     "customFinish",
    summary:    "customSummary"
  };
  Object.values(map).forEach(id => document.getElementById(id).classList.add("hidden"));
  const target = map[key];
  if (target) document.getElementById(target).classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function startCustomWorkout() {
  // Build plan from checked exercises
  const selected = [];
  document.querySelectorAll(".ex-enable").forEach(cb => {
    if (!cb.checked) return;
    const id = cb.dataset.ex;
    const repsInput = document.querySelector(`.reps-input[data-ex="${id}"]`);
    const reps = parseInt(repsInput.value, 10) || 1;
    // Look up meta from GUIDED_PLAN defaults
    const meta = GUIDED_PLAN.find(p => p.id === id);
    selected.push({
      id:    id,
      name:  meta.name,
      reps:  reps,
      unit:  meta.unit,
      icon:  meta.icon,
      // Plank gets a countdown timer matching its configured seconds
      timer: id === "plank" ? reps : null
    });
  });

  if (selected.length === 0) {
    alert("Pick at least one exercise to start.");
    return;
  }

  const includeWalk = document.getElementById("customWalkEnable").checked;
  const walkMiles = parseFloat(document.getElementById("customWalkMiles").value) || 0;

  if (includeWalk) {
    document.getElementById("customWalkTarget").textContent = `Goal: ${walkMiles} miles`;
  }

  customEngine = createCoachEngine({
    plan: selected,
    rounds: customRounds,
    includeWalk: includeWalk,
    walkMiles: walkMiles,
    elements: window.__customEl
  });
  customEngine.start();
}

function saveCustomWorkout() {
  const s = customEngine.getState();
  const plan = customEngine.getPlan();
  const walkGoal = customEngine.getWalkGoal();

  const workout = {
    date:             customDateValue,
    mode:             "custom",
    totalRounds:      customRounds,
    plan:             plan.map(p => ({ id: p.id, name: p.name, reps: p.reps, unit: p.unit })),
    roundsCompleted:  s.roundsCompleted,
    exerciseCounts:   { ...s.exerciseCounts },
    exerciseTimings:  JSON.parse(JSON.stringify(s.exerciseTimings)),
    restTimings:      [...s.restTimings],
    walkGoal:         walkGoal,
    walkCompleted:    s.walkCompleted,
    milesWalked:      s.milesWalked,
    durationMinutes:  parseInt(document.getElementById("customDuration").value, 10) || 0,
    caloriesBurned:   parseInt(document.getElementById("customCalories").value, 10) || 0,
    notes:            document.getElementById("customNotes").value.trim(),
    timestamp:        Date.now()
  };

  commitWorkout(workout);
  renderSummary(workout, document.getElementById("customSummaryContent"));
  showCustomScreen("summary");
}

/* ==========================================================
   GUIDED WIZARD (Wizard 2)
   ========================================================== */

let guidedEngine = null;
let guidedDateValue = todayISO();

function initGuidedWizard() {
  const guidedDate = document.getElementById("guidedDate");
  guidedDate.value = guidedDateValue;
  guidedDate.addEventListener("change", () => { guidedDateValue = guidedDate.value; });

  const guidedEl = {
    showScreen: (key) => showGuidedScreen(key),
    roundLabel:         document.getElementById("roundLabel"),
    roundNumber:        document.getElementById("roundNumber"),
    exerciseRoundLabel: document.getElementById("exerciseRoundLabel"),
    exerciseIcon:       document.getElementById("exerciseIcon"),
    exerciseName:       document.getElementById("exerciseName"),
    exerciseTarget:     document.getElementById("exerciseTarget"),
    exerciseLiveTimer:  document.getElementById("exerciseLiveTimer"),
    timerSection:       document.getElementById("timerSection"),
    timerDisplay:       document.getElementById("timerDisplay"),
    timerStartBtn:      document.getElementById("timerStartBtn"),
    restTitle:          document.getElementById("restTitle"),
    restTimer:          document.getElementById("restTimer"),
    nextRoundBtn:       document.getElementById("nextRoundBtn")
  };
  window.__guidedEl = guidedEl;

  document.getElementById("startWorkoutBtn").addEventListener("click", () => {
    startGuidedWorkout();
  });
  document.getElementById("beginRoundBtn").addEventListener("click", () => {
    if (guidedEngine) guidedEngine.showExercise();
  });
  document.getElementById("exerciseDoneBtn").addEventListener("click", () => {
    if (guidedEngine) guidedEngine.handleDone();
  });
  document.getElementById("exerciseBackBtn").addEventListener("click", () => {
    if (guidedEngine) guidedEngine.handleBack();
  });
  document.getElementById("exerciseInfoBtn").addEventListener("click", () => {
    if (!guidedEngine) return;
    const ex = guidedEngine.getCurrentExercise();
    openInfoModal(ex.id, ex.name);
  });
  document.getElementById("timerStartBtn").addEventListener("click", () => {
    if (guidedEngine) guidedEngine.startPlankTimer();
  });
  document.getElementById("nextRoundBtn").addEventListener("click", () => {
    if (guidedEngine) guidedEngine.handleNextRound();
  });
  document.getElementById("walkDoneBtn").addEventListener("click", () => {
    if (!guidedEngine) return;
    const miles = parseFloat(document.getElementById("guidedMiles").value) || 0;
    guidedEngine.handleWalkDone(miles);
  });
  document.getElementById("walkSkipBtn").addEventListener("click", () => {
    if (guidedEngine) guidedEngine.handleWalkSkip();
  });
  document.getElementById("guidedSaveBtn").addEventListener("click", () => {
    saveGuidedWorkout();
  });
}

function resetGuided() {
  stopAllTimers();
  guidedEngine = null;
  guidedDateValue = todayISO();
  document.getElementById("guidedDate").value = guidedDateValue;
  document.getElementById("guidedMiles").value = "";
  document.getElementById("guidedNotes").value = "";
  document.getElementById("guidedDuration").value = "";
  document.getElementById("guidedCalories").value = "";
  showGuidedScreen("start");
}

function showGuidedScreen(key) {
  const map = {
    start:      "guidedStart",
    roundIntro: "guidedRoundIntro",
    exercise:   "guidedExercise",
    rest:       "guidedRest",
    walk:       "guidedWalk",
    finish:     "guidedFinish",
    summary:    "guidedSummary"
  };
  Object.values(map).forEach(id => document.getElementById(id).classList.add("hidden"));
  const target = map[key];
  if (target) document.getElementById(target).classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function startGuidedWorkout() {
  guidedEngine = createCoachEngine({
    plan:        GUIDED_PLAN,
    rounds:      GUIDED_ROUNDS,
    includeWalk: true,
    walkMiles:   3,
    elements:    window.__guidedEl
  });
  guidedEngine.start();
}

function saveGuidedWorkout() {
  const s = guidedEngine.getState();
  const plan = guidedEngine.getPlan();

  const workout = {
    date:             guidedDateValue,
    mode:             "guided",
    totalRounds:      GUIDED_ROUNDS,
    plan:             plan.map(p => ({ id: p.id, name: p.name, reps: p.reps, unit: p.unit })),
    roundsCompleted:  s.roundsCompleted,
    exerciseCounts:   { ...s.exerciseCounts },
    exerciseTimings:  JSON.parse(JSON.stringify(s.exerciseTimings)),
    restTimings:      [...s.restTimings],
    walkGoal:         3,
    walkCompleted:    s.walkCompleted,
    milesWalked:      s.milesWalked,
    durationMinutes:  parseInt(document.getElementById("guidedDuration").value, 10) || 0,
    caloriesBurned:   parseInt(document.getElementById("guidedCalories").value, 10) || 0,
    notes:            document.getElementById("guidedNotes").value.trim(),
    timestamp:        Date.now()
  };

  commitWorkout(workout);
  renderSummary(workout, document.getElementById("guidedSummaryContent"));
  showGuidedScreen("summary");
}

/* ==========================================================
   STATUS + SAVE + HISTORY + SUMMARY (shared)
   ========================================================== */

function computeStatus(w) {
  const rounds = w.totalRounds || 0;
  const plan = w.plan || [];
  const allExercisesComplete = plan.length > 0 && plan.every(p =>
    (w.exerciseCounts?.[p.id] || 0) === rounds
  );
  const fullWorkout = allExercisesComplete && w.roundsCompleted === rounds && rounds > 0;
  const anyWorkout  = (w.roundsCompleted || 0) > 0 ||
                      Object.values(w.exerciseCounts || {}).some(c => c > 0);

  if (fullWorkout && w.walkCompleted) return { label: "Full Workout + Walk Complete", cls: "complete" };
  if (fullWorkout && !w.walkCompleted) return { label: "Workout Complete (No Walk)", cls: "complete" };
  if (!anyWorkout && w.walkCompleted)  return { label: "Walk Only", cls: "partial" };
  return { label: "Partial Workout", cls: "partial" };
}

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

function renderSummary(w, targetEl) {
  const status  = computeStatus(w);
  const rounds  = w.totalRounds || 0;
  const plan    = w.plan || [];
  const counts  = w.exerciseCounts  || {};
  const timings = w.exerciseTimings || {};
  const milesText = w.milesWalked > 0 ? ` (${w.milesWalked} mi)` : "";

  // Per-exercise rows + timing breakdowns
  const exerciseBlocks = plan.map(p => {
    const n = counts[p.id] || 0;
    const countCls = n === rounds ? "yes" : (n > 0 ? "" : "no");
    let html = `
      <div class="summary-row">
        <span class="label-text">${p.name} <small style="color:var(--text-dim); font-weight:500;">(${p.reps} ${p.unit})</small></span>
        <span class="value ${countCls}">${n}/${rounds}</span>
      </div>`;

    const rt = timings[p.id];
    if (Array.isArray(rt) && rt.length > 0) {
      const chips = [];
      for (let i = 0; i < rounds; i++) {
        const t = rt[i];
        chips.push(`
          <div class="round-time-chip">
            R${i + 1}
            <strong>${typeof t === "number" ? formatSeconds(t) : "—"}</strong>
          </div>`);
      }
      const valid = rt.filter(t => typeof t === "number" && t > 0);
      const total = valid.reduce((a, b) => a + b, 0);
      const avg   = valid.length ? Math.round(total / valid.length) : 0;
      const gridStyle = `grid-template-columns: repeat(${Math.min(rounds, 4)}, 1fr);`;
      html += `
        <div class="exercise-breakdown">
          <div class="exercise-breakdown-title"><span>${p.name} — Round Times</span></div>
          <div class="exercise-breakdown-rounds" style="${gridStyle}">${chips.join("")}</div>
          <div class="exercise-breakdown-totals">
            Total: ${formatSeconds(total)} &bull; Avg: ${formatSeconds(avg)}
          </div>
        </div>`;
    }
    return html;
  }).join("");

  // Rest breakdown
  let restHtml = "";
  if (Array.isArray(w.restTimings) && w.restTimings.length > 0) {
    const chips = w.restTimings.map((secs, i) => `
      <div class="round-time-chip">
        Rest ${i + 1}
        <strong>${formatSeconds(secs)}</strong>
      </div>`);
    const total = w.restTimings.reduce((a, b) => a + b, 0);
    const gridStyle = `grid-template-columns: repeat(${Math.min(chips.length, 4)}, 1fr);`;
    restHtml = `
      <div class="exercise-breakdown">
        <div class="exercise-breakdown-title"><span>Rest Between Rounds</span></div>
        <div class="exercise-breakdown-rounds" style="${gridStyle}">${chips.join("")}</div>
        <div class="exercise-breakdown-totals">Total rest: ${formatSeconds(total)}</div>
      </div>`;
  }

  // Metrics
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
  const metricsHtml = metricParts.join("");

  const walkLabel = (w.walkGoal && w.walkGoal > 0)
    ? `Walk (${w.walkGoal} mi goal)${milesText}`
    : `Walk${milesText}`;

  targetEl.innerHTML = `
    <div class="summary-date">${formatDate(w.date)}</div>
    <div class="summary-headline ${status.cls}">${status.label}</div>

    <div class="summary-row">
      <span class="label-text">Rounds completed</span>
      <span class="value">${w.roundsCompleted} of ${rounds}</span>
    </div>
    ${exerciseBlocks}
    ${restHtml}
    <div class="summary-row">
      <span class="label-text">${walkLabel}</span>
      ${yesNo(w.walkCompleted)}
    </div>
    ${metricsHtml}

    ${w.notes ? `<div class="summary-notes">${escapeHtml(w.notes)}</div>` : ""}
  `;
}

function yesNo(bool) {
  return bool
    ? `<span class="value yes">Yes</span>`
    : `<span class="value no">No</span>`;
}

function renderHistory() {
  const historyList = document.getElementById("historyList");
  const workouts = loadWorkouts();

  if (workouts.length === 0) {
    historyList.innerHTML = `<p class="empty-text">No workouts saved yet.</p>`;
    return;
  }

  workouts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  historyList.innerHTML = workouts.map(w => {
    const status = computeStatus(w);
    const rounds = w.totalRounds || 0;
    const walkText = w.walkCompleted
      ? (w.milesWalked > 0 ? `Walk: ${w.milesWalked} mi` : "Walk: Yes")
      : "Walk: No";
    const modeTag = w.mode === "guided" ? " &bull; Guided" :
                    w.mode === "custom" ? " &bull; Custom" : "";

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
          Rounds: ${w.roundsCompleted}/${rounds} &nbsp;&bull;&nbsp; ${walkText}${modeTag}${metricText}
        </div>
        <span class="status-tag ${status.cls}">${status.label}</span>
        ${notePreview}
      </div>
    `;
  }).join("");
}

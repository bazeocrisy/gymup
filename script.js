/* ==========================================================
   Military Calisthenics Tracker
   Simple vanilla JS app with localStorage persistence.
   ========================================================== */

const STORAGE_KEY = "militaryTracker_workouts";

// ---------- DOM references ----------
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

// ---------- Initialize on load ----------
document.addEventListener("DOMContentLoaded", () => {
  setTodayAsDefault();
  updateRoundStatus();
  renderHistory();
});

// ---------- Date default ----------
function setTodayAsDefault() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

// ---------- Round status counter ----------
roundChecks.forEach(cb => cb.addEventListener("change", updateRoundStatus));

function updateRoundStatus() {
  const count = getRoundsCompleted();
  roundStatusEl.textContent = `${count} of 4 rounds complete`;
}

function getRoundsCompleted() {
  return Array.from(roundChecks).filter(cb => cb.checked).length;
}

// ---------- Save workout ----------
saveBtn.addEventListener("click", () => {
  const workout = gatherWorkoutData();
  const workouts = loadWorkouts();

  // If an entry for this date exists, replace it. Otherwise add new.
  const existingIndex = workouts.findIndex(w => w.date === workout.date);
  if (existingIndex !== -1) {
    workouts[existingIndex] = workout;
  } else {
    workouts.unshift(workout); // most recent first
  }

  saveWorkouts(workouts);
  renderSummary(workout);
  renderHistory();

  // Scroll to the summary so it's immediately visible
  summarySection.scrollIntoView({ behavior: "smooth", block: "start" });
});

function gatherWorkoutData() {
  return {
    date:              dateInput.value || todayString(),
    roundsCompleted:   getRoundsCompleted(),
    pushupsCompleted:  pushupsEl.checked,
    situpsCompleted:   situpsEl.checked,
    squatsCompleted:   squatsEl.checked,
    plankCompleted:    plankEl.checked,
    walkCompleted:     walkEl.checked,
    milesWalked:       parseFloat(milesEl.value) || 0,
    notes:             notesEl.value.trim(),
    timestamp:         Date.now()
  };
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ---------- localStorage helpers ----------
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

// ---------- Summary rendering ----------
function renderSummary(w) {
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

  summaryContent.innerHTML = `
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

  summarySection.classList.remove("hidden");
}

function yesNo(bool) {
  return bool
    ? `<span class="value yes">Yes</span>`
    : `<span class="value no">No</span>`;
}

// ---------- History rendering ----------
function renderHistory() {
  const workouts = loadWorkouts();

  if (workouts.length === 0) {
    historyList.innerHTML = `<p class="empty-text">No workouts saved yet.</p>`;
    return;
  }

  // Sort most recent first (by timestamp, falling back to date)
  workouts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  historyList.innerHTML = workouts.map(w => {
    const walkText = w.walkCompleted
      ? (w.milesWalked > 0 ? `Walk: ${w.milesWalked} mi` : "Walk: Yes")
      : "Walk: No";
    const notePreview = w.notes
      ? `<div class="history-note">"${escapeHtml(truncate(w.notes, 80))}"</div>`
      : "";
    return `
      <div class="history-item">
        <div class="history-date">${formatDate(w.date)}</div>
        <div class="history-meta">
          Rounds: ${w.roundsCompleted}/4 &nbsp;&bull;&nbsp; ${walkText}
        </div>
        ${notePreview}
      </div>
    `;
  }).join("");
}

// ---------- Reset form (does not touch saved data) ----------
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

// ---------- Clear all saved data ----------
clearAllBtn.addEventListener("click", () => {
  const confirmed = confirm(
    "This will permanently delete all saved workouts. Continue?"
  );
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  summarySection.classList.add("hidden");
});

// ---------- Utilities ----------
function formatDate(isoDate) {
  // Parse as local date to avoid timezone shifting (YYYY-MM-DD)
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

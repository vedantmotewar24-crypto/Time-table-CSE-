/**
 * COEP Tech CSE Timetable Portal - Core Application Logic
 * Odd Semester 2026–27 | S.Y. B.Tech Divisions 1 to 4
 * Fully Responsive with Mobile Touch UI & Adaptive Layouts
 */

// Application State
const isMobileDevice = window.innerWidth < 768;

const state = {
  data: null,
  selectedDivision: "SY CSE Div 1",
  selectedBatch: "ALL",
  selectedDay: "Monday",
  searchQuery: "",
  viewMode: isMobileDevice ? "day" : "grid", // Mobile defaults to Day Cards, Desktop to Grid
  isTimeMachineActive: false,
  simulatedDay: "Monday",
  simulatedTime: "10:45",
  theme: localStorage.getItem("coep_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  allEntries: []
};

// Days List (Mon to Sat)
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACADEMIC_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Slot Columns Definitions
const TIME_COLUMNS = [
  { header: "08:30 – 09:30", start: "08:30", end: "09:30", key: "08:30" },
  { header: "09:30 – 10:30", start: "09:30", end: "10:30", key: "09:30" },
  { header: "10:30 – 11:30", start: "10:30", end: "11:30", key: "10:30" },
  { header: "11:30 – 12:30", start: "11:30", end: "12:30", key: "11:30" },
  { header: "12:30 – 13:30", start: "12:30", end: "13:30", key: "12:30", isLunch: true },
  { header: "13:30 – 14:30", start: "13:30", end: "14:30", key: "13:30" },
  { header: "14:30 – 15:30", start: "14:30", end: "15:30", key: "14:30" },
  { header: "15:30 – 16:30", start: "15:30", end: "16:30", key: "15:30" },
  { header: "16:30 – 17:30", start: "16:30", end: "17:30", key: "16:30" },
  { header: "17:30 – 18:30", start: "17:30", end: "18:30", key: "17:30" }
];

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  await loadTimetableData();
  initLucideIcons();
  setupEventListeners();
  initLiveClockAndTracker();
  switchViewMode(state.viewMode);
  updateUI();
});

/**
 * Theme initialization and handling
 */
function initTheme() {
  if (state.theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("coep_theme", state.theme);
  initTheme();
}

/**
 * Load Timetable Data (from bundle window.TIMETABLE_DATA or fallback fetch)
 */
async function loadTimetableData() {
  if (window.TIMETABLE_DATA) {
    state.data = window.TIMETABLE_DATA;
    state.allEntries = state.data.timetable_entries || [];
  } else {
    try {
      const res = await fetch("timetable_data.json");
      state.data = await res.json();
      state.allEntries = state.data.timetable_entries || [];
    } catch (err) {
      console.error("Failed to load timetable_data.json:", err);
      showToast("Error loading timetable data", "error");
    }
  }

  // Determine current day of week
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  if (DAYS.includes(today)) {
    state.selectedDay = today;
    state.simulatedDay = today;
  }
}

/**
 * Initialize Lucide Icons
 */
function initLucideIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Theme Toggle
  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);

  // Print Button
  document.getElementById("printBtn").addEventListener("click", () => window.print());

  // Export .ICS Button
  document.getElementById("exportIcsBtn").addEventListener("click", exportIcsSchedule);

  // Reference Legends Button & Modal
  document.getElementById("openLegendBtn").addEventListener("click", openLegendModal);
  document.getElementById("closeLegendModalBtn").addEventListener("click", closeLegendModal);
  document.getElementById("closeLegendFooterBtn").addEventListener("click", closeLegendModal);
  document.getElementById("legendModal").addEventListener("click", (e) => {
    if (e.target.id === "legendModal") closeLegendModal();
  });

  // Division Tabs
  document.querySelectorAll("#divisionTabsContainer .div-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const divName = btn.getAttribute("data-div");
      selectDivision(divName);
    });
  });

  // View Mode Switches
  document.getElementById("viewModeGridBtn").addEventListener("click", () => switchViewMode("grid"));
  document.getElementById("viewModeDayBtn").addEventListener("click", () => switchViewMode("day"));
  document.getElementById("viewModeFacultyBtn").addEventListener("click", () => switchViewMode("faculty"));
  document.getElementById("viewModeRoomBtn").addEventListener("click", () => switchViewMode("room"));

  // Switch to Day Cards button from mobile tip notice
  const switchTipBtn = document.getElementById("switchToDayCardsBtn");
  if (switchTipBtn) {
    switchTipBtn.addEventListener("click", () => switchViewMode("day"));
  }

  // Day Agenda Tabs (Mon to Sat)
  document.querySelectorAll("#dayAgendaTabs .day-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedDay = btn.getAttribute("data-day");
      document.querySelectorAll("#dayAgendaTabs .day-tab-btn").forEach((b) => {
        b.classList.remove("active", "bg-white", "dark:bg-brand-600", "text-slate-900", "dark:text-white", "shadow-xs");
        b.classList.add("text-slate-600", "dark:text-slate-300");
      });
      btn.classList.add("active", "bg-white", "dark:bg-brand-600", "text-slate-900", "dark:text-white", "shadow-xs");
      btn.classList.remove("text-slate-600", "dark:text-slate-300");
      renderDayAgendaView();
    });
  });

  // Faculty Select Dropdown
  document.getElementById("facultySelectDropdown").addEventListener("change", (e) => {
    renderFacultySchedule(e.target.value);
  });

  // Room Select Dropdown
  document.getElementById("roomSelectDropdown").addEventListener("change", (e) => {
    renderRoomSchedule(e.target.value);
  });

  // Search Input (Desktop & Mobile)
  const desktopSearch = document.getElementById("globalSearchInput");
  const mobileSearch = document.getElementById("mobileSearchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const mobileClearSearchBtn = document.getElementById("mobileClearSearchBtn");

  const handleSearch = (val) => {
    state.searchQuery = val.trim().toLowerCase();
    if (state.searchQuery) {
      clearSearchBtn.classList.remove("hidden");
      mobileClearSearchBtn.classList.remove("hidden");
    } else {
      clearSearchBtn.classList.add("hidden");
      mobileClearSearchBtn.classList.add("hidden");
    }
    desktopSearch.value = val;
    mobileSearch.value = val;
    renderCurrentView();
  };

  desktopSearch.addEventListener("input", (e) => handleSearch(e.target.value));
  mobileSearch.addEventListener("input", (e) => handleSearch(e.target.value));

  clearSearchBtn.addEventListener("click", () => handleSearch(""));
  mobileClearSearchBtn.addEventListener("click", () => handleSearch(""));

  // Keyboard shortcut '/' for search
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== desktopSearch && document.activeElement !== mobileSearch) {
      e.preventDefault();
      desktopSearch.focus();
    }
    if (e.key === "Escape") {
      closeClassModal();
      closeLegendModal();
    }
  });

  // Class Modal Close
  document.getElementById("closeModalBtn").addEventListener("click", closeClassModal);
  document.getElementById("closeModalFooterBtn").addEventListener("click", closeClassModal);
  document.getElementById("classDetailsModal").addEventListener("click", (e) => {
    if (e.target.id === "classDetailsModal") closeClassModal();
  });

  // Copy Details Button in Modal
  document.getElementById("copyDetailsBtn").addEventListener("click", copyCurrentClassDetails);

  // Time Machine / Simulator Controls
  document.getElementById("toggleTimeMachineBtn").addEventListener("click", () => {
    state.isTimeMachineActive = !state.isTimeMachineActive;
    const panel = document.getElementById("timeSimulatorPanel");
    const statusText = document.getElementById("timeMachineStatusText");
    if (state.isTimeMachineActive) {
      panel.classList.remove("hidden");
      statusText.textContent = "Exit Simulator";
      showToast("Time Simulator enabled. Choose any Day and Time to test.", "info");
    } else {
      panel.classList.add("hidden");
      statusText.textContent = "Time Simulator";
      showToast("Returned to Live Real-Time clock.", "info");
    }
    updateLiveTracker();
  });

  document.getElementById("applySimTimeBtn").addEventListener("click", () => {
    state.simulatedDay = document.getElementById("simDaySelect").value;
    state.simulatedTime = document.getElementById("simTimeInput").value;
    updateLiveTracker();
    showToast(`Simulating: ${state.simulatedDay} at ${state.simulatedTime}`, "success");
  });

  document.getElementById("resetLiveTimeBtn").addEventListener("click", () => {
    state.isTimeMachineActive = false;
    document.getElementById("timeSimulatorPanel").classList.add("hidden");
    document.getElementById("timeMachineStatusText").textContent = "Time Simulator";
    updateLiveTracker();
  });
}

/**
 * Division Selection Handler
 */
function selectDivision(divName) {
  state.selectedDivision = divName;
  state.selectedBatch = "ALL"; // reset batch filter

  // Update tabs UI
  document.querySelectorAll("#divisionTabsContainer .div-tab-btn").forEach((btn) => {
    const isSelected = btn.getAttribute("data-div") === divName;
    if (isSelected) {
      btn.classList.add("active", "bg-white", "dark:bg-brand-600", "text-slate-900", "dark:text-white", "shadow-xs");
      btn.classList.remove("text-slate-600", "dark:text-slate-300");
    } else {
      btn.classList.remove("active", "bg-white", "dark:bg-brand-600", "text-slate-900", "dark:text-white", "shadow-xs");
      btn.classList.add("text-slate-600", "dark:text-slate-300");
    }
  });

  updateUI();
}

/**
 * Switch View Mode
 */
function switchViewMode(mode) {
  state.viewMode = mode;

  // Update button active classes
  const buttons = {
    grid: document.getElementById("viewModeGridBtn"),
    day: document.getElementById("viewModeDayBtn"),
    faculty: document.getElementById("viewModeFacultyBtn"),
    room: document.getElementById("viewModeRoomBtn")
  };

  const containers = {
    grid: document.getElementById("viewGridContainer"),
    day: document.getElementById("viewDayContainer"),
    faculty: document.getElementById("viewFacultyContainer"),
    room: document.getElementById("viewRoomContainer")
  };

  Object.keys(buttons).forEach((key) => {
    const btn = buttons[key];
    const isCur = key === mode;
    if (btn) {
      if (isCur) {
        btn.classList.add("active", "bg-white", "dark:bg-brand-600", "text-slate-900", "dark:text-white", "shadow-xs");
        btn.classList.remove("text-slate-600", "dark:text-slate-300");
      } else {
        btn.classList.remove("active", "bg-white", "dark:bg-brand-600", "text-slate-900", "dark:text-white", "shadow-xs");
        btn.classList.add("text-slate-600", "dark:text-slate-300");
      }
    }
  });

  // Toggle containers
  Object.keys(containers).forEach((key) => {
    if (containers[key]) {
      if (key === mode) {
        containers[key].classList.remove("hidden");
      } else {
        containers[key].classList.add("hidden");
      }
    }
  });

  // Toggle batch wrapper for faculty/room modes
  const batchWrapper = document.getElementById("batchFilterWrapper");
  if (batchWrapper) {
    if (mode === "faculty" || mode === "room") {
      batchWrapper.classList.add("hidden");
    } else {
      batchWrapper.classList.remove("hidden");
    }
  }

  renderCurrentView();
}

/**
 * Update Full UI State
 */
function updateUI() {
  renderBatchPills();
  renderStatistics();
  populateFacultyDropdown();
  populateRoomDropdown();
  renderCurrentView();
  updateLiveTracker();
}

/**
 * Render Current Active View
 */
function renderCurrentView() {
  if (state.viewMode === "grid") {
    renderTimetableGrid();
  } else if (state.viewMode === "day") {
    renderDayAgendaView();
  } else if (state.viewMode === "faculty") {
    const faculty = document.getElementById("facultySelectDropdown").value;
    renderFacultySchedule(faculty);
  } else if (state.viewMode === "room") {
    const room = document.getElementById("roomSelectDropdown").value;
    renderRoomSchedule(room);
  }
}

/**
 * Get distinct batches for the currently selected division
 */
function getBatchesForDivision(divName) {
  if (!state.data || !state.data.timetable_entries) return ["ALL"];
  const divEntries = state.data.timetable_entries.filter((e) => e.division === divName);
  const batchSet = new Set(["ALL"]);
  divEntries.forEach((e) => {
    if (e.batch && e.batch !== "ALL") batchSet.add(e.batch);
  });
  return Array.from(batchSet).sort((a, b) => {
    if (a === "ALL") return -1;
    if (b === "ALL") return 1;
    return a.localeCompare(b);
  });
}

/**
 * Render Batch Filter Pills
 */
function renderBatchPills() {
  const container = document.getElementById("batchPillsContainer");
  container.innerHTML = "";

  const batches = getBatchesForDivision(state.selectedDivision);

  batches.forEach((batch) => {
    const isSelected = state.selectedBatch === batch;
    const pill = document.createElement("button");
    pill.className = `touch-target px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
      isSelected
        ? "bg-brand-600 text-white shadow-xs"
        : "bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80"
    }`;
    pill.textContent = batch === "ALL" ? "All Batches" : batch;
    pill.addEventListener("click", () => {
      state.selectedBatch = batch;
      renderBatchPills();
      renderCurrentView();
      updateLiveTracker();
    });
    container.appendChild(pill);
  });

  // Update active batch tag in table header
  const batchTag = document.getElementById("activeBatchTag");
  if (batchTag) {
    batchTag.textContent = state.selectedBatch === "ALL" ? "Showing All Batches" : `Filtered for Batch: ${state.selectedBatch}`;
  }
}

/**
 * Render Weekly Timetable Grid with Sticky Day Column & Top Headers
 */
function renderTimetableGrid() {
  if (!state.data) return;

  const tbody = document.getElementById("timetableGridBody");
  tbody.innerHTML = "";

  document.getElementById("tableHeaderTitle").textContent = `Weekly Timetable • ${state.selectedDivision}`;

  const divEntries = state.allEntries.filter((e) => e.division === state.selectedDivision);

  ACADEMIC_DAYS.forEach((day) => {
    const row = document.createElement("tr");
    row.className = "hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors";

    // Sticky Left Day Header Cell
    const dayCell = document.createElement("td");
    dayCell.className = "sticky-day-col py-4 px-3 text-center font-bold text-xs sm:text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xs";
    
    // Check if this day is today
    const currentDayName = getCurrentDayName();
    const isToday = currentDayName === day;
    
    dayCell.innerHTML = `
      <div class="flex flex-col items-center gap-1">
        <span class="${isToday ? 'text-brand-600 dark:text-brand-400 font-extrabold' : ''}">${day.slice(0, 3)}</span>
        ${isToday ? '<span class="px-1.5 py-0.2 rounded text-[9px] bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 font-bold">TODAY</span>' : ''}
      </div>
    `;
    row.appendChild(dayCell);

    // Get day entries
    const dayEntries = divEntries.filter((e) => e.day === day);

    // Track merged column skips for 2-hour labs
    let colIdx = 0;
    while (colIdx < TIME_COLUMNS.length) {
      const col = TIME_COLUMNS[colIdx];

      // Lunch Slot (12:30 - 13:30)
      if (col.isLunch) {
        const lunchCell = document.createElement("td");
        lunchCell.className = "p-1.5 text-center border-r border-slate-200 dark:border-slate-800/60";
        lunchCell.innerHTML = `
          <div class="block-lunch h-24 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-semibold select-none">
            <i data-lucide="coffee" class="w-4 h-4 mb-1"></i>
            <span>LUNCH</span>
          </div>
        `;
        row.appendChild(lunchCell);
        colIdx++;
        continue;
      }

      // Find matching entries starting at this column time
      const matching = dayEntries.filter((e) => {
        const start = e.time_slot.split(" - ")[0].trim();
        return start === col.start;
      });

      // Filter by selected batch
      const filteredMatching = matching.filter((e) => {
        if (state.selectedBatch === "ALL") return true;
        return e.batch === "ALL" || e.batch === state.selectedBatch;
      });

      // Determine if this is a 2-hour block (e.g. 10:30-12:30, 13:30-15:30, 15:30-17:30)
      const has2HourBlock = filteredMatching.some((e) => {
        const parts = e.time_slot.split(" - ");
        if (parts.length === 2) {
          const s = parseInt(parts[0].replace(":", ""), 10);
          const end = parseInt(parts[1].replace(":", ""), 10);
          return (end - s) >= 150; // roughly 2 hours difference
        }
        return false;
      });

      const cell = document.createElement("td");
      cell.className = "p-1.5 align-top border-r border-slate-200 dark:border-slate-800/60";

      if (has2HourBlock) {
        cell.colSpan = 2;
      }

      if (filteredMatching.length === 0) {
        // Free Slot
        cell.innerHTML = `
          <div class="h-24 rounded-xl border border-dashed border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center text-slate-300 dark:text-slate-700 text-xs select-none">
            —
          </div>
        `;
      } else {
        // Build cards container
        const blockContainer = document.createElement("div");
        blockContainer.className = "space-y-1.5";

        filteredMatching.forEach((entry) => {
          const blockCard = createTimetableBlockCard(entry);
          blockContainer.appendChild(blockCard);
        });

        cell.appendChild(blockContainer);
      }

      row.appendChild(cell);

      if (has2HourBlock) {
        colIdx += 2; // Skip next column because it's spanned!
      } else {
        colIdx++;
      }
    }

    tbody.appendChild(row);
  });

  initLucideIcons();
}

/**
 * Create a visual timetable card for a session entry
 */
function createTimetableBlockCard(entry) {
  const card = document.createElement("div");

  // Determine styling class by session type
  let colorClass = "block-lecture";
  let badgeColor = "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (entry.session_type === "Lab") {
    colorClass = "block-lab";
    badgeColor = "bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
  } else if (entry.session_type === "Elective" || entry.subject_code === "ENTSP" || entry.subject_code === "MDCP") {
    colorClass = "block-elective";
    badgeColor = "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  }

  // Check search query highlight
  const isHighlighted = matchesSearch(entry, state.searchQuery);
  const highlightClass = isHighlighted ? "search-highlight ring-2 ring-brand-500" : "";

  card.className = `timetable-block ${colorClass} ${highlightClass} p-2.5 rounded-xl text-xs space-y-1.5 min-h-[5.5rem] flex flex-col justify-between`;

  // Duration label
  const is2h = entry.time_slot.includes("12:30") || entry.time_slot.includes("15:30") || entry.time_slot.includes("17:30");
  const durationText = is2h && entry.session_type === "Lab" ? "2h Lab" : "1h";

  card.innerHTML = `
    <div>
      <div class="flex items-center justify-between gap-1 mb-1">
        <span class="font-bold text-xs uppercase tracking-tight truncate">${entry.subject_code}</span>
        <div class="flex items-center gap-1">
          ${entry.batch !== "ALL" ? `<span class="px-1.5 py-0.2 text-[10px] font-bold rounded-md ${badgeColor}">${entry.batch}</span>` : ""}
          <span class="text-[9px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 font-mono">${durationText}</span>
        </div>
      </div>
      <div class="text-[11px] font-medium leading-tight line-clamp-1 opacity-90" title="${entry.subject_name}">
        ${entry.subject_name}
      </div>
    </div>

    <div class="pt-1 border-t border-current/10 flex items-center justify-between text-[10px] font-medium opacity-85">
      <span class="truncate flex items-center gap-1">
        <i data-lucide="map-pin" class="w-3 h-3"></i>
        ${entry.room_number || "—"}
      </span>
      <span class="truncate text-right ml-1 max-w-[80px]">
        ${entry.faculty ? entry.faculty.split(" ").pop() : "—"}
      </span>
    </div>
  `;

  card.addEventListener("click", () => openClassDetailsModal(entry));
  return card;
}

/**
 * Render Day / Mobile Agenda Timeline View (Vertically Stacked Cards)
 */
function renderDayAgendaView() {
  if (!state.data) return;

  const container = document.getElementById("dayAgendaTimeline");
  container.innerHTML = "";

  // Handle Saturday specially
  if (state.selectedDay === "Saturday") {
    document.getElementById("dayAgendaSummaryBadge").textContent = "Weekend • Saturday";
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-slate-500">
        <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center mx-auto mb-3">
          <i data-lucide="sparkles" class="w-6 h-6"></i>
        </div>
        <div class="font-bold text-base text-slate-800 dark:text-slate-200">No Scheduled Classes on Saturday</div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          Academic timetable runs Monday through Friday. Saturdays are reserved for project work, club activities, and self-study.
        </div>
      </div>
    `;
    initLucideIcons();
    return;
  }

  const divEntries = state.allEntries.filter(
    (e) => e.division === state.selectedDivision && e.day === state.selectedDay
  );

  const filtered = divEntries.filter((e) => {
    if (state.selectedBatch === "ALL") return true;
    return e.batch === "ALL" || e.batch === state.selectedBatch;
  });

  // Sort by start time
  filtered.sort((a, b) => {
    const timeA = a.time_slot.split(" - ")[0];
    const timeB = b.time_slot.split(" - ")[0];
    return timeA.localeCompare(timeB);
  });

  document.getElementById("dayAgendaSummaryBadge").textContent = `${filtered.length} Sessions on ${state.selectedDay}`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-slate-500">
        <i data-lucide="sun" class="w-8 h-8 mx-auto mb-2 text-amber-500"></i>
        <div class="font-bold text-base text-slate-800 dark:text-slate-200">No scheduled sessions for this batch filter</div>
        <div class="text-xs mt-1">Enjoy your free study or lab time!</div>
      </div>
    `;
    initLucideIcons();
    return;
  }

  filtered.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "relative pl-10 sm:pl-16 group";

    let colorBorder = "border-blue-500 text-blue-500";
    let typeBadge = "Lecture";
    let badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    
    if (entry.session_type === "Lab") {
      colorBorder = "border-emerald-500 text-emerald-500";
      typeBadge = "2-Hour Lab";
      badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    } else if (entry.session_type === "Elective" || entry.subject_code === "ENTSP" || entry.subject_code === "MDCP") {
      colorBorder = "border-amber-500 text-amber-500";
      typeBadge = "Elective / Special";
      badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    }

    card.innerHTML = `
      <!-- Timeline Node Circle -->
      <div class="absolute left-2.5 sm:left-4 top-4 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 ${colorBorder} z-10 flex items-center justify-center shadow-xs">
        <div class="w-1.5 h-1.5 rounded-full bg-current"></div>
      </div>

      <!-- Item Card with Large Mobile Touch Target -->
      <div class="bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100/90 dark:hover:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 transition-all shadow-xs cursor-pointer active:scale-[0.99] touch-manipulation">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeClass}">
              ${typeBadge}
            </span>
            ${entry.batch !== "ALL" ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono">Batch ${entry.batch}</span>` : `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">Entire Division</span>`}
            <h4 class="font-bold text-base text-slate-900 dark:text-white">${entry.subject_name} (${entry.subject_code})</h4>
          </div>
          <div class="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-3 py-1 rounded-lg border border-brand-200 dark:border-brand-800/60 self-start sm:self-auto">
            ${entry.time_slot}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-2.5 border-t border-slate-200 dark:border-slate-700/60">
          <div class="flex items-center gap-2">
            <i data-lucide="user" class="w-4 h-4 text-slate-400 shrink-0"></i>
            <span>Faculty: <strong>${entry.faculty || "Open / University Course"}</strong></span>
          </div>
          <div class="flex items-center gap-2">
            <i data-lucide="map-pin" class="w-4 h-4 text-slate-400 shrink-0"></i>
            <span>Room: <strong>${entry.room_number || "—"}</strong> (${entry.room_name || "N/A"})</span>
          </div>
        </div>
      </div>
    `;

    card.querySelector(".cursor-pointer").addEventListener("click", () => openClassDetailsModal(entry));
    container.appendChild(card);
  });

  initLucideIcons();
}

/**
 * Populate Faculty Dropdown & Schedule
 */
function populateFacultyDropdown() {
  const select = document.getElementById("facultySelectDropdown");
  if (!select || !state.data) return;

  const facultySet = new Set();
  state.allEntries.forEach((e) => {
    if (e.faculty) facultySet.add(e.faculty);
  });

  const sortedFaculty = Array.from(facultySet).sort();
  select.innerHTML = sortedFaculty.map((f) => `<option value="${f}">${f}</option>`).join("");

  if (sortedFaculty.length > 0) {
    renderFacultySchedule(sortedFaculty[0]);
  }
}

function renderFacultySchedule(facultyName) {
  const container = document.getElementById("facultyScheduleResults");
  if (!container || !state.data) return;

  const facultyEntries = state.allEntries.filter((e) => e.faculty === facultyName);

  if (facultyEntries.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400">No schedule found for ${facultyName}.</div>`;
    return;
  }

  // Group by Day
  let html = `
    <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
          ${facultyName.split(" ").map(n => n[0]).join("")}
        </div>
        <div>
          <div class="font-bold text-base text-slate-900 dark:text-white">${facultyName}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">Total Teaching Load: <strong>${facultyEntries.length} Sessions/Week</strong></div>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto scrollbar-thin">
      <table class="w-full text-left text-xs border-collapse min-w-[550px]">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-700 dark:text-slate-300">
            <th class="py-3 px-3">Day</th>
            <th class="py-3 px-3">Time Slot</th>
            <th class="py-3 px-3">Division</th>
            <th class="py-3 px-3">Batch</th>
            <th class="py-3 px-3">Subject</th>
            <th class="py-3 px-3">Room / Lab</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
  `;

  facultyEntries.sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.time_slot.localeCompare(b.time_slot);
  });

  facultyEntries.forEach((e) => {
    html += `
      <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
        <td class="py-3 px-3 font-semibold text-slate-900 dark:text-white">${e.day}</td>
        <td class="py-3 px-3 font-mono text-brand-600 dark:text-brand-400 font-semibold">${e.time_slot}</td>
        <td class="py-3 px-3 font-medium">${e.division}</td>
        <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold text-[10px]">${e.batch}</span></td>
        <td class="py-3 px-3 font-medium">${e.subject_name} (${e.subject_code})</td>
        <td class="py-3 px-3 font-semibold text-emerald-600 dark:text-emerald-400">${e.room_number || "—"}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

/**
 * Populate Room Dropdown & Occupancy Schedule
 */
function populateRoomDropdown() {
  const select = document.getElementById("roomSelectDropdown");
  if (!select || !state.data) return;

  const roomSet = new Set();
  state.allEntries.forEach((e) => {
    if (e.room_number) roomSet.add(e.room_number);
  });

  const sortedRooms = Array.from(roomSet).sort();
  select.innerHTML = sortedRooms.map((r) => `<option value="${r}">${r}</option>`).join("");

  if (sortedRooms.length > 0) {
    renderRoomSchedule(sortedRooms[0]);
  }
}

function renderRoomSchedule(roomCode) {
  const container = document.getElementById("roomScheduleResults");
  if (!container || !state.data) return;

  const roomEntries = state.allEntries.filter((e) => e.room_number === roomCode);

  const sampleEntry = roomEntries[0];
  const roomFullName = sampleEntry ? sampleEntry.room_name : roomCode;

  let html = `
    <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
          <i data-lucide="map-pin" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="font-bold text-base text-slate-900 dark:text-white">${roomCode} — ${roomFullName}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">Total Occupancy: <strong>${roomEntries.length} Sessions/Week</strong></div>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto scrollbar-thin">
      <table class="w-full text-left text-xs border-collapse min-w-[550px]">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-700 dark:text-slate-300">
            <th class="py-3 px-3">Day</th>
            <th class="py-3 px-3">Time Slot</th>
            <th class="py-3 px-3">Division</th>
            <th class="py-3 px-3">Batch</th>
            <th class="py-3 px-3">Subject</th>
            <th class="py-3 px-3">Faculty In-Charge</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
  `;

  roomEntries.sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.time_slot.localeCompare(b.time_slot);
  });

  roomEntries.forEach((e) => {
    html += `
      <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
        <td class="py-3 px-3 font-semibold text-slate-900 dark:text-white">${e.day}</td>
        <td class="py-3 px-3 font-mono text-brand-600 dark:text-brand-400 font-semibold">${e.time_slot}</td>
        <td class="py-3 px-3 font-medium">${e.division}</td>
        <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold text-[10px]">${e.batch}</span></td>
        <td class="py-3 px-3 font-medium">${e.subject_name} (${e.subject_code})</td>
        <td class="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">${e.faculty || "—"}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
  initLucideIcons();
}

/**
 * Statistics Cards Calculation
 */
function renderStatistics() {
  if (!state.data) return;

  const divEntries = state.allEntries.filter((e) => e.division === state.selectedDivision);

  const lectures = divEntries.filter((e) => e.session_type === "Lecture").length;
  const labs = divEntries.filter((e) => e.session_type === "Lab").length;
  
  const facultySet = new Set();
  const roomSet = new Set();
  divEntries.forEach((e) => {
    if (e.faculty) facultySet.add(e.faculty);
    if (e.room_number) roomSet.add(e.room_number);
  });

  document.getElementById("statLectureCount").textContent = lectures;
  document.getElementById("statLabCount").textContent = labs;
  document.getElementById("statFacultyCount").textContent = facultySet.size;
  document.getElementById("statRoomCount").textContent = roomSet.size;
}

/**
 * Real-time Clock & Live Class Tracker Radar
 */
function initLiveClockAndTracker() {
  setInterval(() => {
    updateClockDisplay();
    updateLiveTracker();
  }, 1000);
  updateClockDisplay();
  updateLiveTracker();
}

function updateClockDisplay() {
  const clock = document.getElementById("headerLiveTime");
  if (!clock) return;
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("en-US", { hour12: false });
}

function getCurrentDayName() {
  if (state.isTimeMachineActive) return state.simulatedDay;
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function getCurrentMinutesOfDay() {
  if (state.isTimeMachineActive) {
    const parts = state.simulatedTime.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeStrToMinutes(timeStr) {
  const parts = timeStr.trim().split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Calculate & Update Live Class Radar
 */
function updateLiveTracker() {
  if (!state.data) return;

  const curDay = getCurrentDayName();
  const curMinutes = getCurrentMinutesOfDay();

  document.getElementById("trackerDivisionBadge").textContent = `${state.selectedDivision} • ${
    state.selectedBatch === "ALL" ? "All Batches" : "Batch " + state.selectedBatch
  }`;

  // Filter entries for selected division and batch on current day
  const divDayEntries = state.allEntries.filter((e) => {
    if (e.division !== state.selectedDivision || e.day !== curDay) return false;
    if (state.selectedBatch !== "ALL") {
      return e.batch === "ALL" || e.batch === state.selectedBatch;
    }
    return true;
  });

  // Find active ongoing class
  let activeEntry = null;
  let nextEntry = null;
  let minNextStart = Infinity;

  divDayEntries.forEach((entry) => {
    const [startStr, endStr] = entry.time_slot.split(" - ");
    const startMin = timeStrToMinutes(startStr);
    const endMin = timeStrToMinutes(endStr);

    if (curMinutes >= startMin && curMinutes < endMin) {
      activeEntry = { ...entry, startMin, endMin };
    } else if (startMin > curMinutes && startMin < minNextStart) {
      minNextStart = startMin;
      nextEntry = { ...entry, startMin, endMin };
    }
  });

  // Update Main Tracker Title
  const mainTitle = document.getElementById("trackerMainTitle");
  const subTitle = document.getElementById("trackerSubtitle");

  if (activeEntry) {
    mainTitle.innerHTML = `<span class="text-emerald-400 font-extrabold">${activeEntry.subject_code}</span> in Progress (${activeEntry.room_number || "Open"})`;
    subTitle.textContent = `${activeEntry.subject_name} • Instructor: ${activeEntry.faculty || "Not Assigned"}`;

    // Update Active Card
    document.getElementById("activeClassName").textContent = activeEntry.subject_name;
    document.getElementById("activeClassRoom").innerHTML = `<i data-lucide="map-pin" class="w-3 h-3 text-emerald-400"></i> ${activeEntry.room_number || "Open Room"}`;
    document.getElementById("activeClassFaculty").textContent = activeEntry.faculty || "Open";
    document.getElementById("activeClassTime").textContent = activeEntry.time_slot;

    const remaining = activeEntry.endMin - curMinutes;
    document.getElementById("activeClassRemaining").textContent = `${remaining} min left`;

    const totalDuration = activeEntry.endMin - activeEntry.startMin;
    const elapsed = curMinutes - activeEntry.startMin;
    const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    document.getElementById("activeClassProgress").style.width = `${percent}%`;
  } else {
    // No active class
    const isWeekend = curDay === "Saturday" || curDay === "Sunday";
    if (isWeekend) {
      mainTitle.textContent = "Weekend — No scheduled sessions";
      subTitle.textContent = "Take time to review your coursework and recharge.";
    } else if (curMinutes < 8 * 60 + 30) {
      mainTitle.textContent = "Classes start at 08:30 AM";
      subTitle.textContent = "Good morning! Check your upcoming classes below.";
    } else if (curMinutes >= 18 * 60 + 30) {
      mainTitle.textContent = "College day ended";
      subTitle.textContent = "All scheduled sessions for today have concluded.";
    } else {
      mainTitle.textContent = "Free Period / Recess right now";
      subTitle.textContent = "No active class in session at this moment.";
    }

    document.getElementById("activeClassName").textContent = "No ongoing session";
    document.getElementById("activeClassRoom").textContent = "—";
    document.getElementById("activeClassFaculty").textContent = "—";
    document.getElementById("activeClassTime").textContent = "—";
    document.getElementById("activeClassRemaining").textContent = "Free";
    document.getElementById("activeClassProgress").style.width = "0%";
  }

  // Update Next Card
  if (nextEntry) {
    document.getElementById("nextClassName").textContent = nextEntry.subject_name;
    document.getElementById("nextClassRoom").innerHTML = `<i data-lucide="map-pin" class="w-3 h-3 text-indigo-400"></i> ${nextEntry.room_number || "—"}`;
    document.getElementById("nextClassFaculty").textContent = nextEntry.faculty || "—";
    document.getElementById("nextClassTime").textContent = nextEntry.time_slot;

    const diff = nextEntry.startMin - curMinutes;
    document.getElementById("nextClassCountdown").textContent = `Starts in ${diff} mins`;
  } else {
    document.getElementById("nextClassName").textContent = "No more classes today";
    document.getElementById("nextClassRoom").textContent = "—";
    document.getElementById("nextClassFaculty").textContent = "—";
    document.getElementById("nextClassTime").textContent = "—";
    document.getElementById("nextClassCountdown").textContent = "Done for day";
  }

  initLucideIcons();
}

/**
 * Search Match Utility
 */
function matchesSearch(entry, query) {
  if (!query) return false;
  const fields = [
    entry.subject_name,
    entry.subject_code,
    entry.faculty,
    entry.room_number,
    entry.room_name,
    entry.batch,
    entry.division
  ].map((f) => (f || "").toLowerCase());

  return fields.some((field) => field.includes(query));
}

/**
 * Modal Dialog for Class Details
 */
let currentModalEntry = null;

function openClassDetailsModal(entry) {
  currentModalEntry = entry;
  const modal = document.getElementById("classDetailsModal");
  const content = modal.querySelector(".modal-content");

  document.getElementById("modalSubjectName").textContent = entry.subject_name;
  document.getElementById("modalSubjectCode").textContent = `Code: ${entry.subject_code}`;
  document.getElementById("modalTypeBadge").textContent = entry.session_type;
  document.getElementById("modalBatchBadge").textContent = entry.batch === "ALL" ? "Entire Division" : `Batch ${entry.batch}`;

  document.getElementById("modalDayTime").textContent = `${entry.day} • ${entry.time_slot}`;
  document.getElementById("modalFaculty").textContent = entry.faculty || "Not Assigned / University Course";
  document.getElementById("modalRoomCode").textContent = entry.room_number || "No physical room assigned";
  document.getElementById("modalRoomFullName").textContent = entry.room_name || "N/A";
  document.getElementById("modalTargetClass").textContent = `${entry.division} • Batch ${entry.batch}`;

  // Theme color for banner
  const banner = document.getElementById("modalHeaderBanner");
  if (entry.session_type === "Lab") {
    banner.className = "p-5 sm:p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white relative shrink-0";
  } else if (entry.session_type === "Elective") {
    banner.className = "p-5 sm:p-6 bg-gradient-to-r from-amber-600 to-orange-700 text-white relative shrink-0";
  } else {
    banner.className = "p-5 sm:p-6 bg-gradient-to-r from-brand-600 to-indigo-700 text-white relative shrink-0";
  }

  modal.classList.remove("hidden");
  setTimeout(() => content.classList.add("show"), 10);
  initLucideIcons();
}

function closeClassModal() {
  const modal = document.getElementById("classDetailsModal");
  const content = modal.querySelector(".modal-content");
  content.classList.remove("show");
  setTimeout(() => modal.classList.add("hidden"), 150);
}

function copyCurrentClassDetails() {
  if (!currentModalEntry) return;
  const text = `
Course: ${currentModalEntry.subject_name} (${currentModalEntry.subject_code})
Type: ${currentModalEntry.session_type}
Division: ${currentModalEntry.division} | Batch: ${currentModalEntry.batch}
Schedule: ${currentModalEntry.day} at ${currentModalEntry.time_slot}
Room: ${currentModalEntry.room_number || "N/A"} (${currentModalEntry.room_name || ""})
Faculty: ${currentModalEntry.faculty || "N/A"}
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    showToast("Class details copied to clipboard!", "success");
  });
}

/**
 * Reference Legend Modal
 */
function openLegendModal() {
  const modal = document.getElementById("legendModal");
  const content = modal.querySelector(".modal-content");

  // Populate Rooms
  const roomsContainer = document.getElementById("legendRoomsGrid");
  roomsContainer.innerHTML = "";

  const divData = state.data && state.data.division_timetables ? state.data.division_timetables[state.selectedDivision] : null;
  const rooms = divData ? divData.rooms : {};

  Object.entries(rooms).forEach(([code, name]) => {
    const item = document.createElement("div");
    item.className = "p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-2.5";
    item.innerHTML = `
      <span class="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono font-bold text-xs shrink-0">
        ${code}
      </span>
      <div class="text-xs text-slate-700 dark:text-slate-300 leading-tight">
        ${name}
      </div>
    `;
    roomsContainer.appendChild(item);
  });

  // Populate Subjects
  const subjectsContainer = document.getElementById("legendSubjectsGrid");
  subjectsContainer.innerHTML = "";
  const subjects = divData ? divData.subjects : {};

  Object.entries(subjects).forEach(([code, name]) => {
    const item = document.createElement("div");
    item.className = "p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-2.5";
    item.innerHTML = `
      <span class="px-2 py-1 rounded-md bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-mono font-bold text-xs shrink-0">
        ${code}
      </span>
      <div class="text-xs text-slate-700 dark:text-slate-300 leading-tight">
        ${name}
      </div>
    `;
    subjectsContainer.appendChild(item);
  });

  modal.classList.remove("hidden");
  setTimeout(() => content.classList.add("show"), 10);
  initLucideIcons();
}

function closeLegendModal() {
  const modal = document.getElementById("legendModal");
  const content = modal.querySelector(".modal-content");
  content.classList.remove("show");
  setTimeout(() => modal.classList.add("hidden"), 150);
}

/**
 * Export Timetable to iCalendar (.ics) format
 */
function exportIcsSchedule() {
  if (!state.data) return;

  const divEntries = state.allEntries.filter((e) => {
    if (e.division !== state.selectedDivision) return false;
    if (state.selectedBatch !== "ALL") {
      return e.batch === "ALL" || e.batch === state.selectedBatch;
    }
    return true;
  });

  const dayMapToIcs = {
    Monday: "MO",
    Tuesday: "TU",
    Wednesday: "WE",
    Thursday: "TH",
    Friday: "FR",
    Saturday: "SA"
  };

  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//COEP Technological University//CSE Timetable Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:COEP CSE ${state.selectedDivision} (${state.selectedBatch})`
  ];

  // Base reference date (Monday of semester start e.g. 2026-08-03)
  const baseDates = {
    Monday: "20260803",
    Tuesday: "20260804",
    Wednesday: "20260805",
    Thursday: "20260806",
    Friday: "20260807"
  };

  divEntries.forEach((entry, idx) => {
    const [startStr, endStr] = entry.time_slot.split(" - ");
    const startFormatted = startStr.replace(":", "") + "00";
    const endFormatted = endStr.replace(":", "") + "00";
    const baseDate = baseDates[entry.day] || "20260803";

    const dtStart = `${baseDate}T${startFormatted}`;
    const dtEnd = `${baseDate}T${endFormatted}`;
    const rruleDay = dayMapToIcs[entry.day] || "MO";

    icsContent.push(
      "BEGIN:VEVENT",
      `UID:coep-tt-${state.selectedDivision}-${idx}-${Date.now()}@coep.ac.in`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
      `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};UNTIL=20261215T235959Z`,
      `SUMMARY:${entry.subject_code} - ${entry.subject_name} (${entry.session_type})`,
      `LOCATION:${entry.room_number || "COEP Tech"} - ${entry.room_name || ""}`,
      `DESCRIPTION:Division: ${entry.division}\\nBatch: ${entry.batch}\\nFaculty: ${entry.faculty || "N/A"}\\nType: ${entry.session_type}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  });

  icsContent.push("END:VCALENDAR");

  const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${state.selectedDivision.replace(/\s+/g, "_")}_${state.selectedBatch}_timetable.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Exported ${divEntries.length} classes to iCalendar (.ics)`, "success");
}

/**
 * Toast Notification Helper
 */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");

  let bgColor = "bg-slate-900 text-white border-slate-700";
  let icon = "info";
  if (type === "success") {
    bgColor = "bg-emerald-900/90 text-emerald-100 border-emerald-700";
    icon = "check-circle";
  } else if (type === "error") {
    bgColor = "bg-rose-900/90 text-rose-100 border-rose-700";
    icon = "alert-circle";
  }

  toast.className = `${bgColor} pointer-events-auto px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 transition-all duration-300 transform translate-y-4 opacity-0`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  initLucideIcons();

  setTimeout(() => {
    toast.classList.remove("translate-y-4", "opacity-0");
  }, 10);

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

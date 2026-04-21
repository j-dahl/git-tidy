// ===========================================================
//  GitHub Issue Cleaner — content script
//  1. Per-category toggle for noisy timeline events on issues/PRs
//  2. Repo navigator panel on GitHub project pages
// ===========================================================

(function () {
  "use strict";

  const STORAGE_KEY = "ghic-settings";
  const SCAN_DEBOUNCE_MS = 400;
  const REPO_NAV_DEBOUNCE_MS = 800;

  // ---- noise categories mapped to timeline event ID prefixes --
  const CATEGORIES = {
    labels:      { name: "Labels",          prefixes: ["LE", "UNLE"], icon: "🏷️" },
    issueType:   { name: "Issue type",      prefixes: ["ITAE"],       icon: "🔖" },
    crossRef:    { name: "Cross-references",prefixes: ["CRE"],        icon: "🔗" },
    stateChange: { name: "State changes",   prefixes: ["CE", "REE"],  icon: "🔄" },
    projectBoard:{ name: "Project board",   prefixes: ["ATPVTE", "PVTISC"], icon: "📋" },
    rename:      { name: "Renames",         prefixes: ["RTE"],        icon: "✏️" },
    assignment:  { name: "Assignments",     prefixes: ["AE", "UAE"],  icon: "👤" },
    milestone:   { name: "Milestones",      prefixes: ["MIE", "DMFE"],icon: "🎯" },
    parentChild: { name: "Parent/sub-issue",prefixes: ["PIAE", "SIAE"],icon: "🔗" },
    fieldChange: { name: "Field changes",   prefixes: ["IFAE"],       icon: "📝" },
    locked:      { name: "Lock/unlock",     prefixes: ["LOCKE", "UNLOCKE"], icon: "🔒" },
    pinned:      { name: "Pin/unpin",       prefixes: ["PINNE", "UNPINNE"], icon: "📌" },
  };

  // Prefixes that are always real content (never noise)
  const KEEP_PREFIXES = ["IC"]; // IC = Issue Comment

  // ---- state -----------------------------------------------
  let settings = {};       // category key → boolean (true = hidden)
  let noiseItems = [];     // { el, category, prefix }
  let settingsPanel = null;
  let toggleBtn = null;

  // ---- detect page type ------------------------------------
  function isIssuePage() {
    return /^\/[^/]+\/[^/]+\/(issues|pull)\/\d+/.test(location.pathname);
  }

  function isProjectPage() {
    return /^\/orgs\/[^/]+\/projects\/\d+/.test(location.pathname);
  }

  // Returns true if timeline noise events might be present
  function hasTimelineContent() {
    return isIssuePage() || isProjectPage();
  }

  // ---- persistence -----------------------------------------
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        settings = JSON.parse(raw);
      } else {
        // Default: hide labels, project board, cross-refs
        Object.keys(CATEGORIES).forEach((k) => { settings[k] = true; });
        // Keep state changes visible by default
        settings.stateChange = false;
      }
    } catch (e) {
      Object.keys(CATEGORIES).forEach((k) => { settings[k] = true; });
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { /* storage unavailable */ }
  }

  // ---- classify a timeline event by its ID prefix -----------
  function classifyEvent(eventId) {
    const prefix = eventId.split("_")[0];
    // Check if it's a "keep" item
    if (KEEP_PREFIXES.some((p) => prefix === p)) return null;
    // Find matching category
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      if (cat.prefixes.some((p) => prefix === p)) return key;
    }
    // Unknown system event — classify as "other"
    return "other";
  }

  // ---- scan for noise elements ------------------------------
  function scanForNoise() {
    // Clean up
    noiseItems.forEach(({ el }) => {
      el.classList.remove("ghic-noise-item", "ghic-noise-hidden");
      el.removeAttribute("data-ghic-category");
    });
    noiseItems = [];

    const timelineEls = document.querySelectorAll("[data-timeline-event-id]");
    timelineEls.forEach((el) => {
      const eventId = el.getAttribute("data-timeline-event-id");
      const category = classifyEvent(eventId);
      if (category) {
        el.classList.add("ghic-noise-item");
        el.setAttribute("data-ghic-category", category);
        noiseItems.push({ el, category, prefix: eventId.split("_")[0] });
      }
    });

    applyVisibility();
    updateButton();
  }

  // ---- apply show/hide based on per-category settings -------
  function applyVisibility() {
    noiseItems.forEach(({ el, category }) => {
      const hidden = settings[category] !== false; // default to hidden
      el.classList.toggle("ghic-noise-hidden", hidden);
    });
  }

  // ---- floating settings button & panel ---------------------
  function createButton() {
    if (toggleBtn) return;

    toggleBtn = document.createElement("button");
    toggleBtn.id = "ghic-toggle-btn";
    toggleBtn.title = "GitHub Issue Cleaner — toggle noise categories";
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSettingsPanel();
    });
    document.body.appendChild(toggleBtn);

    // Close panel on outside click
    document.addEventListener("click", (e) => {
      if (settingsPanel && settingsPanel.style.display !== "none" &&
          !settingsPanel.contains(e.target) && e.target !== toggleBtn) {
        settingsPanel.style.display = "none";
      }
    });

    updateButton();
  }

  function updateButton() {
    if (!toggleBtn) return;
    const total = noiseItems.length;
    const hidden = noiseItems.filter(({ category }) => settings[category] !== false).length;
    if (total === 0) {
      toggleBtn.style.display = "none";
      return;
    }
    toggleBtn.style.display = "";
    toggleBtn.innerHTML = `
      <span class="ghic-icon">🧹</span>
      <span>Noise</span>
      <span class="ghic-count">${hidden}/${total}</span>
    `;
  }

  function removeButton() {
    if (toggleBtn) { toggleBtn.remove(); toggleBtn = null; }
    if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; }
  }

  // ---- settings panel with per-category toggles -------------
  function toggleSettingsPanel() {
    if (!settingsPanel) {
      settingsPanel = document.createElement("div");
      settingsPanel.id = "ghic-settings-panel";
      document.body.appendChild(settingsPanel);
    }

    if (settingsPanel.style.display !== "none" && settingsPanel.innerHTML) {
      settingsPanel.style.display = "none";
      return;
    }

    renderSettingsPanel();
    settingsPanel.style.display = "";
  }

  function renderSettingsPanel() {
    if (!settingsPanel) return;

    // Count items per category
    const counts = {};
    noiseItems.forEach(({ category }) => {
      counts[category] = (counts[category] || 0) + 1;
    });

    let html = `<div class="ghic-panel-header">
      <span>Toggle noise categories</span>
      <div class="ghic-panel-actions">
        <button id="ghic-hide-all" title="Hide all">Hide all</button>
        <button id="ghic-show-all" title="Show all">Show all</button>
      </div>
    </div><div class="ghic-panel-list">`;

    // Render categories that have items, plus any with count > 0
    const activeCategories = Object.entries(CATEGORIES).filter(
      ([key]) => counts[key] > 0
    );

    // Also show "other" if there are uncategorized events
    if (counts.other > 0) {
      activeCategories.push(["other", { name: "Other events", icon: "❓", prefixes: [] }]);
    }

    activeCategories.forEach(([key, cat]) => {
      const count = counts[key] || 0;
      const hidden = settings[key] !== false;
      html += `
        <label class="ghic-category-row" data-category="${key}">
          <input type="checkbox" ${hidden ? "checked" : ""} data-cat="${key}" />
          <span class="ghic-cat-icon">${cat.icon}</span>
          <span class="ghic-cat-name">${cat.name}</span>
          <span class="ghic-cat-count">${count}</span>
        </label>`;
    });

    html += `</div>`;
    settingsPanel.innerHTML = html;

    // Bind checkbox events
    settingsPanel.querySelectorAll("input[data-cat]").forEach((cb) => {
      cb.addEventListener("change", () => {
        settings[cb.dataset.cat] = cb.checked;
        saveSettings();
        applyVisibility();
        updateButton();
      });
    });

    // Bind hide-all / show-all
    settingsPanel.querySelector("#ghic-hide-all").addEventListener("click", () => {
      Object.keys(counts).forEach((k) => { settings[k] = true; });
      saveSettings();
      applyVisibility();
      updateButton();
      renderSettingsPanel();
    });
    settingsPanel.querySelector("#ghic-show-all").addEventListener("click", () => {
      Object.keys(counts).forEach((k) => { settings[k] = false; });
      saveSettings();
      applyVisibility();
      updateButton();
      renderSettingsPanel();
    });
  }

  // =============================================================
  //  FEATURE 2 — Repo Navigator for GitHub Project pages
  //  Scans project items for repo references and displays a
  //  floating panel for quick navigation to associated repos.
  // =============================================================

  let repoNavBtn = null;
  let repoNavPanel = null;
  let repoNavOpen = false;
  let knownRepos = new Map(); // "org/repo" → { count, url }

  function getProjectOrg() {
    const m = location.pathname.match(/^\/orgs\/([^/]+)\/projects\//);
    return m ? m[1] : null;
  }

  function scanForRepos() {
    const repos = new Map();

    // Strategy 1: scan all links pointing to issues/PRs
    document.querySelectorAll('a[href]').forEach((a) => {
      const m = a.href.match(
        /github\.com\/([^/]+\/[^/]+)\/(issues|pull)\/\d+/
      );
      if (m) {
        const repoPath = m[1];
        const entry = repos.get(repoPath) || { count: 0, url: `https://github.com/${repoPath}` };
        entry.count++;
        repos.set(repoPath, entry);
      }
    });

    // Strategy 2: scan text nodes that look like "repo#123" references
    const org = getProjectOrg();
    if (org) {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );
      const pattern = /([A-Za-z0-9_.-]+)#\d+/g;
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent;
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const repoName = match[1];
          // Skip common false positives
          if (repoName.length < 2 || /^\d+$/.test(repoName)) continue;
          const repoPath = `${org}/${repoName}`;
          if (!repos.has(repoPath)) {
            repos.set(repoPath, { count: 1, url: `https://github.com/${repoPath}` });
          }
        }
      }
    }

    knownRepos = repos;
  }

  function createRepoNavButton() {
    if (repoNavBtn) return;

    repoNavBtn = document.createElement("button");
    repoNavBtn.id = "ghic-repo-nav-btn";
    repoNavBtn.title = "Project repositories";
    repoNavBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      repoNavOpen = !repoNavOpen;
      updateRepoNavPanel();
    });
    document.body.appendChild(repoNavBtn);

    // Close panel when clicking outside
    document.addEventListener("click", (e) => {
      if (
        repoNavOpen &&
        repoNavPanel &&
        !repoNavPanel.contains(e.target) &&
        e.target !== repoNavBtn
      ) {
        repoNavOpen = false;
        updateRepoNavPanel();
      }
    });

    updateRepoNavButton();
  }

  function updateRepoNavButton() {
    if (!repoNavBtn) return;
    const count = knownRepos.size;
    if (count === 0) {
      repoNavBtn.style.display = "none";
      return;
    }
    repoNavBtn.style.display = "";
    repoNavBtn.innerHTML = `
      <span class="ghic-icon">📂</span>
      <span>Repos</span>
      <span class="ghic-count">${count}</span>
    `;
  }

  function updateRepoNavPanel() {
    if (!repoNavPanel) {
      repoNavPanel = document.createElement("div");
      repoNavPanel.id = "ghic-repo-nav-panel";
      document.body.appendChild(repoNavPanel);
    }

    if (!repoNavOpen || knownRepos.size === 0) {
      repoNavPanel.style.display = "none";
      return;
    }

    // Sort repos by item count descending
    const sorted = [...knownRepos.entries()].sort(
      (a, b) => b[1].count - a[1].count
    );

    const org = getProjectOrg();
    let html = `<div class="ghic-repo-nav-header">
      <span>Repositories in this project</span>
      <button id="ghic-repo-nav-close" title="Close">✕</button>
    </div>
    <div class="ghic-repo-nav-list">`;

    sorted.forEach(([repoPath, info]) => {
      // Show short name if same org, full path otherwise
      const shortName = org && repoPath.startsWith(org + "/")
        ? repoPath.slice(org.length + 1)
        : repoPath;

      html += `
        <a href="${info.url}" class="ghic-repo-nav-item" target="_blank" rel="noopener">
          <span class="ghic-repo-nav-icon">📦</span>
          <span class="ghic-repo-nav-name" title="${repoPath}">${shortName}</span>
          <span class="ghic-repo-nav-count">${info.count} item${info.count !== 1 ? "s" : ""}</span>
        </a>`;
    });

    html += `</div>`;
    repoNavPanel.innerHTML = html;
    repoNavPanel.style.display = "";

    // Bind close button
    const closeBtn = repoNavPanel.querySelector("#ghic-repo-nav-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        repoNavOpen = false;
        updateRepoNavPanel();
      });
    }
  }

  function removeRepoNav() {
    if (repoNavBtn) { repoNavBtn.remove(); repoNavBtn = null; }
    if (repoNavPanel) { repoNavPanel.remove(); repoNavPanel = null; }
    repoNavOpen = false;
    knownRepos.clear();
  }

  // ---- debounced rescan (for SPA navigation) ----------------
  let scanTimer = null;
  let repoScanTimer = null;

  function debouncedScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      if (hasTimelineContent()) {
        scanForNoise();
        if (!toggleBtn) createButton();
      } else {
        cleanupNoise();
      }

      if (isProjectPage()) {
        debouncedRepoScan();
      } else {
        removeRepoNav();
      }
    }, SCAN_DEBOUNCE_MS);
  }

  function debouncedRepoScan() {
    clearTimeout(repoScanTimer);
    repoScanTimer = setTimeout(() => {
      scanForRepos();
      if (!repoNavBtn) createRepoNavButton();
      updateRepoNavButton();
      if (repoNavOpen) updateRepoNavPanel();
    }, REPO_NAV_DEBOUNCE_MS);
  }

  function cleanupNoise() {
    noiseItems.forEach(({ el }) => {
      el.classList.remove("ghic-noise-item", "ghic-noise-hidden");
      el.removeAttribute("data-ghic-category");
    });
    noiseItems = [];
    removeButton();
  }

  // ---- init -------------------------------------------------
  function init() {
    loadSettings();

    if (hasTimelineContent()) {
      scanForNoise();
      createButton();
    }

    if (isProjectPage()) {
      scanForRepos();
      createRepoNavButton();
    }

    // GitHub uses Turbo/pjax for navigation — watch for URL changes
    const observer = new MutationObserver(() => debouncedScan());
    observer.observe(document.body, { childList: true, subtree: true });

    // Also listen for turbo navigation events
    document.addEventListener("turbo:load", debouncedScan);
    document.addEventListener("turbo:render", debouncedScan);
    document.addEventListener("pjax:end", debouncedScan);
  }

  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

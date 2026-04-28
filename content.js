// ===========================================================
//  GitTidy — content script
//  1. Per-category noise toggle on issues, PRs, and project panes
//  2. Repo navigator panel on GitHub project pages
//  3. Project association badges on issue/PR pages
//  4. Issue age indicator
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
  let manuallyRevealed = new Set(); // elements user clicked to reveal
  let settingsPanel = null;
  let toggleBtn = null;
  let lastPath = location.pathname;
  let settingsClickHandler = null;
  let repoNavClickHandler = null;
  let escapeHandler = null;
  let isMutating = false;

  // ---- detect page type ------------------------------------
  function isIssuePage() {
    return /^\/[^/]+\/[^/]+\/(issues|pull)\/\d+/.test(location.pathname);
  }

  function isProjectPage() {
    return /^\/(orgs|users)\/[^/]+\/projects\/\d+/.test(location.pathname);
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
        settings.other = false;
      }
    } catch (e) {
      Object.keys(CATEGORIES).forEach((k) => { settings[k] = true; });
      settings.stateChange = false;
      settings.other = false;
    }
    if (settings.other === undefined) settings.other = false;
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { /* storage unavailable */ }
  }

  // ---- classify a timeline event by its ID prefix -----------
  function classifyEvent(eventId, el) {
    if (el?.querySelector(".timeline-comment, .comment-body, .review-comment, .js-comment-container")) {
      return null;
    }

    const prefix = eventId.split("_")[0];
    // Check if it's a "keep" item
    if (KEEP_PREFIXES.some((p) => prefix === p)) return null;
    // Find matching category
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      if (cat.prefixes.some((p) => prefix === p)) return key;
    }
    // Unknown system event — leave visible unless explicitly classified elsewhere.
    return null;
  }

  // ---- classify PR timeline items by octicon class ----------
  const PR_NOISE_ICONS = {
    "octicon-eye":       "reviewRequest",  // requested review
    "octicon-repo-push": "commits",        // pushed commits
    "octicon-bookmark":  "crossRef",       // linked issue
    "octicon-git-branch":"branch",         // branch events
    "octicon-person":    "assignment",      // assigned
  };

  const PR_CATEGORIES_EXTRA = {
    reviewRequest: { name: "Review requests", icon: "👁️" },
    commits:       { name: "Commit pushes",   icon: "📦" },
    branch:        { name: "Branch events",   icon: "🌿" },
  };

  function classifyPRItem(el) {
    // Skip items that contain actual review comments or PR comments
    if (el.querySelector(".timeline-comment, .comment-body, .review-comment, .js-comment-container")) {
      return null;
    }
    // Check octicon classes
    const svgs = el.querySelectorAll("svg[class*='octicon-']");
    for (const svg of svgs) {
      const cls = svg.getAttribute("class") || "";
      for (const [icon, category] of Object.entries(PR_NOISE_ICONS)) {
        if (cls.includes(icon)) return category;
      }
    }
    // Non-comment TimelineItem with no recognized icon = other noise
    if (el.querySelector(".TimelineItem") && !el.querySelector(".timeline-comment")) {
      return "other";
    }
    return null;
  }

  // ---- scan for noise elements ------------------------------
  function scanForNoise() {
    isMutating = true;
    // Clean up — but preserve manually revealed items' visual state
    noiseItems.forEach(({ el }) => {
      if (!manuallyRevealed.has(el)) {
        el.classList.remove("ghic-noise-item", "ghic-noise-hidden");
      } else {
        el.classList.remove("ghic-noise-item");
        // keep ghic-noise-hidden removed (they were revealed)
      }
      el.removeAttribute("data-ghic-category");
    });
    noiseItems = [];

    // Strategy 1: New-style issue pages (data-timeline-event-id)
    const timelineEls = document.querySelectorAll("[data-timeline-event-id]");
    timelineEls.forEach((el) => {
      const eventId = el.getAttribute("data-timeline-event-id");
      const category = classifyEvent(eventId, el);
      if (category) {
        el.classList.add("ghic-noise-item");
        el.setAttribute("data-ghic-category", category);
        noiseItems.push({ el, category, prefix: eventId.split("_")[0] });
      }
    });

    // Strategy 2: Old-style PR pages (.js-timeline-item)
    if (timelineEls.length === 0) {
      const prItems = document.querySelectorAll(".js-timeline-item");
      prItems.forEach((el) => {
        const category = classifyPRItem(el);
        if (category) {
          el.classList.add("ghic-noise-item");
          el.setAttribute("data-ghic-category", category);
          noiseItems.push({ el, category, prefix: "PR" });
        }
      });
    }

    isMutating = false;
    applyVisibility();
    updateButton();
  }

  // ---- apply show/hide based on per-category settings -------
  function applyVisibility() {
    isMutating = true;
    noiseItems.forEach(({ el, category }) => {
      // Don't re-hide items the user manually revealed
      if (manuallyRevealed.has(el)) return;
      const hidden = settings[category] !== false; // default to hidden
      el.classList.toggle("ghic-noise-hidden", hidden);
    });
    isMutating = false;
    insertHiddenPlaceholders();
  }

  function insertHiddenPlaceholders() {
    isMutating = true;
    // Remove existing placeholders
    document.querySelectorAll(".ghic-hidden-placeholder").forEach(p => p.remove());

    if (noiseItems.length === 0) { isMutating = false; return; }

    // Group consecutive hidden items
    let run = [];
    const allTimeline = document.querySelectorAll("[data-timeline-event-id], .js-timeline-item");
    
    allTimeline.forEach((el) => {
      if (el.classList.contains("ghic-noise-hidden")) {
        run.push(el);
      } else {
        if (run.length > 0) {
          createPlaceholder(run);
          run = [];
        }
      }
    });
    if (run.length > 0) createPlaceholder(run);
    isMutating = false;
  }

  function createPlaceholder(hiddenItems) {
    const placeholder = document.createElement("div");
    placeholder.className = "ghic-hidden-placeholder";
    placeholder.textContent = `⋯ ${hiddenItems.length} system event${hiddenItems.length !== 1 ? "s" : ""} hidden`;
    placeholder.title = "Click to reveal hidden events";
    const items = [...hiddenItems];
    placeholder.addEventListener("click", () => {
      isMutating = true;
      items.forEach(item => {
        item.classList.remove("ghic-noise-hidden");
        manuallyRevealed.add(item);
      });
      placeholder.remove();
      isMutating = false;
      updateButton();
    });
    const lastHidden = hiddenItems[hiddenItems.length - 1];
    lastHidden.parentNode.insertBefore(placeholder, lastHidden.nextSibling);
  }

  // ---- floating settings button & panel ---------------------
  function createButton() {
    if (toggleBtn) return;

    toggleBtn = document.createElement("button");
    toggleBtn.id = "ghic-toggle-btn";
    toggleBtn.title = "GitTidy — toggle noise categories (Shift+H)";
    toggleBtn.setAttribute("aria-label", "GitTidy noise settings (Shift+H)");
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.setAttribute("aria-controls", "ghic-settings-panel");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSettingsPanel();
    });
    document.body.appendChild(toggleBtn);

    // Close panel on outside click
    if (settingsClickHandler) document.removeEventListener("click", settingsClickHandler);
    settingsClickHandler = (e) => {
      if (settingsPanel && settingsPanel.style.display !== "none" &&
          !settingsPanel.contains(e.target) && e.target !== toggleBtn) {
        settingsPanel.style.display = "none";
        if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
      }
    };
    document.addEventListener("click", settingsClickHandler);

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
      <span class="ghic-icon" aria-hidden="true">🧹</span>
      <span>Noise</span>
      <span class="ghic-count">${hidden}/${total}</span>
    `;
  }

  function removeButton() {
    if (settingsClickHandler) { document.removeEventListener("click", settingsClickHandler); settingsClickHandler = null; }
    if (toggleBtn) { toggleBtn.remove(); toggleBtn = null; }
    if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; }
  }

  // ---- settings panel with per-category toggles -------------
  function toggleSettingsPanel() {
    if (!settingsPanel) {
      settingsPanel = document.createElement("div");
      settingsPanel.id = "ghic-settings-panel";
      settingsPanel.setAttribute("role", "dialog");
      settingsPanel.setAttribute("aria-label", "GitTidy noise settings");
      document.body.appendChild(settingsPanel);
    }

    if (settingsPanel.style.display !== "none" && settingsPanel.innerHTML) {
      settingsPanel.style.display = "none";
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
      return;
    }

    renderSettingsPanel();
    settingsPanel.style.display = "";
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
  }

  function renderSettingsPanel() {
    if (!settingsPanel) return;

    // Count items per category
    const counts = {};
    noiseItems.forEach(({ category }) => {
      counts[category] = (counts[category] || 0) + 1;
    });

    let html = `<div class="ghic-panel-header">
      <span>Show these event types</span>
      <div class="ghic-panel-actions">
        <button id="ghic-hide-all" title="Hide all">Hide all</button>
        <button id="ghic-show-all" title="Show all">Show all</button>
      </div>
    </div><div class="ghic-panel-list">`;

    // Render categories that have items
    const allCategories = { ...CATEGORIES, ...PR_CATEGORIES_EXTRA };
    const activeCategories = Object.entries(allCategories).filter(
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
          <input type="checkbox" ${hidden ? "" : "checked"} data-cat="${key}" />
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
        settings[cb.dataset.cat] = !cb.checked;
        saveSettings();
        applyVisibility();
        updateButton();
        insertHiddenPlaceholders();
      });
    });

    // Bind hide-all / show-all
    settingsPanel.querySelector("#ghic-hide-all").addEventListener("click", () => {
      manuallyRevealed.clear();
      Object.keys(counts).forEach((k) => { settings[k] = true; });
      saveSettings();
      applyVisibility();
      updateButton();
      renderSettingsPanel();
    });
    settingsPanel.querySelector("#ghic-show-all").addEventListener("click", () => {
      manuallyRevealed.clear();
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
  let seenItemUrls = new Set(); // persistent dedup across scans

  function getProjectOwner() {
    const m = location.pathname.match(/^\/(?:orgs|users)\/([^/]+)\/projects\//);
    return m ? m[1] : null;
  }

  function scanForRepos() {
    // Accumulate into knownRepos across scans (GitHub virtualizes project boards)
    const root = document.querySelector('[data-testid="project-view"]')
      || document.querySelector("main")
      || document.body;

    root.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest("[id^='ghic-']")) return;
      const m = a.href.match(/github\.com\/([^/]+\/[^/]+)\/(issues|pull)\/(\d+)/);
      if (m) {
        const repoPath = m[1];
        const itemKey = `${repoPath}/${m[2]}/${m[3]}`;
        if (seenItemUrls.has(itemKey)) return;
        seenItemUrls.add(itemKey);
        const entry = knownRepos.get(repoPath) || { count: 0, url: `https://github.com/${repoPath}` };
        entry.count++;
        knownRepos.set(repoPath, entry);
      }
    });

    const org = getProjectOwner();
    if (org) {
      const walkRoot = document.querySelector('[data-testid="project-view"]')
        || document.querySelector("main")
        || document.body;
      const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "SVG") return NodeFilter.FILTER_REJECT;
          if (parent.closest("[id^='ghic-']")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const pattern = /([A-Za-z0-9_.-]+)#\d+/g;
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent;
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const repoName = match[1];
          if (repoName.length < 2 || /^\d+$/.test(repoName)) continue;
          const repoPath = `${org}/${repoName}`;
          if (!knownRepos.has(repoPath)) {
            knownRepos.set(repoPath, { count: 1, url: `https://github.com/${repoPath}` });
          }
        }
      }
    }
  }

  function createRepoNavButton() {
    if (repoNavBtn) return;

    repoNavBtn = document.createElement("button");
    repoNavBtn.id = "ghic-repo-nav-btn";
    repoNavBtn.title = "Project repositories";
    repoNavBtn.setAttribute("aria-label", "Project repositories");
    repoNavBtn.setAttribute("aria-expanded", "false");
    repoNavBtn.setAttribute("aria-controls", "ghic-repo-nav-panel");
    repoNavBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      repoNavOpen = !repoNavOpen;
      updateRepoNavPanel();
    });
    document.body.appendChild(repoNavBtn);

    // Close panel when clicking outside
    if (repoNavClickHandler) document.removeEventListener("click", repoNavClickHandler);
    repoNavClickHandler = (e) => {
      if (
        repoNavOpen &&
        repoNavPanel &&
        !repoNavPanel.contains(e.target) &&
        e.target !== repoNavBtn
      ) {
        repoNavOpen = false;
        updateRepoNavPanel();
      }
    };
    document.addEventListener("click", repoNavClickHandler);

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
      <span class="ghic-icon" aria-hidden="true">📂</span>
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
      if (repoNavBtn) repoNavBtn.setAttribute("aria-expanded", "false");
      return;
    }

    if (repoNavBtn) repoNavBtn.setAttribute("aria-expanded", "true");

    // Sort repos by item count descending
    const sorted = [...knownRepos.entries()].sort(
      (a, b) => b[1].count - a[1].count
    );

    const org = getProjectOwner();
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
    clearTimeout(repoScanTimer);
    repoScanTimer = null;
    if (repoNavClickHandler) { document.removeEventListener("click", repoNavClickHandler); repoNavClickHandler = null; }
    if (repoNavBtn) { repoNavBtn.remove(); repoNavBtn = null; }
    if (repoNavPanel) { repoNavPanel.remove(); repoNavPanel = null; }
    repoNavOpen = false;
    knownRepos.clear();
    seenItemUrls.clear();
  }

  // =============================================================
  //  FEATURE 3 — Project Association Badges
  //  Scrapes sidebar DOM for project names and surfaces them
  //  as clickable pills near the issue/PR title.
  // =============================================================

  let projectBadgesInjected = false;
  let badgeRetryTimer = null;
  let badgeObserver = null;

  function injectProjectBadges() {
    // Remove previous badges
    document.querySelectorAll(".ghic-project-badge, .ghic-project-badge-container").forEach((b) => b.remove());
    projectBadgesInjected = false;

    if (!isIssuePage()) { stopBadgeRetry(); return; }

    // Collect project names from all sidebar sources
    const projects = [];

    // New-style sidebar: data-testid="project-title"
    document.querySelectorAll('[data-testid="project-title"]').forEach((pt) => {
      const name = pt.textContent.trim();
      const link = pt.closest("a");
      projects.push({ name, url: link ? link.href : "#" });
    });

    // Old-style sidebar (some PR pages)
    if (projects.length === 0) {
      document.querySelectorAll(".sidebar-projects-section a, .js-issue-sidebar-form a").forEach((a) => {
        if (a.href.includes("/projects/")) {
          projects.push({ name: a.textContent.trim(), url: a.href });
        }
      });
    }

    // If no projects found yet, start watching for sidebar to load
    if (projects.length === 0) {
      startBadgeRetry();
      return;
    }

    stopBadgeRetry();

    // Find the title area to inject badges
    const titleEl =
      document.querySelector("h1.gh-header-title") ||          // old issues
      document.querySelector('[data-testid="issue-title"]') ||  // new issues
      document.querySelector(".js-issue-title");                // fallback

    if (!titleEl) return;

    const container = document.createElement("span");
    container.className = "ghic-project-badge-container";

    projects.forEach(({ name, url }) => {
      const badge = document.createElement("a");
      badge.className = "ghic-project-badge";
      badge.href = url;
      badge.textContent = "📋 " + name;
      badge.title = "Project: " + name;
      container.appendChild(badge);
    });

    if (container.children.length > 0) {
      titleEl.parentElement.insertBefore(container, titleEl.nextSibling);
      projectBadgesInjected = true;
    }
  }

  // Retry mechanism: watch the sidebar for project data to appear
  function startBadgeRetry() {
    if (badgeObserver) return; // already watching

    // Observe the sidebar area for new children (project section loads async)
    const sidebar = document.querySelector('[data-testid="sidebar-projects-section"]')
      || document.querySelector(".js-issue-sidebar-form")
      || document.querySelector('[class*="sidebar"]');

    if (sidebar) {
      badgeObserver = new MutationObserver(() => {
        const found = document.querySelectorAll('[data-testid="project-title"]');
        if (found.length > 0) {
          stopBadgeRetry();
          injectProjectBadges();
        }
      });
      badgeObserver.observe(sidebar, { childList: true, subtree: true });
    }

    // Also poll briefly in case the sidebar element itself loads late
    let attempts = 0;
    const maxAttempts = 15; // ~7.5 seconds total
    clearInterval(badgeRetryTimer);
    badgeRetryTimer = setInterval(() => {
      attempts++;
      if (projectBadgesInjected || attempts >= maxAttempts || !isIssuePage()) {
        stopBadgeRetry();
        return;
      }
      const found = document.querySelectorAll('[data-testid="project-title"]');
      if (found.length > 0) {
        stopBadgeRetry();
        injectProjectBadges();
      }
    }, 500);
  }

  function stopBadgeRetry() {
    clearInterval(badgeRetryTimer);
    badgeRetryTimer = null;
    if (badgeObserver) { badgeObserver.disconnect(); badgeObserver = null; }
  }

  // =============================================================
  //  FEATURE 4 — Issue Age Indicator
  //  Shows how old an issue is with a color-coded badge.
  // =============================================================

  function injectAgeIndicator() {
    document.querySelectorAll(".ghic-age-badge").forEach((b) => b.remove());

    if (!isIssuePage()) return;

    // Find the "opened X ago" or creation timestamp
    const headerArea =
      document.querySelector(".gh-header-meta") ||
      document.querySelector('[data-testid="issue-metadata"]') ||
      document.querySelector(".gh-header");
    const relativeTime = headerArea
      ? (headerArea.querySelector("relative-time") || headerArea.querySelector("time-ago"))
      : (document.querySelector("relative-time") || document.querySelector("time-ago"));

    if (!relativeTime) return;

    const datetime = relativeTime.getAttribute("datetime");
    if (!datetime) return;

    const created = new Date(datetime);
    if (Number.isNaN(created.getTime())) return;

    const now = new Date();
    const daysDiff = Math.floor((now - created) / (1000 * 60 * 60 * 24));

    // Determine staleness level
    let label, colorClass;
    if (daysDiff <= 7) {
      label = daysDiff <= 1 ? "Today" : daysDiff + "d";
      colorClass = "ghic-age-fresh";
    } else if (daysDiff <= 30) {
      label = Math.floor(daysDiff / 7) + "w";
      colorClass = "ghic-age-recent";
    } else if (daysDiff <= 90) {
      label = Math.floor(daysDiff / 30) + "mo";
      colorClass = "ghic-age-aging";
    } else if (daysDiff <= 365) {
      label = Math.floor(daysDiff / 30) + "mo";
      colorClass = "ghic-age-stale";
    } else {
      label = Math.floor(daysDiff / 365) + "y";
      colorClass = "ghic-age-ancient";
    }

    const badge = document.createElement("span");
    badge.className = "ghic-age-badge " + colorClass;
    badge.textContent = "⏱ " + label;
    badge.title = "Opened " + daysDiff + " days ago (" + created.toLocaleDateString() + ")";

    // Insert near the issue header
    const header =
      document.querySelector('[data-testid="issue-title"]') ||
      document.querySelector("h1.gh-header-title") ||
      document.querySelector(".js-issue-title");

    if (header) {
      header.parentElement.insertBefore(badge, header.nextSibling);
    }
  }

  // ---- debounced rescan (for SPA navigation) ----------------
  let scanTimer = null;
  let repoScanTimer = null;

  function debouncedScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      // Detect SPA route change: reset per-page state
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        projectBadgesInjected = false;
        manuallyRevealed.clear();
        stopBadgeRetry();
      }

      if (hasTimelineContent()) {
        scanForNoise();
        if (!toggleBtn) createButton();
      } else {
        cleanupNoise();
      }

      // Project badges and age indicator on issue/PR pages
      if (isIssuePage()) {
        if (!projectBadgesInjected) injectProjectBadges();
        if (!document.querySelector(".ghic-age-badge")) injectAgeIndicator();
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
      if (!isProjectPage()) return;
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
    document.querySelectorAll(".ghic-hidden-placeholder").forEach(p => p.remove());
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
    const observer = new MutationObserver((mutations) => {
      if (isMutating) return;
      // Skip mutations that only affect our own elements
      const dominated = mutations.every(m => {
        const target = m.target;
        return target.id?.startsWith("ghic-") || 
               target.classList?.contains("ghic-noise-hidden") ||
               target.classList?.contains("ghic-noise-item") ||
               target.closest?.("[id^='ghic-']");
      });
      if (dominated) return;
      debouncedScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Also listen for turbo navigation events
    document.addEventListener("turbo:load", debouncedScan);
    document.addEventListener("turbo:render", debouncedScan);
    document.addEventListener("pjax:end", debouncedScan);

    // Global Escape key: close any open panels
    // Shift+H: toggle noise settings panel (works from anywhere on page)
    if (escapeHandler) document.removeEventListener("keydown", escapeHandler);
    escapeHandler = (e) => {
      // Don't intercept when user is typing in an input/textarea
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || 
          document.activeElement?.isContentEditable) return;

      if (e.key === "Escape") {
        if (settingsPanel && settingsPanel.style.display !== "none") {
          settingsPanel.style.display = "none";
          if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
        }
        if (repoNavOpen) {
          repoNavOpen = false;
          updateRepoNavPanel();
        }
      }

      // Shift+H: toggle noise settings (only on pages with noise)
      if (e.key === "H" && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (toggleBtn && toggleBtn.style.display !== "none") {
          e.preventDefault();
          toggleSettingsPanel();
        }
      }
    };
    document.addEventListener("keydown", escapeHandler);
  }

  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

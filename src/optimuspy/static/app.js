/* ============================================================
   OptimusPy Dashboard — app.js
   Single IIFE module: API, Router, Toast, Modal, Theme, Table,
   TransferList, DimensionConfigurator, StreamManager, Sidebar,
   BatchManager, and 6 page modules.
   ============================================================ */

const OptimusPy = (function () {
  "use strict";

  // ==================================================================
  // State
  // ==================================================================
  const state = {
    // Connection
    instances: [],
    activeInstance: null,
    password: null,
    connected: false,
    serverName: null,

    // Scan
    scanData: null,
    scanTimestamp: null,  // Date.now() when last scan completed

    // Cubes & configs
    savedCubes: [],
    cubeMetadata: {},   // cubeName → { dimensions_metadata, storage_order, suggested_order }
    cubeViews: {},      // cubeName → [view names]
    processes: [],      // all TI process names

    // Jobs
    jobs: [],

    // UI prefs
    theme: localStorage.getItem("op-theme") || "system",
    sidebarCollapsed: localStorage.getItem("op-sidebar") === "collapsed",
  };

  // ==================================================================
  // Icons (inline SVG strings — Lucide style)
  // ==================================================================
  const Icons = {
    x: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alertTriangle: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    chevronRight: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    chevronLeft: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    arrowRight: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    arrowLeft: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    play: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    download: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    refresh: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
    trash: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    search: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    zap: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    sun: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
    monitor: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    externalLink: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    gripVertical: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>',
    lock: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    unlock: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>',
    rotateCcw: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>',
    square: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
    plus: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    transfer: '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><line x1="3" y1="5" x2="21" y2="5"/><polyline points="7 23 3 19 7 15"/><line x1="21" y1="19" x2="3" y2="19"/></svg>',
  };

  // ==================================================================
  // Helpers
  // ==================================================================
  function $(sel, parent) { return (parent || document).querySelector(sel); }
  function $$(sel, parent) { return Array.from((parent || document).querySelectorAll(sel)); }
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === "className") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "html") e.innerHTML = v;
      else if (k === "dataset") Object.assign(e.dataset, v);
      else e.setAttribute(k, v);
    });
    children.forEach(c => {
      if (c == null) return;
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    // Keyboard activation for non-button elements with role="button"
    if (attrs && attrs.role === "button" && tag !== "button") {
      e.addEventListener("keydown", ev => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); e.click(); }
      });
    }
    return e;
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(2) + " GB";
  }
  function formatDate(ts) {
    return new Date(ts * 1000).toLocaleString();
  }
  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  // ---- Scan cache (localStorage, keyed by instance) ----
  const ScanCache = {
    _key(instance) { return `op-scan-${instance}`; },
    save(instance, scanData) {
      const entry = { data: scanData, ts: Date.now() };
      try { localStorage.setItem(this._key(instance), JSON.stringify(entry)); } catch { /* quota */ }
    },
    load(instance) {
      try {
        const raw = localStorage.getItem(this._key(instance));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        // Expire after 24 hours
        if (Date.now() - entry.ts > 86400000) { this.clear(instance); return null; }
        return entry;
      } catch { return null; }
    },
    clear(instance) {
      try { localStorage.removeItem(this._key(instance)); } catch { /* */ }
    },
    formatAge(ts) {
      if (!ts) return "";
      const mins = Math.floor((Date.now() - ts) / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    },
  };

  // ---- Cube intelligence cache (localStorage, keyed by instance+cube) ----
  const IntelCache = {
    _key(instance, cube) { return `op-intel-${instance}-${cube}`; },
    save(instance, cube, data) {
      const entry = { data, ts: Date.now() };
      try { localStorage.setItem(this._key(instance, cube), JSON.stringify(entry)); } catch { /* quota */ }
    },
    load(instance, cube) {
      try {
        const raw = localStorage.getItem(this._key(instance, cube));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        // Expire after 7 days
        if (Date.now() - entry.ts > 7 * 86400000) { this.clear(instance, cube); return null; }
        return entry;
      } catch { return null; }
    },
    clear(instance, cube) {
      try { localStorage.removeItem(this._key(instance, cube)); } catch { /* */ }
    },
  };

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ==================================================================
  // API Client
  // ==================================================================
  const Api = {
    async _fetch(method, url, body) {
      const opts = { method, headers: {} };
      if (body) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(url, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    getInstances() { return this._fetch("GET", "/api/instances"); },
    getInstance(name) { return this._fetch("GET", `/api/instance/${encodeURIComponent(name)}`); },
    updateInstance(name, params) { return this._fetch("POST", `/api/instance/${encodeURIComponent(name)}`, { params }); },
    connect(instance, password) { return this._fetch("POST", "/api/connect", { instance, password }); },
    scan(instance, password, ramPercent, includeOptimized) {
      return this._fetch("POST", "/api/scan", { instance, password, ram_percent: ramPercent, include_optimized: includeOptimized });
    },
    getViews(instance, password, cube) { return this._fetch("POST", "/api/views", { instance, password, cube }); },
    getProcesses(instance, password) { return this._fetch("POST", "/api/processes", { instance, password }); },
    getProcessParameters(instance, password, processName) {
      return this._fetch("POST", "/api/process_parameters", { instance, password, process_name: processName });
    },
    getCubeIntelligence(instance, password, cube) {
      return this._fetch("POST", "/api/cube_intelligence", { instance, password, cube });
    },
    saveConfig(config, filename) { return this._fetch("POST", "/api/config", { config, filename }); },
    deleteConfig(filename) { return this._fetch("DELETE", `/api/config/${encodeURIComponent(filename)}`); },
    getSavedCubes() { return this._fetch("GET", "/api/saved-cubes"); },
    validate(config, mode) { return this._fetch("POST", "/api/validate", { config, mode }); },
    startJob(mode, cubeConfig, password) {
      return this._fetch("POST", "/api/job/start", { mode, cube_config: cubeConfig, password });
    },
    getJob(id) { return this._fetch("GET", `/api/job/${id}`); },
    cancelJob(id) { return this._fetch("POST", `/api/job/${id}/cancel`); },
    getJobs() { return this._fetch("GET", "/api/jobs"); },
    getResults() { return this._fetch("GET", "/api/results"); },
    getStatus() { return this._fetch("GET", "/api/status"); },
    createInstance(name, params) { return this._fetch("POST", "/api/instances", { name, params }); },
    deleteInstance(name) { return this._fetch("DELETE", `/api/instance/${encodeURIComponent(name)}`); },
    deleteInstanceField(name, key) { return this._fetch("DELETE", `/api/instance/${encodeURIComponent(name)}/field/${encodeURIComponent(key)}`); },
    transferScan(instance, password, ramPercent) {
      return this._fetch("POST", "/api/transfer/scan", { instance, password, ram_percent: ramPercent });
    },
    transferTargetOrders(instance, password, cubes) {
      return this._fetch("POST", "/api/transfer/target-orders", { instance, password, cubes });
    },
    transferApply(instance, password, orders) {
      return this._fetch("POST", "/api/transfer/apply", { instance, password, orders });
    },
    transferExport(instance, orders) {
      return this._fetch("POST", "/api/transfer/export", { instance, orders });
    },
  };

  // ==================================================================
  // Toast
  // ==================================================================
  const Toast = {
    _container: null,
    _counter: 0,

    init() { this._container = $("#toast-container"); },

    show(message, type = "info", duration) {
      // Default durations: success/info fade fast, warnings a bit longer, errors stick
      if (duration === undefined) {
        duration = type === "error" ? 0 : type === "warning" ? 4000 : 2500;
      }
      const id = ++this._counter;
      const iconMap = { success: Icons.check, error: Icons.x, warning: Icons.alertTriangle, info: Icons.info };
      const closeBtn = el("button", { className: "toast-close", html: Icons.x });
      const t = el("div", { className: `toast ${type}`, dataset: { id: String(id) } },
        el("span", { className: "toast-icon", html: iconMap[type] || iconMap.info }),
        el("span", { className: "toast-body" }, message),
        closeBtn,
      );
      closeBtn.addEventListener("click", (e) => { e.stopPropagation(); this._remove(t); });
      // Clicking anywhere on an error toast also dismisses it
      if (type === "error") {
        t.style.cursor = "pointer";
        t.addEventListener("click", () => this._remove(t));
      }
      this._container.appendChild(t);
      if (duration > 0) setTimeout(() => this._remove(t), duration);
      return id;
    },

    _remove(t) {
      if (!t || !t.parentNode) return;
      t.classList.add("removing");
      t.addEventListener("animationend", () => t.remove());
      // Fallback in case animation doesn't fire
      setTimeout(() => { if (t.parentNode) t.remove(); }, 300);
    },

    dismiss(id) {
      const t = this._container.querySelector(`[data-id="${id}"]`);
      if (t) this._remove(t);
    },

    success(msg) { return this.show(msg, "success"); },
    error(msg) { return this.show(msg, "error"); },
    warning(msg) { return this.show(msg, "warning"); },
    info(msg) { return this.show(msg, "info"); },
  };

  // ==================================================================
  // Modal
  // ==================================================================
  const Modal = {
    _backdrop: null,
    _container: null,
    _previousFocus: null,

    init() {
      this._backdrop = $("#modal-backdrop");
      this._container = $("#modal-container");
      this._backdrop.addEventListener("click", () => this.close());
      document.addEventListener("keydown", e => {
        if (this._container.classList.contains("hidden")) return;
        if (e.key === "Escape") { this.close(); return; }
        // Focus trap: Tab / Shift+Tab within modal
        if (e.key === "Tab") {
          const focusable = this._container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
          } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        }
      });
    },

    open({ title, body, footer, size = "md" }) {
      this._previousFocus = document.activeElement;
      const titleId = "modal-title-id";
      const m = el("div", { className: `modal ${size}` },
        el("div", { className: "modal-header" },
          el("h2", { className: "modal-title", id: titleId }, title),
          el("button", { className: "modal-close", html: Icons.x, onClick: () => this.close() },
            el("span", { className: "sr-only" }, "Close")),
        ),
        el("div", { className: "modal-body" }, ...(typeof body === "string" ? [el("p", null, body)] : [body])),
      );
      if (footer) m.appendChild(el("div", { className: "modal-footer" }, ...footer));
      this._container.innerHTML = "";
      this._container.appendChild(m);
      this._container.setAttribute("aria-labelledby", titleId);
      this._backdrop.classList.remove("hidden");
      this._container.classList.remove("hidden");
      // Move focus into modal
      const firstFocusable = m.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) requestAnimationFrame(() => firstFocusable.focus());
    },

    confirm(message, onConfirm) {
      this.open({
        title: "Confirm",
        body: message,
        size: "sm",
        footer: [
          el("button", { className: "btn btn-secondary", onClick: () => this.close() }, "Cancel"),
          el("button", { className: "btn btn-danger", onClick: () => { this.close(); onConfirm(); } }, "Confirm"),
        ],
      });
    },

    close() {
      this._backdrop.classList.add("hidden");
      this._container.classList.add("hidden");
      this._container.innerHTML = "";
      // Restore focus to trigger element
      if (this._previousFocus && typeof this._previousFocus.focus === "function") {
        this._previousFocus.focus();
        this._previousFocus = null;
      }
    },
  };

  // ==================================================================
  // Theme
  // ==================================================================
  const Theme = {
    init() {
      this.apply();
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (state.theme === "system") this.apply();
      });
    },
    set(theme) {
      state.theme = theme;
      localStorage.setItem("op-theme", theme);
      this.apply();
    },
    apply() {
      // Always resolve to explicit light/dark so CSS only needs [data-theme="dark"]
      const resolved = this.current();
      document.documentElement.setAttribute("data-theme", resolved);
    },
    current() {
      if (state.theme !== "system") return state.theme;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    },
  };

  // ==================================================================
  // Table factory
  // ==================================================================
  function createTable({ columns, data, sortable = true, filterable = true, onRowClick, emptyMessage = "No data", emptyIcon }) {
    let _data = data || [];
    let _filtered = _data;
    let _sortCol = null;
    let _sortDir = "asc";
    let _filter = "";

    const wrapper = el("div", { className: "table-wrapper" });
    const table = el("table", { className: "data-table" });
    const thead = el("thead");
    const tbody = el("tbody");
    table.appendChild(thead);
    table.appendChild(tbody);

    let searchInput;
    if (filterable) {
      const toolbar = el("div", { className: "table-toolbar" });
      const searchWrap = el("div", { className: "table-search" });
      searchInput = el("input", { type: "text", placeholder: "Search..." });
      searchInput.addEventListener("input", () => { _filter = searchInput.value.toLowerCase(); applyFilter(); render(); });
      searchWrap.appendChild(searchInput);
      toolbar.appendChild(searchWrap);
      wrapper.appendChild(toolbar);
    }
    wrapper.appendChild(table);

    function applyFilter() {
      if (!_filter) { _filtered = _data; return; }
      _filtered = _data.filter(row =>
        columns.some(col => {
          const v = col.value ? col.value(row) : row[col.key];
          return v != null && String(v).toLowerCase().includes(_filter);
        })
      );
    }

    function renderHeader() {
      thead.innerHTML = "";
      const tr = el("tr");
      columns.forEach(col => {
        const th = el("th", null, col.label);
        if (col.align === "right") th.classList.add("align-right");
        if (sortable && col.sortable !== false) {
          th.classList.add("sortable");
          const arrow = el("span", { className: "sort-arrow" }, "▲");
          th.appendChild(arrow);
          if (_sortCol === col.key) {
            th.classList.add(_sortDir === "asc" ? "sort-asc" : "sort-desc");
            arrow.textContent = _sortDir === "asc" ? "▲" : "▼";
          }
          th.addEventListener("click", () => {
            if (_sortCol === col.key) _sortDir = _sortDir === "asc" ? "desc" : "asc";
            else { _sortCol = col.key; _sortDir = "asc"; }
            doSort();
            renderHeader();
            renderBody();
          });
        }
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    }

    function doSort() {
      if (!_sortCol) return;
      const col = columns.find(c => c.key === _sortCol);
      _filtered.sort((a, b) => {
        let va = col.sortValue ? col.sortValue(a) : (col.value ? col.value(a) : a[col.key]);
        let vb = col.sortValue ? col.sortValue(b) : (col.value ? col.value(b) : b[col.key]);
        if (va == null) va = "";
        if (vb == null) vb = "";
        let cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
        return _sortDir === "desc" ? -cmp : cmp;
      });
    }

    function renderBody() {
      tbody.innerHTML = "";
      if (_filtered.length === 0) {
        const tr = el("tr");
        const td = el("td", { colspan: columns.length, className: "table-empty" });
        if (emptyIcon) td.appendChild(el("div", { className: "table-empty-icon", html: emptyIcon }));
        td.appendChild(document.createTextNode(emptyMessage));
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      _filtered.forEach((row, idx) => {
        const tr = el("tr");
        if (onRowClick) {
          tr.classList.add("clickable");
          tr.addEventListener("click", () => onRowClick(row, idx));
        }
        columns.forEach(col => {
          const td = el("td");
          if (col.align === "right") td.classList.add("align-right");
          if (col.render) {
            const content = col.render(row, idx);
            if (content instanceof HTMLElement) td.appendChild(content);
            else td.textContent = content != null ? String(content) : "";
          } else {
            const v = col.value ? col.value(row) : row[col.key];
            td.textContent = v != null ? v : "";
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    function render() { renderHeader(); renderBody(); }

    render();

    return {
      el: wrapper,
      update(newData) {
        _data = newData;
        applyFilter();
        doSort();
        render();
      },
      getData() { return _filtered; },
      destroy() { wrapper.remove(); },
    };
  }

  // ==================================================================
  // TransferList factory
  // ==================================================================
  function createTransferList({ available, selected, labelKey = "name", searchable = true, onChange }) {
    let _avail = available.filter(a => !selected.includes(a));
    let _sel = [...selected];
    let _availFilter = "";
    let _selFilter = "";
    let _availSelected = new Set();
    let _selSelected = new Set();

    const container = el("div", { className: "transfer-list" });

    function filteredAvail() {
      return _availFilter ? _avail.filter(i => i.toLowerCase().includes(_availFilter)) : _avail;
    }
    function filteredSel() {
      return _selFilter ? _sel.filter(i => i.toLowerCase().includes(_selFilter)) : _sel;
    }

    function render() {
      container.innerHTML = "";

      // Left pane
      const leftPane = el("div", { className: "transfer-pane" });
      leftPane.appendChild(el("div", { className: "transfer-pane-header" },
        el("span", null, "Available"),
        el("span", { className: "transfer-pane-count" }, `${_avail.length}`),
      ));
      if (searchable) {
        const sw = el("div", { className: "transfer-search" });
        const si = el("input", { type: "text", placeholder: "Filter..." });
        si.value = _availFilter;
        si.addEventListener("input", () => { _availFilter = si.value.toLowerCase(); render(); });
        sw.appendChild(si);
        leftPane.appendChild(sw);
      }
      const leftItems = el("div", { className: "transfer-items" });
      const fa = filteredAvail();
      if (fa.length === 0) {
        leftItems.appendChild(el("div", { className: "transfer-item-empty" }, _avail.length === 0 ? "None available" : "No matches"));
      } else {
        fa.forEach(item => {
          const d = el("div", {
            className: `transfer-item${_availSelected.has(item) ? " selected" : ""}`,
            onClick: () => { toggleSet(_availSelected, item); render(); }
          }, item);
          leftItems.appendChild(d);
        });
      }
      leftPane.appendChild(leftItems);

      // Center arrows
      const actions = el("div", { className: "transfer-actions" });
      const addBtn = el("button", { className: "transfer-btn", title: "Add selected", "aria-label": "Add selected", html: Icons.chevronRight, onClick: moveRight });
      const removeBtn = el("button", { className: "transfer-btn", title: "Remove selected", "aria-label": "Remove selected", html: Icons.chevronLeft, onClick: moveLeft });
      actions.appendChild(addBtn);
      actions.appendChild(removeBtn);

      // Right pane
      const rightPane = el("div", { className: "transfer-pane" });
      rightPane.appendChild(el("div", { className: "transfer-pane-header" },
        el("span", null, "Selected"),
        el("span", { className: "transfer-pane-count" }, `${_sel.length}`),
      ));
      if (searchable) {
        const sw = el("div", { className: "transfer-search" });
        const si = el("input", { type: "text", placeholder: "Filter..." });
        si.value = _selFilter;
        si.addEventListener("input", () => { _selFilter = si.value.toLowerCase(); render(); });
        sw.appendChild(si);
        rightPane.appendChild(sw);
      }
      const rightItems = el("div", { className: "transfer-items" });
      const fs = filteredSel();
      if (fs.length === 0) {
        rightItems.appendChild(el("div", { className: "transfer-item-empty" }, _sel.length === 0 ? "None selected" : "No matches"));
      } else {
        fs.forEach(item => {
          const d = el("div", {
            className: `transfer-item${_selSelected.has(item) ? " selected" : ""}`,
            onClick: () => { toggleSet(_selSelected, item); render(); }
          }, item);
          rightItems.appendChild(d);
        });
      }
      rightPane.appendChild(rightItems);

      container.appendChild(leftPane);
      container.appendChild(actions);
      container.appendChild(rightPane);
    }

    function toggleSet(set, item) {
      if (set.has(item)) set.delete(item); else set.add(item);
    }

    function moveRight() {
      if (_availSelected.size === 0) return;
      _availSelected.forEach(item => {
        _avail = _avail.filter(a => a !== item);
        _sel.push(item);
      });
      _availSelected.clear();
      if (onChange) onChange(_sel);
      render();
    }

    function moveLeft() {
      if (_selSelected.size === 0) return;
      _selSelected.forEach(item => {
        _sel = _sel.filter(s => s !== item);
        _avail.push(item);
        _avail.sort();
      });
      _selSelected.clear();
      if (onChange) onChange(_sel);
      render();
    }

    render();

    return {
      el: container,
      getSelected() { return [..._sel]; },
      setItems(avail, sel) {
        _sel = [...sel];
        _avail = avail.filter(a => !_sel.includes(a));
        _availSelected.clear();
        _selSelected.clear();
        render();
      },
      reset() {
        _avail = [...available];
        _sel = [];
        _availFilter = "";
        _selFilter = "";
        _availSelected.clear();
        _selSelected.clear();
        render();
        if (onChange) onChange();
      },
      destroy() { container.remove(); },
    };
  }

  // ==================================================================
  // DimensionConfigurator factory
  // ==================================================================
  function createDimensionConfigurator({ dimensions, metadata, mode, onChange }) {
    // dimensions: [name, ...] in storage order, metadata: { name: { leaf_elements, has_strings, ... } }
    const _origDims = dimensions.map((name, i) => ({ name, meta: metadata[name] || {} }));
    let _dims = _origDims.map((d, i) => ({ ...d, included: true, locked: false }));
    let _mode = mode;
    let _targetPosition = 1;                      // position mode: 1-based
    let _targetDimension = dimensions[0] || "";    // dimension mode: dim name
    let _ignoreOrders = [];                        // greedy mode: [[dim, dim, ...], ...]
    let _positionRules = [];                       // greedy mode: [{ dimension, position }, ...]
    let _predefinedOrders = [];                    // predefined mode: [[dim, dim, ...], ...]
    let _dragIdx = null;                           // predefined drag source

    const container = el("div", { className: "dim-configurator" });

    function fire() { if (onChange) onChange(getConfig()); }

    // ── Shared card builder ──
    function dimCard(dim, idx, opts = {}) {
      const { showToggle, showDrag, showLock, showMeta = true, highlight } = opts;
      const cls = ["dim-card"];
      if (!dim.included) cls.push("excluded");
      if (dim.locked) cls.push("locked");
      if (highlight) cls.push("highlight");
      const card = el("div", { className: cls.join(" ") });

      // Drag handle
      if (showDrag) {
        card.setAttribute("draggable", "true");
        card.appendChild(el("span", { className: "drag-handle", html: Icons.gripVertical }));
      }

      // Position label (auto from index)
      if (showDrag && dim.included) {
        card.appendChild(el("span", { className: "dim-card-pos-label" }, `${idx + 1}.`));
      }

      // Include/exclude toggle
      if (showToggle) {
        const toggle = el("label", { className: "toggle-switch dim-card-toggle" });
        const cb = el("input", { type: "checkbox" });
        cb.checked = dim.included;
        cb.addEventListener("change", () => { dim.included = cb.checked; dim.locked = false; fire(); render(); });
        toggle.appendChild(cb);
        toggle.appendChild(el("span", { className: "toggle-slider" }));
        card.appendChild(toggle);
      }

      // Lock toggle
      if (showLock) {
        const lockBtn = el("span", {
          className: `dim-card-lock${dim.locked ? " locked" : ""}`,
          role: "button",
          tabindex: "0",
          "aria-label": dim.locked ? "Unlock dimension" : "Lock dimension in place",
          "aria-pressed": dim.locked ? "true" : "false",
          html: dim.locked ? Icons.lock : Icons.unlock,
          title: dim.locked ? "Locked — will not be moved" : "Click to lock in place",
        });
        lockBtn.addEventListener("click", () => { dim.locked = !dim.locked; fire(); render(); });
        card.appendChild(lockBtn);
      }

      // Name
      card.appendChild(el("span", { className: "dim-card-name" }, dim.name));

      // Meta badges
      if (showMeta) {
        const metaWrap = el("span", { className: "dim-card-meta" });
        if (dim.meta.leaf_elements != null) {
          metaWrap.appendChild(el("span", { className: "badge" }, `${dim.meta.leaf_elements.toLocaleString()} elem`));
        }
        if (dim.meta.has_strings) {
          metaWrap.appendChild(el("span", { className: "dim-card-warning", html: Icons.alertTriangle + " Strings" }));
        }
        card.appendChild(metaWrap);
      }

      return card;
    }

    // ── Modal: build an order to ignore (greedy mode) ──
    function _showIgnoreOrderModal() {
      const modalDims = _dims.filter(d => d.included).map(d => d.name);
      let dragIdx = null;

      const body = el("div");
      body.appendChild(el("p", { className: "text-xs text-tertiary mb-3" },
        "Drag dimensions to build the order you want the greedy algorithm to skip."));

      const list = el("div", { className: "dim-card-list" });
      body.appendChild(list);

      function renderModalList() {
        list.innerHTML = "";
        modalDims.forEach((name, i) => {
          const card = el("div", { className: "dim-card" });
          card.setAttribute("draggable", "true");
          card.appendChild(el("span", { className: "drag-handle", html: Icons.gripVertical }));
          card.appendChild(el("span", { className: "dim-card-pos-label" }, `${i + 1}.`));
          card.appendChild(el("span", { className: "dim-card-name" }, name));

          card.addEventListener("dragstart", e => {
            dragIdx = i;
            card.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
          });
          card.addEventListener("dragend", () => {
            dragIdx = null;
            card.classList.remove("dragging");
            list.querySelectorAll(".drag-indicator").forEach(x => x.remove());
          });
          card.addEventListener("dragover", e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            list.querySelectorAll(".drag-indicator").forEach(x => x.remove());
            const rect = card.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const ind = el("div", { className: "drag-indicator" });
            if (e.clientY < mid) card.before(ind); else card.after(ind);
          });
          card.addEventListener("drop", e => {
            e.preventDefault();
            list.querySelectorAll(".drag-indicator").forEach(x => x.remove());
            if (dragIdx == null) return;
            const rect = card.getBoundingClientRect();
            let ti = e.clientY < rect.top + rect.height / 2 ? i : i + 1;
            if (dragIdx < ti) ti--;
            if (dragIdx !== ti) {
              const [m] = modalDims.splice(dragIdx, 1);
              modalDims.splice(ti, 0, m);
              renderModalList();
            }
          });
          list.appendChild(card);
        });
      }

      renderModalList();

      Modal.open({
        title: "Build Order to Ignore",
        body,
        footer: [
          el("button", { className: "btn btn-ghost", onClick: () => Modal.close() }, "Cancel"),
          el("button", { className: "btn btn-primary", onClick: () => {
            _ignoreOrders.push([...modalDims]);
            fire();
            render();
            Modal.close();
          }}, "Add to Ignore List"),
        ],
        size: "md",
      });
    }

    // ── Modal: build a predefined order ──
    function _showPredefinedOrderModal() {
      const modalDims = _dims.filter(d => d.included).map(d => ({ name: d.name, meta: d.meta }));
      let dragIdx = null;

      const body = el("div");
      body.appendChild(el("p", { className: "text-xs text-tertiary mb-3" },
        "Drag dimensions to build the order you want to benchmark."));

      const list = el("div", { className: "dim-card-list" });
      body.appendChild(list);

      function renderModalList() {
        list.innerHTML = "";
        modalDims.forEach((dim, i) => {
          const card = el("div", { className: "dim-card" });
          card.setAttribute("draggable", "true");
          card.appendChild(el("span", { className: "drag-handle", html: Icons.gripVertical }));
          card.appendChild(el("span", { className: "dim-card-pos-label" }, `${i + 1}.`));
          card.appendChild(el("span", { className: "dim-card-name" }, dim.name));
          const leafCount = dim.meta.leaf_elements;
          if (leafCount != null) {
            card.appendChild(el("span", { className: "dim-card-elements text-tertiary", style: "margin-left:auto;font-size:11px;" },
              `${leafCount.toLocaleString()} elements`));
          }

          card.addEventListener("dragstart", e => {
            dragIdx = i;
            card.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
          });
          card.addEventListener("dragend", () => {
            dragIdx = null;
            card.classList.remove("dragging");
            list.querySelectorAll(".drag-indicator").forEach(x => x.remove());
          });
          card.addEventListener("dragover", e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            list.querySelectorAll(".drag-indicator").forEach(x => x.remove());
            const rect = card.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const ind = el("div", { className: "drag-indicator" });
            if (e.clientY < mid) card.before(ind); else card.after(ind);
          });
          card.addEventListener("drop", e => {
            e.preventDefault();
            list.querySelectorAll(".drag-indicator").forEach(x => x.remove());
            if (dragIdx == null) return;
            const rect = card.getBoundingClientRect();
            let ti = e.clientY < rect.top + rect.height / 2 ? i : i + 1;
            if (dragIdx < ti) ti--;
            if (dragIdx !== ti) {
              const [m] = modalDims.splice(dragIdx, 1);
              modalDims.splice(ti, 0, m);
              renderModalList();
            }
          });
          list.appendChild(card);
        });
      }

      renderModalList();

      Modal.open({
        title: "Build Predefined Order",
        body,
        footer: [
          el("button", { className: "btn btn-ghost", onClick: () => Modal.close() }, "Cancel"),
          el("button", { className: "btn btn-primary", onClick: () => {
            _predefinedOrders.push(modalDims.map(d => d.name));
            fire();
            render();
            Modal.close();
          }}, "Add Order"),
        ],
        size: "md",
      });
    }

    // ── Modal: add a dimension position rule ──
    function _showPositionRuleModal() {
      const includedDims = _dims.filter(d => d.included).map(d => d.name);
      const body = el("div");

      body.appendChild(el("label", { className: "form-label mb-1" }, "Dimension"));
      const dimSelect = el("select", { className: "form-input mb-3" });
      includedDims.forEach(name => {
        dimSelect.appendChild(el("option", { value: name }, name));
      });
      body.appendChild(dimSelect);

      body.appendChild(el("label", { className: "form-label mb-1" }, "Never in Position"));
      const posSelect = el("select", { className: "form-input mb-3" });
      posSelect.appendChild(el("option", { value: "first" }, "First"));
      for (let i = 2; i < includedDims.length; i++) {
        posSelect.appendChild(el("option", { value: String(i) }, `Position ${i}`));
      }
      posSelect.appendChild(el("option", { value: "last" }, "Last"));
      body.appendChild(posSelect);

      Modal.open({
        title: "Add Dimension Position Rule",
        body,
        footer: [
          el("button", { className: "btn btn-ghost", onClick: () => Modal.close() }, "Cancel"),
          el("button", { className: "btn btn-primary", onClick: () => {
            const dim = dimSelect.value;
            const pos = posSelect.value;
            const exists = _positionRules.some(r => r.dimension === dim && r.position === pos);
            if (!exists) {
              _positionRules.push({ dimension: dim, position: pos });
              fire();
              render();
            }
            Modal.close();
          }}, "Add Rule"),
        ],
        size: "sm",
      });
    }

    // ── GREEDY render ──
    function renderGreedy() {
      // Dim toggles
      const list = el("div", { className: "dim-card-list" });
      _dims.forEach((dim, i) => list.appendChild(dimCard(dim, i, { showToggle: true })));
      container.appendChild(list);

      // Dimension position rules section
      container.appendChild(el("div", { className: "section-divider mt-4" }, "Dimension Position Rules (optional)"));
      container.appendChild(el("div", { className: "form-hint mb-2" }, "Prevent specific dimensions from being placed in certain positions"));

      const rulesList = el("div");
      _positionRules.forEach((rule, ri) => {
        const row = el("div", { className: "selection-row" });
        const label = rule.position === "first" ? "Never First"
                    : rule.position === "last" ? "Never Last"
                    : `Never Position ${rule.position}`;
        const nameSpan = el("span", { className: "selection-row-name" });
        nameSpan.appendChild(el("span", { className: "badge" }, rule.dimension));
        nameSpan.appendChild(document.createTextNode(` \u2014 ${label}`));
        row.appendChild(nameSpan);
        const removeBtn = el("span", { className: "selection-row-remove", role: "button", tabindex: "0", "aria-label": "Remove", html: Icons.x, title: "Remove" });
        removeBtn.addEventListener("click", () => { _positionRules.splice(ri, 1); fire(); render(); });
        row.appendChild(removeBtn);
        rulesList.appendChild(row);
      });
      if (_positionRules.length === 0) {
        rulesList.appendChild(el("div", { className: "text-xs text-tertiary" }, "No position rules defined"));
      }
      container.appendChild(rulesList);

      const addRuleBtn = el("button", { className: "btn btn-ghost btn-sm mt-2" },
        el("span", { html: Icons.plus }), "Add Rule");
      addRuleBtn.addEventListener("click", () => _showPositionRuleModal());
      container.appendChild(addRuleBtn);

      // Orders to ignore section
      container.appendChild(el("div", { className: "section-divider mt-4" }, "Orders to Ignore (optional)"));
      container.appendChild(el("div", { className: "form-hint mb-2" }, "Full dimension orders the greedy algorithm will skip"));

      const ignoreList = el("div");
      _ignoreOrders.forEach((order, oi) => {
        const row = el("div", { className: "selection-row", style: "flex-wrap:wrap" });
        const badges = el("span", { className: "selection-row-name", style: "display:flex;gap:4px;flex-wrap:wrap" });
        order.forEach((name, pi) => {
          badges.appendChild(el("span", { className: "badge" }, `${pi + 1}. ${name}`));
        });
        row.appendChild(badges);
        const removeBtn = el("span", { className: "selection-row-remove", role: "button", tabindex: "0", "aria-label": "Remove", html: Icons.x, title: "Remove" });
        removeBtn.addEventListener("click", () => { _ignoreOrders.splice(oi, 1); fire(); render(); });
        row.appendChild(removeBtn);
        ignoreList.appendChild(row);
      });
      if (_ignoreOrders.length === 0) {
        ignoreList.appendChild(el("div", { className: "text-xs text-tertiary" }, "No orders to ignore"));
      }
      container.appendChild(ignoreList);

      const addBtn = el("button", { className: "btn btn-ghost btn-sm mt-2" },
        el("span", { html: Icons.plus }), "Add Order to Ignore");
      addBtn.addEventListener("click", () => _showIgnoreOrderModal());
      container.appendChild(addBtn);
    }

    // ── PREDEFINED render (multi-order list builder) ──
    function renderPredefined() {
      container.appendChild(el("div", { className: "section-divider" }, "Predefined Orders"));
      container.appendChild(el("div", { className: "form-hint mb-2" }, "Dimension orders to benchmark against each other"));

      const orderList = el("div");
      _predefinedOrders.forEach((order, oi) => {
        const row = el("div", { className: "selection-row", style: "flex-wrap:wrap" });
        const badges = el("span", { className: "selection-row-name", style: "display:flex;gap:4px;flex-wrap:wrap" });
        order.forEach((name, pi) => {
          badges.appendChild(el("span", { className: "badge" }, `${pi + 1}. ${name}`));
        });
        row.appendChild(badges);
        const removeBtn = el("span", { className: "selection-row-remove", role: "button", tabindex: "0", "aria-label": "Remove", html: Icons.x, title: "Remove" });
        removeBtn.addEventListener("click", () => { _predefinedOrders.splice(oi, 1); fire(); render(); });
        row.appendChild(removeBtn);
        orderList.appendChild(row);
      });
      if (_predefinedOrders.length === 0) {
        orderList.appendChild(el("div", { className: "text-xs text-tertiary" }, "No orders defined"));
      }
      container.appendChild(orderList);

      const btnRow = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" });
      const addBtn = el("button", { className: "btn btn-ghost btn-sm mt-2" },
        el("span", { html: Icons.plus }), "Add Custom Order");
      addBtn.addEventListener("click", () => _showPredefinedOrderModal());
      btnRow.appendChild(addBtn);
      container.appendChild(btnRow);
    }

    // ── POSITION render ──
    function renderPosition() {
      // Target position selector
      container.appendChild(el("div", { className: "form-label mb-2" }, "Target Position"));
      container.appendChild(el("div", { className: "form-hint mb-2" }, "Select the position to optimize — OptimusPy will try each unlocked dimension in this position"));
      const chips = el("div", { className: "position-chips" });
      const positions = [
        { value: "first", label: "First" },
        ...dimensions.map((_, i) => ({ value: i + 1, label: `${i + 1}` })),
        { value: "last", label: "Last" },
      ];
      positions.forEach(p => {
        const chip = el("button", {
          className: `position-chip${_targetPosition === p.value ? " active" : ""}`,
        }, p.label);
        chip.addEventListener("click", () => { _targetPosition = p.value; fire(); render(); });
        chips.appendChild(chip);
      });
      container.appendChild(chips);

      // Dimension list with lock toggles
      container.appendChild(el("div", { className: "form-label mb-2" }, "Dimensions"));
      container.appendChild(el("div", { className: "form-hint mb-2" }, "Lock dimensions to keep them fixed in their current position"));
      const list = el("div", { className: "dim-card-list" });
      const resolvedPos = _targetPosition === "first" ? 0 : _targetPosition === "last" ? _dims.length - 1 : _targetPosition - 1;
      _dims.forEach((dim, i) => {
        const isTarget = i === resolvedPos;
        const card = dimCard(dim, i, { showLock: !isTarget, showMeta: true, highlight: isTarget });
        // Show position label
        const posLabel = el("span", { className: "dim-card-pos-label" }, `${i + 1}.`);
        card.insertBefore(posLabel, card.firstChild);
        if (isTarget) {
          card.appendChild(el("span", { className: "badge badge-info", style: "margin-left:auto" }, "target"));
        }
        list.appendChild(card);
      });
      container.appendChild(list);
    }

    // ── DIMENSION render ──
    function renderDimension() {
      // Target dimension selector
      container.appendChild(el("div", { className: "form-label mb-2" }, "Target Dimension"));
      container.appendChild(el("div", { className: "form-hint mb-2" }, "Select the dimension to pivot — OptimusPy will try it in every possible position"));
      const sel = el("select", { className: "form-input mb-4" });
      dimensions.forEach(name => {
        const opt = el("option", { value: name }, name);
        if (name === _targetDimension) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => { _targetDimension = sel.value; fire(); render(); });
      container.appendChild(sel);

      // Dimension list with lock toggles
      container.appendChild(el("div", { className: "form-label mb-2" }, "Current Order"));
      container.appendChild(el("div", { className: "form-hint mb-2" }, "Lock dimensions to keep them fixed while the target dimension moves"));
      const list = el("div", { className: "dim-card-list" });
      _dims.forEach((dim, i) => {
        const isTarget = dim.name === _targetDimension;
        const card = dimCard(dim, i, { showLock: !isTarget, showMeta: true, highlight: isTarget });
        const posLabel = el("span", { className: "dim-card-pos-label" }, `${i + 1}.`);
        card.insertBefore(posLabel, card.firstChild);
        if (isTarget) {
          card.appendChild(el("span", { className: "badge badge-info", style: "margin-left:auto" }, "target"));
        }
        list.appendChild(card);
      });
      container.appendChild(list);
    }

    function render() {
      container.innerHTML = "";
      switch (_mode) {
        case "greedy": renderGreedy(); break;
        case "predefined": renderPredefined(); break;
        case "position": renderPosition(); break;
        case "dimension": renderDimension(); break;
      }
    }

    function getConfig() {
      const included = _dims.filter(d => d.included).map(d => d.name);
      const excluded = _dims.filter(d => !d.included).map(d => d.name);
      const locked = _dims.filter(d => d.locked).map(d => d.name);

      switch (_mode) {
        case "greedy":
          return {
            included, excluded,
            ignoreOrders: _ignoreOrders.length > 0 ? [..._ignoreOrders] : [],
            positionRules: _positionRules.length > 0 ? [..._positionRules] : [],
          };
        case "predefined":
          return { included, excluded, predefinedOrders: [..._predefinedOrders] };
        case "position":
          return { targetPosition: _targetPosition, excluded: locked };
        case "dimension":
          return { targetDimension: _targetDimension, excluded: locked };
        default:
          return { included, excluded };
      }
    }

    render();

    return {
      el: container,
      getConfig,
      setMode(m) { _mode = m; render(); fire(); },
      applySuggested(suggestedOrder) {
        if (!Array.isArray(suggestedOrder) || suggestedOrder.length === 0) return;
        if (_mode === "predefined") {
          // Add as a new predefined order (dedup by JSON comparison)
          const orderStr = JSON.stringify(suggestedOrder);
          const exists = _predefinedOrders.some(o => JSON.stringify(o) === orderStr);
          if (!exists) _predefinedOrders.push([...suggestedOrder]);
          fire();
          render();
        } else {
          // Reorder _dims to match suggested order
          const orderMap = {};
          suggestedOrder.forEach((name, i) => { orderMap[name] = i; });
          _dims.sort((a, b) => {
            const ai = orderMap[a.name] != null ? orderMap[a.name] : 999;
            const bi = orderMap[b.name] != null ? orderMap[b.name] : 999;
            return ai - bi;
          });
          _dims.forEach(d => { d.included = true; });
          fire();
          render();
        }
      },
      reset() {
        _dims = _origDims.map(d => ({ ...d, included: true, locked: false }));
        _targetPosition = 1;
        _targetDimension = dimensions[0] || "";
        _ignoreOrders = [];
        _positionRules = [];
        _predefinedOrders = [];
        fire();
        render();
      },
      destroy() { container.remove(); },
    };
  }

  // ==================================================================
  // StreamManager — holds EventSource connections across navigations
  // ==================================================================
  const StreamManager = {
    _streams: {},   // jobId → { es: EventSource, logs: [], status, subscribers: [cb] }

    connect(jobId) {
      if (this._streams[jobId]?.es) return;
      const entry = this._streams[jobId] || { es: null, logs: [], status: "running", subscribers: [] };
      this._streams[jobId] = entry;

      const es = new EventSource(`/api/job/${jobId}/stream`);
      entry.es = es;

      es.addEventListener("log", e => {
        const data = JSON.parse(e.data);
        entry.logs.push(data);
        entry.subscribers.forEach(cb => cb("log", data));
      });
      es.addEventListener("progress", e => {
        const data = JSON.parse(e.data);
        entry.subscribers.forEach(cb => cb("progress", data));
      });
      es.addEventListener("complete", e => {
        const data = JSON.parse(e.data);
        entry.status = "completed";
        entry.subscribers.forEach(cb => cb("complete", data));
        es.close();
        entry.es = null;
      });
      es.addEventListener("error_event", e => {
        const data = JSON.parse(e.data);
        entry.status = "failed";
        entry.subscribers.forEach(cb => cb("error_event", data));
        es.close();
        entry.es = null;
      });
      es.addEventListener("cancelled", e => {
        const data = JSON.parse(e.data);
        entry.status = "cancelled";
        entry.subscribers.forEach(cb => cb("cancelled", data));
        es.close();
        entry.es = null;
      });
      es.onerror = () => {
        // SSE auto-reconnect or close
        if (es.readyState === EventSource.CLOSED) {
          entry.es = null;
        }
      };
    },

    subscribe(jobId, callback) {
      if (!this._streams[jobId]) {
        this._streams[jobId] = { es: null, logs: [], status: "unknown", subscribers: [] };
      }
      this._streams[jobId].subscribers.push(callback);
      return () => {
        const s = this._streams[jobId];
        if (s) s.subscribers = s.subscribers.filter(cb => cb !== callback);
      };
    },

    getLogs(jobId) {
      return this._streams[jobId]?.logs || [];
    },

    getStatus(jobId) {
      return this._streams[jobId]?.status || "unknown";
    },
  };

  // ==================================================================
  // BatchManager — sequential multi-cube optimization
  // ==================================================================
  const BatchManager = {
    _queue: [],
    _running: false,

    enqueue(configs) {
      // configs: [{ mode, cubeConfig, password }]
      this._queue.push(...configs);
      if (!this._running) this._processNext();
    },

    async _processNext() {
      if (this._queue.length === 0) { this._running = false; return; }
      this._running = true;
      const item = this._queue.shift();
      try {
        const resp = await Api.startJob(item.mode, item.cubeConfig, item.password);
        StreamManager.connect(resp.job_id);
        // Wait for completion before processing next
        const unsub = StreamManager.subscribe(resp.job_id, (event) => {
          if (event === "complete" || event === "error_event" || event === "cancelled") {
            unsub();
            Sidebar.updateActivityMonitor();
            this._processNext();
          }
        });
        Toast.info(`Started optimization for ${item.cubeConfig.cube}`);
        Sidebar.updateActivityMonitor();
      } catch (err) {
        Toast.error(`Failed to start job for ${item.cubeConfig.cube}: ${err.message}`);
        this._processNext();
      }
    },
  };

  // ==================================================================
  // Sidebar
  // ==================================================================
  const Sidebar = {
    init() {
      const sidebar = $("#sidebar");
      const collapseBtn = $("#sidebarCollapseBtn");
      if (state.sidebarCollapsed) sidebar.classList.add("collapsed");

      collapseBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        state.sidebarCollapsed = sidebar.classList.contains("collapsed");
        localStorage.setItem("op-sidebar", state.sidebarCollapsed ? "collapsed" : "expanded");
        collapseBtn.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
        collapseBtn.setAttribute("aria-label", state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
      });
      // Sync initial aria-expanded state
      if (state.sidebarCollapsed) {
        collapseBtn.setAttribute("aria-expanded", "false");
        collapseBtn.setAttribute("aria-label", "Expand sidebar");
      }

      // Mobile menu button & overlay
      const mobileMenuBtn = $("#mobileMenuBtn");
      const sidebarOverlay = $("#sidebarOverlay");
      const _closeMobileSidebar = () => {
        sidebar.classList.remove("mobile-open");
        sidebarOverlay.classList.remove("visible");
        mobileMenuBtn.setAttribute("aria-expanded", "false");
      };
      const _openMobileSidebar = () => {
        sidebar.classList.add("mobile-open");
        sidebarOverlay.classList.add("visible");
        mobileMenuBtn.setAttribute("aria-expanded", "true");
      };
      if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener("click", () => {
          if (sidebar.classList.contains("mobile-open")) _closeMobileSidebar();
          else _openMobileSidebar();
        });
      }
      if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", _closeMobileSidebar);
      }
      // Close mobile sidebar on nav link click
      $$(".nav-item, .nav-sub-item").forEach(link => {
        link.addEventListener("click", () => {
          if (window.innerWidth < 768) _closeMobileSidebar();
        });
      });

      // Instance switcher
      const switcherBtn = $("#instanceSwitcherBtn");
      const dropdown = $("#instanceDropdown");
      const _toggleDropdown = (show) => {
        const isHidden = typeof show === "boolean" ? !show : !dropdown.classList.contains("hidden");
        dropdown.classList.toggle("hidden", isHidden);
        switcherBtn.setAttribute("aria-expanded", String(!isHidden));
      };
      switcherBtn.addEventListener("click", () => {
        if (switcherBtn.disabled) return;
        _toggleDropdown();
      });
      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && !dropdown.classList.contains("hidden")) _toggleDropdown(false);
      });
      document.addEventListener("click", e => {
        if (!e.target.closest("#instanceSwitcher")) _toggleDropdown(false);
      });
    },

    async loadInstances() {
      try {
        const data = await Api.getInstances();
        state.instances = data.instances || [];
        this.renderInstanceSwitcher();
      } catch (err) {
        Toast.error("Failed to load instances: " + err.message);
      }
    },

    renderInstanceSwitcher() {
      const btn = $("#instanceSwitcherBtn");
      const dropdown = $("#instanceDropdown");
      btn.disabled = state.instances.length === 0;
      const nameEl = btn.querySelector(".instance-name");
      nameEl.textContent = state.activeInstance || "Select instance";

      dropdown.innerHTML = "";
      state.instances.forEach(name => {
        const isActive = name === state.activeInstance && state.connected;
        const item = el("div", {
          className: `instance-dropdown-item${isActive ? " active connected" : ""}`,
          role: "option",
          "aria-selected": isActive ? "true" : "false",
          tabindex: "0",
          onClick: () => {
            dropdown.classList.add("hidden");
            btn.setAttribute("aria-expanded", "false");
            if (isActive) return;
            this._promptConnect(name);
          },
          onKeydown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              item.click();
            }
          },
        },
          el("span", { className: "dot" }),
          el("span", null, name),
        );
        dropdown.appendChild(item);
      });
    },

    _promptConnect(instanceName) {
      const body = el("div");
      body.appendChild(el("p", { className: "text-sm text-secondary mb-4" },
        `Connect to "${instanceName}". Enter password if it's not stored in config.ini.`));
      const pwGroup = el("div", { className: "form-group" });
      pwGroup.appendChild(el("label", { className: "form-label" }, "Password (optional)"));
      const pwInput = el("input", { type: "password", className: "form-input", placeholder: "Leave blank to use config.ini" });
      pwGroup.appendChild(pwInput);
      body.appendChild(pwGroup);

      const connectBtn = el("button", { className: "btn btn-primary" }, "Connect");
      const cancelBtn = el("button", { className: "btn btn-secondary", onClick: () => Modal.close() }, "Cancel");

      connectBtn.addEventListener("click", async () => {
        connectBtn.disabled = true;
        connectBtn.textContent = "Connecting...";
        try {
          const pw = pwInput.value || null;
          const resp = await Api.connect(instanceName, pw);
          state.activeInstance = instanceName;
          state.password = pw;
          state.connected = true;
          state.serverName = resp.server_name;
          // Reset cached data from previous instance, restore scan cache if available
          state.cubeMetadata = {};
          state.cubeViews = {};
          state.processes = [];
          const cached = ScanCache.load(instanceName);
          if (cached) {
            state.scanData = cached.data;
            state.scanTimestamp = cached.ts;
          } else {
            state.scanData = null;
            state.scanTimestamp = null;
          }
          Modal.close();
          this.renderInstanceSwitcher();
          Sidebar.loadSavedCubes();
          Sidebar.updateActivityMonitor();
          Toast.success(`Connected to ${resp.server_name}`);
          // Navigate to the split-panel navigation page
          Router.navigate("#/nav");
        } catch (err) {
          Toast.error(err.message);
          connectBtn.disabled = false;
          connectBtn.textContent = "Connect";
        }
      });

      Modal.open({
        title: "Connect to Instance",
        body,
        size: "sm",
        footer: [cancelBtn, connectBtn],
      });

      // Focus password input
      setTimeout(() => pwInput.focus(), 100);
    },

    async loadSavedCubes() {
      try {
        const data = await Api.getSavedCubes();
        state.savedCubes = data.saved_cubes || [];
        this.renderScannedCubes();
      } catch {
        // Non-critical
      }
    },

    renderScannedCubes() {
      // Cube list now lives in the NavPage left panel — clear sidebar sub-items
      const nav = $("#savedCubesNav");
      if (nav) nav.innerHTML = "";
    },

    async updateActivityMonitor() {
      const container = $("#sidebarActivity");
      try {
        const data = await Api.getJobs();
        const jobs = data.jobs || [];
        const running = jobs.find(j => j.status === "running");
        if (running) {
          container.innerHTML = "";
          const cubeName = running.cube_name || running.cube_config?.cube || "Unknown";
          const bar = el("div", { className: "activity-bar" },
            el("div", { className: "activity-pulse" }),
            el("div", { className: "activity-label" },
              el("div", { className: "activity-title" }, "Optimizing"),
              el("div", { className: "activity-subtitle" }, cubeName),
            ),
            el("div", { className: "activity-spinner" }),
          );
          container.appendChild(bar);
          container.classList.remove("hidden");
          container.onclick = () => {
            window.location.hash = `#/cube/${encodeURIComponent(cubeName)}?tab=optimize`;
          };
        } else {
          container.classList.add("hidden");
          container.innerHTML = "";
          container.onclick = null;
        }
      } catch {
        // Non-critical
      }
    },
  };

  // ==================================================================
  // Router — hash-based
  // ==================================================================
  const Router = {
    _pages: {},
    _current: null,

    register(name, module) {
      this._pages[name] = module;
    },

    init() {
      window.addEventListener("hashchange", () => {
        // Close mobile sidebar on navigation
        if (window.innerWidth < 768) {
          const sidebar = $("#sidebar");
          const overlay = $("#sidebarOverlay");
          const menuBtn = $("#mobileMenuBtn");
          if (sidebar) sidebar.classList.remove("mobile-open");
          if (overlay) overlay.classList.remove("visible");
          if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
        }
        this._resolve();
      });
      this._resolve();
    },

    navigate(hash) {
      window.location.hash = hash;
    },

    _resolve() {
      const hash = window.location.hash || "#/home";
      const [path, queryStr] = hash.slice(1).split("?");
      const query = {};
      if (queryStr) {
        queryStr.split("&").forEach(p => {
          const [k, v] = p.split("=");
          query[decodeURIComponent(k)] = decodeURIComponent(v || "");
        });
      }

      const segments = path.split("/").filter(Boolean);
      let pageName, params = {};

      // Route: #/cube/CubeName?tab=x → redirect to #/nav?cube=CubeName&tab=x
      if (segments[0] === "cube" && segments[1]) {
        const cubeName = decodeURIComponent(segments[1]);
        const tabParam = query.tab ? `&tab=${query.tab}` : "";
        window.location.hash = `#/nav?cube=${encodeURIComponent(cubeName)}${tabParam}`;
        return;
      }

      // Route: #/nav?cube=X&tab=Y
      if (segments[0] === "nav") {
        pageName = "nav";
        if (query.cube) params.cubeName = query.cube;
      } else {
        pageName = segments[0] || "home";
      }

      // Unmount current (skip if staying on same page module)
      const stayingSamePage = this._current === pageName;
      if (this._current && this._pages[this._current] && !stayingSamePage) {
        const mod = this._pages[this._current];
        if (mod.unmount) mod.unmount();
      }

      // Show/hide pages
      $$(".page").forEach(p => p.classList.remove("active"));
      const pageEl = $(`#page-${pageName}`);
      if (pageEl) pageEl.classList.add("active");

      // Update nav active state
      $$(".nav-item").forEach(a => {
        const href = a.getAttribute("href");
        if (!href) return;
        const page = a.dataset.page;
        a.classList.toggle("active", page === pageName || pageName === "nav" && page === "home");
      });

      // Update title
      const titles = { home: "Optimize", nav: query.cube || "Navigation", results: "Results", jobs: "Jobs", settings: "Settings", transfer: "Sync Order" };
      document.title = `OptimusPy — ${titles[pageName] || "Dashboard"}`;

      // Mount
      this._current = pageName;
      if (this._pages[pageName]) {
        this._pages[pageName].mount(params, query);
      }
    },
  };

  // ==================================================================
  // Page: Home
  // ==================================================================
  const HomePage = {
    _ramThreshold: 60,
    _includeOptimized: false,

    mount() {
      const page = $("#page-home");
      page.innerHTML = "";

      if (!state.connected) {
        this._renderDisconnected(page);
      } else {
        // Connected — redirect to the navigation split-panel view
        Router.navigate("#/nav");
      }
    },

    // ---- Not connected: instance tiles + collapsible help ----
    _renderDisconnected(page) {
      page.appendChild(el("div", { className: "page-header" },
        el("h1", { className: "page-title" }, "OptimusPy"),
        el("p", { className: "page-subtitle" }, "Connect to a TM1 instance to get started"),
      ));

      if (state.instances.length > 0) {
        const tilesGrid = el("div", { className: "instance-tiles" });
        state.instances.forEach(name => {
          const tile = el("button", {
            className: "instance-tile",
            onClick: () => Sidebar._promptConnect(name),
          },
            el("div", { className: "instance-tile-icon", html: '<svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>' }),
            el("div", { className: "instance-tile-name" }, name),
            el("div", { className: "instance-tile-hint" }, "Click to connect"),
          );
          tilesGrid.appendChild(tile);
        });
        page.appendChild(tilesGrid);
      } else {
        page.appendChild(el("div", { className: "empty-state" },
          el("div", { className: "empty-state-icon", html: '<svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>' }),
          el("div", { className: "empty-state-title" }, "No instances configured"),
          el("div", { className: "empty-state-text" }, "Add TM1 server connections to config.ini to get started."),
        ));
      }

      // Collapsible help section
      page.appendChild(this._buildCollapsibleHelp());
    },

    // ---- Connected: auto-scan cube cards ----
    _renderConnected(page) {
      // Header with instance info + rescan
      const header = el("div", { className: "page-header", style: "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px" });
      header.appendChild(el("div", null,
        el("h1", { className: "page-title" }, state.serverName || state.activeInstance),
        el("p", { className: "page-subtitle" }, `${state.activeInstance} — ${state.savedCubes.length} saved cube${state.savedCubes.length !== 1 ? "s" : ""}`),
      ));
      const headerActions = el("div", { className: "flex gap-2 items-center" });
      const helpBtn = el("button", {
        className: "btn btn-ghost btn-sm",
        "aria-label": "Tips & help",
        onClick: () => this._showHelpDrawer(),
      }, el("span", { html: Icons.info }), "Help");
      headerActions.appendChild(helpBtn);
      header.appendChild(headerActions);
      page.appendChild(header);

      // Filter bar
      const filterBar = el("div", { className: "cube-filter-bar" });
      // RAM threshold slider
      const ramGroup = el("div", { className: "cube-filter-group" });
      ramGroup.appendChild(el("label", { className: "cube-filter-label" }, "RAM Threshold"));
      const ramRow = el("div", { className: "flex items-center gap-2" });
      const ramSlider = el("input", { type: "range", min: "0", max: "100", value: String(this._ramThreshold), style: "width:120px" });
      const ramValue = el("span", { className: "cube-filter-value" }, this._ramThreshold + "%");
      ramSlider.addEventListener("input", () => {
        this._ramThreshold = parseInt(ramSlider.value);
        ramValue.textContent = this._ramThreshold + "%";
      });
      // Don't auto-scan on slider change — user clicks Rescan when ready
      ramRow.appendChild(ramSlider);
      ramRow.appendChild(ramValue);
      ramGroup.appendChild(ramRow);
      filterBar.appendChild(ramGroup);
      // Include optimized toggle
      const optLabel = el("label", { className: "cube-filter-group checkbox-label", style: "cursor:pointer" });
      const optCb = el("input", { type: "checkbox" });
      optCb.checked = this._includeOptimized;
      optCb.addEventListener("change", () => { this._includeOptimized = optCb.checked; });
      optLabel.appendChild(optCb);
      optLabel.appendChild(document.createTextNode(" Include optimized"));
      filterBar.appendChild(optLabel);
      // Rescan button
      const rescanBtn = el("button", { className: "btn btn-ghost btn-sm", id: "home-rescan-btn", onClick: () => this._rescan(page) },
        el("span", { html: Icons.refresh }), "Rescan");
      filterBar.appendChild(rescanBtn);
      page.appendChild(filterBar);

      // Cubes container
      const cubesContainer = el("div", { id: "home-cubes-container" });
      page.appendChild(cubesContainer);

      // Auto-scan if no data yet, otherwise render existing
      if (state.scanData) {
        this._renderCubeCards(cubesContainer);
      } else {
        this._autoScan(cubesContainer);
      }
    },

    async _autoScan(container) {
      this._showScanLoading(container);
      try {
        const data = await Api.scan(state.activeInstance, state.password, this._ramThreshold, this._includeOptimized);
        state.scanData = data;
        Sidebar.renderScannedCubes();
        container.innerHTML = "";
        this._renderCubeCards(container);
      } catch (err) {
        container.innerHTML = "";
        container.appendChild(el("div", { className: "empty-state" },
          el("div", { className: "empty-state-title" }, "Scan failed"),
          el("div", { className: "empty-state-text" }, err.message),
          el("div", { className: "empty-state-action" },
            el("button", { className: "btn btn-primary", onClick: () => this._autoScan(container) }, "Retry")),
        ));
      }
    },

    async _rescan(page) {
      const container = page.querySelector("#home-cubes-container") || $("#home-cubes-container");
      if (!container) return;
      const btn = page.querySelector("#home-rescan-btn") || $("#home-rescan-btn");
      if (btn) { btn.disabled = true; }
      this._showScanLoading(container);
      try {
        const data = await Api.scan(state.activeInstance, state.password, this._ramThreshold, this._includeOptimized);
        state.scanData = data;
        Sidebar.renderScannedCubes();
        container.innerHTML = "";
        this._renderCubeCards(container);
        Toast.success(`Found ${data.candidates?.length || 0} cubes`);
      } catch (err) {
        container.innerHTML = "";
        container.appendChild(el("div", { className: "empty-state" },
          el("div", { className: "empty-state-title" }, "Scan failed"),
          el("div", { className: "empty-state-text" }, err.message),
        ));
        Toast.error("Scan failed: " + err.message);
      } finally {
        if (btn) { btn.disabled = false; }
      }
    },

    _showScanLoading(container) {
      container.innerHTML = "";
      const loading = el("div", { className: "cube-cards-loading" });
      loading.appendChild(el("div", { className: "flex items-center gap-3 mb-4" },
        el("div", { className: "activity-spinner", style: "width:16px;height:16px;border-width:2px" }),
        el("span", { className: "text-sm text-secondary" }, "Scanning instance — fetching cube RAM data and dimension metadata..."),
      ));
      // Skeleton cards
      for (let i = 0; i < 6; i++) {
        loading.appendChild(el("div", { className: "cube-card-skeleton" }));
      }
      container.appendChild(loading);
    },

    _renderCubeCards(container) {
      const cubes = state.scanData?.candidates || [];
      if (cubes.length === 0) {
        container.appendChild(el("div", { className: "empty-state" },
          el("div", { className: "empty-state-title" }, "No cubes found"),
          el("div", { className: "empty-state-text" }, "Try lowering the RAM threshold or enabling 'Include optimized'."),
        ));
        return;
      }

      // Summary line
      const totalRam = cubes.reduce((sum, c) => sum + (c.ram_gb || 0), 0);
      container.appendChild(el("div", { className: "cube-cards-summary" },
        `${cubes.length} cube${cubes.length !== 1 ? "s" : ""} — ${totalRam.toFixed(2)} GB total RAM`
      ));

      const grid = el("div", { className: "cube-cards-grid" });
      const maxRam = Math.max(...cubes.map(c => c.ram_gb || 0), 0.01);
      cubes.forEach(c => {
        const card = el("button", {
          className: "cube-card",
          onClick: () => Router.navigate(`#/cube/${encodeURIComponent(c.cube_name)}`),
        });
        // Top row: name + badges
        const top = el("div", { className: "cube-card-top" });
        top.appendChild(el("span", { className: "cube-card-name" }, c.cube_name));
        const badges = el("span", { className: "cube-card-badges" });
        if (c.already_optimized) badges.appendChild(el("span", { className: "badge badge-success" }, "optimized"));
        if (c.last_dim_has_strings) badges.appendChild(el("span", { className: "badge badge-warning" }, "strings"));
        top.appendChild(badges);
        card.appendChild(top);
        // RAM bar
        const barWrap = el("div", { className: "cube-card-bar-wrap" });
        const barFill = el("div", { className: "cube-card-bar-fill" });
        const pct = Math.max((c.ram_gb || 0) / maxRam * 100, 2);
        barFill.style.width = pct + "%";
        // Color: green < 33%, amber 33-66%, red > 66% of max
        barFill.classList.add(pct > 66 ? "high" : pct > 33 ? "mid" : "low");
        barWrap.appendChild(barFill);
        card.appendChild(barWrap);
        // Bottom row: stats
        const bottom = el("div", { className: "cube-card-stats" });
        bottom.appendChild(el("span", null, `${(c.ram_gb || 0).toFixed(2)} GB`));
        bottom.appendChild(el("span", null, `${(c.pct_of_total || 0).toFixed(1)}% of model`));
        bottom.appendChild(el("span", null, `${c.dim_count || 0} dims`));
        card.appendChild(bottom);
        grid.appendChild(card);
      });
      container.appendChild(grid);
    },

    // ---- Help: show tips in a modal instead of inline ----
    _showHelpDrawer() {
      Modal.open({
        title: "Tips & Help",
        body: this._buildGuideContent(),
        size: "lg",
      });
    },

    // ---- Collapsible help (for not-connected page) ----
    _buildCollapsibleHelp() {
      const section = el("div", { className: "collapsible-help" });
      const toggle = el("button", { className: "collapsible-help-toggle" },
        el("span", null, "Tips & Getting Started"),
        el("span", { className: "collapsible-help-chevron", html: Icons.chevronRight }),
      );
      const content = el("div", { className: "collapsible-help-content hidden" });
      content.appendChild(this._buildGuideContent());
      toggle.addEventListener("click", () => {
        content.classList.toggle("hidden");
        const chevron = toggle.querySelector(".collapsible-help-chevron");
        chevron.style.transform = content.classList.contains("hidden") ? "" : "rotate(90deg)";
      });
      section.appendChild(toggle);
      section.appendChild(content);
      return section;
    },

    _buildGuideContent() {
      const wrap = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px" });

      // ---- How to Use OptimusPy ----
      const howTo = el("div", { className: "card" });
      howTo.appendChild(el("h2", { className: "card-title", style: "margin-bottom:12px" }, "How to Use OptimusPy"));

      const steps = [
        { n: "1", title: "Connect", desc: "Select a TM1 instance from the sidebar and enter your password if needed." },
        { n: "2", title: "Scan", desc: "Go to Cubes and scan the instance. OptimusPy identifies cubes that may benefit from reordering based on RAM usage." },
        { n: "3", title: "Configure", desc: "Select a cube, choose an optimization mode (Greedy, Predefined, Position, or Dimension), pick views to benchmark, and set the number of executions per permutation." },
        { n: "4", title: "Optimize", desc: "Start the optimization. OptimusPy will test dimension orderings, measuring RAM and query time for each. You can stop the process at any time." },
        { n: "5", title: "Review", desc: "Check the Results tab for CSV/HTML reports showing all tested permutations and the recommended order." },
      ];
      steps.forEach(s => {
        const row = el("div", { style: "display:flex;gap:10px;margin-bottom:10px" });
        row.appendChild(el("div", { style: "width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0" }, s.n));
        const text = el("div");
        text.appendChild(el("div", { style: "font-weight:600;font-size:13px;color:var(--text-primary)" }, s.title));
        text.appendChild(el("div", { style: "font-size:12px;color:var(--text-secondary);line-height:1.4" }, s.desc));
        row.appendChild(text);
        howTo.appendChild(row);
      });

      // Optimization modes
      howTo.appendChild(el("div", { style: "margin-top:14px;padding-top:14px;border-top:1px solid var(--border-secondary)" }));
      howTo.appendChild(el("div", { style: "font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:8px" }, "Optimization Modes"));
      const modes = [
        { badge: "Greedy", color: "var(--accent)", desc: "Outside-in algorithm. Tests each dimension for first and last position, then works inward. Best general-purpose approach." },
        { badge: "Predefined", color: "var(--warning)", desc: "Benchmarks specific dimension orders you define. Use when you have candidate orders from manual analysis." },
        { badge: "Position", color: "var(--success)", desc: "Tests all dimensions for a single position (e.g., find the best last dimension). Quick, targeted optimization." },
        { badge: "Dimension", color: "var(--error)", desc: "Tests all positions for a single dimension. Useful when you know which dimension to focus on." },
      ];
      modes.forEach(m => {
        const row = el("div", { style: "display:flex;gap:8px;align-items:baseline;margin-bottom:6px" });
        row.appendChild(el("span", { style: `display:inline-block;padding:1px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${m.color}` }, m.badge));
        row.appendChild(el("span", { style: "font-size:12px;color:var(--text-secondary);line-height:1.4" }, m.desc));
        howTo.appendChild(row);
      });

      wrap.appendChild(howTo);

      // ---- Dimension Ordering Tips ----
      const tips = el("div", { className: "card" });
      tips.appendChild(el("h2", { className: "card-title", style: "margin-bottom:12px" }, "Dimension Ordering Tips"));
      tips.appendChild(el("div", { style: "font-size:12px;color:var(--text-tertiary);margin-bottom:14px;line-height:1.4" },
        "Based on research from IBM documentation, the TM1 community, and the Horizon 2021 presentation by Hubert Heijkers, IBM Chief Architect of the TM1 Server."));

      const tipItems = [
        {
          icon: "&#x1F3AF;", title: "The 90/10 Rule",
          text: "~90% of memory optimization comes from correctly identifying the last dimension. The second-to-last accounts for ~9%. Getting the last dimension right is the single most impactful change."
        },
        {
          icon: "&#x2B06;", title: "Small-Sparse First, Large-Dense Last",
          text: "Order dimensions from smallest/sparsest at the top to largest/densest at the bottom. Dimensions higher in the storage order multiply the index structure below them \u2014 fewer branches at the top means less replication."
        },
        {
          icon: "&#x1F50D;", title: "Title Dimensions First for Query Speed",
          text: "Dimensions commonly used in view titles or MDX WHERE clauses (Version, Year, Currency) should be near the top. This lets TM1 prune the internal index early, drastically reducing traversal."
        },
        {
          icon: "&#x1F4BE;", title: "Partitioning Dimension First for Write Speed",
          text: "If TI loads data partitioned by a dimension (e.g., one file per Store), place that dimension first. All writes go to a single compact branch, minimizing lock contention."
        },
        {
          icon: "&#x26A0;", title: "Watch for String Dimensions",
          text: "TM1 requires the dimension with string elements to stay in the last position. This can prevent the optimal dimension from taking that spot. Best practice: separate string elements into a different cube."
        },
        {
          icon: "&#x1F4CA;", title: "Density Matters More Than Size",
          text: "A 10,000-element dimension at 2% density behaves very differently from one at 95%. Size alone isn\u2019t enough \u2014 always consider how much of the dimension is actually populated with data."
        },
        {
          icon: "&#x2696;", title: "RAM vs. Speed Is a Trade-Off",
          text: "The optimal order for memory, query speed, and write speed can differ for the same cube. Under 2 GB? Prioritize query speed. Hitting RAM limits? Prioritize memory. Use OptimusPy to find the best compromise."
        },
        {
          icon: "&#x1F504;", title: "Re-evaluate Periodically",
          text: "Data volumes and distribution patterns change over time. An order that was optimal last year may no longer be. Re-run the analysis after major data changes or growth."
        },
      ];
      tipItems.forEach(t => {
        const row = el("div", { style: "display:flex;gap:10px;margin-bottom:12px" });
        row.appendChild(el("div", { html: t.icon, style: "font-size:16px;flex-shrink:0;margin-top:1px" }));
        const text = el("div");
        text.appendChild(el("div", { style: "font-weight:600;font-size:13px;color:var(--text-primary)" }, t.title));
        text.appendChild(el("div", { style: "font-size:12px;color:var(--text-secondary);line-height:1.4" }, t.text));
        row.appendChild(text);
        tips.appendChild(row);
      });

      // Storage vs Presentation callout
      tips.appendChild(el("div", { style: "margin-top:10px;padding:12px;border-radius:var(--radius-md);background:var(--bg-tertiary);border:1px solid var(--border-secondary);font-size:12px;color:var(--text-secondary);line-height:1.5" },
        el("strong", { style: "color:var(--text-primary)" }, "Storage order \u2260 Presentation order. "),
        "The storage (internal) order controls how TM1 indexes data in memory. It can be changed at any time without affecting rules, processes, views, or reports. The presentation (build) order is set at cube creation and determines how dimensions appear in viewers and code \u2014 it cannot be changed. OptimusPy only modifies the storage order."
      ));

      wrap.appendChild(tips);
      return wrap;
    },

    unmount() {},
  };

  // ==================================================================
  // Page: Navigation (split-panel: cube list + workspace)
  // ==================================================================
  const NavPage = {
    _selectedCube: null,
    _panelHidden: false,
    _ramThreshold: 60,
    _includeOptimized: false,
    _searchQuery: "",

    mount(params, query) {
      if (!state.connected) {
        Router.navigate("#/home");
        return;
      }

      const cubeName = params.cubeName || query.cube || null;
      const tab = query.tab || null;

      // If same cube, just update workspace tab
      if (cubeName && cubeName === this._selectedCube && tab) {
        // Re-render workspace for tab switch
        this._renderWorkspace(tab);
        return;
      }

      this._selectedCube = cubeName;
      this._renderCubePanel();

      if (cubeName) {
        this._renderWorkspace(tab || "overview");
        this._highlightCube(cubeName);
      } else {
        this._renderEmptyWorkspace();
      }
    },

    // ---- Left panel: cube list ----
    _renderCubePanel() {
      const header = $("#cubePanelHeader");
      const body = $("#cubePanelBody");
      header.innerHTML = "";
      body.innerHTML = "";

      // Header: filter controls
      const filterWrap = el("div");
      // Search input (filters the already-scanned cube list client-side)
      const searchInput = el("input", {
        type: "search",
        placeholder: "Search cubes…",
        value: this._searchQuery,
        className: "form-input",
        style: "width:100%;margin-bottom:8px;font-size:12px;padding:4px 8px",
      });
      searchInput.addEventListener("input", () => {
        this._searchQuery = searchInput.value;
      });
      filterWrap.appendChild(searchInput);
      // RAM slider
      const ramRow = el("div", { className: "flex items-center justify-between mb-2" });
      ramRow.appendChild(el("span", { className: "cube-filter-label" }, "RAM Threshold"));
      const ramValSpan = el("span", { className: "cube-filter-value" }, this._ramThreshold + "%");
      ramRow.appendChild(ramValSpan);
      filterWrap.appendChild(ramRow);
      const ramSlider = el("input", { type: "range", min: "0", max: "100", value: String(this._ramThreshold), style: "width:100%;margin-bottom:8px" });
      ramSlider.addEventListener("input", () => {
        this._ramThreshold = parseInt(ramSlider.value);
        ramValSpan.textContent = this._ramThreshold + "%";
      });
      // Don't auto-scan on slider change — user clicks Rescan when ready
      filterWrap.appendChild(ramSlider);
      // Include optimized + Rescan
      const bottomRow = el("div", { className: "flex items-center justify-between" });
      const optLabel = el("label", { className: "checkbox-label", style: "font-size:11px;gap:4px" });
      const optCb = el("input", { type: "checkbox" });
      optCb.checked = this._includeOptimized;
      optCb.addEventListener("change", () => { this._includeOptimized = optCb.checked; });
      optLabel.appendChild(optCb);
      optLabel.appendChild(document.createTextNode("Include optimized"));
      bottomRow.appendChild(optLabel);
      const rescanBtn = el("button", { className: "btn btn-ghost btn-sm", id: "nav-rescan-btn", onClick: () => this._doScan() },
        el("span", { html: Icons.refresh }));
      bottomRow.appendChild(rescanBtn);
      filterWrap.appendChild(bottomRow);
      // Scan age indicator
      const ageEl = el("div", { className: "text-xs text-tertiary", id: "scan-age", style: "margin-top:6px" });
      filterWrap.appendChild(ageEl);
      header.appendChild(filterWrap);

      // Body: cube list — use cached data if available, otherwise scan
      if (state.scanData) {
        this._renderCubeList(body);
        this._updateScanAge();
      } else {
        this._doScan();
      }
    },

    _updateScanAge() {
      const ageEl = $("#scan-age");
      if (!ageEl) return;
      if (state.scanTimestamp) {
        ageEl.textContent = `Scanned ${ScanCache.formatAge(state.scanTimestamp)}`;
      } else {
        ageEl.textContent = "";
      }
    },

    async _doScan() {
      const body = $("#cubePanelBody");
      const btn = $("#nav-rescan-btn");
      if (btn) btn.disabled = true;
      body.innerHTML = "";
      // Loading
      for (let i = 0; i < 6; i++) {
        body.appendChild(el("div", { className: "cube-card-skeleton", style: "height:52px;margin-bottom:4px" }));
      }
      try {
        const data = await Api.scan(state.activeInstance, state.password, this._ramThreshold, this._includeOptimized);
        state.scanData = data;
        state.scanTimestamp = Date.now();
        ScanCache.save(state.activeInstance, data);
        Sidebar.renderScannedCubes();
        body.innerHTML = "";
        this._renderCubeList(body);
        this._updateScanAge();
      } catch (err) {
        body.innerHTML = "";
        body.appendChild(el("div", { className: "text-sm text-tertiary", style: "padding:12px" }, "Scan failed: " + err.message));
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    _renderCubeList(container) {
      const cubes = state.scanData?.candidates || [];
      if (cubes.length === 0) {
        container.appendChild(el("div", { className: "text-sm text-tertiary", style: "padding:12px;text-align:center" }, "No cubes found"));
        return;
      }
      const maxRam = Math.max(...cubes.map(c => c.ram_gb || 0), 0.01);
      // Summary
      container.appendChild(el("div", { className: "text-xs text-tertiary", style: "padding:0 4px 8px" },
        `${cubes.length} cube${cubes.length !== 1 ? "s" : ""}`));

      cubes.forEach(c => {
        const isActive = c.cube_name === this._selectedCube;
        const item = el("button", {
          className: `cube-list-item${isActive ? " active" : ""}`,
          dataset: { cube: c.cube_name },
          onClick: () => {
            this._selectedCube = c.cube_name;
            history.replaceState(null, "", `#/nav?cube=${encodeURIComponent(c.cube_name)}`);
            this._highlightCube(c.cube_name);
            this._renderWorkspace("overview");
          },
        });
        // Top: name + RAM
        const top = el("div", { className: "cube-list-item-top" });
        top.appendChild(el("span", { className: "cube-list-item-name" }, c.cube_name));
        top.appendChild(el("span", { className: "cube-list-item-ram" }, `${(c.ram_gb || 0).toFixed(2)} GB`));
        item.appendChild(top);
        // Bar
        const barWrap = el("div", { className: "cube-card-bar-wrap" });
        const pct = Math.max((c.ram_gb || 0) / maxRam * 100, 2);
        const barFill = el("div", { className: `cube-card-bar-fill ${pct > 66 ? "high" : pct > 33 ? "mid" : "low"}` });
        barFill.style.width = pct + "%";
        barWrap.appendChild(barFill);
        item.appendChild(barWrap);
        // Meta
        const meta = el("div", { className: "cube-list-item-meta" });
        meta.appendChild(el("span", null, `${c.dim_count || 0} dims`));
        meta.appendChild(el("span", null, `${(c.pct_of_total || 0).toFixed(1)}%`));
        if (c.already_optimized) meta.appendChild(el("span", { className: "badge badge-success", style: "font-size:9px;padding:0 4px" }, "opt"));
        if (c.last_dim_has_strings) meta.appendChild(el("span", { className: "badge badge-warning", style: "font-size:9px;padding:0 4px" }, "str"));
        item.appendChild(meta);
        container.appendChild(item);
      });
    },

    _highlightCube(cubeName) {
      const body = $("#cubePanelBody");
      if (!body) return;
      body.querySelectorAll(".cube-list-item").forEach(item => {
        item.classList.toggle("active", item.dataset.cube === cubeName);
      });
    },

    // ---- Right panel: workspace ----
    _renderEmptyWorkspace() {
      const panel = $("#workspacePanel");
      panel.innerHTML = "";
      panel.appendChild(el("div", { className: "empty-state", style: "padding-top:80px" },
        el("div", { className: "empty-state-icon", html: '<svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' }),
        el("div", { className: "empty-state-title" }, "Select a cube"),
        el("div", { className: "empty-state-text" }, "Choose a cube from the list to view details and start optimizing."),
      ));
    },

    _renderWorkspace(tab) {
      const panel = $("#workspacePanel");
      panel.innerHTML = "";
      panel.style.position = "relative";

      if (!this._selectedCube) {
        this._renderEmptyWorkspace();
        return;
      }

      // Toggle button to show/hide cube panel
      const cubePanel = $("#cubePanel");
      const toggleBtn = el("button", {
        className: "cube-panel-toggle",
        "aria-label": this._panelHidden ? "Show cube list" : "Hide cube list",
        onClick: () => {
          this._panelHidden = !this._panelHidden;
          cubePanel.classList.toggle("hidden-panel", this._panelHidden);
          toggleBtn.setAttribute("aria-label", this._panelHidden ? "Show cube list" : "Hide cube list");
          toggleBtn.innerHTML = this._panelHidden ? Icons.chevronRight : Icons.chevronLeft;
          // Show/hide breadcrumb
          const bc = panel.querySelector(".workspace-breadcrumb");
          if (bc) bc.style.display = this._panelHidden ? "flex" : "none";
        },
      });
      toggleBtn.innerHTML = this._panelHidden ? Icons.chevronRight : Icons.chevronLeft;
      panel.appendChild(toggleBtn);

      // Breadcrumb (shown when panel hidden)
      const breadcrumb = el("div", { className: "workspace-breadcrumb", style: this._panelHidden ? "" : "display:none" });
      breadcrumb.appendChild(el("button", { onClick: () => toggleBtn.click() },
        el("span", { html: Icons.chevronRight }), "Show cubes"));
      breadcrumb.appendChild(el("span", null, " / "));
      breadcrumb.appendChild(el("span", { style: "font-weight:600;color:var(--text-primary)" }, this._selectedCube));
      panel.appendChild(breadcrumb);

      // Content container (offset for toggle button)
      const content = el("div", { style: "padding-left:36px" });

      // Cube title
      content.appendChild(el("h1", { className: "page-title mb-2" }, this._selectedCube));

      // Delegate to CubeWorkspace for the actual tab rendering
      // We pass the content container and tab name
      this._renderCubeContent(content, tab || "overview");

      panel.appendChild(content);
    },

    _renderCubeContent(container, tab) {
      // We reuse CubeWorkspace's internal methods by telling it to render into our container
      // Set the cube name on CubeWorkspace and trigger its tab rendering
      CubeWorkspace._cubeName = this._selectedCube;
      CubeWorkspace._activeTab = tab;
      CubeWorkspace._tabCache = {};

      // Tabs bar
      const tabsEl = el("div", { className: "tabs", role: "tablist", "aria-label": "Cube workspace tabs" });
      const tabNames = ["overview", "configure", "optimize", "results"];
      tabNames.forEach((t, idx) => {
        const label = t.charAt(0).toUpperCase() + t.slice(1);
        const isActive = t === tab;
        const tabBtn = el("button", {
          className: `tab${isActive ? " active" : ""}`,
          role: "tab",
          "aria-selected": isActive ? "true" : "false",
          tabindex: isActive ? "0" : "-1",
          id: `tab-${t}`,
          "aria-controls": `tabpanel-${t}`,
          dataset: { tab: t },
          onClick: () => {
            history.replaceState(null, "", `#/nav?cube=${encodeURIComponent(this._selectedCube)}&tab=${t}`);
            // Re-render workspace for this tab
            this._renderWorkspace(t);
          },
          onKeydown: (e) => {
            let newIdx = idx;
            if (e.key === "ArrowRight") newIdx = (idx + 1) % tabNames.length;
            else if (e.key === "ArrowLeft") newIdx = (idx - 1 + tabNames.length) % tabNames.length;
            else if (e.key === "Home") newIdx = 0;
            else if (e.key === "End") newIdx = tabNames.length - 1;
            else return;
            e.preventDefault();
            const target = tabsEl.querySelector(`[data-tab="${tabNames[newIdx]}"]`);
            if (target) { target.click(); target.focus(); }
          },
        }, label);
        tabsEl.appendChild(tabBtn);
      });

      // Check for results availability and add "View Results" action
      const hasResults = this._cubeHasResults(this._selectedCube);
      const actionsRow = el("div", { className: "flex items-center gap-2 mb-4", style: "margin-top:-4px" });
      const viewResultsBtn = el("button", {
        className: `btn btn-ghost btn-sm${hasResults ? "" : " disabled"}`,
        disabled: !hasResults,
        onClick: () => { if (hasResults) Router.navigate(`#/results?cube=${encodeURIComponent(this._selectedCube)}`); },
      }, el("span", { html: Icons.externalLink }), "View Prior Results");
      actionsRow.appendChild(viewResultsBtn);

      // Help button
      const helpBtn = el("button", { className: "btn btn-ghost btn-sm", onClick: () => HomePage._showHelpDrawer() },
        el("span", { html: Icons.info }), "Help");
      actionsRow.appendChild(helpBtn);

      container.appendChild(tabsEl);
      container.appendChild(actionsRow);

      // Tab content
      const tabPane = el("div", { className: "tab-pane", role: "tabpanel", id: `tabpanel-${tab}`, "aria-labelledby": `tab-${tab}` });
      CubeWorkspace._tabCache = {};
      CubeWorkspace._contentEl = tabPane;
      CubeWorkspace._tabsEl = tabsEl;

      switch (tab) {
        case "overview": CubeWorkspace._renderOverview(tabPane); break;
        case "configure": CubeWorkspace._renderConfigure(tabPane).catch(err => {
          tabPane.innerHTML = "";
          tabPane.appendChild(el("div", { className: "empty-state" },
            el("div", { className: "empty-state-title" }, "Failed to load configuration"),
            el("div", { className: "empty-state-text" }, err.message),
          ));
        }); break;
        case "optimize": CubeWorkspace._renderOptimize(tabPane); break;
        case "results": CubeWorkspace._renderResults(tabPane); break;
      }
      container.appendChild(tabPane);
    },

    _cubeHasResults(cubeName) {
      // Check if there are result files for this cube in the results API cache
      // We'll do a quick check — if scanData has the cube or savedCubes has it
      return state.savedCubes.some(sc => sc.cube === cubeName);
    },

    // ---- Panel visibility ----
    showPanel() {
      this._panelHidden = false;
      const cubePanel = $("#cubePanel");
      if (cubePanel) cubePanel.classList.remove("hidden-panel");
    },

    hidePanel() {
      this._panelHidden = true;
      const cubePanel = $("#cubePanel");
      if (cubePanel) cubePanel.classList.add("hidden-panel");
    },

    unmount() {
      this._selectedCube = null;
    },
  };

  // ==================================================================
  // Page: Cubes (scan + table) — legacy, kept for direct URL access
  // ==================================================================
  const CubesPage = {
    _table: null,

    mount() {
      const page = $("#page-cubes");
      page.innerHTML = "";

      page.appendChild(el("div", { className: "page-header" },
        el("h1", { className: "page-title" }, "Cubes"),
        el("p", { className: "page-subtitle" }, "Scan your TM1 instance and explore cube dimensions"),
      ));

      if (!state.connected) {
        page.appendChild(el("div", { className: "empty-state" },
          el("div", { className: "empty-state-title" }, "Not connected"),
          el("div", { className: "empty-state-text" }, "Connect to a TM1 instance first."),
          el("div", { className: "empty-state-action" },
            el("button", { className: "btn btn-primary", onClick: () => Router.navigate("#/home") }, "Go to Home")),
        ));
        return;
      }

      // Scan controls
      const controls = el("div", { className: "card mb-4" });
      const controlsInner = el("div", { className: "flex items-center gap-4", style: "flex-wrap:wrap" });

      // RAM threshold
      const ramGroup = el("div", { className: "form-group", style: "margin-bottom:0;flex:1;min-width:200px" });
      ramGroup.appendChild(el("label", { className: "form-label" }, "RAM Threshold %"));
      const ramRow = el("div", { className: "flex items-center gap-2" });
      const ramSlider = el("input", { type: "range", min: "0", max: "100", value: "60", style: "flex:1" });
      const ramValue = el("span", { className: "text-sm font-medium", style: "width:36px;text-align:right" }, "60%");
      ramSlider.addEventListener("input", () => { ramValue.textContent = ramSlider.value + "%"; });
      ramRow.appendChild(ramSlider);
      ramRow.appendChild(ramValue);
      ramGroup.appendChild(ramRow);
      controlsInner.appendChild(ramGroup);

      // Include optimized
      const optLabel = el("label", { className: "checkbox-label" });
      const optCb = el("input", { type: "checkbox" });
      optLabel.appendChild(optCb);
      optLabel.appendChild(document.createTextNode("Include optimized"));
      controlsInner.appendChild(optLabel);

      // Scan button
      const scanBtn = el("button", { className: "btn btn-primary" },
        el("span", { html: Icons.search }), "Scan");
      scanBtn.addEventListener("click", async () => {
        scanBtn.disabled = true;
        scanBtn.innerHTML = Icons.refresh + " Scanning...";
        // Show loading skeleton while scan runs
        const existingTable = page.querySelector(".table-wrapper");
        if (existingTable) existingTable.remove();
        const existingEmpty = page.querySelector(".empty-state");
        if (existingEmpty) existingEmpty.remove();
        const loadingEl = el("div", { className: "card", id: "scan-loading" });
        loadingEl.appendChild(el("div", { className: "flex items-center gap-3 mb-4" },
          el("div", { className: "status-dot running", style: "width:8px;height:8px;border-radius:50%;background:var(--success);animation:pulse 1.5s ease-in-out infinite" }),
          el("span", { className: "text-sm font-medium" }, "Scanning instance — fetching RAM data, dimension metadata, and storage orders..."),
        ));
        for (let i = 0; i < 5; i++) {
          loadingEl.appendChild(el("div", { className: "skeleton skeleton-text", style: `width:${80 - i * 10}%;margin-bottom:8px` }));
        }
        page.appendChild(loadingEl);
        try {
          const data = await Api.scan(state.activeInstance, state.password, parseInt(ramSlider.value), optCb.checked);
          state.scanData = data;
          const lEl = page.querySelector("#scan-loading");
          if (lEl) lEl.remove();
          this._renderTable(page);
          Sidebar.renderScannedCubes();
          Toast.success(`Found ${data.candidates?.length || 0} cubes`);
        } catch (err) {
          const lEl = page.querySelector("#scan-loading");
          if (lEl) lEl.remove();
          Toast.error("Scan failed: " + err.message);
        } finally {
          scanBtn.disabled = false;
          scanBtn.innerHTML = Icons.search + " Scan";
        }
      });
      controlsInner.appendChild(scanBtn);

      controls.appendChild(controlsInner);
      page.appendChild(controls);

      // Table placeholder
      if (state.scanData) {
        this._renderTable(page);
      } else {
        page.appendChild(el("div", { className: "empty-state" },
          el("div", { className: "empty-state-title" }, "No scan data"),
          el("div", { className: "empty-state-text" }, "Click Scan to discover cubes in your TM1 instance."),
        ));
      }
    },

    _renderTable(page) {
      // Remove old table
      const existing = page.querySelector(".table-wrapper");
      if (existing) existing.remove();
      const existingEmpty = page.querySelector(".empty-state");
      if (existingEmpty) existingEmpty.remove();

      const cubes = state.scanData?.candidates || [];

      this._table = createTable({
        columns: [
          { key: "index", label: "#", sortable: false, render: (_, i) => i + 1, align: "right" },
          { key: "cube_name", label: "Cube Name", render: r => {
            const wrap = el("span", { className: "flex items-center gap-2" });
            wrap.appendChild(el("span", { className: "font-medium" }, r.cube_name));
            if (r.already_optimized) wrap.appendChild(el("span", { className: "badge badge-success" }, "optimized"));
            return wrap;
          }},
          { key: "dim_count", label: "Dims", align: "right", value: r => r.dim_count || 0 },
          { key: "dims_detail", label: "Dimensions", sortable: false, render: r => {
            const dims = r.dimension_order || [];
            if (dims.length === 0) return "—";
            const wrap = el("div", { className: "flex gap-1", style: "flex-wrap:wrap" });
            dims.forEach(name => {
              wrap.appendChild(el("span", { className: "badge badge-neutral", style: "font-size:10px" }, name));
            });
            if (r.last_dim_has_strings) {
              wrap.appendChild(el("span", {
                className: "badge badge-neutral",
                style: "font-size:10px;border-left:2px solid var(--warning);color:var(--warning)",
                html: Icons.alertTriangle + " strings in last dim"
              }));
            }
            return wrap;
          }},
          { key: "ram_gb", label: "RAM (GB)", align: "right", sortValue: r => r.ram_gb || 0,
            render: r => r.ram_gb != null ? r.ram_gb.toFixed(2) : "—" },
          { key: "pct_of_total", label: "% of Total", align: "right", sortValue: r => r.pct_of_total || 0,
            render: r => r.pct_of_total != null ? r.pct_of_total.toFixed(1) + "%" : "—" },
        ],
        data: cubes,
        onRowClick: (row) => {
          Router.navigate(`#/cube/${encodeURIComponent(row.cube_name)}`);
        },
        emptyMessage: "No cubes found",
      });

      page.appendChild(this._table.el);
    },

    unmount() {
      if (this._table) { this._table.destroy(); this._table = null; }
    },
  };

  // ==================================================================
  // Page: CubeWorkspace (4 tabs: Overview, Configure, Optimize, Results)
  // ==================================================================
  const CubeWorkspace = {
    _cubeName: null,
    _activeTab: "overview",
    _dimConfigurator: null,
    _viewsTransfer: null,
    _processesTransfer: null,
    _jobId: null,
    _unsubStream: null,
    _timer: null,
    _timerStart: null,
    _tabCache: {},     // tab name → DOM container (cached rendered tabs)
    _tabsEl: null,     // tabs bar element
    _contentEl: null,  // tab content wrapper

    mount(params, query) {
      const newCube = params.cubeName;
      const newTab = query.tab || "overview";

      // If same cube: just switch tab (don't re-render page chrome)
      if (this._cubeName === newCube && this._contentEl) {
        this._switchTab(newTab);
        return;
      }

      // Different cube or first mount: full render
      this._cubeName = newCube;
      this._activeTab = newTab;
      this._tabCache = {};

      const page = $("#page-cube-workspace");
      page.innerHTML = "";

      // Breadcrumb
      page.appendChild(el("div", { className: "breadcrumb" },
        el("a", { href: "#/cubes" }, "Cubes"),
        el("span", { className: "separator" }, "/"),
        el("span", { className: "current" }, this._cubeName),
      ));

      page.appendChild(el("h1", { className: "page-title mb-4" }, this._cubeName));

      // Tabs bar
      this._tabsEl = el("div", { className: "tabs", role: "tablist", "aria-label": "Cube workspace tabs" });
      const tabNames = ["overview", "configure", "optimize", "results"];
      tabNames.forEach((t, idx) => {
        const label = t.charAt(0).toUpperCase() + t.slice(1);
        const isActive = t === this._activeTab;
        const tab = el("button", {
          className: `tab${isActive ? " active" : ""}`,
          role: "tab",
          "aria-selected": isActive ? "true" : "false",
          tabindex: isActive ? "0" : "-1",
          id: `tab-${t}`,
          "aria-controls": `tabpanel-${t}`,
          dataset: { tab: t },
          onClick: () => {
            this._switchTab(t);
            history.replaceState(null, "", `#/cube/${encodeURIComponent(this._cubeName)}?tab=${t}`);
          },
          onKeydown: (e) => {
            let newIdx = idx;
            if (e.key === "ArrowRight") newIdx = (idx + 1) % tabNames.length;
            else if (e.key === "ArrowLeft") newIdx = (idx - 1 + tabNames.length) % tabNames.length;
            else if (e.key === "Home") newIdx = 0;
            else if (e.key === "End") newIdx = tabNames.length - 1;
            else return;
            e.preventDefault();
            const target = this._tabsEl.querySelector(`[data-tab="${tabNames[newIdx]}"]`);
            if (target) { target.click(); target.focus(); }
          },
        }, label);
        this._tabsEl.appendChild(tab);
      });
      page.appendChild(this._tabsEl);

      // Tab content container
      this._contentEl = el("div", { id: "cube-tab-content" });
      page.appendChild(this._contentEl);

      // Render initial tab
      this._renderTab(this._activeTab);
    },

    _switchTab(tabName) {
      if (tabName === this._activeTab && this._tabCache[tabName]) return;
      this._activeTab = tabName;

      // Update tab bar active + ARIA states
      if (this._tabsEl) {
        this._tabsEl.querySelectorAll(".tab").forEach(t => {
          const isActive = t.dataset.tab === tabName;
          t.classList.toggle("active", isActive);
          t.setAttribute("aria-selected", String(isActive));
          t.setAttribute("tabindex", isActive ? "0" : "-1");
        });
      }

      // Hide all cached tabs
      Object.values(this._tabCache).forEach(c => { c.style.display = "none"; });

      // Show cached tab or render new one
      if (this._tabCache[tabName]) {
        this._tabCache[tabName].style.display = "";
        // Re-trigger optimize tab refresh when switching to it
        if (tabName === "optimize") this._refreshOptimize();
      } else {
        this._renderTab(tabName);
      }

      document.title = `OptimusPy — ${this._cubeName}`;
    },

    _renderTab(tabName) {
      const container = el("div", { className: "tab-pane", role: "tabpanel", id: `tabpanel-${tabName}`, "aria-labelledby": `tab-${tabName}`, dataset: { tabPane: tabName } });
      this._tabCache[tabName] = container;
      this._contentEl.appendChild(container);
      switch (tabName) {
        case "overview": this._renderOverview(container); break;
        case "configure": this._renderConfigure(container).catch(err => {
          container.innerHTML = "";
          container.appendChild(el("div", { className: "empty-state" },
            el("div", { className: "empty-state-title" }, "Failed to load configuration"),
            el("div", { className: "empty-state-text" }, err.message),
          ));
        }); break;
        case "optimize": this._renderOptimize(container); break;
        case "results": this._renderResults(container); break;
      }
    },

    // ---- Overview Tab ----
    _renderOverview(container) {
      // Show scan-level data immediately if available
      const scanCandidate = (state.scanData?.candidates || []).find(c => c.cube_name === this._cubeName);

      // Storage order (from scan data or will load from intelligence)
      const orderCard = el("div", { className: "card mb-4" });
      orderCard.appendChild(el("div", { className: "card-title mb-2" }, "Current Storage Order"));
      const orderList = el("div", { className: "flex gap-2", style: "flex-wrap:wrap" });
      const storageOrder = scanCandidate?.storage_order || state.cubeMetadata[this._cubeName]?.storage_order || [];
      if (storageOrder.length > 0) {
        storageOrder.forEach((dim, i) => {
          orderList.appendChild(el("span", { className: "badge badge-neutral" }, `${i + 1}. ${dim}`));
        });
      } else {
        orderList.appendChild(el("span", { className: "text-tertiary text-sm" }, "Load metadata to see storage order"));
      }
      orderCard.appendChild(orderList);
      container.appendChild(orderCard);

      // Cube stats from scan
      if (scanCandidate) {
        const statsCard = el("div", { className: "card mb-4" });
        statsCard.appendChild(el("div", { className: "card-title mb-2" }, "Cube Stats"));
        const statsGrid = el("div", { className: "flex gap-4", style: "flex-wrap:wrap" });
        statsGrid.appendChild(el("div", { className: "stat-card", style: "flex:1;min-width:120px" },
          el("div", { className: "stat-label" }, "Dimensions"),
          el("div", { className: "stat-value" }, String(scanCandidate.dim_count)),
        ));
        statsGrid.appendChild(el("div", { className: "stat-card", style: "flex:1;min-width:120px" },
          el("div", { className: "stat-label" }, "RAM"),
          el("div", { className: "stat-value" }, scanCandidate.ram_gb.toFixed(2) + " GB"),
        ));
        statsGrid.appendChild(el("div", { className: "stat-card", style: "flex:1;min-width:120px" },
          el("div", { className: "stat-label" }, "% of Model"),
          el("div", { className: "stat-value" }, scanCandidate.pct_of_total.toFixed(1) + "%"),
        ));
        if (scanCandidate.already_optimized) {
          statsGrid.appendChild(el("div", { className: "stat-card", style: "flex:1;min-width:120px" },
            el("div", { className: "stat-label" }, "Status"),
            el("div", { className: "stat-value" }, el("span", { className: "badge badge-success" }, "Optimized")),
          ));
        }
        if (scanCandidate.last_dim_has_strings) {
          statsGrid.appendChild(el("div", { className: "stat-card", style: "flex:1;min-width:120px" },
            el("div", { className: "stat-label" }, "Last Dimension"),
            el("div", { className: "stat-value" }, el("span", { className: "dim-card-warning", html: Icons.alertTriangle + " Has Strings" })),
          ));
        }
        statsCard.appendChild(statsGrid);
        container.appendChild(statsCard);
      }

      // Full metadata section — load on demand
      const metaSection = el("div", { id: "overview-metadata" });
      const intel = state.cubeMetadata[this._cubeName];
      if (intel) {
        // Already loaded — show it with a refresh option
        const refreshRow = el("div", { className: "flex items-center gap-2 mb-3" });
        const cachedEntry = IntelCache.load(state.activeInstance, this._cubeName);
        if (cachedEntry) {
          refreshRow.appendChild(el("span", { className: "text-xs text-tertiary" },
            `Analyzed ${ScanCache.formatAge(cachedEntry.ts)}`));
        }
        const refreshBtn = el("button", { className: "btn btn-ghost btn-sm" },
          el("span", { html: Icons.refresh }), "Refresh");
        refreshBtn.addEventListener("click", async () => {
          // Clear caches and re-fetch
          delete state.cubeMetadata[this._cubeName];
          IntelCache.clear(state.activeInstance, this._cubeName);
          delete state.cubeViews[this._cubeName];
          refreshBtn.disabled = true;
          refreshBtn.textContent = "Refreshing...";
          try {
            const [data] = await Promise.all([
              this._fetchIntelligence(),
              this._prefetchViews(),
            ]);
            metaSection.innerHTML = "";
            const newRefreshRow = el("div", { className: "flex items-center gap-2 mb-3" });
            newRefreshRow.appendChild(el("span", { className: "text-xs text-tertiary" }, "Analyzed just now"));
            metaSection.appendChild(newRefreshRow);
            this._renderFullMetadata(metaSection, data);
            Toast.success("Cube analysis refreshed");
          } catch (err) {
            Toast.error("Refresh failed: " + err.message);
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = Icons.refresh + " Refresh";
          }
        });
        refreshRow.appendChild(refreshBtn);
        metaSection.appendChild(refreshRow);
        this._renderFullMetadata(metaSection, intel);
      } else {
        // Show button to analyze cube (fetches dimension metadata + views)
        const loadBtn = el("button", { className: "btn btn-primary" },
          el("span", { html: Icons.search }), "Analyze Cube Dimensions & Views");
        loadBtn.addEventListener("click", async () => {
          loadBtn.disabled = true;
          // Replace button with scan-style loading animation
          metaSection.innerHTML = "";
          const loadingCard = el("div", { className: "card", id: "analyze-loading" });
          loadingCard.appendChild(el("div", { className: "flex items-center gap-3 mb-4" },
            el("div", { style: "width:8px;height:8px;border-radius:50%;background:var(--success);animation:pulse 1.5s ease-in-out infinite" }),
            el("span", { className: "text-sm font-medium" }, "Analyzing cube — fetching dimension metadata, element stats, views, and computing suggested order..."),
          ));
          for (let i = 0; i < 4; i++) {
            loadingCard.appendChild(el("div", { className: "loading-skeleton" }));
          }
          metaSection.appendChild(loadingCard);

          try {
            // Fetch intelligence and views in parallel
            const [data] = await Promise.all([
              this._fetchIntelligence(),
              this._prefetchViews(),
            ]);
            metaSection.innerHTML = "";
            this._renderFullMetadata(metaSection, data);
            // Also update storage order if it wasn't from scan
            if (storageOrder.length === 0) {
              orderList.innerHTML = "";
              (data.storage_order || []).forEach((dim, i) => {
                orderList.appendChild(el("span", { className: "badge badge-neutral" }, `${i + 1}. ${dim}`));
              });
            }
            Toast.success("Cube analysis complete");
          } catch (err) {
            metaSection.innerHTML = "";
            Toast.error("Failed to analyze cube: " + err.message);
            loadBtn.disabled = false;
            metaSection.appendChild(loadBtn);
          }
        });
        metaSection.appendChild(loadBtn);
      }
      container.appendChild(metaSection);
    },

    _renderFullMetadata(container, intel) {
      // Suggested order
      const sugOrder = intel.suggested_order;
      if (sugOrder?.order?.length || (Array.isArray(sugOrder) && sugOrder.length)) {
        const sugCard = el("div", { className: "card mb-4" });
        sugCard.appendChild(el("div", { className: "card-title mb-2" }, "Suggested Order"));
        const sugList = el("div", { className: "flex gap-2", style: "flex-wrap:wrap" });
        const orderArr = sugOrder.order || sugOrder;
        orderArr.forEach((dim, i) => {
          sugList.appendChild(el("span", { className: "badge badge-info" }, `${i + 1}. ${dim}`));
        });
        sugCard.appendChild(sugList);
        if (sugOrder.confidence) {
          sugCard.appendChild(el("div", { className: "text-xs text-tertiary mt-2" },
            `Confidence: ${sugOrder.confidence}` + (sugOrder.notes?.length ? ` — ${sugOrder.notes.join(", ")}` : "")));
        }
        container.appendChild(sugCard);
      }

      // Dimension details table
      const metaCard = el("div", { className: "card" });
      metaCard.appendChild(el("div", { className: "card-title mb-2" }, "Dimension Details"));
      const dimList = Array.isArray(intel.dimensions_metadata) ? intel.dimensions_metadata : [];
      const metaTable = createTable({
        columns: [
          { key: "name", label: "Dimension" },
          { key: "leaf_elements", label: "Leaf Elements", align: "right", value: r => (r.leaf_elements || 0).toLocaleString() },
          { key: "has_strings", label: "Strings", render: r =>
            r.has_strings ? el("span", { className: "dim-card-warning", html: Icons.alertTriangle + " Yes" }) : "No"
          },
          { key: "string_elements", label: "String Count", align: "right", value: r => r.string_elements || 0 },
        ],
        data: dimList,
        sortable: true,
        filterable: false,
      });
      metaCard.appendChild(metaTable.el);
      container.appendChild(metaCard);
    },

    // ---- Configure Tab ----
    async _renderConfigure(container) {
      // Show loading state while fetching dimension metadata
      const loadingEl = el("div", { className: "empty-state", style: "padding:3rem" },
        el("div", { className: "loading-spinner mb-2" }),
        el("div", { className: "empty-state-text" }, "Loading cube dimensions and views from TM1..."),
      );
      container.appendChild(loadingEl);

      const intel = await this._fetchIntelligence();
      container.removeChild(loadingEl);

      const dimNames = intel.storage_order || [];
      // Convert dimensions_metadata list to dict keyed by name
      const dimMetaList = Array.isArray(intel.dimensions_metadata) ? intel.dimensions_metadata : [];
      const dimMeta = {};
      dimMetaList.forEach(d => { dimMeta[d.name] = d; });

      const layout = el("div", { className: "config-layout" });
      const leftCol = el("div");
      const rightCol = el("div");

      // --- Left column ---

      // Mode
      const modeGroup = el("div", { className: "form-group" });
      modeGroup.appendChild(el("label", { className: "form-label" }, "Mode"));
      const modeSelect = el("select", { className: "form-input" });
      ["greedy", "predefined", "position", "dimension"].forEach(m => {
        modeSelect.appendChild(el("option", { value: m }, m.charAt(0).toUpperCase() + m.slice(1)));
      });
      modeGroup.appendChild(modeSelect);
      leftCol.appendChild(modeGroup);

      // Executions
      const execGroup = el("div", { className: "form-group" });
      execGroup.appendChild(el("label", { className: "form-label" }, "Executions per permutation"));
      const execInput = el("input", { type: "number", className: "form-input", value: "5", min: "1", max: "20" });
      execGroup.appendChild(execInput);
      leftCol.appendChild(execGroup);

      // Output format
      const outputGroup = el("div", { className: "form-group" });
      outputGroup.appendChild(el("label", { className: "form-label" }, "Output format"));
      const outputSelect = el("select", { className: "form-input" });
      outputSelect.appendChild(el("option", { value: "csv" }, "CSV"));
      outputSelect.appendChild(el("option", { value: "xlsx" }, "Excel (XLSX)"));
      outputGroup.appendChild(outputSelect);
      leftCol.appendChild(outputGroup);

      // Toggles row
      const toggleRow = el("div", { className: "form-row mb-4" });
      const fastLabel = el("label", { className: "checkbox-label" });
      const fastCb = el("input", { type: "checkbox" });
      fastLabel.appendChild(fastCb);
      fastLabel.appendChild(document.createTextNode("Fast mode"));
      toggleRow.appendChild(fastLabel);

      const autoApplyLabel = el("label", { className: "checkbox-label" });
      const autoApplyCb = el("input", { type: "checkbox" });
      autoApplyLabel.appendChild(autoApplyCb);
      autoApplyLabel.appendChild(document.createTextNode("Auto-apply best"));
      toggleRow.appendChild(autoApplyLabel);
      leftCol.appendChild(toggleRow);

      // Dimensions section
      leftCol.appendChild(el("div", { className: "section-divider" }, "Dimensions"));

      // Suggested order button — only shown in predefined mode
      const sugBtn = el("button", { className: "btn btn-secondary btn-sm mb-2" },
        el("span", { html: Icons.zap }), "Add Suggested Order");
      sugBtn.style.display = modeSelect.value === "predefined" ? "" : "none";
      sugBtn.addEventListener("click", () => {
        if (intel.suggested_order && this._dimConfigurator) {
          const sugArr = intel.suggested_order?.order || intel.suggested_order;
          this._dimConfigurator.applySuggested(Array.isArray(sugArr) ? sugArr : []);
        }
      });
      leftCol.appendChild(sugBtn);

      this._dimConfigurator = createDimensionConfigurator({
        dimensions: dimNames,
        metadata: dimMeta,
        mode: modeSelect.value,
        onChange: () => updatePreview(),
      });
      leftCol.appendChild(this._dimConfigurator.el);

      modeSelect.addEventListener("change", () => {
        this._dimConfigurator.setMode(modeSelect.value);
        sugBtn.style.display = modeSelect.value === "predefined" ? "" : "none";
        updatePreview();
      });

      // Views section
      leftCol.appendChild(el("div", { className: "section-divider" }, "Views (optional)"));
      leftCol.appendChild(el("div", { className: "form-hint mb-2" }, "Omit for RAM-only optimization"));
      this._selectedViews = [];
      this._viewsContainer = el("div", { id: "views-section" });
      leftCol.appendChild(this._viewsContainer);
      this._loadViews(this._viewsContainer);

      // Processes section
      leftCol.appendChild(el("div", { className: "section-divider" }, "Processes (optional)"));
      const procsContainer = el("div", { id: "procs-transfer" });
      leftCol.appendChild(procsContainer);
      const processParamsContainer = el("div", { id: "process-params" });
      leftCol.appendChild(processParamsContainer);
      this._loadProcesses(procsContainer, processParamsContainer);

      // --- Right column ---
      const previewHeader = el("div", { className: "section-divider flex items-center gap-2" });
      previewHeader.appendChild(document.createTextNode("Config Preview"));
      const resetBtn = el("button", { className: "btn btn-ghost btn-sm", style: "margin-left:auto", title: "Reset to defaults" },
        el("span", { html: Icons.rotateCcw }), "Reset");
      resetBtn.addEventListener("click", () => {
        modeSelect.value = "greedy";
        execInput.value = "5";
        outputSelect.value = "csv";
        fastCb.checked = false;
        autoApplyCb.checked = false;
        if (self._dimConfigurator) self._dimConfigurator.reset();
        self._selectedViews = [];
        if (self._viewsContainer) self._renderViewsSection();
        self._selectedProcesses = [];
        if (self._procsContainer) self._renderProcessSection();
        sugBtn.style.display = "none";
        updatePreview();
      });
      previewHeader.appendChild(resetBtn);
      rightCol.appendChild(previewHeader);
      const preview = el("pre", { className: "json-preview", id: "config-preview" });
      rightCol.appendChild(preview);

      // Action buttons
      const btnRow = el("div", { className: "flex gap-2 mt-4" });
      const saveStartBtn = el("button", { className: "btn btn-primary" },
        el("span", { html: Icons.play }), "Save & Start Optimization");
      const saveOnlyBtn = el("button", { className: "btn btn-secondary" }, "Save Config Only");

      saveStartBtn.addEventListener("click", async () => {
        const config = buildConfig();
        try {
          const vResult = await Api.validate(config, "optimize");
          if (!vResult.valid) { Toast.error("Validation: " + vResult.error); return; }

          const filename = `${config.cube}_${config.instance}.json`;
          await Api.saveConfig(config, filename);
          Sidebar.loadSavedCubes();

          const resp = await Api.startJob("optimize", config, state.password);
          this._jobId = resp.job_id;
          StreamManager.connect(resp.job_id);
          Sidebar.updateActivityMonitor();
          Toast.success("Optimization started!");
          // Invalidate optimize tab cache so it re-renders with the new job
          if (this._tabCache.optimize) {
            this._tabCache.optimize.remove();
            delete this._tabCache.optimize;
          }
          this._activeTab = "optimize";
          Router.navigate(`#/cube/${encodeURIComponent(this._cubeName)}?tab=optimize`);
        } catch (err) {
          Toast.error(err.message);
        }
      });

      saveOnlyBtn.addEventListener("click", async () => {
        const config = buildConfig();
        try {
          const filename = `${config.cube}_${config.instance}.json`;
          await Api.saveConfig(config, filename);
          Sidebar.loadSavedCubes();
          Toast.success("Config saved");
        } catch (err) {
          Toast.error(err.message);
        }
      });

      btnRow.appendChild(saveStartBtn);
      btnRow.appendChild(saveOnlyBtn);
      rightCol.appendChild(btnRow);

      layout.appendChild(leftCol);
      layout.appendChild(rightCol);
      container.appendChild(layout);

      const self = this;
      function buildConfig() {
        const dimConfig = self._dimConfigurator ? self._dimConfigurator.getConfig() : { included: [], excluded: [] };
        const views = self._selectedViews || [];
        const selectedProcs = self._selectedProcesses || [];
        const mode = modeSelect.value;

        const config = {
          instance: state.activeInstance,
          cube: self._cubeName,
          executions: parseInt(execInput.value) || 5,
          output: outputSelect.value,
        };

        if (views.length > 0) config.views = views;
        if (selectedProcs.length > 0) config.processes = selectedProcs.map(p => p.name);
        if (fastCb.checked) config.fast = true;
        if (autoApplyCb.checked) config.auto_apply = true;

        if (mode === "greedy") {
          if (dimConfig.excluded.length > 0) config.dimensions_to_exclude = dimConfig.excluded;
          if (dimConfig.ignoreOrders?.length > 0) config.orders_to_ignore = dimConfig.ignoreOrders;
          if (dimConfig.positionRules?.length > 0) config.dimension_position_rules = dimConfig.positionRules;
        } else if (mode === "predefined") {
          if (dimConfig.predefinedOrders?.length > 0) config.predefined_orders = dimConfig.predefinedOrders;
        } else if (mode === "position") {
          config.optimize_position = dimConfig.targetPosition;
          if (dimConfig.excluded.length > 0) config.dimensions_to_exclude = dimConfig.excluded;
        } else if (mode === "dimension") {
          config.optimize_dimension = dimConfig.targetDimension;
        }

        // Collect process parameters from selected processes
        if (selectedProcs.length > 0) {
          const processParams = {};
          selectedProcs.forEach(proc => {
            if (proc.params && proc.params.length > 0) {
              processParams[proc.name] = {};
              proc.params.forEach(p => { processParams[proc.name][p.name] = p.value; });
            }
          });
          if (Object.keys(processParams).length > 0) config.process_parameters = processParams;
        }

        return config;
      }

      function updatePreview() {
        const config = buildConfig();
        const previewEl = $("#config-preview");
        if (previewEl) previewEl.innerHTML = syntaxHighlight(JSON.stringify(config, null, 2));
      }
      self._updatePreview = updatePreview;

      // Wire up all inputs to update preview
      fastCb.addEventListener("change", updatePreview);
      autoApplyCb.addEventListener("change", updatePreview);
      execInput.addEventListener("input", updatePreview);
      outputSelect.addEventListener("change", updatePreview);

      // Initial preview
      setTimeout(updatePreview, 100);
    },

    async _loadViews(container) {
      if (!state.connected) {
        container.appendChild(el("div", { className: "text-xs text-tertiary" }, "Connect to an instance to load views"));
        return;
      }
      if (!state.cubeViews[this._cubeName]) {
        container.appendChild(el("div", { className: "text-xs text-tertiary", id: "views-loading" }, "Loading views..."));
        try {
          const data = await Api.getViews(state.activeInstance, state.password, this._cubeName);
          state.cubeViews[this._cubeName] = data.views || [];
        } catch (err) {
          state.cubeViews[this._cubeName] = [];
          console.warn("Failed to load views:", err);
        }
        const loadingEl = container.querySelector("#views-loading");
        if (loadingEl) loadingEl.remove();
      }
      this._renderViewsSection();
    },

    _renderViewsSection() {
      const container = this._viewsContainer;
      if (!container) return;
      container.innerHTML = "";

      const views = state.cubeViews[this._cubeName] || [];

      if (this._selectedViews.length === 0) {
        container.appendChild(el("div", { className: "text-xs text-tertiary" }, "No views selected"));
      } else {
        this._selectedViews.forEach((view, idx) => {
          const row = el("div", { className: "selection-row" });
          row.appendChild(el("span", { className: "selection-row-name" }, view));
          const removeBtn = el("span", { className: "selection-row-remove", role: "button", tabindex: "0", "aria-label": "Remove", html: Icons.x, title: "Remove" });
          removeBtn.addEventListener("click", () => {
            this._selectedViews.splice(idx, 1);
            this._renderViewsSection();
            if (this._updatePreview) this._updatePreview();
          });
          row.appendChild(removeBtn);
          container.appendChild(row);
        });
      }

      if (views.length > 0) {
        const addBtn = el("button", { className: "btn btn-ghost btn-sm mt-2" },
          el("span", { html: Icons.plus }), "Add Views");
        addBtn.addEventListener("click", () => this._showViewsPicker());
        container.appendChild(addBtn);
      } else if (views.length === 0 && this._selectedViews.length === 0) {
        container.innerHTML = "";
        container.appendChild(el("div", { className: "text-xs text-tertiary" }, "No public views found for this cube"));
      }
    },

    _showViewsPicker() {
      const views = state.cubeViews[this._cubeName] || [];
      const alreadySelected = new Set(this._selectedViews);
      const available = views.filter(v => !alreadySelected.has(v));
      const checked = new Set();

      const body = el("div");
      const searchInput = el("input", { type: "text", className: "form-input w-full mb-2", placeholder: "Search views..." });
      body.appendChild(searchInput);

      const listEl = el("div", { style: "max-height:300px;overflow-y:auto;border:1px solid var(--border-primary);border-radius:var(--radius-md)" });
      body.appendChild(listEl);

      const addSelectedBtn = el("button", { className: "btn btn-primary" }, "Add Selected");
      addSelectedBtn.disabled = true;

      const renderList = (filter) => {
        listEl.innerHTML = "";
        const filtered = available.filter(v => !filter || v.toLowerCase().includes(filter));
        if (filtered.length === 0) {
          listEl.appendChild(el("div", { className: "transfer-item-empty" }, available.length === 0 ? "All views already selected" : "No matching views"));
          return;
        }
        filtered.forEach(viewName => {
          const item = el("div", { className: "transfer-item", style: "cursor:pointer;display:flex;align-items:center;gap:8px" });
          const cb = el("input", { type: "checkbox" });
          cb.checked = checked.has(viewName);
          cb.addEventListener("change", () => {
            if (cb.checked) checked.add(viewName); else checked.delete(viewName);
            addSelectedBtn.disabled = checked.size === 0;
            addSelectedBtn.textContent = checked.size > 0 ? `Add Selected (${checked.size})` : "Add Selected";
          });
          item.appendChild(cb);
          item.appendChild(document.createTextNode(viewName));
          item.addEventListener("click", e => {
            if (e.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change")); }
          });
          listEl.appendChild(item);
        });
      };

      searchInput.addEventListener("input", () => renderList(searchInput.value.toLowerCase()));
      renderList("");

      addSelectedBtn.addEventListener("click", () => {
        checked.forEach(v => this._selectedViews.push(v));
        this._renderViewsSection();
        if (this._updatePreview) this._updatePreview();
        Modal.close();
      });

      Modal.open({
        title: "Add Views",
        body,
        footer: [
          el("button", { className: "btn btn-ghost", onClick: () => Modal.close() }, "Cancel"),
          addSelectedBtn,
        ],
        size: "md",
      });
      setTimeout(() => searchInput.focus(), 100);
    },

    _selectedProcesses: [],   // [{ name, params: [{name, value}] }]

    async _loadProcesses(container, paramsContainer) {
      if (state.processes.length === 0) {
        try {
          const data = await Api.getProcesses(state.activeInstance, state.password);
          state.processes = data.processes || [];
        } catch {
          state.processes = [];
        }
      }
      this._selectedProcesses = [];
      this._procsContainer = container;
      this._procsParamsContainer = paramsContainer;
      this._renderProcessSection();
    },

    _renderProcessSection() {
      const container = this._procsContainer;
      const paramsContainer = this._procsParamsContainer;
      if (!container) return;
      container.innerHTML = "";
      paramsContainer.innerHTML = "";

      if (this._selectedProcesses.length === 0) {
        container.appendChild(el("div", { className: "text-xs text-tertiary" }, "No processes selected"));
      } else {
        this._selectedProcesses.forEach((proc, idx) => {
          // Selection row
          const row = el("div", { className: "selection-row" });
          row.appendChild(el("span", { className: "selection-row-name" }, proc.name));
          const removeBtn = el("span", { className: "selection-row-remove", role: "button", tabindex: "0", "aria-label": "Remove", html: Icons.x, title: "Remove" });
          removeBtn.addEventListener("click", () => {
            this._selectedProcesses.splice(idx, 1);
            this._renderProcessSection();
            if (this._updatePreview) this._updatePreview();
          });
          row.appendChild(removeBtn);
          container.appendChild(row);

          // Parameter inputs below the row
          if (proc.params && proc.params.length > 0) {
            const paramsBlock = el("div", { className: "process-params" });
            proc.params.forEach(p => {
              const paramRow = el("div", { className: "param-row" });
              paramRow.appendChild(el("span", { className: "param-label" }, p.name));
              const input = el("input", {
                className: "param-input",
                type: "text",
                value: p.value || "",
                dataset: { process: proc.name, param: p.name },
              });
              input.addEventListener("input", () => {
                p.value = input.value;
                if (this._updatePreview) this._updatePreview();
              });
              paramRow.appendChild(input);
              paramsBlock.appendChild(paramRow);
            });
            paramsContainer.appendChild(paramsBlock);
          }
        });
      }

      const addBtn = el("button", { className: "btn btn-ghost btn-sm mt-2" },
        el("span", { html: Icons.plus }), "Add Process");
      addBtn.addEventListener("click", () => this._showProcessPicker());
      container.appendChild(addBtn);
    },

    _showProcessPicker() {
      const body = el("div");
      const searchInput = el("input", { type: "text", className: "form-input w-full mb-2", placeholder: "Search processes..." });
      body.appendChild(searchInput);

      const listEl = el("div", { style: "max-height:300px;overflow-y:auto;border:1px solid var(--border-primary);border-radius:var(--radius-md)" });
      body.appendChild(listEl);

      const alreadySelected = new Set(this._selectedProcesses.map(p => p.name));

      const renderList = (filter) => {
        listEl.innerHTML = "";
        const filtered = state.processes.filter(p =>
          !alreadySelected.has(p) && (!filter || p.toLowerCase().includes(filter.toLowerCase()))
        );
        if (filtered.length === 0) {
          listEl.appendChild(el("div", { className: "transfer-item-empty" }, "No matching processes"));
          return;
        }
        filtered.forEach(procName => {
          const item = el("div", {
            className: "transfer-item",
            style: "cursor:pointer",
            onClick: async () => {
              Modal.close();
              // Fetch params for this process
              try {
                const data = await Api.getProcessParameters(state.activeInstance, state.password, procName);
                const params = (data.parameters || []).map(p => ({ name: p.name, value: p.value || "" }));
                this._selectedProcesses.push({ name: procName, params });
              } catch {
                this._selectedProcesses.push({ name: procName, params: [] });
              }
              this._renderProcessSection();
              if (this._updatePreview) this._updatePreview();
            }
          }, procName);
          listEl.appendChild(item);
        });
      };

      searchInput.addEventListener("input", () => renderList(searchInput.value));
      renderList("");

      Modal.open({ title: "Add Process", body, size: "md" });
      setTimeout(() => searchInput.focus(), 100);
    },

    // ---- Optimize Tab ----
    _renderOptimize(container) {
      // Status bar
      const statusBar = el("div", { className: "terminal-status" });
      const statusDot = el("span", { className: "status-dot" });
      const statusText = el("span", { className: "text-sm font-medium" }, "Idle");
      const timerEl = el("span", { className: "terminal-timer" }, "00:00");
      const stopBtn = el("button", { className: "btn btn-danger btn-sm", style: "display:none;margin-left:auto" },
        el("span", { html: Icons.square, style: "display:inline-flex;margin-right:4px" }), "Stop");
      stopBtn.addEventListener("click", async () => {
        if (!this._jobId) return;
        stopBtn.disabled = true;
        stopBtn.textContent = "Stopping\u2026";
        try { await Api.cancelJob(this._jobId); } catch (e) { Toast.error("Cancel failed: " + e.message); stopBtn.disabled = false; stopBtn.innerHTML = ""; stopBtn.appendChild(el("span", { html: Icons.square, style: "display:inline-flex;margin-right:4px" })); stopBtn.appendChild(document.createTextNode("Stop")); }
      });
      statusBar.appendChild(statusDot);
      statusBar.appendChild(statusText);
      statusBar.appendChild(timerEl);
      statusBar.appendChild(stopBtn);
      container.appendChild(statusBar);

      // Terminal
      const terminal = el("div", { className: "terminal", id: "optimize-terminal" });
      container.appendChild(terminal);

      // Determine job for this cube
      this._findActiveJob().then(jobId => {
        if (!jobId) {
          terminal.appendChild(el("div", { className: "terminal-line text-tertiary" }, "No active optimization. Configure and start from the Configure tab."));
          return;
        }

        this._jobId = jobId;
        const existingLogs = StreamManager.getLogs(jobId);
        existingLogs.forEach(log => appendLog(terminal, log));

        const sseStatus = StreamManager.getStatus(jobId);
        if (sseStatus === "running") {
          statusDot.classList.add("running");
          statusText.textContent = "Running";
          stopBtn.style.display = "";
          this._startTimer(timerEl);
          StreamManager.connect(jobId);
        } else if (sseStatus === "completed") {
          statusDot.classList.add("completed");
          statusText.textContent = "Completed";
        } else if (sseStatus === "failed") {
          statusDot.classList.add("failed");
          statusText.textContent = "Failed";
        } else if (sseStatus === "cancelled") {
          statusDot.classList.add("failed");
          statusText.textContent = "Cancelled";
        }

        this._unsubStream = StreamManager.subscribe(jobId, (event, data) => {
          if (event === "log") {
            appendLog(terminal, data);
            terminal.scrollTop = terminal.scrollHeight;
          } else if (event === "complete") {
            statusDot.className = "status-dot completed";
            statusText.textContent = "Completed";
            stopBtn.style.display = "none";
            this._stopTimer();
            Sidebar.updateActivityMonitor();
            Toast.success("Optimization completed!");
          } else if (event === "error_event") {
            statusDot.className = "status-dot failed";
            statusText.textContent = "Failed";
            stopBtn.style.display = "none";
            this._stopTimer();
            Sidebar.updateActivityMonitor();
            Toast.error("Optimization failed: " + (data.error || "Unknown error"));
          } else if (event === "cancelled") {
            statusDot.className = "status-dot failed";
            statusText.textContent = "Cancelled";
            stopBtn.style.display = "none";
            this._stopTimer();
            Sidebar.updateActivityMonitor();
            Toast.info("Optimization cancelled");
          }
        });
      });

      function appendLog(term, logData) {
        const line = el("div", { className: "terminal-line" });
        const msg = logData.message || logData;
        const text = typeof msg === "string" ? msg : JSON.stringify(msg);

        // Color log levels
        if (text.includes("ERROR") || text.includes("error")) {
          line.innerHTML = `<span class="log-error">${escapeHtml(text)}</span>`;
        } else if (text.includes("WARNING") || text.includes("warning")) {
          line.innerHTML = `<span class="log-warning">${escapeHtml(text)}</span>`;
        } else if (text.includes("SUCCESS") || text.includes("Best result") || text.includes("completed")) {
          line.innerHTML = `<span class="log-success">${escapeHtml(text)}</span>`;
        } else {
          line.textContent = text;
        }
        term.appendChild(line);
      }
    },

    async _findActiveJob() {
      if (this._jobId) return this._jobId;
      try {
        const data = await Api.getJobs();
        const jobs = data.jobs || [];
        // Find running job for this cube
        const running = jobs.find(j => j.status === "running" && (j.cube_name || j.cube_config?.cube) === this._cubeName);
        if (running) return running.job_id;
        // Find most recent job for this cube
        const recent = jobs.filter(j => (j.cube_name || j.cube_config?.cube) === this._cubeName);
        if (recent.length > 0) return recent[0].job_id;
      } catch { /* */ }
      return null;
    },

    _startTimer(timerEl) {
      this._timerStart = Date.now();
      this._timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this._timerStart) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const s = String(elapsed % 60).padStart(2, "0");
        timerEl.textContent = `${m}:${s}`;
      }, 1000);
    },

    _stopTimer() {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    // ---- Results Tab (per-cube) ----
    async _renderResults(container) {
      container.appendChild(el("div", { className: "text-secondary text-sm" }, "Loading results..."));
      try {
        const data = await Api.getResults();
        const results = (data.results || []).filter(r => r.cube === this._cubeName);
        container.innerHTML = "";

        if (results.length === 0) {
          container.appendChild(el("div", { className: "empty-state" },
            el("div", { className: "empty-state-title" }, "No results yet"),
            el("div", { className: "empty-state-text" }, "Run an optimization to see results here."),
          ));
          return;
        }

        const tbl = createTable({
          columns: [
            { key: "instance", label: "Instance", render: r => el("span", { className: "text-secondary text-sm" }, r.instance || "—") },
            { key: "filename", label: "File", render: r => el("span", { className: "font-medium" }, (r.filename || "").split("/").pop()) },
            { key: "type", label: "Type", render: r => el("span", { className: "badge badge-neutral" }, r.type.toUpperCase()) },
            { key: "size", label: "Size", align: "right", value: r => formatBytes(r.size) },
            { key: "modified", label: "Date", value: r => formatDate(r.modified) },
            { key: "actions", label: "", sortable: false, render: r => {
              return el("a", { href: `/api/result/${encodeURIComponent(r.filename)}`, target: "_blank", className: "btn btn-ghost btn-sm", html: Icons.externalLink + " Open" });
            }},
          ],
          data: results,
          filterable: false,
        });
        container.appendChild(tbl.el);
      } catch (err) {
        container.innerHTML = "";
        container.appendChild(el("div", { className: "text-secondary" }, "Failed to load results: " + err.message));
      }
    },

    async _fetchIntelligence() {
      // 1. In-memory cache
      if (state.cubeMetadata[this._cubeName]) return state.cubeMetadata[this._cubeName];
      // 2. localStorage cache
      const cached = IntelCache.load(state.activeInstance, this._cubeName);
      if (cached) {
        state.cubeMetadata[this._cubeName] = cached.data;
        return cached.data;
      }
      // 3. Fetch from API and cache
      const data = await Api.getCubeIntelligence(state.activeInstance, state.password, this._cubeName);
      state.cubeMetadata[this._cubeName] = data;
      IntelCache.save(state.activeInstance, this._cubeName, data);
      return data;
    },

    async _prefetchViews() {
      if (state.cubeViews[this._cubeName]) return state.cubeViews[this._cubeName];
      try {
        const data = await Api.getViews(state.activeInstance, state.password, this._cubeName);
        state.cubeViews[this._cubeName] = data.views || [];
      } catch (_) {
        state.cubeViews[this._cubeName] = [];
      }
      return state.cubeViews[this._cubeName];
    },

    _refreshOptimize() {
      // When switching back to optimize tab, scroll terminal to bottom
      const terminal = this._tabCache.optimize?.querySelector("#optimize-terminal");
      if (terminal) terminal.scrollTop = terminal.scrollHeight;
    },

    unmount() {
      if (this._unsubStream) { this._unsubStream(); this._unsubStream = null; }
      this._stopTimer();
      this._dimConfigurator = null;
      this._viewsTransfer = null;
      this._selectedProcesses = [];
      this._updatePreview = null;
      this._tabCache = {};
      this._tabsEl = null;
      this._contentEl = null;
    },
  };

  // ==================================================================
  // Page: Results (global)
  // ==================================================================
  const ResultsPage = {
    mount() {
      const page = $("#page-results");
      page.innerHTML = "";

      page.appendChild(el("div", { className: "page-header" },
        el("h1", { className: "page-title" }, "Results"),
        el("p", { className: "page-subtitle" }, "All optimization results across cubes"),
      ));

      this._loadResults(page);
    },

    async _loadResults(page) {
      try {
        const data = await Api.getResults();
        const results = data.results || [];

        if (results.length === 0) {
          page.appendChild(el("div", { className: "empty-state" },
            el("div", { className: "empty-state-title" }, "No results"),
            el("div", { className: "empty-state-text" }, "Run cube optimizations to see results here."),
          ));
          return;
        }

        const tbl = createTable({
          columns: [
            { key: "instance", label: "Instance", render: r => el("span", { className: "text-secondary text-sm" }, r.instance || "—") },
            { key: "cube", label: "Cube", render: r => el("a", { href: `#/cube/${encodeURIComponent(r.cube)}?tab=results`, className: "font-medium" }, r.cube) },
            { key: "filename", label: "File", value: r => (r.filename || "").split("/").pop() },
            { key: "type", label: "Type", render: r => el("span", { className: "badge badge-neutral" }, r.type.toUpperCase()) },
            { key: "size", label: "Size", align: "right", sortValue: r => r.size, value: r => formatBytes(r.size) },
            { key: "modified", label: "Date", sortValue: r => r.modified, value: r => formatDate(r.modified) },
            { key: "actions", label: "", sortable: false, render: r => {
              return el("a", { href: `/api/result/${encodeURIComponent(r.filename)}`, target: "_blank", className: "btn btn-ghost btn-sm", html: Icons.externalLink + " Open" });
            }},
          ],
          data: results,
        });
        page.appendChild(tbl.el);
      } catch (err) {
        Toast.error("Failed to load results: " + err.message);
      }
    },

    unmount() {},
  };

  // ==================================================================
  // Page: Jobs
  // ==================================================================
  const JobsPage = {
    _refreshInterval: null,

    mount() {
      const page = $("#page-jobs");
      page.innerHTML = "";

      page.appendChild(el("div", { className: "page-header" },
        el("h1", { className: "page-title" }, "Jobs"),
        el("p", { className: "page-subtitle" }, "Optimization job history and status"),
      ));

      this._loadJobs(page);
      this._refreshInterval = setInterval(() => this._loadJobs(page), 10000);
    },

    async _loadJobs(page) {
      try {
        const data = await Api.getJobs();
        const jobs = data.jobs || [];

        // Remove old table
        const existing = page.querySelector(".table-wrapper");
        if (existing) existing.remove();
        const existingEmpty = page.querySelector(".empty-state");
        if (existingEmpty) existingEmpty.remove();

        if (jobs.length === 0) {
          page.appendChild(el("div", { className: "empty-state" },
            el("div", { className: "empty-state-title" }, "No jobs"),
            el("div", { className: "empty-state-text" }, "Start an optimization to see jobs here."),
          ));
          return;
        }

        const tbl = createTable({
          columns: [
            { key: "status", label: "Status", render: r => {
              const cls = r.status === "running" ? "badge-info" : r.status === "completed" ? "badge-success" : "badge-error";
              return el("span", { className: `badge ${cls}` }, r.status);
            }},
            { key: "cube", label: "Cube", render: r => {
              const cube = r.cube_name || r.cube_config?.cube || "Unknown";
              return el("a", { href: `#/cube/${encodeURIComponent(cube)}?tab=optimize`, className: "font-medium" }, cube);
            }},
            { key: "instance", label: "Instance", value: r => r.instance || "—" },
            { key: "mode", label: "Mode", value: r => r.mode || "optimize" },
            { key: "started", label: "Started", value: r => r.started_at ? new Date(r.started_at * 1000).toLocaleTimeString() : "—" },
            { key: "job_id", label: "Job ID", render: r => el("span", { className: "text-xs text-tertiary" }, r.job_id?.slice(0, 8) || "—") },
          ],
          data: jobs,
          filterable: false,
          onRowClick: (row) => {
            const cube = row.cube_name || row.cube_config?.cube;
            if (cube) Router.navigate(`#/cube/${encodeURIComponent(cube)}?tab=optimize`);
          },
        });
        page.appendChild(tbl.el);
      } catch (err) {
        Toast.error("Failed to load jobs: " + err.message);
      }
    },

    unmount() {
      if (this._refreshInterval) { clearInterval(this._refreshInterval); this._refreshInterval = null; }
    },
  };

  // ==================================================================
  // Page: Settings
  // ==================================================================
  // ==================================================================
  // TransferPage (placeholder — full implementation in Tasks 6+7)
  // ==================================================================
  const TransferPage = {
    _sourceInstance: null,
    _sourceConnected: false,
    _sourceCubes: [],

    _targetInstance: null,
    _targetConnected: false,
    _targetOrders: {},
    _transferredCubes: {},
    _targetMissing: [],

    _includeOptimized: true,

    mount() {
      const page = $("#page-transfer");
      page.innerHTML = "";

      page.appendChild(el("div", { className: "page-header" },
        el("h1", { className: "page-title" }, "Sync Order"),
        el("p", { className: "text-secondary text-sm mt-1" }, "Sync optimized dimension orders from a source instance to a target instance"),
      ));

      const panels = el("div", { className: "transfer-panels" });

      const sourcePanel = el("div", { className: "transfer-panel transfer-source" });
      sourcePanel.appendChild(el("div", { className: "transfer-panel-header" }, "Source Instance"));
      this._buildSourcePanel(sourcePanel);
      panels.appendChild(sourcePanel);

      const targetPanel = el("div", { className: "transfer-panel transfer-target" });
      targetPanel.appendChild(el("div", { className: "transfer-panel-header" }, "Target Instance"));
      this._buildTargetPanel(targetPanel);
      panels.appendChild(targetPanel);

      page.appendChild(panels);
    },

    _buildSourcePanel(panel) {
      const connRow = el("div", { className: "transfer-connect-row" });
      const instanceSelect = el("select", { className: "form-input", id: "transfer-source-instance" });
      instanceSelect.appendChild(el("option", { value: "" }, "Select instance..."));
      state.instances.forEach(name => {
        instanceSelect.appendChild(el("option", { value: name }, name));
      });
      if (this._sourceInstance) instanceSelect.value = this._sourceInstance;
      connRow.appendChild(instanceSelect);

      const connectBtn = el("button", { className: "btn btn-primary btn-sm", onClick: async () => {
        const inst = instanceSelect.value;
        if (!inst) { Toast.error("Select a source instance"); return; }
        this._sourceInstance = inst;
        connectBtn.disabled = true;
        connectBtn.textContent = "Scanning...";
        try {
          const data = await Api.transferScan(inst, null, 100);
          this._sourceCubes = data.candidates || [];
          this._sourceConnected = true;
          Toast.success(`Scanned ${this._sourceCubes.length} cubes`);
          this.mount();
        } catch (err) {
          Toast.error(err.message);
          connectBtn.disabled = false;
          connectBtn.textContent = "Connect & Scan";
        }
      }}, "Connect & Scan");
      connRow.appendChild(connectBtn);
      panel.appendChild(connRow);

      if (!this._sourceConnected) return;

      const filterBar = el("div", { className: "transfer-filter-bar" });

      const inclOptCb = el("input", { type: "checkbox", id: "filter-include-optimized" });
      inclOptCb.checked = this._includeOptimized;
      inclOptCb.addEventListener("change", () => { this._includeOptimized = inclOptCb.checked; this._renderSourceList(listContainer); });
      filterBar.appendChild(el("label", { className: "flex items-center gap-1 text-sm" }, inclOptCb, "Include Optimized"));

      panel.appendChild(filterBar);

      const listContainer = el("div", { className: "transfer-cube-list" });
      this._renderSourceList(listContainer);
      panel.appendChild(listContainer);
    },

    _filteredCubes() {
      return this._sourceCubes.filter(c => {
        if (c.already_optimized && !this._includeOptimized) return false;
        return true;
      });
    },

    _renderSourceList(container) {
      container.innerHTML = "";
      const filtered = this._filteredCubes();
      if (filtered.length === 0) {
        container.appendChild(el("div", { className: "text-secondary text-sm p-2" }, "No cubes match filters"));
        return;
      }
      filtered.forEach(cube => {
        const row = el("div", {
          className: "transfer-cube-row",
          draggable: "true",
          dataset: { cubeName: cube.cube_name },
        });
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", JSON.stringify(
            [{ cube_name: cube.cube_name, storage_order: cube.storage_order }]
          ));
          e.dataTransfer.effectAllowed = "copy";
        });

        const info = el("div", { className: "transfer-cube-info" });
        info.appendChild(el("div", { className: "font-medium text-sm" }, cube.cube_name));
        const meta = `${cube.dim_count} dims | ${cube.ram_gb.toFixed(2)} GB`;
        const badge = cube.already_optimized
          ? el("span", { className: "badge badge-success", style: "font-size:9px;margin-left:4px" }, "optimized")
          : null;
        info.appendChild(el("div", { className: "text-xs text-tertiary" }, meta, badge));
        row.appendChild(info);

        container.appendChild(row);
      });
    },

    async _addToTarget(cubeNames) {
      cubeNames.forEach(name => {
        const cube = this._sourceCubes.find(c => c.cube_name === name);
        if (cube && !this._transferredCubes[name]) {
          this._transferredCubes[name] = {
            proposed: cube.storage_order,
            current: null,
          };
        }
      });
      if (this._targetConnected) {
        await this._fetchTargetOrders(selected);
      }
      this.mount();
    },

    _buildTargetPanel(panel) {
      const connRow = el("div", { className: "transfer-connect-row" });
      const instanceSelect = el("select", { className: "form-input", id: "transfer-target-instance" });
      instanceSelect.appendChild(el("option", { value: "" }, "Select instance..."));
      state.instances.forEach(name => {
        instanceSelect.appendChild(el("option", { value: name }, name));
      });
      if (this._targetInstance) instanceSelect.value = this._targetInstance;
      connRow.appendChild(instanceSelect);

      const connectBtn = el("button", { className: "btn btn-primary btn-sm", onClick: async () => {
        const inst = instanceSelect.value;
        if (!inst) { Toast.error("Select a target instance"); return; }
        this._targetInstance = inst;
        this._targetConnected = true;
        if (this._sourceInstance && this._targetInstance === this._sourceInstance) {
          Toast.info("Source and target are the same instance");
        }
        const cubeNames = Object.keys(this._transferredCubes);
        if (cubeNames.length > 0) {
          await this._fetchTargetOrders(cubeNames);
        }
        Toast.success(`Connected to target: ${inst}`);
        this.mount();
      }}, "Connect");
      connRow.appendChild(connectBtn);
      panel.appendChild(connRow);

      const dropZone = el("div", { className: "transfer-drop-zone" });
      dropZone.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; dropZone.classList.add("drag-over"); });
      dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("drag-over"); });
      dropZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        try {
          const cubes = JSON.parse(e.dataTransfer.getData("text/plain"));
          cubes.forEach(c => {
            if (!this._transferredCubes[c.cube_name]) {
              this._transferredCubes[c.cube_name] = { proposed: c.storage_order, current: null };
            }
          });
          if (this._targetConnected) {
            await this._fetchTargetOrders(cubes.map(c => c.cube_name));
          }
          this.mount();
        } catch (err) {
          Toast.error("Invalid drop data");
        }
      });

      const transferredNames = Object.keys(this._transferredCubes);
      if (transferredNames.length === 0) {
        dropZone.appendChild(el("div", { className: "transfer-drop-placeholder" },
          el("span", { html: Icons.arrowRight, style: "opacity:0.3" }),
          el("div", { className: "text-secondary text-sm mt-2" }, "Drag cubes here or use the Transfer button"),
        ));
      } else {
        transferredNames.forEach(cubeName => {
          const cube = this._transferredCubes[cubeName];
          const card = el("div", { className: "transfer-target-card" });

          const header = el("div", { className: "flex items-center justify-between mb-2" });
          header.appendChild(el("div", { className: "font-medium text-sm" }, cubeName));
          header.appendChild(el("button", { className: "btn btn-ghost btn-sm", html: Icons.x, onClick: () => {
            delete this._transferredCubes[cubeName];
            this.mount();
          }}));
          card.appendChild(header);

          if (this._targetMissing.includes(cubeName)) {
            card.appendChild(el("div", { className: "text-warning text-xs mb-1" }, "Cube not found on target instance"));
          }

          const comparison = el("div", { className: "transfer-order-comparison" });

          const currentCol = el("div", { className: "transfer-order-col" });
          currentCol.appendChild(el("div", { className: "text-xs text-tertiary mb-1" }, "Current (Target)"));
          if (cube.current) {
            cube.current.forEach(dim => currentCol.appendChild(el("div", { className: "transfer-dim-tag dim-current" }, dim)));
          } else {
            currentCol.appendChild(el("div", { className: "text-xs text-tertiary" }, this._targetConnected ? "Loading..." : "Connect target to see"));
          }
          comparison.appendChild(currentCol);

          comparison.appendChild(el("div", { className: "transfer-order-arrow", html: Icons.arrowRight }));

          const proposedCol = el("div", { className: "transfer-order-col" });
          proposedCol.appendChild(el("div", { className: "text-xs text-tertiary mb-1" }, "Proposed (Source)"));
          cube.proposed.forEach((dim, i) => {
            const changed = cube.current && cube.current[i] !== dim;
            proposedCol.appendChild(el("div", { className: `transfer-dim-tag dim-proposed${changed ? " dim-changed" : ""}` }, dim));
          });
          comparison.appendChild(proposedCol);

          card.appendChild(comparison);
          dropZone.appendChild(card);
        });
      }
      panel.appendChild(dropZone);

      if (transferredNames.length > 0) {
        const actionsRow = el("div", { className: "flex gap-2 mt-3 flex-wrap" });

        const applyBtn = el("button", { className: "btn btn-primary", onClick: async () => {
          if (!this._targetConnected) { Toast.error("Connect to target instance first"); return; }
          const orders = {};
          Object.entries(this._transferredCubes).forEach(([name, cube]) => {
            if (!this._targetMissing.includes(name)) {
              orders[name] = cube.proposed;
            }
          });
          if (Object.keys(orders).length === 0) { Toast.error("No valid cubes to apply"); return; }
          applyBtn.disabled = true;
          applyBtn.textContent = "Applying...";
          try {
            const resp = await Api.transferApply(this._targetInstance, null, orders);
            Toast.success(`Transfer job started (${resp.job_id})`);
            Router.navigate("#/jobs");
          } catch (err) {
            Toast.error(err.message);
            applyBtn.disabled = false;
            applyBtn.textContent = "Apply All";
          }
        }}, "Apply All");
        actionsRow.appendChild(applyBtn);

        const exportBtn = el("button", { className: "btn btn-secondary", onClick: async () => {
          const orders = {};
          Object.entries(this._transferredCubes).forEach(([name, cube]) => {
            orders[name] = cube.proposed;
          });
          try {
            const resp = await Api.transferExport(this._targetInstance || this._sourceInstance || "", orders);
            Toast.success(`Exported ${resp.files.length} file(s) to exports/`);
          } catch (err) {
            Toast.error(err.message);
          }
        }}, el("span", { html: Icons.download }), " Export to Folder");
        actionsRow.appendChild(exportBtn);

        actionsRow.appendChild(el("button", { className: "btn btn-ghost", onClick: () => {
          this._transferredCubes = {};
          this._targetMissing = [];
          this.mount();
        }}, "Clear All"));

        panel.appendChild(actionsRow);
      }
    },

    async _fetchTargetOrders(cubeNames) {
      try {
        const data = await Api.transferTargetOrders(this._targetInstance, null, cubeNames);
        Object.entries(data.orders || {}).forEach(([name, order]) => {
          if (this._transferredCubes[name]) {
            this._transferredCubes[name].current = order;
          }
        });
        this._targetMissing = [...new Set([...this._targetMissing, ...(data.missing || [])])];
      } catch (err) {
        Toast.error(`Failed to fetch target orders: ${err.message}`);
      }
    },

    unmount() {},
  };

  const SettingsPage = {
    mount() {
      const page = $("#page-settings");
      page.innerHTML = "";

      page.appendChild(el("div", { className: "page-header" },
        el("h1", { className: "page-title" }, "Settings"),
      ));

      // Theme
      const themeCard = el("div", { className: "card mb-4" });
      themeCard.appendChild(el("div", { className: "card-title mb-4" }, "Appearance"));

      const themeRow = el("div", { className: "flex gap-2" });
      const themes = [
        { value: "system", label: "System", icon: Icons.monitor },
        { value: "light", label: "Light", icon: Icons.sun },
        { value: "dark", label: "Dark", icon: Icons.moon },
      ];
      themes.forEach(t => {
        const btn = el("button", {
          className: `btn ${state.theme === t.value ? "btn-primary" : "btn-secondary"}`,
          onClick: () => {
            Theme.set(t.value);
            this.mount(); // re-render
          },
        }, el("span", { html: t.icon }), t.label);
        themeRow.appendChild(btn);
      });
      themeCard.appendChild(themeRow);
      page.appendChild(themeCard);

      // Instance configs — show ALL instances from config.ini
      {
        const instancesCard = el("div", { className: "card mb-4" });
        instancesCard.appendChild(el("div", { className: "card-title mb-4" }, "TM1 Instances"));

        // "New Instance" button
        const newInstanceBtn = el("button", { className: "btn btn-secondary btn-sm mb-3", onClick: () => {
          const nameInput = el("input", { className: "form-input", type: "text", placeholder: "Instance name (e.g. prod_server)" });
          const bodyEl = el("div", null,
            el("label", { className: "form-label" }, "Instance Name"),
            nameInput,
          );
          Modal.open({
            title: "New TM1 Instance",
            body: bodyEl,
            footer: [
              el("button", { className: "btn btn-ghost", onClick: () => Modal.close() }, "Cancel"),
              el("button", { className: "btn btn-primary", onClick: async () => {
                const name = nameInput.value.trim();
                if (!name) { Toast.error("Instance name is required"); return; }
                try {
                  await Api.createInstance(name, {});
                  Toast.success(`Instance "${name}" created`);
                  Modal.close();
                  await Sidebar.loadInstances();
                  this.mount();
                } catch (err) {
                  Toast.error(err.message);
                }
              }}, "Create"),
            ],
          });
          nameInput.focus();
        }}, el("span", { html: Icons.plus }), " New Instance");
        instancesCard.appendChild(newInstanceBtn);

        if (state.instances.length === 0) {
          instancesCard.appendChild(el("div", { className: "text-secondary text-sm" }, "No instances configured. Add one to get started."));
        }

        const tabs = el("div", { className: "tabs" });
        const containers = {};
        state.instances.forEach((name, i) => {
          const tab = el("div", {
            className: `tab${i === 0 ? " active" : ""}`,
            dataset: { instance: name },
            onClick: () => {
              tabs.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
              tab.classList.add("active");
              Object.values(containers).forEach(c => c.style.display = "none");
              containers[name].style.display = "block";
              if (!containers[name].dataset.loaded) {
                this._loadInstanceConfig(containers[name], name);
                containers[name].dataset.loaded = "true";
              }
            },
          });
          const isActive = name === state.activeInstance && state.connected;
          tab.appendChild(document.createTextNode(name));
          if (isActive) tab.appendChild(el("span", { className: "badge badge-success", style: "margin-left:8px;font-size:9px" }, "connected"));
          tabs.appendChild(tab);
          containers[name] = el("div", { style: i === 0 ? "" : "display:none" });
        });
        instancesCard.appendChild(tabs);
        Object.values(containers).forEach(c => instancesCard.appendChild(c));
        page.appendChild(instancesCard);

        // Load first instance config
        if (state.instances.length > 0) {
          const firstName = state.instances[0];
          this._loadInstanceConfig(containers[firstName], firstName);
          containers[firstName].dataset.loaded = "true";
        }
      }

      // Cache management
      const cacheCard = el("div", { className: "card mb-4" });
      cacheCard.appendChild(el("div", { className: "card-title mb-4" }, "Cache"));
      cacheCard.appendChild(el("p", { className: "text-secondary text-sm mb-3" }, "Scan results and cube intelligence are cached locally. Clear the cache to force fresh data from the server."));
      const clearCacheBtn = el("button", { className: "btn btn-secondary", onClick: () => {
        // Clear localStorage caches
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
          if (k.startsWith("op-scan-") || k.startsWith("op-intel-")) {
            localStorage.removeItem(k);
          }
        });
        // Clear in-memory caches
        state.scanData = null;
        state.scanTimestamp = null;
        state.cubeMetadata = {};
        Toast.success("Cache cleared — scans and cube intelligence will be refreshed");
      }}, "Clear Cache");
      cacheCard.appendChild(clearCacheBtn);
      page.appendChild(cacheCard);

      // Saved configs management
      const configsCard = el("div", { className: "card" });
      configsCard.appendChild(el("div", { className: "card-title mb-4" }, "Saved Cube Configs"));
      const configsList = el("div", { id: "saved-configs-list" });
      configsCard.appendChild(configsList);
      page.appendChild(configsCard);
      this._loadSavedConfigs(configsList);
    },

    async _loadInstanceConfig(container, instanceName) {
      try {
        const data = await Api.getInstance(instanceName);
        const params = data.params || {};
        const fieldsContainer = el("div", { className: "instance-fields" });

        // Render existing fields (skip password — handled separately)
        Object.entries(params).forEach(([key, value]) => {
          if (key.toLowerCase() === "password") return;
          fieldsContainer.appendChild(this._createFieldRow(key, value, instanceName, fieldsContainer));
        });
        container.appendChild(fieldsContainer);

        // "Add Field" button
        const addFieldBtn = el("button", { className: "btn btn-secondary btn-sm mt-2", onClick: () => {
          const row = this._createFieldRow("", "", instanceName, fieldsContainer, true);
          fieldsContainer.appendChild(row);
          // Focus the key input
          const keyInput = row.querySelector("[data-field-key]");
          if (keyInput) keyInput.focus();
        }}, el("span", { html: Icons.plus }), " Add Field");
        container.appendChild(addFieldBtn);

        // Password field (write-only)
        const pwGroup = el("div", { className: "form-group mt-4" });
        pwGroup.appendChild(el("label", { className: "form-label" }, "Update Password (write-only)"));
        const pwInput = el("input", { className: "form-input", type: "password", placeholder: "Leave empty to keep current", dataset: { key: "password" } });
        pwGroup.appendChild(pwInput);
        container.appendChild(pwGroup);

        // Action buttons row
        const actionsRow = el("div", { className: "flex gap-2 mt-4 flex-wrap" });

        // Save button
        const saveBtn = el("button", { className: "btn btn-primary" }, "Save");
        saveBtn.addEventListener("click", async () => {
          const newParams = {};
          fieldsContainer.querySelectorAll("[data-field-row]").forEach(row => {
            const keyEl = row.querySelector("[data-field-key]");
            const valEl = row.querySelector("[data-field-value]");
            const key = keyEl ? (keyEl.dataset.fieldKey || keyEl.value || "").trim() : "";
            const val = valEl ? valEl.value : "";
            if (key) newParams[key] = val;
          });
          // Include password only if non-empty
          if (pwInput.value) newParams.password = pwInput.value;
          try {
            await Api.updateInstance(instanceName, newParams);
            Toast.success(`Config saved for ${instanceName}`);
          } catch (err) {
            Toast.error(err.message);
          }
        });
        actionsRow.appendChild(saveBtn);

        // Test Connection button
        const testBtn = el("button", { className: "btn btn-secondary" }, "Test Connection");
        testBtn.addEventListener("click", async () => {
          testBtn.disabled = true;
          testBtn.textContent = "Testing...";
          try {
            const pw = pwInput.value || state.password || null;
            const resp = await Api.connect(instanceName, pw);
            Toast.success(`Connected to ${resp.server_name} (${resp.cube_count} cubes)`);
          } catch (err) {
            Toast.error(`Connection failed: ${err.message}`);
          } finally {
            testBtn.disabled = false;
            testBtn.textContent = "Test Connection";
          }
        });
        actionsRow.appendChild(testBtn);

        // Delete Instance button
        const deleteBtn = el("button", { className: "btn btn-danger" }, "Delete Instance");
        deleteBtn.addEventListener("click", () => {
          Modal.confirm(`Delete instance "${instanceName}" from config.ini? This cannot be undone.`, async () => {
            try {
              await Api.deleteInstance(instanceName);
              Toast.success(`Instance "${instanceName}" deleted`);
              // Reload instances and re-render settings
              await Sidebar.loadInstances();
              this.mount();
            } catch (err) {
              Toast.error(err.message);
            }
          });
        });
        actionsRow.appendChild(deleteBtn);

        container.appendChild(actionsRow);
      } catch (err) {
        container.appendChild(el("div", { className: "text-secondary text-sm" }, "Failed to load config: " + err.message));
      }
    },

    _createFieldRow(key, value, instanceName, fieldsContainer, isNew = false) {
      const row = el("div", { className: "flex gap-2 items-center mb-2", dataset: { fieldRow: "true" } });

      if (isNew) {
        // Editable key input for new fields
        const keyInput = el("input", {
          className: "form-input", type: "text", placeholder: "key",
          style: "flex:0.4;", dataset: { fieldKey: "" },
        });
        keyInput.addEventListener("input", () => { keyInput.dataset.fieldKey = keyInput.value; });
        row.appendChild(keyInput);
      } else {
        // Hidden input to carry the key value + visible label
        row.appendChild(el("input", { type: "hidden", dataset: { fieldKey: key }, value: key }));
        row.appendChild(el("label", { className: "form-label", style: "flex:0.4;min-width:100px;margin:0;" }, key));
      }

      const valInput = el("input", { className: "form-input", type: "text", value, style: "flex:1;", dataset: { fieldValue: "true" } });
      row.appendChild(valInput);

      // Delete field button
      const delBtn = el("button", {
        className: "btn btn-ghost btn-sm", "aria-label": `Delete field ${key}`, html: Icons.x,
        onClick: async () => {
          if (isNew || !key) {
            // Just remove the row from DOM — not saved yet
            row.remove();
            return;
          }
          try {
            await Api.deleteInstanceField(instanceName, key);
            row.remove();
            Toast.success(`Field "${key}" removed`);
          } catch (err) {
            Toast.error(err.message);
          }
        }
      });
      row.appendChild(delBtn);
      return row;
    },

    async _loadSavedConfigs(container) {
      try {
        const data = await Api.getSavedCubes();
        const configs = data.saved_cubes || [];

        if (configs.length === 0) {
          container.appendChild(el("div", { className: "text-secondary text-sm" }, "No saved configs."));
          return;
        }

        configs.forEach(c => {
          const row = el("div", { className: "flex items-center justify-between", style: "padding: 8px 0; border-bottom: 1px solid var(--border-secondary)" });
          const info = el("div");
          info.appendChild(el("div", { className: "font-medium text-sm" }, c.cube));
          info.appendChild(el("div", { className: "text-xs text-tertiary" }, `${c.instance} / ${c.mode} / ${c.filename}`));
          row.appendChild(info);
          const deleteBtn = el("button", { className: "btn btn-ghost btn-sm", "aria-label": "Delete config", html: Icons.trash, onClick: () => {
            Modal.confirm(`Delete config "${c.filename}"?`, async () => {
              try {
                await Api.deleteConfig(c.filename);
                Sidebar.loadSavedCubes();
                Toast.success("Config deleted");
                this._loadSavedConfigs(container);
              } catch (err) {
                Toast.error(err.message);
              }
            });
          }});
          row.appendChild(deleteBtn);
          container.appendChild(row);
        });
      } catch (err) {
        container.appendChild(el("div", { className: "text-secondary text-sm" }, "Failed to load configs: " + err.message));
      }
    },

    unmount() {},
  };

  // ==================================================================
  // JSON Syntax Highlighting
  // ==================================================================
  function syntaxHighlight(json) {
    return escapeHtml(json).replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      match => {
        let cls = "json-number";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-string";
        } else if (/true|false/.test(match)) {
          cls = "json-boolean";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  // ==================================================================
  // Init
  // ==================================================================
  async function init() {
    Toast.init();
    Modal.init();
    Theme.init();
    Sidebar.init();

    // Register pages
    Router.register("home", HomePage);
    Router.register("nav", NavPage);
    Router.register("cubes", CubesPage);
    Router.register("cube-workspace", CubeWorkspace);
    Router.register("results", ResultsPage);
    Router.register("jobs", JobsPage);
    Router.register("settings", SettingsPage);
    Router.register("transfer", TransferPage);

    // Load initial data (non-blocking — app should load even if API calls fail)
    try { await Sidebar.loadInstances(); } catch { /* will show empty instance list */ }
    Sidebar.loadSavedCubes();
    Sidebar.updateActivityMonitor();

    // Start router
    Router.init();
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Public API (for debugging)
  return { state, Api, Router, Toast, Modal, Theme, StreamManager, BatchManager, Sidebar };
})();

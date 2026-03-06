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
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alertTriangle: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    zap: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    sun: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    externalLink: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    gripVertical: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    unlock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>',
    rotateCcw: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>',
    square: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
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
    updateInstance(name, params) { return this._fetch("POST", `/api/instance/${encodeURIComponent(name)}`, params); },
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

    init() {
      this._backdrop = $("#modal-backdrop");
      this._container = $("#modal-container");
      this._backdrop.addEventListener("click", () => this.close());
      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && !this._container.classList.contains("hidden")) this.close();
      });
    },

    open({ title, body, footer, size = "md" }) {
      const m = el("div", { className: `modal ${size}` },
        el("div", { className: "modal-header" },
          el("h3", { className: "modal-title" }, title),
          el("button", { className: "modal-close", html: Icons.x, onClick: () => this.close() }),
        ),
        el("div", { className: "modal-body" }, ...(typeof body === "string" ? [el("p", null, body)] : [body])),
      );
      if (footer) m.appendChild(el("div", { className: "modal-footer" }, ...footer));
      this._container.innerHTML = "";
      this._container.appendChild(m);
      this._backdrop.classList.remove("hidden");
      this._container.classList.remove("hidden");
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
      const html = document.documentElement;
      if (state.theme === "dark") html.setAttribute("data-theme", "dark");
      else if (state.theme === "light") html.setAttribute("data-theme", "light");
      else html.removeAttribute("data-theme");
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
            if (typeof content === "string") td.innerHTML = content;
            else if (content instanceof HTMLElement) td.appendChild(content);
            else td.textContent = content != null ? content : "";
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
      const addBtn = el("button", { className: "transfer-btn", title: "Add selected", html: Icons.chevronRight, onClick: moveRight });
      const removeBtn = el("button", { className: "transfer-btn", title: "Remove selected", html: Icons.chevronLeft, onClick: moveLeft });
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
      const modalDims = _dims.filter(d => d.included).map(d => d.name);
      let dragIdx = null;

      const body = el("div");
      body.appendChild(el("p", { className: "text-xs text-tertiary mb-3" },
        "Drag dimensions to build the order you want to benchmark."));

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
        title: "Build Predefined Order",
        body,
        footer: [
          el("button", { className: "btn btn-ghost", onClick: () => Modal.close() }, "Cancel"),
          el("button", { className: "btn btn-primary", onClick: () => {
            _predefinedOrders.push([...modalDims]);
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
        const removeBtn = el("span", { className: "selection-row-remove", html: Icons.x, title: "Remove" });
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
        const removeBtn = el("span", { className: "selection-row-remove", html: Icons.x, title: "Remove" });
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
        const removeBtn = el("span", { className: "selection-row-remove", html: Icons.x, title: "Remove" });
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
      });

      // Instance switcher
      const switcherBtn = $("#instanceSwitcherBtn");
      const dropdown = $("#instanceDropdown");
      switcherBtn.addEventListener("click", () => {
        if (switcherBtn.disabled) return;
        dropdown.classList.toggle("hidden");
      });
      document.addEventListener("click", e => {
        if (!e.target.closest("#instanceSwitcher")) dropdown.classList.add("hidden");
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
          onClick: () => {
            dropdown.classList.add("hidden");
            if (isActive) return; // Already connected to this one
            this._promptConnect(name);
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
          // Reset cached data from previous instance
          state.scanData = null;
          state.cubeMetadata = {};
          state.cubeViews = {};
          state.processes = [];
          Modal.close();
          this.renderInstanceSwitcher();
          Sidebar.loadSavedCubes();
          Sidebar.updateActivityMonitor();
          Toast.success(`Connected to ${resp.server_name}`);
          // Re-render current page
          Router._resolve();
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
      const nav = $("#savedCubesNav");
      nav.innerHTML = "";
      // Only show cubes when connected to an instance
      if (!state.connected) return;
      // Show saved cubes for the active instance
      state.savedCubes
        .filter(sc => sc.instance === state.activeInstance)
        .forEach(sc => {
          const a = el("a", {
            className: "nav-sub-item",
            href: `#/cube/${encodeURIComponent(sc.cube)}`,
          },
            el("span", { className: "sub-dot" }),
            el("span", null, sc.cube),
          );
          nav.appendChild(a);
        });
      // Then scanned cubes (not already in saved)
      const savedNames = new Set(state.savedCubes.map(sc => sc.cube));
      const candidates = state.scanData?.candidates || [];
      candidates.forEach(c => {
        if (savedNames.has(c.cube_name)) return;
        const a = el("a", {
          className: "nav-sub-item",
          href: `#/cube/${encodeURIComponent(c.cube_name)}`,
        },
          el("span", { className: "sub-dot" }),
          el("span", null, c.cube_name),
        );
        nav.appendChild(a);
      });
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
      window.addEventListener("hashchange", () => this._resolve());
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

      if (segments[0] === "cube" && segments[1]) {
        pageName = "cube-workspace";
        params.cubeName = decodeURIComponent(segments[1]);
      } else {
        pageName = segments[0] || "home";
      }

      // Unmount current (skip if staying on same page module, e.g. tab switch within CubeWorkspace)
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
        a.classList.toggle("active", page === pageName || (pageName === "cube-workspace" && page === "cubes"));
      });

      // Update title
      const titles = { home: "Home", cubes: "Cubes", "cube-workspace": params.cubeName || "Cube", results: "Results", jobs: "Jobs", settings: "Settings" };
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
    mount() {
      const page = $("#page-home");
      page.innerHTML = "";

      if (!state.connected) {
        // Not connected — show prompt to select instance from sidebar
        page.appendChild(el("div", { className: "empty-state", style: "padding-top:120px" },
          el("div", { className: "empty-state-icon", html: '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>' }),
          el("div", { className: "empty-state-title" }, "Select an instance to get started"),
          el("div", { className: "empty-state-text" }, "Use the instance switcher in the sidebar to connect to a TM1 server."),
        ));
        return;
      }

      // Dashboard
      page.appendChild(el("div", { className: "page-header" },
        el("h1", { className: "page-title" }, `Welcome back`),
        el("p", { className: "page-subtitle" }, `Connected to ${state.serverName || state.activeInstance}`),
      ));

      // Stat cards
      const stats = el("div", { className: "stat-cards" });
      stats.appendChild(this._statCard("INSTANCE", state.activeInstance || "—"));
      stats.appendChild(this._statCard("SAVED CUBES", state.savedCubes.length));
      stats.appendChild(this._statCard("RUNNING JOBS", "—", "jobsStat"));
      stats.appendChild(this._statCard("RESULTS", "—", "resultsStat"));
      page.appendChild(stats);

      // Quick actions
      const actions = el("div", { className: "flex gap-3 mb-4" });
      const scanBtn = el("button", { className: "btn btn-primary", onClick: () => Router.navigate("#/cubes") },
        el("span", { html: Icons.search }), "Scan Instance");
      actions.appendChild(scanBtn);
      page.appendChild(actions);

      // Load async stats
      this._loadStats();

      // Recent jobs
      this._loadRecentJobs(page);
    },

    _statCard(label, value, id) {
      const card = el("div", { className: "stat-card" });
      card.appendChild(el("div", { className: "stat-card-label" }, label));
      const valEl = el("div", { className: "stat-card-value" }, String(value));
      if (id) valEl.id = id;
      card.appendChild(valEl);
      return card;
    },

    async _loadStats() {
      try {
        const [statusData, resultsData] = await Promise.all([Api.getStatus(), Api.getResults()]);
        const jobsEl = $("#jobsStat");
        const resultsEl = $("#resultsStat");
        if (jobsEl) jobsEl.textContent = statusData.active_job ? "1" : "0";
        if (resultsEl) resultsEl.textContent = resultsData.results.length;
      } catch { /* non-critical */ }
    },

    async _loadRecentJobs(page) {
      try {
        const data = await Api.getJobs();
        const jobs = (data.jobs || []).slice(0, 5);
        if (jobs.length === 0) return;

        const section = el("div", null,
          el("h3", { className: "card-title mb-2" }, "Recent Jobs"),
        );
        const card = el("div", { className: "card" });
        jobs.forEach(job => {
          const row = el("div", { className: "flex items-center justify-between", style: "padding: 8px 0; border-bottom: 1px solid var(--border-secondary)" });
          row.appendChild(el("span", { className: "font-medium text-sm" }, job.cube_name || job.cube_config?.cube || "Unknown"));
          const badgeClass = job.status === "running" ? "badge-info" : job.status === "completed" ? "badge-success" : "badge-error";
          row.appendChild(el("span", { className: `badge ${badgeClass}` }, job.status));
          card.appendChild(row);
        });
        section.appendChild(card);
        page.appendChild(section);
      } catch { /* non-critical */ }
    },

    unmount() {},
  };

  // ==================================================================
  // Page: Cubes (scan + table)
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
      this._tabsEl = el("div", { className: "tabs" });
      ["overview", "configure", "optimize", "results"].forEach(t => {
        const label = t.charAt(0).toUpperCase() + t.slice(1);
        const tab = el("div", {
          className: `tab${t === this._activeTab ? " active" : ""}`,
          dataset: { tab: t },
          onClick: () => {
            this._switchTab(t);
            // Update URL without triggering full re-mount
            history.replaceState(null, "", `#/cube/${encodeURIComponent(this._cubeName)}?tab=${t}`);
          }
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

      // Update tab bar active states
      if (this._tabsEl) {
        this._tabsEl.querySelectorAll(".tab").forEach(t => {
          t.classList.toggle("active", t.dataset.tab === tabName);
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
      const container = el("div", { className: "tab-pane", dataset: { tabPane: tabName } });
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
        // Already loaded — show it
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
          const removeBtn = el("span", { className: "selection-row-remove", html: Icons.x, title: "Remove" });
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
          const removeBtn = el("span", { className: "selection-row-remove", html: Icons.x, title: "Remove" });
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
            { key: "filename", label: "File", render: r => el("span", { className: "font-medium" }, r.filename) },
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
      if (state.cubeMetadata[this._cubeName]) return state.cubeMetadata[this._cubeName];
      const data = await Api.getCubeIntelligence(state.activeInstance, state.password, this._cubeName);
      state.cubeMetadata[this._cubeName] = data;
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
            { key: "cube", label: "Cube", render: r => el("a", { href: `#/cube/${encodeURIComponent(r.cube)}?tab=results`, className: "font-medium" }, r.cube) },
            { key: "filename", label: "File" },
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
      if (state.instances.length > 0) {
        const instancesCard = el("div", { className: "card mb-4" });
        instancesCard.appendChild(el("div", { className: "card-title mb-4" }, "TM1 Instances"));

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
        const firstName = state.instances[0];
        this._loadInstanceConfig(containers[firstName], firstName);
        containers[firstName].dataset.loaded = "true";
      }

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

        Object.entries(params).forEach(([key, value]) => {
          if (key.toLowerCase() === "password") return; // Don't show password
          const group = el("div", { className: "form-group" });
          group.appendChild(el("label", { className: "form-label" }, key));
          const input = el("input", { className: "form-input", type: "text", value, dataset: { key } });
          group.appendChild(input);
          container.appendChild(group);
        });

        const saveBtn = el("button", { className: "btn btn-primary mt-2" }, "Save Instance Config");
        saveBtn.addEventListener("click", async () => {
          const inputs = $$("[data-key]", container);
          const newParams = {};
          inputs.forEach(inp => { newParams[inp.dataset.key] = inp.value; });
          try {
            await Api.updateInstance(instanceName, newParams);
            Toast.success(`Config saved for ${instanceName}`);
          } catch (err) {
            Toast.error(err.message);
          }
        });
        container.appendChild(saveBtn);
      } catch (err) {
        container.appendChild(el("div", { className: "text-secondary text-sm" }, "Failed to load config: " + err.message));
      }
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
          const deleteBtn = el("button", { className: "btn btn-ghost btn-sm", html: Icons.trash, onClick: () => {
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
    Router.register("cubes", CubesPage);
    Router.register("cube-workspace", CubeWorkspace);
    Router.register("results", ResultsPage);
    Router.register("jobs", JobsPage);
    Router.register("settings", SettingsPage);

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

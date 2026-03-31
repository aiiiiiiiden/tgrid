const { ipcRenderer } = require('electron');
const { Terminal } = require('@xterm/xterm');
const { FitAddon } = require('@xterm/addon-fit');

let panels = [];
let activeIndex = 0;
let gridRows = 1;
let gridCols = 1;
let config = {};
let fullscreenIndex = -1;
let presets = [];
let assignments = {};
let presetImageCache = {}; // path -> dataUrl
let openDropdown = null; // track currently open dropdown
let shiftDetected = false; // for session restore bypass
let resizeListenerRegistered = false;

const DEFAULT_OPACITY = 0.3;
const ACTIVE_OPACITY = 0.5;

const PRESET_COLORS = [
  { value: null, label: 'None' },
  { value: '#f87171', label: 'Red' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#fbbf24', label: 'Yellow' },
  { value: '#4ade80', label: 'Green' },
  { value: '#67e8f9', label: 'Cyan' },
  { value: '#60a5fa', label: 'Blue' },
  { value: '#c084fc', label: 'Purple' },
  { value: '#f472b6', label: 'Pink' }
];

const LIGHT_PRESET_COLORS = [
  { value: null, label: 'None' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#a16207', label: 'Yellow' },
  { value: '#15803d', label: 'Green' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#db2777', label: 'Pink' }
];

function getPresetColors() {
  return currentTheme === 'light' ? LIGHT_PRESET_COLORS : PRESET_COLORS;
}

function getDisplayColor(storedColor) {
  if (!storedColor) return null;
  const darkIdx = PRESET_COLORS.findIndex(c => c.value === storedColor);
  if (darkIdx < 0) return storedColor;
  const colors = getPresetColors();
  return colors[darkIdx] ? colors[darkIdx].value : storedColor;
}

const DARK_TERM_THEME = {
  background: '#141414',
  foreground: '#cccccc',
  cursor: '#4ade80',
  cursorAccent: '#141414',
  selectionBackground: 'rgba(74, 222, 128, 0.2)',
  black: '#141414',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#67e8f9',
  white: '#cccccc',
  brightBlack: '#4e4e4e',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#a5f3fc',
  brightWhite: '#e5e5e5'
};

const LIGHT_TERM_THEME = {
  background: '#fafafa',
  foreground: '#3e3e3e',
  cursor: '#15803d',
  cursorAccent: '#fafafa',
  selectionBackground: 'rgba(21, 128, 61, 0.15)',
  black: '#3e3e3e',
  red: '#dc2626',
  green: '#15803d',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#eaeaea',
  brightBlack: '#808080',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#f2f2f2'
};

let currentTheme = 'dark';

const TERM_OPTIONS = {
  fontSize: 13,
  fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
  theme: DARK_TERM_THEME,
  allowTransparency: true,
  cursorBlink: true,
  scrollback: 5000
};

// ── Resize listener (guarded to prevent duplicate registration) ──

function setupResizeListener() {
  if (resizeListenerRegistered) return;
  resizeListenerRegistered = true;
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      closeAllDropdowns();
      panels.forEach(p => {
        try { p.fitAddon.fit(); } catch(e) {}
      });
    }, 100);
  });
}

// ── Dropdown helpers ──

function closeAllDropdowns() {
  if (openDropdown) {
    openDropdown.remove();
    openDropdown = null;
  }
}

function createDropdown(anchorEl, items, options = {}) {
  closeAllDropdowns();
  const dd = document.createElement('div');
  dd.className = 'dropdown';
  dd.setAttribute('role', 'menu');

  items.forEach(item => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'dropdown-separator';
      dd.appendChild(sep);
      return;
    }
    if (item.action) {
      const el = document.createElement('div');
      el.className = 'dropdown-action';
      el.textContent = item.label;
      el.setAttribute('role', 'menuitem');
      el.tabIndex = -1;
      el.addEventListener('click', (e) => { e.stopPropagation(); closeAllDropdowns(); item.action(); });
      dd.appendChild(el);
      return;
    }
    const el = document.createElement('div');
    el.className = 'dropdown-item' + (item.active ? ' active' : '');
    el.setAttribute('role', 'menuitem');
    el.tabIndex = -1;

    if (item.check !== undefined) {
      const check = document.createElement('span');
      check.className = 'check';
      check.textContent = item.check ? '✓' : '';
      el.appendChild(check);
    }
    if (item.color) {
      const dot = document.createElement('span');
      dot.className = 'preset-color-dot';
      dot.style.background = item.color;
      el.appendChild(dot);
    }
    if (item.imgSrc) {
      const img = document.createElement('img');
      img.src = item.imgSrc;
      el.appendChild(img);
    }
    const label = document.createElement('span');
    label.textContent = item.label;
    el.appendChild(label);

    if (item.onEdit) {
      const editBtn = document.createElement('span');
      editBtn.className = 'edit-icon';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); closeAllDropdowns(); item.onEdit(); });
      el.appendChild(editBtn);
    }

    el.addEventListener('click', (e) => { e.stopPropagation(); closeAllDropdowns(); if (item.onClick) item.onClick(); });
    dd.appendChild(el);
  });

  // Position relative to anchor
  document.body.appendChild(dd);
  const rect = anchorEl.getBoundingClientRect();
  dd.style.top = `${rect.bottom + 4}px`;
  dd.style.left = `${rect.left}px`;

  // Keyboard navigation
  dd.tabIndex = -1;
  let focusedIdx = -1;
  const focusableItems = Array.from(dd.querySelectorAll('.dropdown-item, .dropdown-action'));

  function setFocusedItem(idx) {
    focusableItems.forEach(el => el.classList.remove('focused'));
    if (idx >= 0 && idx < focusableItems.length) {
      focusedIdx = idx;
      focusableItems[idx].classList.add('focused');
      focusableItems[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  dd.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedItem(focusedIdx < focusableItems.length - 1 ? focusedIdx + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedItem(focusedIdx > 0 ? focusedIdx - 1 : focusableItems.length - 1);
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      focusableItems[focusedIdx].click();
    }
  });

  // Clamp to viewport, then focus dropdown and first item
  requestAnimationFrame(() => {
    const ddRect = dd.getBoundingClientRect();
    if (ddRect.right > window.innerWidth) {
      dd.style.left = `${window.innerWidth - ddRect.width - 8}px`;
    }
    if (ddRect.bottom > window.innerHeight) {
      dd.style.top = `${rect.top - ddRect.height - 4}px`;
    }
    dd.focus();
    if (focusableItems.length > 0) setFocusedItem(0);
  });

  openDropdown = dd;
  return dd;
}

// Close dropdown on click outside
document.addEventListener('mousedown', (e) => {
  if (openDropdown && !openDropdown.contains(e.target)) {
    closeAllDropdowns();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllDropdowns();
  if (e.key === 'Shift') shiftDetected = true;
});

// ── Grid Picker (startup) ──

function showGridPicker(lastGrid, onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'grid-picker-overlay';

  const picker = document.createElement('div');
  picker.className = 'grid-picker';

  const title = document.createElement('h2');
  title.textContent = 'Choose Grid Size';
  picker.appendChild(title);

  const cellsContainer = document.createElement('div');
  cellsContainer.className = 'grid-picker-cells';

  const cells = [];
  let selectedRows = lastGrid.rows;
  let selectedCols = lastGrid.cols;
  let hoverRows = 0;
  let hoverCols = 0;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cells.push(cell);
      cellsContainer.appendChild(cell);
    }
  }

  const info = document.createElement('div');
  info.className = 'grid-picker-info';

  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn-primary btn-start';
  startBtn.textContent = 'Start';

  function updateCells(rows, cols, isHover) {
    cells.forEach(cell => {
      const r = parseInt(cell.dataset.row);
      const c = parseInt(cell.dataset.col);
      cell.classList.remove('highlighted', 'selected');
      if (isHover && r < rows && c < cols) {
        cell.classList.add('highlighted');
      } else if (!isHover && r < selectedRows && c < selectedCols) {
        cell.classList.add('selected');
      }
    });
    if (rows > 0 && cols > 0) {
      info.innerHTML = `<span class="size">${rows} × ${cols}</span>  ·  ${rows * cols} agents`;
    }
  }

  // Initial selection
  updateCells(selectedRows, selectedCols, false);
  startBtn.disabled = false;

  cellsContainer.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    hoverRows = parseInt(cell.dataset.row) + 1;
    hoverCols = parseInt(cell.dataset.col) + 1;
    updateCells(hoverRows, hoverCols, true);
  });

  cellsContainer.addEventListener('mouseleave', () => {
    hoverRows = 0;
    hoverCols = 0;
    updateCells(selectedRows, selectedCols, false);
  });

  cellsContainer.addEventListener('click', (e) => {
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    selectedRows = parseInt(cell.dataset.row) + 1;
    selectedCols = parseInt(cell.dataset.col) + 1;
    startBtn.disabled = false;
    updateCells(selectedRows, selectedCols, false);
  });

  startBtn.addEventListener('click', () => {
    if (selectedRows > 0 && selectedCols > 0) {
      overlay.remove();
      onSelect(selectedRows, selectedCols);
    }
  });

  // Keyboard navigation
  overlay.tabIndex = 0;
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
      return;
    }
    if (e.key === 'Enter') {
      if (selectedRows > 0 && selectedCols > 0) {
        overlay.remove();
        onSelect(selectedRows, selectedCols);
      }
      return;
    }
    if (e.key === 'ArrowRight' && selectedCols < 4) { selectedCols++; }
    if (e.key === 'ArrowLeft' && selectedCols > 1) { selectedCols--; }
    if (e.key === 'ArrowDown' && selectedRows < 4) { selectedRows++; }
    if (e.key === 'ArrowUp' && selectedRows > 1) { selectedRows--; }
    updateCells(selectedRows, selectedCols, false);
    e.preventDefault();
  });

  picker.appendChild(cellsContainer);
  picker.appendChild(info);
  picker.appendChild(startBtn);
  overlay.appendChild(picker);
  document.body.appendChild(overlay);
  overlay.focus();
}

// ── Grid Resize Dropdown (runtime) ──

function showGridResizeDropdown(anchorEl) {
  closeAllDropdowns();

  const dd = document.createElement('div');
  dd.className = 'dropdown grid-resize-dropdown';

  const cellsContainer = document.createElement('div');
  cellsContainer.className = 'grid-resize-cells';

  const cells = [];
  let hoverR = 0, hoverC = 0;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-resize-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (r < gridRows && c < gridCols) cell.classList.add('current');
      cells.push(cell);
      cellsContainer.appendChild(cell);
    }
  }

  const info = document.createElement('div');
  info.className = 'grid-resize-info';
  info.innerHTML = `<span class="accent-text">${gridRows} × ${gridCols}</span>`;

  function updateCells(rows, cols) {
    cells.forEach(cell => {
      const r = parseInt(cell.dataset.row);
      const c = parseInt(cell.dataset.col);
      cell.classList.remove('highlighted', 'current');
      if (rows > 0 && cols > 0 && r < rows && c < cols) {
        cell.classList.add('highlighted');
      } else if (r < gridRows && c < gridCols) {
        cell.classList.add('current');
      }
    });
    if (rows > 0 && cols > 0) {
      info.innerHTML = `<span class="accent-text">${rows} × ${cols}</span>  ·  ${rows * cols} agents`;
    } else {
      info.innerHTML = `<span class="accent-text">${gridRows} × ${gridCols}</span>`;
    }
  }

  cellsContainer.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.grid-resize-cell');
    if (!cell) return;
    hoverR = parseInt(cell.dataset.row) + 1;
    hoverC = parseInt(cell.dataset.col) + 1;
    updateCells(hoverR, hoverC);
  });

  cellsContainer.addEventListener('mouseleave', () => {
    hoverR = 0; hoverC = 0;
    updateCells(0, 0);
  });

  cellsContainer.addEventListener('click', (e) => {
    const cell = e.target.closest('.grid-resize-cell');
    if (!cell) return;
    const newRows = parseInt(cell.dataset.row) + 1;
    const newCols = parseInt(cell.dataset.col) + 1;
    // No-op if same size
    if (newRows === gridRows && newCols === gridCols) {
      closeAllDropdowns();
      return;
    }
    closeAllDropdowns();
    rebuildGrid(newRows, newCols);
  });

  dd.appendChild(cellsContainer);
  dd.appendChild(info);
  document.body.appendChild(dd);

  const rect = anchorEl.getBoundingClientRect();
  dd.style.top = `${rect.bottom + 4}px`;
  dd.style.left = `${rect.left}px`;

  requestAnimationFrame(() => {
    const ddRect = dd.getBoundingClientRect();
    if (ddRect.right > window.innerWidth) {
      dd.style.left = `${window.innerWidth - ddRect.width - 8}px`;
    }
  });

  openDropdown = dd;
}

// ── rebuildGrid ──

async function rebuildGrid(newRows, newCols) {
  const oldTotal = panels.length;
  const newTotal = newRows * newCols;

  if (newTotal < oldTotal) {
    const removing = oldTotal - newTotal;
    const ok = await showConfirmDialog(
      `This will close ${removing} terminal(s) and kill their processes. Continue?`,
      { confirmText: 'Close', danger: true }
    );
    if (!ok) return;

    // Exit fullscreen if the fullscreened panel will be removed
    if (fullscreenIndex >= newTotal) {
      exitFullscreen();
    }

    // Tell main to kill PTYs
    await ipcRenderer.invoke('resize-grid', { rows: newRows, cols: newCols });

    // Dispose removed panels from the end
    for (let i = oldTotal - 1; i >= newTotal; i--) {
      const p = panels[i];
      try { p.term.dispose(); } catch(e) {}
      p.panel.remove();
    }
    panels.length = newTotal;

    // Move active if needed
    if (activeIndex >= newTotal) {
      setActivePanel(newTotal - 1);
    }
  } else if (newTotal > oldTotal) {
    // Tell main to update config
    await ipcRenderer.invoke('resize-grid', { rows: newRows, cols: newCols });

    // Create new panels
    const grid = document.getElementById('grid');
    for (let i = oldTotal; i < newTotal; i++) {
      await createPanel(i, null);
    }
  } else {
    // Same total, different shape (e.g. 2x3 → 3x2)
    await ipcRenderer.invoke('resize-grid', { rows: newRows, cols: newCols });
  }

  gridRows = newRows;
  gridCols = newCols;

  const grid = document.getElementById('grid');
  grid.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;

  updateGridIndicator();
  updateStatusBar();

  setTimeout(() => {
    panels.forEach(p => { try { p.fitAddon.fit(); } catch(e) {} });
  }, 50);
}

function exitFullscreen() {
  if (fullscreenIndex >= 0) {
    panels[fullscreenIndex].panel.classList.remove('fullscreen');
    panels.forEach(p => {
      if (p.index !== fullscreenIndex) p.panel.style.display = '';
    });
    fullscreenIndex = -1;
  }
}

function updateGridIndicator() {
  const el = document.getElementById('grid-indicator');
  el.textContent = `${gridRows} × ${gridCols}  ·  ${panels.length} agents ▾`;
}

function updateStatusBar() {
  const leftEl = document.getElementById('status-left');
  const presetId = assignments[String(activeIndex)] || null;
  const preset = presetId ? presets.find(p => p.id === presetId) : null;
  if (preset) {
    leftEl.textContent = `${preset.name} \u00b7 Panel ${activeIndex + 1}`;
  } else {
    leftEl.textContent = `Panel ${activeIndex + 1}`;
  }

  document.getElementById('panel-count').textContent =
    `${panels.length} panel${panels.length !== 1 ? 's' : ''}`;
}

function setupHelpButton() {
  const btn = document.getElementById('help-btn');
  if (!btn || btn._helpBound) return;
  btn._helpBound = true;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isMac = navigator.platform.indexOf('Mac') !== -1;
    const mod = isMac ? '\u2318' : 'Ctrl+';
    const items = [
      { label: `${mod}1-9  Focus panel` },
      { label: `${mod}\u2191\u2193\u2190\u2192  Navigate panels` },
      { label: `${mod}\u23CE  Toggle fullscreen` },
      { separator: true },
      { label: `Shift  New session (on launch)` },
    ];
    createDropdown(btn, items);
  });
}

// ── Theme management ──

function updateThemeToggleButton(theme) {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;
  const isLight = theme === 'light';
  toggleBtn.textContent = isLight ? 'Light ▾' : 'Dark ▾';
  toggleBtn.title = isLight ? 'Switch to dark theme' : 'Switch to light theme';
  toggleBtn.setAttribute('aria-label', isLight ? 'Current theme: light. Switch to dark theme' : 'Current theme: dark. Switch to light theme');
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  const termTheme = theme === 'light' ? LIGHT_TERM_THEME : DARK_TERM_THEME;
  panels.forEach(p => {
    p.term.options.theme = { ...termTheme };
    // Force viewport background update — xterm's ThemeService may not trigger from options setter
    const viewport = p.panel.querySelector('.xterm-viewport');
    if (viewport) viewport.style.backgroundColor = termTheme.background;
    p.term.refresh(0, p.term.rows - 1);
  });

  updateThemeToggleButton(theme);
  refreshAllPanelAssignments();
  ipcRenderer.invoke('set-theme', theme);
}

function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });
}

function initTheme(savedTheme) {
  let theme;
  if (savedTheme) {
    theme = savedTheme;
  } else {
    // Detect OS preference on first launch
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  TERM_OPTIONS.theme = theme === 'light' ? LIGHT_TERM_THEME : DARK_TERM_THEME;
  updateThemeToggleButton(theme);
}

let systemThemeListenerActive = false;
function setupSystemThemeListener() {
  if (systemThemeListenerActive) return;
  systemThemeListenerActive = true;
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', (e) => {
    if (!config.theme) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  });
}

// ── Focus trap helper ──

function trapFocus(backdrop, modal, onEscape) {
  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { onEscape(); return; }
    if (e.key === 'Tab') {
      const focusable = modal.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  });
}

// ── Confirm dialog (replaces native confirm()) ──

function showConfirmDialog(message, { confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal';

    const msg = document.createElement('p');
    msg.textContent = message;
    modal.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelText;
    cancelBtn.addEventListener('click', () => { backdrop.remove(); resolve(false); });
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.textContent = confirmText;
    confirmBtn.addEventListener('click', () => { backdrop.remove(); resolve(true); });
    actions.appendChild(confirmBtn);

    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) { backdrop.remove(); resolve(false); }
    });

    trapFocus(backdrop, modal, () => { backdrop.remove(); resolve(false); });

    confirmBtn.focus();
  });
}

// ── Modal helpers ──

function showPresetModal(preset, onSave, onDelete) {
  const isNew = !preset;
  const data = preset ? { ...preset } : { id: null, name: '', image: '', shell: '', color: null };
  let currentImageDataUrl = null;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = isNew ? 'New Preset' : 'Edit Preset';
  modal.appendChild(title);

  // Name input
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  modal.appendChild(nameLabel);
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = data.name;
  nameInput.placeholder = 'Character name';
  modal.appendChild(nameInput);

  // Image picker
  const imgLabel = document.createElement('label');
  imgLabel.textContent = 'Image';
  modal.appendChild(imgLabel);
  const imgPicker = document.createElement('div');
  imgPicker.className = 'modal-image-picker';

  const imgPreview = document.createElement('div');
  async function updateImagePreview() {
    imgPreview.innerHTML = '';
    if (data.image) {
      const dataUrl = presetImageCache[data.image] || await ipcRenderer.invoke('load-image', data.image);
      if (dataUrl) {
        presetImageCache[data.image] = dataUrl;
        currentImageDataUrl = dataUrl;
        const img = document.createElement('img');
        img.src = dataUrl;
        imgPreview.appendChild(img);
        return;
      }
    }
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = '+';
    imgPreview.appendChild(placeholder);
  }
  updateImagePreview();

  const chooseBtn = document.createElement('button');
  chooseBtn.className = 'btn btn-secondary';
  chooseBtn.textContent = 'Choose Image';
  chooseBtn.addEventListener('click', async () => {
    const imagePath = await ipcRenderer.invoke('pick-image');
    if (imagePath) {
      data.image = imagePath;
      await updateImagePreview();
    }
  });

  imgPicker.appendChild(imgPreview);
  imgPicker.appendChild(chooseBtn);
  modal.appendChild(imgPicker);

  // Color picker
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Color';
  modal.appendChild(colorLabel);
  const colorPalette = document.createElement('div');
  colorPalette.className = 'color-palette';
  colorPalette.setAttribute('role', 'radiogroup');
  colorPalette.setAttribute('aria-label', 'Preset color');
  const displayColors = getPresetColors();
  PRESET_COLORS.forEach((c, idx) => {
    const displayC = displayColors[idx];
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch' + (c.value === null ? ' none-swatch' : '');
    if (displayC.value) swatch.style.background = displayC.value;
    const isSelected = data.color === c.value || (data.color == null && c.value === null);
    if (isSelected) swatch.classList.add('selected');
    swatch.title = c.label;
    swatch.setAttribute('aria-label', c.label);
    swatch.setAttribute('role', 'radio');
    swatch.setAttribute('aria-checked', String(isSelected));
    swatch.addEventListener('click', () => {
      data.color = c.value; // always store the dark palette (canonical) value
      colorPalette.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.remove('selected');
        s.setAttribute('aria-checked', 'false');
      });
      swatch.classList.add('selected');
      swatch.setAttribute('aria-checked', 'true');
    });
    colorPalette.appendChild(swatch);
  });
  modal.appendChild(colorPalette);

  // Shell override
  const shellLabel = document.createElement('label');
  shellLabel.textContent = 'Shell override (optional)';
  modal.appendChild(shellLabel);
  const shellInput = document.createElement('input');
  shellInput.type = 'text';
  shellInput.value = data.shell || '';
  shellInput.placeholder = 'default';
  modal.appendChild(shellInput);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  if (!isNew && onDelete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger modal-actions-left';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      const ok = await showConfirmDialog(
        `Delete preset "${data.name}"?`,
        { confirmText: 'Delete', danger: true }
      );
      if (ok) {
        backdrop.remove();
        onDelete(data.id);
      }
    });
    actions.appendChild(deleteBtn);
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => backdrop.remove());
  actions.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    data.name = name;
    data.shell = shellInput.value.trim() || undefined;
    backdrop.remove();
    onSave(data);
  });
  actions.appendChild(saveBtn);

  modal.appendChild(actions);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  trapFocus(backdrop, modal, () => backdrop.remove());

  nameInput.focus();
}

// ── Preset image loading ──

async function loadPresetImage(imagePath) {
  if (!imagePath) return null;
  if (presetImageCache[imagePath]) return presetImageCache[imagePath];
  const dataUrl = await ipcRenderer.invoke('load-image', imagePath);
  if (dataUrl) presetImageCache[imagePath] = dataUrl;
  return dataUrl;
}

// ── Titlebar Presets dropdown ──

function setupPresetsButton() {
  const btn = document.getElementById('presets-btn');
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    for (const p of presets) {
      if (p.image) await loadPresetImage(p.image);
    }
    const items = presets.map(p => ({
      label: p.name,
      imgSrc: presetImageCache[p.image] || null,
      color: getDisplayColor(p.color) || null,
      onEdit: () => openPresetEditor(p),
      onClick: () => openPresetEditor(p)
    }));
    items.push({ separator: true });
    items.push({ label: '+ New Preset', action: () => openPresetEditor(null) });
    createDropdown(btn, items);
  });
}

function setupGridIndicator() {
  const btn = document.getElementById('grid-indicator');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showGridResizeDropdown(btn);
  });
}

async function openPresetEditor(preset) {
  showPresetModal(
    preset,
    async (data) => {
      const updatedPresets = await ipcRenderer.invoke('save-preset', data);
      presets = updatedPresets;
      document.querySelector('.onboarding-hint')?.remove();
      refreshAllPanelAssignments();
    },
    preset ? async (id) => {
      const result = await ipcRenderer.invoke('delete-preset', id);
      presets = result.presets;
      assignments = result.assignments;
      refreshAllPanelAssignments();
    } : null
  );
}

// ── Panel ... menu ──

function showPanelPresetMenu(panelIndex, anchorEl) {
  const currentPresetId = assignments[String(panelIndex)] || null;

  const items = [
    {
      label: 'None',
      check: currentPresetId === null,
      onClick: () => assignPresetToPanel(panelIndex, null)
    },
    { separator: true }
  ];

  for (const p of presets) {
    items.push({
      label: p.name,
      imgSrc: presetImageCache[p.image] || null,
      check: currentPresetId === p.id,
      color: getDisplayColor(p.color) || null,
      onClick: () => assignPresetToPanel(panelIndex, p.id)
    });
  }

  createDropdown(anchorEl, items);
}

async function assignPresetToPanel(panelIndex, presetId) {
  document.querySelector('.onboarding-hint')?.remove();
  assignments = await ipcRenderer.invoke('set-assignment', { panelIndex, presetId });
  await updatePanelPreset(panelIndex);
  updateStatusBar();
}

async function updatePanelPreset(panelIndex) {
  const panel = panels[panelIndex];
  if (!panel) return;

  const presetId = assignments[String(panelIndex)] || null;
  const preset = presetId ? presets.find(p => p.id === presetId) : null;

  // Update header name
  const nameSpan = panel.panel.querySelector('.panel-header .name');
  if (nameSpan) {
    nameSpan.textContent = preset ? preset.name : `Terminal ${panelIndex + 1}`;
  }

  // Update panel color (header bar + active glow)
  const panelColor = (preset && preset.color) ? getDisplayColor(preset.color) : '';
  const headerEl = panel.panel.querySelector('.panel-header');
  if (headerEl) {
    headerEl.style.setProperty('--panel-color', panelColor || 'transparent');
  }
  panel.panel.style.setProperty('--panel-color', panelColor || '');

  // Update overlay image
  panel.overlay.innerHTML = '';
  if (preset && preset.image) {
    const dataUrl = await loadPresetImage(preset.image);
    if (dataUrl) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = preset.name;
      panel.overlay.appendChild(img);
    }
  }

  // Update terminal cursor color to match preset color
  const termTheme = currentTheme === 'light' ? LIGHT_TERM_THEME : DARK_TERM_THEME;
  const cursorColor = panelColor || termTheme.cursor;
  panel.term.options.theme = { ...panel.term.options.theme, cursor: cursorColor };

  // Update opacity
  const isActive = panelIndex === activeIndex;
  panel.overlay.style.opacity = isActive ? (config.activeOpacity || ACTIVE_OPACITY) : (config.defaultOpacity || DEFAULT_OPACITY);
}

function refreshAllPanelAssignments() {
  panels.forEach(p => updatePanelPreset(p.index));
}

// ── Drag and Drop ──

let dragSourceIndex = -1;

function setupDragAndDrop(header, panelIndex) {
  header.setAttribute('draggable', 'true');

  header.addEventListener('dragstart', (e) => {
    if (fullscreenIndex >= 0) { e.preventDefault(); return; }
    closeAllDropdowns();
    dragSourceIndex = panelIndex;
    header.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(panelIndex));
  });

  header.addEventListener('dragend', () => {
    header.classList.remove('dragging');
    dragSourceIndex = -1;
    // Clean up all drag-over states
    document.querySelectorAll('.panel-header.drag-over').forEach(h => h.classList.remove('drag-over'));
  });

  header.addEventListener('dragover', (e) => {
    if (dragSourceIndex === panelIndex) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    header.classList.add('drag-over');
  });

  header.addEventListener('dragleave', () => {
    header.classList.remove('drag-over');
  });

  header.addEventListener('drop', (e) => {
    e.preventDefault();
    header.classList.remove('drag-over');
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(sourceIdx) || sourceIdx === panelIndex) return;
    swapPanelAssignments(sourceIdx, panelIndex);
  });
}

async function swapPanelAssignments(sourceIndex, targetIndex) {
  const src = panels[sourceIndex];
  const tgt = panels[targetIndex];
  if (!src || !tgt) return;

  // Swap preset assignments
  const sourcePresetId = assignments[String(sourceIndex)] || null;
  const targetPresetId = assignments[String(targetIndex)] || null;

  if (targetPresetId) assignments[String(sourceIndex)] = targetPresetId;
  else delete assignments[String(sourceIndex)];

  if (sourcePresetId) assignments[String(targetIndex)] = sourcePresetId;
  else delete assignments[String(targetIndex)];

  await ipcRenderer.invoke('swap-assignments', {
    indexA: sourceIndex, presetIdA: targetPresetId,
    indexB: targetIndex, presetIdB: sourcePresetId
  });

  // Swap terminal DOM: move xterm elements between terminal-wrap containers
  const srcWrap = src.panel.querySelector('.terminal-wrap');
  const tgtWrap = tgt.panel.querySelector('.terminal-wrap');

  // Collect xterm DOM nodes (not overlay or onboarding hint)
  const srcXtermEl = srcWrap.querySelector('.xterm');
  const tgtXtermEl = tgtWrap.querySelector('.xterm');

  if (srcXtermEl && tgtXtermEl) {
    // Move xterm elements to the other panel's wrap
    tgtWrap.appendChild(srcXtermEl);
    srcWrap.appendChild(tgtXtermEl);
  }

  // Swap term, fitAddon, ptyId in panel data
  const tmpTerm = src.term;
  const tmpFitAddon = src.fitAddon;
  const tmpPtyId = src.ptyId;

  src.term = tgt.term;
  src.fitAddon = tgt.fitAddon;
  src.ptyId = tgt.ptyId;

  tgt.term = tmpTerm;
  tgt.fitAddon = tmpFitAddon;
  tgt.ptyId = tmpPtyId;

  // Refit both terminals to their new containers
  requestAnimationFrame(() => {
    try { src.fitAddon.fit(); } catch(e) {}
    try { tgt.fitAddon.fit(); } catch(e) {}
  });

  // Update preset visuals
  updatePanelPreset(sourceIndex);
  updatePanelPreset(targetIndex);
}

// ── Grid Picker IPC ──

ipcRenderer.on('show-grid-picker', (event, data) => {
  config = data.config;
  presets = config.presets || [];
  assignments = config.assignments || {};
  initTheme(config.theme);

  showGridPicker(data.lastGrid, async (rows, cols) => {
    await ipcRenderer.invoke('grid-selected', { rows, cols });
  });
});

// ── Session Restore ──

ipcRenderer.on('restore-session', async (event, data) => {
  config = data.config;
  presets = config.presets || [];
  initTheme(config.theme);

  // Give the user a brief window to press Shift
  await new Promise(r => setTimeout(r, 100));

  if (shiftDetected) {
    // User wants fresh start → show grid picker
    assignments = config.assignments || {};
    const lastGrid = data.session.grid || { rows: 2, cols: 2 };
    showGridPicker(lastGrid, async (rows, cols) => {
      await ipcRenderer.invoke('grid-selected', { rows, cols });
    });
    return;
  }

  // Restore session
  const session = data.session;
  gridRows = session.grid.rows;
  gridCols = session.grid.cols;

  // Rebuild assignments from session data (session is newer than config)
  assignments = {};
  session.panels.forEach(p => {
    if (p.presetId) assignments[String(p.index)] = p.presetId;
  });

  updateGridIndicator();

  const grid = document.getElementById('grid');
  grid.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;

  const totalPanels = gridRows * gridCols;

  // Preload preset images
  for (const p of presets) {
    if (p.image) await loadPresetImage(p.image);
  }

  // Create panels with saved cwds
  for (let i = 0; i < totalPanels; i++) {
    const sessionPanel = session.panels.find(p => p.index === i);
    const presetId = assignments[String(i)] || null;
    const preset = presetId ? presets.find(p => p.id === presetId) : null;
    const cwd = sessionPanel ? sessionPanel.cwd : null;
    await createPanel(i, preset, cwd);
  }

  setActivePanel(0);
  setupPresetsButton();
  setupGridIndicator();
  setupHelpButton();
  setupThemeToggle();
  setupSystemThemeListener();
  updateStatusBar();

  // Persist updated assignments back to config
  await ipcRenderer.invoke('restore-assignments', {
    assignments,
    grid: { rows: gridRows, cols: gridCols }
  });

  setupResizeListener();
});

// ── Init ──

ipcRenderer.on('init', async (event, data) => {
  gridRows = data.rows;
  gridCols = data.cols;
  config = data.config;
  presets = config.presets || [];
  assignments = config.assignments || {};
  initTheme(config.theme);

  updateGridIndicator();

  const grid = document.getElementById('grid');
  grid.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;

  const totalPanels = gridRows * gridCols;

  // Preload all preset images
  for (const p of presets) {
    if (p.image) await loadPresetImage(p.image);
  }

  for (let i = 0; i < totalPanels; i++) {
    const presetId = assignments[String(i)] || null;
    const preset = presetId ? presets.find(p => p.id === presetId) : null;
    await createPanel(i, preset);
  }

  setActivePanel(0);
  setupPresetsButton();
  setupGridIndicator();
  setupHelpButton();
  setupThemeToggle();
  setupSystemThemeListener();
  updateStatusBar();

  setupResizeListener();
});

async function createPanel(index, character, cwd = null) {
  const grid = document.getElementById('grid');

  // Panel container
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.index = index;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', `Terminal ${index + 1}`);

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  nameSpan.textContent = character ? character.name : `Terminal ${index + 1}`;

  // Apply preset color to header and panel
  const presetColor = (character && character.color) ? getDisplayColor(character.color) : '';
  if (presetColor) {
    header.style.setProperty('--panel-color', presetColor);
    panel.style.setProperty('--panel-color', presetColor);
  }

  const rightGroup = document.createElement('span');
  rightGroup.className = 'panel-header-right';
  const indexSpan = document.createElement('span');
  indexSpan.className = 'index';
  indexSpan.textContent = index < 9 ? `\u2318${index + 1}` : '';

  // ... menu button
  const menuBtn = document.createElement('button');
  menuBtn.className = 'panel-menu-btn';
  menuBtn.textContent = '···';
  menuBtn.setAttribute('aria-label', 'Panel options');
  menuBtn.setAttribute('aria-haspopup', 'menu');
  menuBtn.setAttribute('draggable', 'false');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanelPresetMenu(index, menuBtn);
  });

  rightGroup.appendChild(indexSpan);
  rightGroup.appendChild(menuBtn);
  header.appendChild(nameSpan);
  header.appendChild(rightGroup);
  panel.appendChild(header);

  // Setup drag and drop on header
  setupDragAndDrop(header, index);

  // Terminal wrap
  const termWrap = document.createElement('div');
  termWrap.className = 'terminal-wrap';

  // Character overlay
  const overlay = document.createElement('div');
  overlay.className = 'character-overlay';
  overlay.style.opacity = config.defaultOpacity || DEFAULT_OPACITY;

  if (character && character.image) {
    const dataUrl = presetImageCache[character.image] || await ipcRenderer.invoke('load-image', character.image);
    if (dataUrl) {
      presetImageCache[character.image] = dataUrl;
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = character.name;
      overlay.appendChild(img);
    }
  }

  termWrap.appendChild(overlay);

  // Show onboarding hint on first panel when no presets exist
  if (index === 0 && presets.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'onboarding-hint';
    hint.innerHTML = '<p>Click <span class="key">···</span> to assign a character preset</p>';
    termWrap.appendChild(hint);
  }

  panel.appendChild(termWrap);
  grid.appendChild(panel);

  // Click to focus
  panel.addEventListener('mousedown', () => {
    setActivePanel(index);
  });

  // Create xterm with current theme + preset cursor color
  const termThemeNow = currentTheme === 'light' ? LIGHT_TERM_THEME : DARK_TERM_THEME;
  const presetCursorColor = (character && character.color) ? getDisplayColor(character.color) : null;
  const termThemeInit = presetCursorColor ? { ...termThemeNow, cursor: presetCursorColor } : { ...termThemeNow };
  const term = new Terminal({ ...TERM_OPTIONS, theme: termThemeInit });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(termWrap);

  // Force viewport background to match theme
  const viewport = termWrap.querySelector('.xterm-viewport');
  if (viewport) viewport.style.backgroundColor = termThemeNow.background;

  const ptyId = `pty-${index}`;

  const panelData = {
    index,
    panel,
    term,
    fitAddon,
    overlay,
    character,
    ptyId
  };

  panels.push(panelData);

  // Fit after DOM update
  requestAnimationFrame(() => {
    try { fitAddon.fit(); } catch(e) {}
  });

  // Terminal input -> PTY
  term.onData(data => {
    ipcRenderer.send('pty-write', { id: ptyId, data });
  });

  // Terminal resize -> PTY
  term.onResize(({ cols, rows }) => {
    ipcRenderer.send('pty-resize', { id: ptyId, cols, rows });
  });

  // Create PTY
  const shellOverride = character ? character.shell : null;
  try {
    await ipcRenderer.invoke('create-pty', { id: ptyId, shellOverride, cwd });
  } catch (e) {
    term.writeln(`\x1b[31mFailed to create terminal: ${e.message}\x1b[0m`);
  }

  return panelData;
}

function setActivePanel(index) {
  if (index < 0 || index >= panels.length) return;

  const oldActive = panels[activeIndex];
  if (oldActive) {
    oldActive.panel.classList.remove('active');
    if (oldActive.overlay) {
      oldActive.overlay.style.opacity = config.defaultOpacity || DEFAULT_OPACITY;
    }
  }

  activeIndex = index;
  const newActive = panels[activeIndex];
  newActive.panel.classList.add('active');
  if (newActive.overlay) {
    newActive.overlay.style.opacity = config.activeOpacity || ACTIVE_OPACITY;
  }
  newActive.term.focus();
  updateStatusBar();
}

// PTY data -> Terminal
ipcRenderer.on('pty-data', (event, { id, data }) => {
  const panel = panels.find(p => p.ptyId === id);
  if (panel) {
    panel.term.write(data);
  }
});

// PTY exit
ipcRenderer.on('pty-exit', (event, { id, exitCode }) => {
  const panel = panels.find(p => p.ptyId === id);
  if (panel) {
    panel.term.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`);
  }
});

// Focus panel by index (Cmd+1~9)
ipcRenderer.on('focus-panel', (event, index) => {
  setActivePanel(index);
});

// Focus direction (Cmd+Arrow)
ipcRenderer.on('focus-direction', (event, dir) => {
  const row = Math.floor(activeIndex / gridCols);
  const col = activeIndex % gridCols;
  let newRow = row;
  let newCol = col;

  switch (dir) {
    case 'up':    newRow = (row - 1 + gridRows) % gridRows; break;
    case 'down':  newRow = (row + 1) % gridRows; break;
    case 'left':  newCol = (col - 1 + gridCols) % gridCols; break;
    case 'right': newCol = (col + 1) % gridCols; break;
  }

  const newIndex = newRow * gridCols + newCol;
  if (newIndex < panels.length) {
    setActivePanel(newIndex);
  }
});

// Toggle fullscreen (Cmd+Enter)
ipcRenderer.on('toggle-fullscreen', () => {
  if (fullscreenIndex >= 0) {
    exitFullscreen();
  } else {
    fullscreenIndex = activeIndex;
    panels[fullscreenIndex].panel.classList.add('fullscreen');
    panels.forEach(p => {
      if (p.index !== fullscreenIndex) p.panel.style.display = 'none';
    });
  }
  setTimeout(() => {
    panels.forEach(p => { try { p.fitAddon.fit(); } catch(e) {} });
  }, 50);
});

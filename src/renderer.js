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

const TERM_OPTIONS = {
  fontSize: 13,
  fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
  theme: {
    background: '#0d0d14',
    foreground: '#c8c8d0',
    cursor: '#00d4ff',
    cursorAccent: '#0d0d14',
    selectionBackground: 'rgba(0, 212, 255, 0.2)',
    black: '#0d0d14',
    red: '#ff5555',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#60a5fa',
    magenta: '#a78bfa',
    cyan: '#00d4ff',
    white: '#c8c8d0',
    brightBlack: '#555555',
    brightRed: '#ff6e6e',
    brightGreen: '#69db7c',
    brightYellow: '#fdd835',
    brightBlue: '#74b9ff',
    brightMagenta: '#b794f6',
    brightCyan: '#22d3ee',
    brightWhite: '#e0e0e8'
  },
  allowTransparency: true,
  cursorBlink: true,
  scrollback: 5000
};

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
      el.addEventListener('click', (e) => { e.stopPropagation(); closeAllDropdowns(); item.action(); });
      dd.appendChild(el);
      return;
    }
    const el = document.createElement('div');
    el.className = 'dropdown-item' + (item.active ? ' active' : '');

    if (item.check !== undefined) {
      const check = document.createElement('span');
      check.className = 'check';
      check.textContent = item.check ? '✓' : '';
      el.appendChild(check);
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

  // Clamp to viewport
  requestAnimationFrame(() => {
    const ddRect = dd.getBoundingClientRect();
    if (ddRect.right > window.innerWidth) {
      dd.style.left = `${window.innerWidth - ddRect.width - 8}px`;
    }
    if (ddRect.bottom > window.innerHeight) {
      dd.style.top = `${rect.top - ddRect.height - 4}px`;
    }
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
  info.innerHTML = `<span style="color:#00d4ff">${gridRows} × ${gridCols}</span>`;

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
      info.innerHTML = `<span style="color:#00d4ff">${rows} × ${cols}</span>  ·  ${rows * cols} agents`;
    } else {
      info.innerHTML = `<span style="color:#00d4ff">${gridRows} × ${gridCols}</span>`;
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
    const ok = confirm(`This will close ${removing} terminal(s) and kill their processes. Continue?`);
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
  document.getElementById('status-right').textContent =
    `${panels.length}/${panels.length} active  |  tgrid v0.1.0`;
}

// ── Modal helpers ──

function showPresetModal(preset, onSave, onDelete) {
  const isNew = !preset;
  const data = preset ? { ...preset } : { id: null, name: '', image: '', shell: '' };
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
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Delete preset "${data.name}"?`)) {
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
      onEdit: () => openPresetEditor(p),
      onClick: () => {}
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
      onClick: () => assignPresetToPanel(panelIndex, p.id)
    });
  }

  createDropdown(anchorEl, items);
}

async function assignPresetToPanel(panelIndex, presetId) {
  assignments = await ipcRenderer.invoke('set-assignment', { panelIndex, presetId });
  await updatePanelPreset(panelIndex);
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

  // Update opacity
  const isActive = panelIndex === activeIndex;
  panel.overlay.style.opacity = isActive ? (config.activeOpacity || 0.18) : (config.defaultOpacity || 0.12);
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
  const sourcePresetId = assignments[String(sourceIndex)] || null;
  const targetPresetId = assignments[String(targetIndex)] || null;

  // Swap in local state
  if (targetPresetId) assignments[String(sourceIndex)] = targetPresetId;
  else delete assignments[String(sourceIndex)];

  if (sourcePresetId) assignments[String(targetIndex)] = sourcePresetId;
  else delete assignments[String(targetIndex)];

  // Persist both in a single IPC call to avoid a partial-update window
  await ipcRenderer.invoke('swap-assignments', {
    indexA: sourceIndex, presetIdA: targetPresetId,
    indexB: targetIndex, presetIdB: sourcePresetId
  });

  // Update visuals
  updatePanelPreset(sourceIndex);
  updatePanelPreset(targetIndex);
}

// ── Grid Picker IPC ──

ipcRenderer.on('show-grid-picker', (event, data) => {
  config = data.config;
  presets = config.presets || [];
  assignments = config.assignments || {};

  showGridPicker(data.lastGrid, async (rows, cols) => {
    await ipcRenderer.invoke('grid-selected', { rows, cols });
  });
});

// ── Session Restore ──

ipcRenderer.on('restore-session', async (event, data) => {
  config = data.config;
  presets = config.presets || [];

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
  updateStatusBar();

  // Persist updated assignments back to config
  await ipcRenderer.invoke('restore-assignments', {
    assignments,
    grid: { rows: gridRows, cols: gridCols }
  });

  // Handle window resize
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
});

// ── Init ──

ipcRenderer.on('init', async (event, data) => {
  gridRows = data.rows;
  gridCols = data.cols;
  config = data.config;
  presets = config.presets || [];
  assignments = config.assignments || {};

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
  updateStatusBar();

  // Handle window resize
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
});

async function createPanel(index, character, cwd = null) {
  const grid = document.getElementById('grid');

  // Panel container
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.index = index;

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  nameSpan.textContent = character ? character.name : `Terminal ${index + 1}`;
  const rightGroup = document.createElement('span');
  rightGroup.style.cssText = 'display:flex;align-items:center;gap:2px;';
  const indexSpan = document.createElement('span');
  indexSpan.className = 'index';
  indexSpan.textContent = index < 9 ? `\u2318${index + 1}` : '';

  // ... menu button
  const menuBtn = document.createElement('button');
  menuBtn.className = 'panel-menu-btn';
  menuBtn.textContent = '···';
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
  overlay.style.opacity = config.defaultOpacity || 0.12;

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
  panel.appendChild(termWrap);
  grid.appendChild(panel);

  // Click to focus
  panel.addEventListener('mousedown', () => {
    setActivePanel(index);
  });

  // Create xterm
  const term = new Terminal(TERM_OPTIONS);
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(termWrap);

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
      oldActive.overlay.style.opacity = config.defaultOpacity || 0.12;
    }
  }

  activeIndex = index;
  const newActive = panels[activeIndex];
  newActive.panel.classList.add('active');
  if (newActive.overlay) {
    newActive.overlay.style.opacity = config.activeOpacity || 0.18;
  }
  newActive.term.focus();
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

const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const pty = require('node-pty');

// Parse CLI args: tgrid <rows> <cols>
// Returns null if no args (show grid picker), or { rows, cols } if valid args
function parseGridArgs() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (args.length === 0) return null; // No args → show grid picker
  if (args.length < 2) {
    console.error('Usage: tgrid <rows> <cols>');
    process.exit(1);
  }
  const rows = parseInt(args[0], 10);
  const cols = parseInt(args[1], 10);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    console.error('Usage: tgrid <rows> <cols> (positive integers)');
    process.exit(1);
  }
  return { rows, cols };
}

const gridConfig = parseGridArgs();

// Config management
const CONFIG_DIR = path.join(os.homedir(), '.tgrid');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');

function generatePresetId(name, existingIds) {
  let base = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!base) base = 'preset';
  let id = base;
  let counter = 2;
  while (existingIds.has(id)) {
    id = `${base}-${counter}`;
    counter++;
  }
  return id;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      defaultShell: process.env.SHELL || '/bin/zsh',
      defaultOpacity: 0.12,
      activeOpacity: 0.18,
      presets: [],
      assignments: {}
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

  if (!config.presets) config.presets = [];
  if (!config.assignments) config.assignments = {};

  return config;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Session management

function getPtyCwd(pid) {
  try {
    const output = execSync(`lsof -p ${pid} -Fn 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 2000
    });
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === 'fcwd' && lines[i + 1] && lines[i + 1].startsWith('n')) {
        return lines[i + 1].slice(1);
      }
    }
  } catch (e) {}
  return null;
}

function saveSession() {
  const config = loadConfig();
  const panelData = [];

  for (const [id, p] of ptys) {
    const index = parseInt(id.replace('pty-', ''));
    const cwd = getPtyCwd(p.pid) || os.homedir();
    const presetId = (config.assignments && config.assignments[String(index)]) || null;
    panelData.push({ index, presetId, cwd });
  }

  panelData.sort((a, b) => a.index - b.index);

  const session = {
    grid: config.lastGrid || { rows: 2, cols: 2 },
    panels: panelData,
    savedAt: new Date().toISOString()
  };

  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function loadSession() {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    if (!session.grid || !Array.isArray(session.panels)) return null;
    if (!session.grid.rows || !session.grid.cols) return null;
    session.panels.forEach(p => {
      if (!p.cwd || !fs.existsSync(p.cwd)) {
        p.cwd = os.homedir();
      }
    });
    return session;
  } catch (e) {
    return null;
  }
}

// PTY management
const ptys = new Map();

function resolveShell(shellName, defaultShell) {
  if (!shellName) return defaultShell;
  // Absolute path
  if (path.isAbsolute(shellName)) {
    return fs.existsSync(shellName) ? shellName : defaultShell;
  }
  // Try to find in PATH
  const pathDirs = (process.env.PATH || '').split(':');
  for (const dir of pathDirs) {
    const fullPath = path.join(dir, shellName);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return defaultShell;
}

function expandTilde(p) {
  if (p && p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

let mainWindow = null;

function createWindow() {
  const config = loadConfig();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (gridConfig) {
      // CLI args provided → bypass everything
      config.lastGrid = { rows: gridConfig.rows, cols: gridConfig.cols };
      saveConfig(config);
      mainWindow.webContents.send('init', {
        rows: gridConfig.rows,
        cols: gridConfig.cols,
        config,
        sessionPanels: null
      });
    } else {
      const session = loadSession();
      if (session) {
        // Session exists → send to renderer for restore (or Shift bypass)
        mainWindow.webContents.send('restore-session', {
          session,
          config
        });
      } else {
        // No session → show grid picker (first launch)
        const lastGrid = config.lastGrid || { rows: 2, cols: 2 };
        mainWindow.webContents.send('show-grid-picker', {
          lastGrid,
          config
        });
      }
    }
  });

  // Register Cmd+number shortcuts for panel focus
  for (let i = 1; i <= 9; i++) {
    globalShortcut.register(`CommandOrControl+${i}`, () => {
      mainWindow.webContents.send('focus-panel', i - 1);
    });
  }

  // Cmd+Arrow for directional focus
  ['Up', 'Down', 'Left', 'Right'].forEach(dir => {
    globalShortcut.register(`CommandOrControl+${dir}`, () => {
      mainWindow.webContents.send('focus-direction', dir.toLowerCase());
    });
  });

  // Cmd+Enter for fullscreen toggle
  globalShortcut.register('CommandOrControl+Return', () => {
    mainWindow.webContents.send('toggle-fullscreen');
  });

  mainWindow.on('close', () => {
    // Save session before window closes (PTYs still alive here)
    try { saveSession(); } catch (e) {}
  });

  mainWindow.on('closed', () => {
    // Kill all PTYs
    for (const [id, p] of ptys) {
      p.kill();
    }
    ptys.clear();
    mainWindow = null;
  });
}

// IPC: Create PTY
ipcMain.handle('create-pty', (event, { id, shellOverride, cwd }) => {
  const config = loadConfig();
  const shell = resolveShell(shellOverride, config.defaultShell || process.env.SHELL || '/bin/zsh');

  let startDir = cwd || os.homedir();
  if (!fs.existsSync(startDir)) startDir = os.homedir();

  const p = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: startDir,
    env: { ...process.env, TERM: 'xterm-256color' }
  });

  ptys.set(id, p);

  p.onData(data => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty-data', { id, data });
    }
  });

  p.onExit(({ exitCode }) => {
    ptys.delete(id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty-exit', { id, exitCode });
    }
  });

  return { id, shell };
});

// IPC: Write to PTY
ipcMain.on('pty-write', (event, { id, data }) => {
  const p = ptys.get(id);
  if (p) p.write(data);
});

// IPC: Resize PTY
ipcMain.on('pty-resize', (event, { id, cols, rows }) => {
  const p = ptys.get(id);
  if (p) {
    try {
      p.resize(cols, rows);
    } catch (e) {
      // Ignore resize errors
    }
  }
});

// IPC: Kill PTY
ipcMain.on('pty-kill', (event, { id }) => {
  const p = ptys.get(id);
  if (p) {
    p.kill();
    ptys.delete(id);
  }
});

// IPC: Load character image as data URL
ipcMain.handle('load-image', async (event, imagePath) => {
  const resolved = expandTilde(imagePath);
  if (!fs.existsSync(resolved)) return null;
  const ext = path.extname(resolved).toLowerCase();
  const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  const mime = mimeMap[ext] || 'image/png';
  const data = fs.readFileSync(resolved);
  return `data:${mime};base64,${data.toString('base64')}`;
});

// IPC: Grid selected from picker
ipcMain.handle('grid-selected', (event, { rows, cols }) => {
  const config = loadConfig();
  config.lastGrid = { rows, cols };
  saveConfig(config);
  mainWindow.webContents.send('init', { rows, cols, config });
  return { rows, cols };
});

// IPC: Resize grid at runtime
ipcMain.handle('resize-grid', (event, { rows, cols }) => {
  const config = loadConfig();
  const oldTotal = Object.keys(ptys).length;
  const newTotal = rows * cols;
  const removedIds = [];

  // Kill PTYs for panels that will be removed
  if (newTotal < oldTotal) {
    for (let i = newTotal; i < oldTotal; i++) {
      const id = `pty-${i}`;
      const p = ptys.get(id);
      if (p) {
        p.kill();
        ptys.delete(id);
      }
      removedIds.push(id);
      // Clean up assignments for removed indices
      delete config.assignments[String(i)];
    }
  }

  config.lastGrid = { rows, cols };
  saveConfig(config);
  return { removedIds };
});

// IPC: Swap assignments (atomic — both written in one save)
ipcMain.handle('swap-assignments', (event, { indexA, presetIdA, indexB, presetIdB }) => {
  const config = loadConfig();
  if (presetIdA) config.assignments[String(indexA)] = presetIdA;
  else delete config.assignments[String(indexA)];
  if (presetIdB) config.assignments[String(indexB)] = presetIdB;
  else delete config.assignments[String(indexB)];
  saveConfig(config);
  return config.assignments;
});

// IPC: Get presets list
ipcMain.handle('get-presets', () => {
  const config = loadConfig();
  return config.presets || [];
});

// IPC: Save (upsert) a preset
ipcMain.handle('save-preset', (event, preset) => {
  const config = loadConfig();
  const existingIndex = config.presets.findIndex(p => p.id === preset.id);
  if (existingIndex >= 0) {
    config.presets[existingIndex] = { ...config.presets[existingIndex], ...preset };
  } else {
    const existingIds = new Set(config.presets.map(p => p.id));
    if (!preset.id) {
      preset.id = generatePresetId(preset.name || 'preset', existingIds);
    }
    config.presets.push(preset);
  }
  saveConfig(config);
  return config.presets;
});

// IPC: Delete a preset
ipcMain.handle('delete-preset', (event, id) => {
  const config = loadConfig();
  config.presets = config.presets.filter(p => p.id !== id);
  // Unassign from all panels
  for (const [panelIdx, presetId] of Object.entries(config.assignments)) {
    if (presetId === id) delete config.assignments[panelIdx];
  }
  saveConfig(config);
  return { presets: config.presets, assignments: config.assignments };
});

// IPC: Pick image via native dialog
ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Character Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;

  const src = result.filePaths[0];
  const ext = path.extname(src);
  const destName = `${Date.now()}${ext}`;
  const charDir = path.join(CONFIG_DIR, 'characters');
  const dest = path.join(charDir, destName);

  fs.mkdirSync(charDir, { recursive: true });
  fs.copyFileSync(src, dest);

  return `~/.tgrid/characters/${destName}`;
});

// IPC: Get panel assignments
ipcMain.handle('get-assignments', () => {
  const config = loadConfig();
  return config.assignments || {};
});

// IPC: Restore assignments from session
ipcMain.handle('restore-assignments', (event, { assignments, grid }) => {
  const config = loadConfig();
  config.assignments = assignments;
  config.lastGrid = grid;
  saveConfig(config);
  return config.assignments;
});

// IPC: Set panel assignment
ipcMain.handle('set-assignment', (event, { panelIndex, presetId }) => {
  const config = loadConfig();
  if (presetId === null) {
    delete config.assignments[String(panelIndex)];
  } else {
    config.assignments[String(panelIndex)] = presetId;
  }
  saveConfig(config);
  return config.assignments;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  for (const [id, p] of ptys) {
    p.kill();
  }
});

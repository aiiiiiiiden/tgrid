import { app, BrowserWindow, ipcMain, globalShortcut, nativeImage } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  loadConfig,
  saveConfig,
  loadSession,
  saveSession,
  generatePresetId,
} from './config';
import {
  getPtys,
  resolveShell,
  getPtyCwd,
  createPty,
  writePty,
  resizePty,
  killPty,
  killAllPtys,
  setTheme as setPtyTheme,
} from './pty-manager';
import fs from 'node:fs';
import { loadImage, pickImage } from './image-loader';
import { CONFIG_DIR } from './config';
import type { Preset } from '../shared/types';

if (started) {
  app.quit();
}

app.setName('tgrid');

// Icon path: __dirname is .vite/build/ in dev, project root in packaged builds
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(__dirname, '..', '..', 'resources', 'icon.png');

// macOS dock icon (dev mode only, packaged builds use .icns from packagerConfig)
app.setAboutPanelOptions({
  applicationName: 'tgrid',
  iconPath,
});

if (!app.isPackaged && process.platform === 'darwin') {
  app.whenReady().then(() => {
    app.dock?.setIcon(nativeImage.createFromPath(iconPath));
  });
}

// Parse CLI args: tgrid <rows> <cols>
function parseGridArgs(): { rows: number; cols: number } | null {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (args.length === 0) return null;
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
let mainWindow: BrowserWindow | null = null;

function sendToRenderer(channel: string, data?: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function createWindow(): void {
  const config = loadConfig();
  setPtyTheme(config.theme || 'dark');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 600,
    minHeight: 400,
    icon: iconPath,
    backgroundColor: config.theme === 'light' ? '#ebebeb' : '#0e0e0e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const loadContent = async () => {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      for (let i = 0; i < 20; i++) {
        try {
          await mainWindow!.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      console.error('Failed to connect to Vite dev server after retries');
    } else {
      mainWindow!.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    }
  };

  loadContent();

  mainWindow.webContents.on('did-finish-load', () => {
    if (gridConfig) {
      config.lastGrid = { rows: gridConfig.rows, cols: gridConfig.cols };
      saveConfig(config);
      sendToRenderer('init', {
        rows: gridConfig.rows,
        cols: gridConfig.cols,
        config,
        sessionPanels: null,
      });
    } else {
      const session = loadSession();
      if (session) {
        sendToRenderer('restore-session', { session, config });
      } else {
        const lastGrid = config.lastGrid || { rows: 2, cols: 2 };
        sendToRenderer('show-grid-picker', { lastGrid, config });
      }
    }
  });

  function registerShortcuts() {
    for (let i = 1; i <= 9; i++) {
      globalShortcut.register(`CommandOrControl+${i}`, () => {
        sendToRenderer('focus-panel', i - 1);
      });
    }
    (['Up', 'Down', 'Left', 'Right'] as const).forEach((dir) => {
      globalShortcut.register(`CommandOrControl+${dir}`, () => {
        sendToRenderer('focus-direction', dir.toLowerCase());
      });
    });
    globalShortcut.register('CommandOrControl+Return', () => {
      sendToRenderer('toggle-fullscreen');
    });
  }

  registerShortcuts();
  mainWindow.on('focus', registerShortcuts);
  mainWindow.on('blur', () => globalShortcut.unregisterAll());

  mainWindow.on('close', () => {
    try {
      saveSession(getPtys(), getPtyCwd);
    } catch {
      // Best-effort session save
    }
  });

  mainWindow.on('closed', () => {
    killAllPtys();
    mainWindow = null;
  });
}

// ── IPC Handlers ──

// PTY
ipcMain.handle('create-pty', (_event, { id, shellOverride, cwd }) => {
  const config = loadConfig();
  const shell = resolveShell(
    shellOverride,
    config.defaultShell || process.env.SHELL || '/bin/zsh',
  );
  return createPty(id, shell, cwd, mainWindow);
});

ipcMain.on('pty-write', (_event, { id, data }) => {
  writePty(id, data);
});

ipcMain.on('pty-resize', (_event, { id, cols, rows }) => {
  resizePty(id, cols, rows);
});


// Images
ipcMain.handle('load-image', (_event, imagePath: string) => {
  return loadImage(imagePath);
});

ipcMain.handle('pick-image', async () => {
  if (!mainWindow) return null;
  return pickImage(mainWindow);
});

// Grid
ipcMain.handle('grid-selected', (_event, { rows, cols }) => {
  const config = loadConfig();
  config.lastGrid = { rows, cols };
  saveConfig(config);
  mainWindow!.webContents.send('init', { rows, cols, config });
  return { rows, cols };
});

ipcMain.handle('resize-grid', (_event, { rows, cols, killPtyIds, assignments }) => {
  const config = loadConfig();

  for (const id of killPtyIds) {
    killPty(id);
  }

  config.assignments = assignments;
  config.lastGrid = { rows, cols };
  saveConfig(config);
});

// Presets
ipcMain.handle('get-presets', () => {
  const config = loadConfig();
  return config.presets || [];
});

ipcMain.handle('save-preset', (_event, preset: Preset) => {
  const config = loadConfig();
  const existingIndex = config.presets.findIndex((p) => p.id === preset.id);
  if (preset.color === undefined) preset.color = null;
  if (existingIndex >= 0) {
    config.presets[existingIndex] = { ...config.presets[existingIndex], ...preset };
  } else {
    const existingIds = new Set(config.presets.map((p) => p.id));
    if (!preset.id) {
      preset.id = generatePresetId(preset.name || 'preset', existingIds);
    }
    config.presets.push(preset);
  }
  saveConfig(config);
  return config.presets;
});

ipcMain.handle('delete-preset', (_event, id: string) => {
  const config = loadConfig();
  config.presets = config.presets.filter((p) => p.id !== id);
  for (const [panelIdx, presetId] of Object.entries(config.assignments)) {
    if (presetId === id) delete config.assignments[panelIdx];
  }
  saveConfig(config);
  return { presets: config.presets, assignments: config.assignments };
});

// Assignments
ipcMain.handle('get-assignments', () => {
  const config = loadConfig();
  return config.assignments || {};
});

ipcMain.handle('set-assignment', (_event, { panelIndex, presetId }) => {
  const config = loadConfig();
  if (presetId === null) {
    delete config.assignments[String(panelIndex)];
  } else {
    config.assignments[String(panelIndex)] = presetId;
  }
  saveConfig(config);
  return config.assignments;
});

ipcMain.handle('swap-assignments', (_event, { indexA, presetIdA, indexB, presetIdB }) => {
  const config = loadConfig();
  if (presetIdA) config.assignments[String(indexA)] = presetIdA;
  else delete config.assignments[String(indexA)];
  if (presetIdB) config.assignments[String(indexB)] = presetIdB;
  else delete config.assignments[String(indexB)];
  saveConfig(config);
  return config.assignments;
});

ipcMain.handle('restore-assignments', (_event, { assignments, grid }) => {
  const config = loadConfig();
  config.assignments = assignments;
  config.lastGrid = grid;
  saveConfig(config);
  return config.assignments;
});

// Theme
ipcMain.handle('set-theme', (_event, theme: 'dark' | 'light') => {
  const config = loadConfig();
  config.theme = theme;
  saveConfig(config);
  setPtyTheme(theme);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(theme === 'light' ? '#ebebeb' : '#0e0e0e');
  }
  return theme;
});

// Preset packs
interface PresetPackEntry {
  name: string;
  color: string | null;
  filename: string; // relative to resources/presets/{packName}/
}

const PRESET_PACKS: Record<string, PresetPackEntry[]> = {
  'harry-potter': [
    { name: 'Gryffindor', color: '#dc2626', filename: 'Gryffindor.webp' },
    { name: 'Slytherin', color: '#15803d', filename: 'Slytherin.webp' },
    { name: 'Ravenclaw', color: '#2563eb', filename: 'Ravenclaw.webp' },
    { name: 'Hufflepuff', color: '#ca8a04', filename: 'Hufflepuff.webp' },
  ],
};

ipcMain.handle('install-preset-pack', (_event, packName: string) => {
  const pack = PRESET_PACKS[packName];
  if (!pack) throw new Error(`Unknown preset pack: ${packName}`);

  const config = loadConfig();
  const existingIds = new Set(config.presets.map((p) => p.id));

  const presetsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'presets', packName)
    : path.join(__dirname, '..', '..', 'resources', 'presets', packName);

  const charDir = path.join(CONFIG_DIR, 'characters');
  fs.mkdirSync(charDir, { recursive: true });

  for (const entry of pack) {
    if (config.presets.some((p) => p.name === entry.name)) continue; // skip duplicates by name

    const id = generatePresetId(entry.name, existingIds);
    const ext = path.extname(entry.filename);

    const src = path.join(presetsDir, entry.filename);
    const dest = path.join(charDir, `${id}${ext}`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }

    const preset: Preset = {
      id,
      name: entry.name,
      color: entry.color,
      image: `~/.tgrid/characters/${id}${ext}`,
    };
    config.presets.push(preset);
    existingIds.add(id);
  }

  saveConfig(config);
  return config.presets;
});

// ── App lifecycle ──

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  killAllPtys();
});

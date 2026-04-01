import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { TGridConfig, SessionData, SessionPanel } from '../shared/types';

export const CONFIG_DIR = path.join(os.homedir(), '.tgrid');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');

export function generatePresetId(name: string, existingIds: Set<string>): string {
  let base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!base) base = 'preset';
  let id = base;
  let counter = 2;
  while (existingIds.has(id)) {
    id = `${base}-${counter}`;
    counter++;
  }
  return id;
}

export function loadConfig(): TGridConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig: TGridConfig = {
      defaultShell: process.env.SHELL || '/bin/zsh',
      defaultOpacity: 0.3,
      activeOpacity: 0.5,
      presets: [],
      assignments: {},
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  const config: TGridConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  if (!config.presets) config.presets = [];
  if (!config.assignments) config.assignments = {};
  return config;
}

export function saveConfig(config: TGridConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadSession(): SessionData | null {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const session: SessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    if (!session.grid || !Array.isArray(session.panels)) return null;
    if (!session.grid.rows || !session.grid.cols) return null;
    session.panels.forEach((p: SessionPanel) => {
      if (!p.cwd || !fs.existsSync(p.cwd)) {
        p.cwd = os.homedir();
      }
    });
    return session;
  } catch {
    return null;
  }
}

export function saveSession(
  ptys: Map<string, { pid: number }>,
  getPtyCwd: (pid: number) => string | null,
): void {
  const config = loadConfig();
  const panelData: SessionPanel[] = [];

  for (const [id, p] of ptys) {
    const index = parseInt(id.replace('pty-', ''));
    const cwd = getPtyCwd(p.pid) || os.homedir();
    const presetId = (config.assignments && config.assignments[String(index)]) || null;
    panelData.push({ index, presetId, cwd });
  }

  panelData.sort((a, b) => a.index - b.index);

  const session: SessionData = {
    grid: config.lastGrid || { rows: 2, cols: 2 },
    panels: panelData,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

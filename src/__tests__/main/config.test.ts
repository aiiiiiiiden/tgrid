import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// We need dynamic import because CONFIG_DIR is computed at module load time
// from os.homedir(), and we need to control it per-test via a temp directory.

let tmpDir: string;
let configDir: string;
let configFile: string;
let sessionFile: string;

// Module under test — imported dynamically after mock setup
let generatePresetId: typeof import('../../main/config').generatePresetId;
let loadConfig: typeof import('../../main/config').loadConfig;
let saveConfig: typeof import('../../main/config').saveConfig;
let loadSession: typeof import('../../main/config').loadSession;
let saveSession: typeof import('../../main/config').saveSession;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgrid-test-'));
  configDir = path.join(tmpDir, '.tgrid');
  configFile = path.join(configDir, 'config.json');
  sessionFile = path.join(configDir, 'session.json');

  // Mock os.homedir to return our temp dir
  vi.spyOn(os, 'homedir').mockReturnValue(tmpDir);

  // Clear module cache so CONFIG_DIR/CONFIG_FILE get recomputed
  vi.resetModules();
  const mod = await import('../../main/config');
  generatePresetId = mod.generatePresetId;
  loadConfig = mod.loadConfig;
  saveConfig = mod.saveConfig;
  loadSession = mod.loadSession;
  saveSession = mod.saveSession;
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('generatePresetId', () => {
  it('converts name to slug', () => {
    expect(generatePresetId('My Agent', new Set())).toBe('my-agent');
  });

  it('strips special characters', () => {
    expect(generatePresetId('Agent #1!', new Set())).toBe('agent-1');
  });

  it('deduplicates with counter', () => {
    const existing = new Set(['my-agent']);
    expect(generatePresetId('My Agent', existing)).toBe('my-agent-2');
  });

  it('increments counter past existing', () => {
    const existing = new Set(['my-agent', 'my-agent-2', 'my-agent-3']);
    expect(generatePresetId('My Agent', existing)).toBe('my-agent-4');
  });

  it('falls back to "preset" for empty name', () => {
    expect(generatePresetId('', new Set())).toBe('preset');
  });

  it('falls back to "preset" for all-special-chars name', () => {
    expect(generatePresetId('!!!', new Set())).toBe('preset');
  });
});

describe('loadConfig', () => {
  it('creates default config when none exists', () => {
    const config = loadConfig();
    expect(config.presets).toEqual([]);
    expect(config.assignments).toEqual({});
    expect(config.defaultOpacity).toBe(0.3);
    expect(config.activeOpacity).toBe(0.5);
  });

  it('creates config directory if missing', () => {
    loadConfig();
    expect(fs.existsSync(configDir)).toBe(true);
  });

  it('writes default config file to disk', () => {
    loadConfig();
    expect(fs.existsSync(configFile)).toBe(true);
  });

  it('reads existing config', () => {
    fs.mkdirSync(configDir, { recursive: true });
    const testConfig = {
      presets: [{ id: 'test', name: 'Test' }],
      assignments: { '0': 'test' },
    };
    fs.writeFileSync(configFile, JSON.stringify(testConfig));
    const config = loadConfig();
    expect(config.presets).toHaveLength(1);
    expect(config.assignments['0']).toBe('test');
  });

  it('adds missing presets/assignments arrays', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify({}));
    const config = loadConfig();
    expect(config.presets).toEqual([]);
    expect(config.assignments).toEqual({});
  });
});

describe('saveConfig', () => {
  it('writes config to disk', () => {
    fs.mkdirSync(configDir, { recursive: true });
    const config = { presets: [], assignments: {}, theme: 'dark' as const };
    saveConfig(config);
    const raw = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    expect(raw.theme).toBe('dark');
  });
});

describe('loadSession', () => {
  it('returns null when no session file', () => {
    expect(loadSession()).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(sessionFile, 'not json');
    expect(loadSession()).toBeNull();
  });

  it('returns null for missing grid', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify({ panels: [] }));
    expect(loadSession()).toBeNull();
  });

  it('returns null for missing panels array', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify({ grid: { rows: 2, cols: 2 } }));
    expect(loadSession()).toBeNull();
  });

  it('loads valid session', () => {
    fs.mkdirSync(configDir, { recursive: true });
    const session = {
      grid: { rows: 2, cols: 2 },
      panels: [{ index: 0, presetId: null, cwd: tmpDir }],
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(sessionFile, JSON.stringify(session));
    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.grid.rows).toBe(2);
  });

  it('replaces invalid cwd with homedir', () => {
    fs.mkdirSync(configDir, { recursive: true });
    const session = {
      grid: { rows: 1, cols: 1 },
      panels: [{ index: 0, presetId: null, cwd: '/nonexistent/path/zzz' }],
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(sessionFile, JSON.stringify(session));
    const loaded = loadSession();
    expect(loaded!.panels[0].cwd).toBe(tmpDir);
  });
});

describe('saveSession', () => {
  it('writes session data with PTY info', () => {
    // Need config to exist for saveSession
    fs.mkdirSync(configDir, { recursive: true });
    const config = { presets: [], assignments: { '0': 'agent-1' } };
    fs.writeFileSync(configFile, JSON.stringify(config));

    const ptys = new Map([['pty-0', { pid: 1234 }]]);
    const getCwd = (pid: number) => (pid === 1234 ? '/tmp' : null);

    saveSession(ptys, getCwd);

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    expect(session.grid).toBeDefined();
    expect(session.panels).toHaveLength(1);
    expect(session.panels[0].presetId).toBe('agent-1');
    expect(session.panels[0].cwd).toBe('/tmp');
    expect(session.savedAt).toBeDefined();
  });
});

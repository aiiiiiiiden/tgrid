import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import * as pty from 'node-pty';
import type { BrowserWindow } from 'electron';

const ptys = new Map<string, pty.IPty>();
let currentTheme: 'dark' | 'light' = 'dark';

// OSC 10 sets foreground, OSC 11 sets background color.
// CLI tools (vim, bat, delta, etc.) query OSC 11 to detect dark/light — no visible output in terminal.
const THEME_COLORS = {
  dark:  { fg: '#cccdcc', bg: '#141514' },
  light: { fg: '#3e3e3e', bg: '#fafafa' },
} as const;

export function setTheme(theme: 'dark' | 'light'): void {
  const changed = currentTheme !== theme;
  currentTheme = theme;
  if (changed) {
    const { fg, bg } = THEME_COLORS[theme];
    for (const [, p] of ptys) {
      try {
        p.write(`\x1b]10;${fg}\x07\x1b]11;${bg}\x07`);
      } catch { /* PTY may have exited */ }
    }
  }
}

export function getPtys(): Map<string, pty.IPty> {
  return ptys;
}

export function resolveShell(shellName: string | undefined, defaultShell: string): string {
  if (!shellName) return defaultShell;
  if (path.isAbsolute(shellName)) {
    return fs.existsSync(shellName) ? shellName : defaultShell;
  }
  const pathDirs = (process.env.PATH || '').split(':');
  for (const dir of pathDirs) {
    const fullPath = path.join(dir, shellName);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return defaultShell;
}

export function getPtyCwd(pid: number): string | null {
  try {
    if (process.platform === 'darwin') {
      const output = execSync(`lsof -p ${pid} -Fn 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 2000,
      });
      const lines = output.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === 'fcwd' && lines[i + 1] && lines[i + 1].startsWith('n')) {
          return lines[i + 1].slice(1);
        }
      }
    } else if (process.platform === 'linux') {
      return fs.readlinkSync(`/proc/${pid}/cwd`, { encoding: 'utf-8' });
    }
  } catch {
    // Fall through to null
  }
  return null;
}

export function createPty(
  id: string,
  shell: string,
  cwd: string,
  mainWindow: BrowserWindow | null,
): { id: string; shell: string } {
  // Kill existing PTY with same id to handle re-creation (e.g., React StrictMode)
  const existing = ptys.get(id);
  if (existing) {
    existing.kill();
    ptys.delete(id);
  }

  let startDir = cwd || os.homedir();
  if (!fs.existsSync(startDir)) startDir = os.homedir();

  const env = { ...process.env } as Record<string, string>;
  env.TERM = 'xterm-256color';
  env.COLORFGBG = currentTheme === 'light' ? '0;15' : '15;0';
  env.TERM_BACKGROUND = currentTheme;

  // Ensure UTF-8 locale for CJK input (Korean, Japanese, Chinese)
  if (!env.LANG || !env.LANG.includes('UTF-8')) {
    env.LANG = 'en_US.UTF-8';
  }
  if (!env.LC_ALL) {
    env.LC_ALL = 'en_US.UTF-8';
  }

  const p = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: startDir,
    env,
  });

  ptys.set(id, p);

  p.onData((data: string) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty-data', { id, data });
      }
    } catch {
      // Window may have been destroyed between the check and the send
    }
  });

  p.onExit(({ exitCode }: { exitCode: number }) => {
    // Only notify for the current PTY — ignore exits from replaced instances (e.g., React StrictMode)
    if (ptys.get(id) !== p) return;
    ptys.delete(id);
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty-exit', { id, exitCode });
      }
    } catch {
      // Window may have been destroyed between the check and the send
    }
  });

  return { id, shell };
}

export function writePty(id: string, data: string): void {
  const p = ptys.get(id);
  if (!p) return;
  try {
    p.write(data);
  } catch {
    // PTY process may have exited between the map lookup and the write
  }
}

export function resizePty(id: string, cols: number, rows: number): void {
  const p = ptys.get(id);
  if (p) {
    try {
      p.resize(cols, rows);
    } catch {
      // Ignore resize errors
    }
  }
}

export function killPty(id: string): void {
  const p = ptys.get(id);
  if (p) {
    ptys.delete(id);
    try { p.kill(); } catch { /* already exited */ }
  }
}

export function killAllPtys(): void {
  for (const [, p] of ptys) {
    try { p.kill(); } catch { /* already exited */ }
  }
  ptys.clear();
}

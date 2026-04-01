import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import * as pty from 'node-pty';
import type { BrowserWindow } from 'electron';

const ptys = new Map<string, pty.IPty>();

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

  const p = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: startDir,
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
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
    if (ptys.get(id) === p) {
      ptys.delete(id);
    }
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

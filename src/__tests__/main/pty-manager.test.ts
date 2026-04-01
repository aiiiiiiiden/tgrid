import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';

// Mock node-pty
const mockPty = {
  pid: 12345,
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onExit: vi.fn().mockReturnValue({ dispose: vi.fn() }),
};

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({ ...mockPty })),
}));

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

import { resolveShell, writePty, resizePty, killPty, killAllPtys, createPty, getPtys } from '../../main/pty-manager';

describe('resolveShell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaultShell when shellName is undefined', () => {
    expect(resolveShell(undefined, '/bin/zsh')).toBe('/bin/zsh');
  });

  it('returns defaultShell when shellName is empty', () => {
    expect(resolveShell('', '/bin/zsh')).toBe('/bin/zsh');
  });

  it('returns absolute path if it exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    expect(resolveShell('/usr/local/bin/fish', '/bin/zsh')).toBe('/usr/local/bin/fish');
  });

  it('returns defaultShell for non-existent absolute path', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(resolveShell('/no/such/shell', '/bin/zsh')).toBe('/bin/zsh');
  });

  it('searches PATH for relative shell name', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p).endsWith('/fish');
    });
    const originalPath = process.env.PATH;
    process.env.PATH = '/usr/bin:/usr/local/bin';
    const result = resolveShell('fish', '/bin/zsh');
    expect(result).toBe('/usr/bin/fish');
    process.env.PATH = originalPath;
  });

  it('returns defaultShell when shell not found in PATH', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(resolveShell('nonexistent', '/bin/zsh')).toBe('/bin/zsh');
  });
});

describe('writePty', () => {
  it('does not throw for non-existent pty', () => {
    expect(() => writePty('pty-999', 'hello')).not.toThrow();
  });
});

describe('resizePty', () => {
  it('does not throw for non-existent pty', () => {
    expect(() => resizePty('pty-999', 80, 24)).not.toThrow();
  });
});

describe('killPty', () => {
  it('does not throw for non-existent pty', () => {
    expect(() => killPty('pty-999')).not.toThrow();
  });
});

describe('killAllPtys', () => {
  it('clears all ptys', () => {
    killAllPtys();
    expect(getPtys().size).toBe(0);
  });
});

describe('createPty', () => {
  const mockWindow = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: { send: vi.fn() },
  } as unknown as import('electron').BrowserWindow;

  beforeEach(() => {
    killAllPtys();
    vi.clearAllMocks();
  });

  it('returns id and shell', () => {
    const result = createPty('pty-0', '/bin/zsh', os.homedir(), mockWindow);
    expect(result).toEqual({ id: 'pty-0', shell: '/bin/zsh' });
  });

  it('adds pty to map', () => {
    createPty('pty-0', '/bin/zsh', os.homedir(), mockWindow);
    expect(getPtys().has('pty-0')).toBe(true);
  });

  it('replaces existing pty with same id', () => {
    createPty('pty-0', '/bin/zsh', os.homedir(), mockWindow);
    const first = getPtys().get('pty-0');
    createPty('pty-0', '/bin/zsh', os.homedir(), mockWindow);
    const second = getPtys().get('pty-0');
    expect(first).not.toBe(second);
  });

  it('falls back to homedir for non-existent cwd', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const result = createPty('pty-1', '/bin/zsh', '/no/such/dir', mockWindow);
    expect(result.id).toBe('pty-1');
  });
});

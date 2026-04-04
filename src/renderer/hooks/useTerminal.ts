import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const DARK_TERM_THEME = {
  background: '#141514',
  foreground: '#cccdcc',
  cursor: '#4ade80',
  cursorAccent: '#141514',
  selectionBackground: 'rgba(74, 222, 128, 0.2)',
  black: '#141514',
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
  brightWhite: '#e5e5e5',
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
  brightWhite: '#f2f2f2',
};

export function getTermTheme(theme: 'dark' | 'light') {
  return theme === 'light' ? LIGHT_TERM_THEME : DARK_TERM_THEME;
}

function hexToSelectionBg(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

interface UseTerminalOptions {
  ptyId: string;
  shell?: string;
  cwd?: string;
  theme: 'dark' | 'light';
  cursorColor?: string | null;
  onExit?: (exitCode: number) => void;
}

export function useTerminal(
  ref: RefObject<HTMLDivElement | null>,
  options: UseTerminalOptions,
): {
  terminal: Terminal | null;
  fitAddon: FitAddon | null;
  isReady: boolean;
  restart: () => void;
} {
  const [isReady, setIsReady] = useState(false);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const createdRef = useRef(false);
  const disposedRef = useRef(false);
  const fitDebounceRef = useRef(0);
  const ptyIdRef = useRef(options.ptyId);
  ptyIdRef.current = options.ptyId;
  const onExitRef = useRef(options.onExit);
  onExitRef.current = options.onExit;

  const debouncedFit = useCallback(() => {
    if (fitDebounceRef.current) return;
    fitDebounceRef.current = requestAnimationFrame(() => {
      fitDebounceRef.current = 0;
      try {
        fitAddonRef.current?.fit();
      } catch {
        // terminal may be disposed
      }
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || createdRef.current) return;
    createdRef.current = true;

    const termTheme = getTermTheme(options.theme);
    const cursorColor = options.cursorColor || termTheme.cursor;
    const selectionBg = options.cursorColor
      ? hexToSelectionBg(options.cursorColor, options.theme === 'light' ? 0.15 : 0.2)
      : termTheme.selectionBackground;

    const terminal = new Terminal({
      fontSize: 13,
      fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
      theme: { ...termTheme, cursor: cursorColor, selectionBackground: selectionBg },
      allowTransparency: true,
      cursorBlink: true,
      scrollback: 5000,
      overviewRuler: { width: 0 },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(el);

    // Force viewport background
    const viewport = el.querySelector('.xterm-viewport') as HTMLElement;
    if (viewport) viewport.style.backgroundColor = termTheme.background;

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    disposedRef.current = false;

    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // terminal may not be ready yet
      }
    });

    const observer = new ResizeObserver(debouncedFit);
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (fitDebounceRef.current) {
        cancelAnimationFrame(fitDebounceRef.current);
        fitDebounceRef.current = 0;
      }
      disposedRef.current = true;
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      createdRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-runs on ptyId change to rebind PTY after drag swap
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const ptyId = options.ptyId;

    // Terminal input -> PTY (use current ptyId via ref)
    const dataDisposable = terminal.onData((data) => {
      window.tgrid.send('pty-write', { id: ptyIdRef.current, data });
    });

    // Terminal resize -> PTY
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      window.tgrid.send('pty-resize', { id: ptyIdRef.current, cols, rows });
    });

    const unsubData = window.tgrid.on<'pty-data'>('pty-data', ({ id, data }) => {
      if (id === ptyIdRef.current && !disposedRef.current) {
        terminal.write(data);
      }
    });

    const unsubExit = window.tgrid.on<'pty-exit'>('pty-exit', ({ id, exitCode }) => {
      if (id === ptyIdRef.current && !disposedRef.current) {
        terminal.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`);
        onExitRef.current?.(exitCode);
      }
    });

    // Create PTY if not yet created (first mount only)
    if (!isReady) {
      window.tgrid
        .invoke('create-pty', {
          id: ptyId,
          shellOverride: options.shell,
          cwd: options.cwd,
        })
        .then(() => {
          setIsReady(true);
        })
        .catch((err: Error) => {
          terminal.writeln(`\x1b[31mFailed to create terminal: ${err.message}\x1b[0m`);
        });
    } else {
      // ptyId changed — sync terminal size with the PTY (no reset to preserve buffer)
      requestAnimationFrame(() => {
        const { cols, rows } = terminal;
        window.tgrid.send('pty-resize', { id: ptyId, cols, rows });
      });
    }

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      unsubData();
      unsubExit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.ptyId]);

  // Theme changes
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const termTheme = getTermTheme(options.theme);
    const cursorColor = options.cursorColor || termTheme.cursor;
    const selectionBg = options.cursorColor
      ? hexToSelectionBg(options.cursorColor, options.theme === 'light' ? 0.15 : 0.2)
      : termTheme.selectionBackground;
    terminal.options.theme = { ...termTheme, cursor: cursorColor, selectionBackground: selectionBg };
    const el = ref.current;
    if (el) {
      const viewport = el.querySelector('.xterm-viewport') as HTMLElement;
      if (viewport) viewport.style.backgroundColor = termTheme.background;
    }
    terminal.refresh(0, terminal.rows - 1);
  }, [options.theme, options.cursorColor, ref]);

  const restart = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal || disposedRef.current) return;
    const ptyId = ptyIdRef.current;
    window.tgrid
      .invoke('create-pty', {
        id: ptyId,
        shellOverride: options.shell,
        cwd: options.cwd,
      })
      .catch((err: Error) => {
        terminal.writeln(`\x1b[31mFailed to restart: ${err.message}\x1b[0m`);
      });
  }, [options.shell, options.cwd]);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  return {
    terminal: terminalRef.current,
    fitAddon: fitAddonRef.current,
    isReady,
    restart,
    focus,
  };
}

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { useTerminal } from '../hooks/useTerminal';

interface TerminalViewProps {
  ptyId: string;
  shell?: string;
  cwd?: string;
  theme: 'dark' | 'light';
  cursorColor?: string | null;
  onExit?: (exitCode: number) => void;
}

export interface TerminalViewHandle {
  restart: () => void;
  focus: () => void;
}

export default forwardRef<TerminalViewHandle, TerminalViewProps>(
  function TerminalView({ ptyId, shell, cwd, theme, cursorColor, onExit }, ref) {
    const termRef = useRef<HTMLDivElement>(null);

    const { restart, focus } = useTerminal(termRef, {
      ptyId,
      shell,
      cwd,
      theme,
      cursorColor,
      onExit,
    });

    useImperativeHandle(ref, () => ({ restart, focus }), [restart, focus]);

    return <div ref={termRef} className="terminal-container absolute inset-0 overflow-hidden" />;
  },
);

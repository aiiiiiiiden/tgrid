import React, { useRef } from 'react';
import { useTerminal } from '../hooks/useTerminal';

interface TerminalViewProps {
  ptyId: string;
  shell?: string;
  cwd?: string;
  theme: 'dark' | 'light';
  cursorColor?: string | null;
}

export default function TerminalView({ ptyId, shell, cwd, theme, cursorColor }: TerminalViewProps) {
  const termRef = useRef<HTMLDivElement>(null);

  useTerminal(termRef, {
    ptyId,
    shell,
    cwd,
    theme,
    cursorColor,
  });

  return <div ref={termRef} className="terminal-container" />;
}

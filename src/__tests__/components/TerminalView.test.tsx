import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import TerminalView from '../../renderer/components/TerminalView';

describe('TerminalView', () => {
  it('renders a div container with terminal-container class', () => {
    const { container } = render(
      <TerminalView ptyId="pty-0" theme="dark" />,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.tagName).toBe('DIV');
    expect(div.className).toContain('terminal-container');
  });

  it('renders without crashing with all props', () => {
    const { container } = render(
      <TerminalView
        ptyId="pty-5"
        shell="/bin/bash"
        cwd="/tmp"
        theme="light"
        cursorColor="#ff0000"
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});

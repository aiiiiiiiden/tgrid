import { describe, it, expect, vi } from 'vitest';
import { getTermTheme } from '../../renderer/hooks/useTerminal';

describe('getTermTheme', () => {
  it('returns dark theme for "dark"', () => {
    const theme = getTermTheme('dark');
    expect(theme.background).toBe('#141514');
    expect(theme.cursor).toBe('#4ade80');
  });

  it('returns light theme for "light"', () => {
    const theme = getTermTheme('light');
    expect(theme.background).toBe('#fafafa');
    expect(theme.cursor).toBe('#15803d');
  });

  it('dark theme has all required ANSI colors', () => {
    const theme = getTermTheme('dark');
    const required = [
      'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
      'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
      'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
    ];
    for (const key of required) {
      expect(theme).toHaveProperty(key);
      expect((theme as Record<string, string>)[key]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('light theme has all required ANSI colors', () => {
    const theme = getTermTheme('light');
    const required = [
      'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
      'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
      'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
    ];
    for (const key of required) {
      expect(theme).toHaveProperty(key);
      expect((theme as Record<string, string>)[key]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

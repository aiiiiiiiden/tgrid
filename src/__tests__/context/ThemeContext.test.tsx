import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '../../renderer/context/ThemeContext';
import { getMockTgrid } from '../setup';

function wrapper(initialTheme: 'dark' | 'light' = 'dark') {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>;
  };
}

describe('ThemeContext', () => {
  it('provides initial dark theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper('dark'),
    });
    expect(result.current.theme).toBe('dark');
  });

  it('provides initial light theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper('light'),
    });
    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme switches dark to light', async () => {
    const mock = getMockTgrid();
    mock.invoke.mockResolvedValue('light');

    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper('dark'),
    });
    await act(async () => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
    expect(mock.invoke).toHaveBeenCalledWith('set-theme', 'light');
  });

  it('toggleTheme switches light to dark', async () => {
    const mock = getMockTgrid();
    mock.invoke.mockResolvedValue('dark');

    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper('light'),
    });
    await act(async () => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(mock.invoke).toHaveBeenCalledWith('set-theme', 'dark');
  });

  it('sets data-theme attribute on document', () => {
    renderHook(() => useTheme(), { wrapper: wrapper('light') });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

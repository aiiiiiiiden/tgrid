import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  GridProvider,
  useGrid,
  useGridLayout,
  useGridSelection,
  usePresets,
} from '../../renderer/context/GridContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <GridProvider>{children}</GridProvider>;
}

describe('useGrid (composite)', () => {
  it('provides initial state', () => {
    const { result } = renderHook(() => useGrid(), { wrapper });
    expect(result.current.rows).toBe(0);
    expect(result.current.cols).toBe(0);
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.fullscreenIndex).toBe(-1);
    expect(result.current.presets).toEqual([]);
    expect(result.current.assignments).toEqual({});
  });
});

describe('useGridLayout', () => {
  it('provides initial rows/cols', () => {
    const { result } = renderHook(() => useGridLayout(), { wrapper });
    expect(result.current.rows).toBe(0);
    expect(result.current.cols).toBe(0);
  });

  it('setGrid updates rows and cols', () => {
    const { result } = renderHook(() => useGridLayout(), { wrapper });
    act(() => result.current.setGrid(3, 4));
    expect(result.current.rows).toBe(3);
    expect(result.current.cols).toBe(4);
  });
});

describe('useGridSelection', () => {
  it('provides initial selection state', () => {
    const { result } = renderHook(() => useGridSelection(), { wrapper });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.fullscreenIndex).toBe(-1);
  });

  it('setActiveIndex updates active panel', () => {
    const { result } = renderHook(() => useGridSelection(), { wrapper });
    act(() => result.current.setActiveIndex(5));
    expect(result.current.activeIndex).toBe(5);
  });

  it('setFullscreenIndex updates fullscreen state', () => {
    const { result } = renderHook(() => useGridSelection(), { wrapper });
    act(() => result.current.setFullscreenIndex(2));
    expect(result.current.fullscreenIndex).toBe(2);
    act(() => result.current.setFullscreenIndex(-1));
    expect(result.current.fullscreenIndex).toBe(-1);
  });
});

describe('usePresets', () => {
  it('provides initial preset state', () => {
    const { result } = renderHook(() => usePresets(), { wrapper });
    expect(result.current.presets).toEqual([]);
    expect(result.current.assignments).toEqual({});
  });

  it('setPresets updates presets', () => {
    const { result } = renderHook(() => usePresets(), { wrapper });
    const presets = [{ id: 'a', name: 'Agent A' }, { id: 'b', name: 'Agent B' }];
    act(() => result.current.setPresets(presets));
    expect(result.current.presets).toHaveLength(2);
    expect(result.current.presets[0].name).toBe('Agent A');
  });

  it('setAssignments updates assignments', () => {
    const { result } = renderHook(() => usePresets(), { wrapper });
    act(() => result.current.setAssignments({ '0': 'agent-a', '3': 'agent-b' }));
    expect(result.current.assignments['0']).toBe('agent-a');
    expect(result.current.assignments['3']).toBe('agent-b');
  });

  it('setConfig syncs presets and assignments from config', () => {
    const { result } = renderHook(() => usePresets(), { wrapper });
    act(() =>
      result.current.setConfig({
        presets: [{ id: 'x', name: 'X' }],
        assignments: { '0': 'x' },
        theme: 'light',
      }),
    );
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.assignments['0']).toBe('x');
    expect(result.current.config.theme).toBe('light');
  });

  it('cacheImage stores and getCachedImage retrieves', () => {
    const { result } = renderHook(() => usePresets(), { wrapper });
    act(() => result.current.cacheImage('/path/img.png', 'data:abc'));
    expect(result.current.getCachedImage('/path/img.png')).toBe('data:abc');
  });

  it('getCachedImage returns undefined for uncached', () => {
    const { result } = renderHook(() => usePresets(), { wrapper });
    expect(result.current.getCachedImage('/nonexistent')).toBeUndefined();
  });
});

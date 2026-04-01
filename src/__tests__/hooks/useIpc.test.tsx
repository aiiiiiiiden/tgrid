import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIpcEvent } from '../../renderer/hooks/useIpc';
import { getMockTgrid } from '../setup';

describe('useIpcEvent', () => {
  it('subscribes to channel on mount', () => {
    const handler = vi.fn();
    renderHook(() => useIpcEvent('focus-panel', handler, []));
    const mock = getMockTgrid();
    expect(mock.on).toHaveBeenCalledWith('focus-panel', expect.any(Function));
  });

  it('unsubscribes on unmount', () => {
    const unsub = vi.fn();
    const mock = getMockTgrid();
    mock.on.mockReturnValue(unsub);

    const handler = vi.fn();
    const { unmount } = renderHook(() => useIpcEvent('focus-panel', handler, []));
    unmount();
    expect(unsub).toHaveBeenCalled();
  });

  it('resubscribes when deps change', () => {
    const unsub = vi.fn();
    const mock = getMockTgrid();
    mock.on.mockReturnValue(unsub);

    const handler = vi.fn();
    let dep = 1;
    const { rerender } = renderHook(() => useIpcEvent('focus-panel', handler, [dep]));

    expect(mock.on).toHaveBeenCalledTimes(1);

    dep = 2;
    rerender();

    // Should unsub old and re-sub
    expect(unsub).toHaveBeenCalled();
    expect(mock.on).toHaveBeenCalledTimes(2);
  });
});

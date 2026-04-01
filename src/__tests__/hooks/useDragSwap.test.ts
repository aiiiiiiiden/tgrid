import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragSwap } from '../../renderer/hooks/useDragSwap';

function createDragEvent(overrides: Partial<DragEvent> = {}): DragEvent {
  const dataStore: Record<string, string> = {};
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, val: string) => { dataStore[type] = val; },
      getData: (type: string) => dataStore[type] || '',
    },
    currentTarget: {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    },
    ...overrides,
  } as unknown as DragEvent;
}

describe('useDragSwap', () => {
  const onSwap = vi.fn();

  beforeEach(() => {
    onSwap.mockClear();
    // Reset module-level dragSourceIndex by simulating dragEnd
    document.querySelectorAll = vi.fn().mockReturnValue([]);
  });

  it('returns draggable handlers', () => {
    const { result } = renderHook(() =>
      useDragSwap({ panelIndex: 0, fullscreenIndex: -1, onSwap }),
    );
    expect(result.current.draggable).toBe(true);
    expect(result.current.onDragStart).toBeDefined();
    expect(result.current.onDragEnd).toBeDefined();
    expect(result.current.onDragOver).toBeDefined();
    expect(result.current.onDragLeave).toBeDefined();
    expect(result.current.onDrop).toBeDefined();
  });

  it('prevents drag in fullscreen mode', () => {
    const { result } = renderHook(() =>
      useDragSwap({ panelIndex: 0, fullscreenIndex: 0, onSwap }),
    );
    const e = createDragEvent();
    act(() => {
      result.current.onDragStart(e as unknown as React.DragEvent);
    });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('sets effectAllowed on drag start', () => {
    const { result } = renderHook(() =>
      useDragSwap({ panelIndex: 2, fullscreenIndex: -1, onSwap }),
    );
    const e = createDragEvent();
    act(() => {
      result.current.onDragStart(e as unknown as React.DragEvent);
    });
    expect(e.dataTransfer!.effectAllowed).toBe('move');
  });

  it('calls onSwap on valid drop', () => {
    // First, start a drag from panel 0
    const { result: sourceResult } = renderHook(() =>
      useDragSwap({ panelIndex: 0, fullscreenIndex: -1, onSwap }),
    );
    const startEvent = createDragEvent();
    act(() => {
      sourceResult.current.onDragStart(startEvent as unknown as React.DragEvent);
    });

    // Then drop on panel 1
    const { result: targetResult } = renderHook(() =>
      useDragSwap({ panelIndex: 1, fullscreenIndex: -1, onSwap }),
    );
    const dropEvent = createDragEvent();
    // Manually set data to simulate what browser does on drop
    dropEvent.dataTransfer!.setData!('text/plain', '0');
    act(() => {
      targetResult.current.onDrop(dropEvent as unknown as React.DragEvent);
    });
    expect(onSwap).toHaveBeenCalledWith(0, 1);
  });

  it('ignores drop on same panel', () => {
    const { result } = renderHook(() =>
      useDragSwap({ panelIndex: 0, fullscreenIndex: -1, onSwap }),
    );
    const startEvent = createDragEvent();
    act(() => {
      result.current.onDragStart(startEvent as unknown as React.DragEvent);
    });

    const dropEvent = createDragEvent();
    dropEvent.dataTransfer!.setData!('text/plain', '0');
    act(() => {
      result.current.onDrop(dropEvent as unknown as React.DragEvent);
    });
    expect(onSwap).not.toHaveBeenCalled();
  });

  it('allows dragOver when source is different panel', () => {
    // Start drag from panel 0
    const { result: source } = renderHook(() =>
      useDragSwap({ panelIndex: 0, fullscreenIndex: -1, onSwap }),
    );
    act(() => {
      source.current.onDragStart(createDragEvent() as unknown as React.DragEvent);
    });

    // DragOver on panel 1
    const { result: target } = renderHook(() =>
      useDragSwap({ panelIndex: 1, fullscreenIndex: -1, onSwap }),
    );
    const overEvent = createDragEvent();
    act(() => {
      target.current.onDragOver(overEvent as unknown as React.DragEvent);
    });
    expect(overEvent.preventDefault).toHaveBeenCalled();
  });

  it('blocks dragOver on same panel', () => {
    const { result } = renderHook(() =>
      useDragSwap({ panelIndex: 0, fullscreenIndex: -1, onSwap }),
    );
    act(() => {
      result.current.onDragStart(createDragEvent() as unknown as React.DragEvent);
    });

    const overEvent = createDragEvent();
    act(() => {
      result.current.onDragOver(overEvent as unknown as React.DragEvent);
    });
    expect(overEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('cleans up on drag end', () => {
    document.querySelectorAll = vi.fn().mockReturnValue([
      { classList: { remove: vi.fn() } },
    ]);

    const { result } = renderHook(() =>
      useDragSwap({ panelIndex: 0, fullscreenIndex: -1, onSwap }),
    );
    const e = createDragEvent();
    act(() => {
      result.current.onDragEnd(e as unknown as React.DragEvent);
    });
    expect((e.currentTarget as any).classList.remove).toHaveBeenCalledWith('dragging');
  });
});

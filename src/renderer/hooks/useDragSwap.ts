import { useCallback, useMemo, type DragEvent } from 'react';

// Module-level variable to track drag source across components.
// dataTransfer.getData() returns empty during dragover (browser security).
let dragSourceIndex = -1;

interface UseDragSwapOptions {
  panelIndex: number;
  fullscreenIndex: number;
  onSwap: (sourceIndex: number, targetIndex: number) => void;
}

export function useDragSwap({ panelIndex, fullscreenIndex, onSwap }: UseDragSwapOptions) {
  const onDragStart = useCallback(
    (e: DragEvent) => {
      if (fullscreenIndex >= 0) {
        e.preventDefault();
        return;
      }
      dragSourceIndex = panelIndex;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(panelIndex));
      (e.currentTarget as HTMLElement).classList.add('dragging');
    },
    [panelIndex, fullscreenIndex],
  );

  const onDragEnd = useCallback((e: DragEvent) => {
    dragSourceIndex = -1;
    (e.currentTarget as HTMLElement).classList.remove('dragging');
    document
      .querySelectorAll('.panel.drag-over')
      .forEach((el) => el.classList.remove('drag-over'));
  }, []);

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (dragSourceIndex < 0 || dragSourceIndex === panelIndex) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      (e.currentTarget as HTMLElement).classList.add('drag-over');
    },
    [panelIndex],
  );

  const onDragLeave = useCallback((e: DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).classList.remove('drag-over');
      const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (isNaN(sourceIdx) || sourceIdx === panelIndex) return;
      onSwap(sourceIdx, panelIndex);
    },
    [panelIndex, onSwap],
  );

  return useMemo(() => ({
    dragHandlers: {
      draggable: true as const,
      onDragStart,
      onDragEnd,
    },
    dropHandlers: {
      onDragOver,
      onDragLeave,
      onDrop,
    },
  }), [onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop]);
}

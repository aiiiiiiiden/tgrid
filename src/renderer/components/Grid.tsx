import React, { useMemo } from 'react';
import Panel from './Panel';
import { useGridLayout, useGridSelection } from '../context/GridContext';
import { ptyIdFor } from '../utils/ptyMap';

interface GridProps {
  panelCwds: Record<number, string>;
  ptyMap: Record<number, string>;
  onSwap: (sourceIndex: number, targetIndex: number) => void;
  onEditPreset?: (preset: import('../../shared/types').Preset | null) => void;
}

export default function Grid({ panelCwds, ptyMap, onSwap, onEditPreset }: GridProps) {
  const { rows, cols } = useGridLayout();
  const { activeIndex, fullscreenIndex, setActiveIndex } = useGridSelection();
  const totalPanels = rows * cols;

  const style = useMemo<React.CSSProperties>(() => ({
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  }), [rows, cols]);

  // Reverse map: ptyId -> visual position (memoized since ptyMap only changes on swap/resize)
  // Also collect unique ptyIds sorted for stable DOM ordering.
  const { ptyToVisual, sortedPtyIds } = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < totalPanels; i++) {
      map[ptyMap[i] || ptyIdFor(i)] = i;
    }
    const ids = Object.keys(map).sort();
    return { ptyToVisual: map, sortedPtyIds: ids };
  }, [ptyMap, totalPanels]);

  // Render in stable ptyId order to prevent DOM reordering.
  // CSS `order` controls visual position, preserving xterm canvas state on swap.
  const panels = [];
  for (const ptyId of sortedPtyIds) {
    const visualIndex = ptyToVisual[ptyId];
    const isFullscreen = fullscreenIndex === visualIndex;
    const isHidden = fullscreenIndex >= 0 && fullscreenIndex !== visualIndex;
    panels.push(
      <Panel
        key={ptyId}
        index={visualIndex}
        ptyId={ptyId}
        isActive={activeIndex === visualIndex}
        isFullscreen={isFullscreen}
        isHidden={isHidden}
        cwd={panelCwds[visualIndex] || null}
        onActivate={setActiveIndex}
        onSwap={onSwap}
        onEditPreset={onEditPreset}
      />,
    );
  }

  return (
    <div className="flex-1 grid gap-1.5 overflow-hidden p-1.5 bg-canvas" style={style}>
      {panels}
    </div>
  );
}

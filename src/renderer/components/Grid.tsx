import React, { useMemo } from 'react';
import Panel from './Panel';
import { useGridLayout, useGridSelection } from '../context/GridContext';
import { ptyIdFor } from '../utils/ptyMap';

interface GridProps {
  panelCwds: Record<number, string>;
  ptyMap: Record<number, string>;
  onSwap: (sourceIndex: number, targetIndex: number) => void;
}

export default function Grid({ panelCwds, ptyMap, onSwap }: GridProps) {
  const { rows, cols } = useGridLayout();
  const { activeIndex, fullscreenIndex, setActiveIndex } = useGridSelection();
  const totalPanels = rows * cols;

  const style: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  };

  // Reverse map: ptyId -> visual position (memoized since ptyMap only changes on swap/resize)
  const ptyToVisual = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < totalPanels; i++) {
      map[ptyMap[i] || ptyIdFor(i)] = i;
    }
    return map;
  }, [ptyMap, totalPanels]);

  // Render in stable ptyId order to prevent DOM reordering.
  // CSS `order` controls visual position, preserving xterm canvas state on swap.
  const panels = [];
  for (let pi = 0; pi < totalPanels; pi++) {
    const ptyId = ptyIdFor(pi);
    const visualIndex = ptyToVisual[ptyId] ?? pi;
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
        onActivate={() => setActiveIndex(visualIndex)}
        onSwap={onSwap}
      />,
    );
  }

  return (
    <div className="grid" style={style}>
      {panels}
    </div>
  );
}

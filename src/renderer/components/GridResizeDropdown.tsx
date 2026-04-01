import React, { useState } from 'react';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

interface GridResizeDropdownProps {
  currentRows: number;
  currentCols: number;
  anchorEl: HTMLElement;
  onResize: (rows: number, cols: number) => void;
  onClose: () => void;
}

export default function GridResizeDropdown({
  currentRows,
  currentCols,
  anchorEl,
  onResize,
  onClose,
}: GridResizeDropdownProps) {
  const [hoverR, setHoverR] = useState(0);
  const [hoverC, setHoverC] = useState(0);
  const ddRef = useDropdownPosition<HTMLDivElement>({ anchorEl, onClose });

  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const isHighlighted = hoverR > 0 && hoverC > 0 && r < hoverR && c < hoverC;
      const isCurrent = r < currentRows && c < currentCols && !isHighlighted;
      cells.push(
        <div
          key={`${r}-${c}`}
          className={`grid-resize-cell${isHighlighted ? ' highlighted' : isCurrent ? ' current' : ''}`}
          onMouseEnter={() => { setHoverR(r + 1); setHoverC(c + 1); }}
          onClick={() => {
            const newR = r + 1;
            const newC = c + 1;
            if (newR === currentRows && newC === currentCols) {
              onClose();
              return;
            }
            onResize(newR, newC);
            onClose();
          }}
        />,
      );
    }
  }

  const displayR = hoverR || currentRows;
  const displayC = hoverC || currentCols;

  return (
    <div ref={ddRef} className="dropdown grid-resize-dropdown">
      <div
        className="grid-resize-cells"
        onMouseLeave={() => { setHoverR(0); setHoverC(0); }}
      >
        {cells}
      </div>
      <div className="grid-resize-info">
        <span>{displayR} &times; {displayC}</span>
        {hoverR > 0 && <> &middot; {displayR * displayC} agents</>}
      </div>
    </div>
  );
}

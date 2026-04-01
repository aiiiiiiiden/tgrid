import React, { useState, useCallback, useEffect, useRef } from 'react';

interface GridPickerProps {
  lastGrid: { rows: number; cols: number };
  onSelect: (rows: number, cols: number) => void;
}

export default function GridPicker({ lastGrid, onSelect }: GridPickerProps) {
  const [selectedRows, setSelectedRows] = useState(lastGrid.rows);
  const [selectedCols, setSelectedCols] = useState(lastGrid.cols);
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  const displayRows = hoverRows || selectedRows;
  const displayCols = hoverCols || selectedCols;
  const isHovering = hoverRows > 0;

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.close();
        return;
      }
      if (e.key === 'Enter') {
        if (selectedRows > 0 && selectedCols > 0) onSelect(selectedRows, selectedCols);
        return;
      }
      let r = selectedRows;
      let c = selectedCols;
      if (e.key === 'ArrowRight' && c < 4) c++;
      if (e.key === 'ArrowLeft' && c > 1) c--;
      if (e.key === 'ArrowDown' && r < 4) r++;
      if (e.key === 'ArrowUp' && r > 1) r--;
      setSelectedRows(r);
      setSelectedCols(c);
      e.preventDefault();
    },
    [selectedRows, selectedCols, onSelect],
  );

  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const inDisplay = r < displayRows && c < displayCols;
      const className = `grid-cell${
        isHovering && inDisplay
          ? ' highlighted'
          : !isHovering && r < selectedRows && c < selectedCols
            ? ' selected'
            : ''
      }`;
      cells.push(
        <div
          key={`${r}-${c}`}
          className={className}
          onMouseEnter={() => {
            setHoverRows(r + 1);
            setHoverCols(c + 1);
          }}
          onClick={() => {
            setSelectedRows(r + 1);
            setSelectedCols(c + 1);
          }}
        />,
      );
    }
  }

  return (
    <div
      ref={overlayRef}
      className="grid-picker-overlay"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="grid-picker">
        <h2>Choose Grid Size</h2>
        <div
          className="grid-picker-cells"
          onMouseLeave={() => {
            setHoverRows(0);
            setHoverCols(0);
          }}
        >
          {cells}
        </div>
        <div className="grid-picker-info">
          {displayRows > 0 && displayCols > 0 && (
            <>
              <span className="size">
                {displayRows} &times; {displayCols}
              </span>{' '}
              &middot; {displayRows * displayCols} agents
            </>
          )}
        </div>
        <button
          className="btn btn-primary btn-start"
          disabled={selectedRows <= 0 || selectedCols <= 0}
          onClick={() => onSelect(selectedRows, selectedCols)}
        >
          Start
        </button>
      </div>
    </div>
  );
}

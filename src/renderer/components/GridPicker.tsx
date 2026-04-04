import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

  useEffect(() => { overlayRef.current?.focus(); }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { window.close(); return; }
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
      cells.push(
        <div
          key={`${r}-${c}`}
          role="button"
          className={cn(
            'grid-cell w-10 h-8 bg-muted border border-input rounded-md cursor-pointer transition-[background,border-color] duration-100',
            isHovering && inDisplay && 'bg-highlight border-primary',
            !isHovering && r < selectedRows && c < selectedCols && 'bg-highlight border-primary',
          )}
          onMouseEnter={() => { setHoverRows(r + 1); setHoverCols(c + 1); }}
          onClick={() => { setSelectedRows(r + 1); setSelectedCols(c + 1); }}
        />,
      );
    }
  }

  return (
    <div
      ref={overlayRef}
      className="grid-picker-overlay fixed inset-0 bg-canvas z-[500] flex items-center justify-center"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="text-center">
        <h2 className="text-foreground text-base font-medium mb-6">Choose Grid Size</h2>
        <div
          className="inline-grid grid-cols-4 gap-1.5 mb-5"
          onMouseLeave={() => { setHoverRows(0); setHoverCols(0); }}
        >
          {cells}
        </div>
        <div className="text-muted-foreground text-sm mb-4 h-6">
          {displayRows > 0 && displayCols > 0 && (
            <>
              <span className="text-primary font-semibold">
                {displayRows} &times; {displayCols}
              </span>{' '}
              &middot; {displayRows * displayCols} agents
            </>
          )}
        </div>
        <Button
          size="default"
          className="px-6"
          disabled={selectedRows <= 0 || selectedCols <= 0}
          onClick={() => onSelect(selectedRows, selectedCols)}
        >
          Start
        </Button>
        <p className="text-ghost text-[10px] mt-4">
          Arrow keys to select &middot; Enter to start
        </p>
      </div>
    </div>
  );
}

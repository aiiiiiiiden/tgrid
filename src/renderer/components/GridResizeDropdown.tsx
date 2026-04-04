import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TOOLBAR_BTN } from '../utils/styles';

interface GridResizeDropdownProps {
  currentRows: number;
  currentCols: number;
  onResize: (rows: number, cols: number) => void;
  defaultOpen?: boolean;
}

export default function GridResizeDropdown({
  currentRows, currentCols, onResize, defaultOpen = false,
}: GridResizeDropdownProps) {
  const [hoverR, setHoverR] = useState(0);
  const [hoverC, setHoverC] = useState(0);
  const [open, setOpen] = useState(defaultOpen);
  const [pendingResize, setPendingResize] = useState<{ rows: number; cols: number } | null>(null);

  const isHovering = hoverR > 0 && hoverC > 0;
  const currentTotal = currentRows * currentCols;

  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const inCurrent = r < currentRows && c < currentCols;
      const inHover = isHovering && r < hoverR && c < hoverC;
      const willRemove = isHovering && inCurrent && !inHover;
      cells.push(
        <div
          key={`${r}-${c}`}
          role="button"
          className={cn(
            'grid-resize-cell w-7 h-[22px] bg-panel border border-input rounded-sm cursor-pointer transition-[background,border-color] duration-100',
            !isHovering && inCurrent && 'bg-highlight border-primary',
            inHover && 'bg-highlight border-primary',
            willRemove && 'bg-destructive/15 border-destructive/40',
          )}
          onMouseEnter={() => { setHoverR(r + 1); setHoverC(c + 1); }}
          onClick={() => {
            const newR = r + 1;
            const newC = c + 1;
            if (newR === currentRows && newC === currentCols) { setOpen(false); return; }
            const newTotal = newR * newC;
            if (newTotal < currentTotal) {
              setPendingResize({ rows: newR, cols: newC });
              setOpen(false);
            } else {
              onResize(newR, newC);
              setOpen(false);
            }
          }}
        />,
      );
    }
  }

  const displayR = hoverR || currentRows;
  const displayC = hoverC || currentCols;
  const hoverTotal = hoverR * hoverC;
  const diff = hoverTotal - currentTotal;

  const removedCount = pendingResize
    ? currentTotal - pendingResize.rows * pendingResize.cols
    : 0;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setHoverR(0); setHoverC(0); } }}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="xs" className={TOOLBAR_BTN} title="Resize grid">
            {currentRows} &times; {currentCols} &middot; {currentRows * currentCols} agents &#9662;
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-3">
          <div
            className="inline-grid grid-cols-4 gap-1.5"
            onMouseLeave={() => { setHoverR(0); setHoverC(0); }}
          >
            {cells}
          </div>
          <div className="text-muted-foreground text-[11px] mt-2 text-center">
            {isHovering ? (
              <>
                <span>{currentRows}&times;{currentCols} &rarr; {hoverR}&times;{hoverC}</span>
                {diff !== 0 && (
                  <span className={cn('ml-1', diff < 0 ? 'text-destructive' : 'text-primary')}>
                    {diff > 0 ? '+' : ''}{diff}
                  </span>
                )}
              </>
            ) : (
              <span>{displayR} &times; {displayC}</span>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pendingResize !== null} onOpenChange={(v) => { if (!v) setPendingResize(null); }}>
        <DialogContent showCloseButton={false} className="max-w-[320px] gap-3 p-4 bg-background border-input">
          <DialogHeader>
            <DialogTitle className="text-sm font-normal">
              {removedCount} {removedCount === 1 ? 'panel' : 'panels'} will be closed and running processes terminated.
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingResize(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => {
              if (pendingResize) onResize(pendingResize.rows, pendingResize.cols);
              setPendingResize(null);
            }}>
              Resize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

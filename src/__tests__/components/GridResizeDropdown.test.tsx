import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GridResizeDropdown from '../../renderer/components/GridResizeDropdown';

describe('GridResizeDropdown', () => {
  const onResize = vi.fn();

  it('renders trigger button with grid dimensions', () => {
    render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={3}
        onResize={onResize}
      />,
    );
    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('2');
    expect(btn.textContent).toContain('3');
    expect(btn.textContent).toContain('6');
  });

  it('renders 16 resize cells when open', () => {
    render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={2}
        onResize={onResize}
        defaultOpen
      />,
    );
    const cells = document.querySelectorAll('.grid-resize-cell');
    expect(cells).toHaveLength(16);
  });

  it('calls onResize on cell click with new size', () => {
    render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={2}
        onResize={onResize}
        defaultOpen
      />,
    );
    const cells = document.querySelectorAll('.grid-resize-cell');
    fireEvent.click(cells[10]); // row=2, col=2 -> 3x3
    expect(onResize).toHaveBeenCalledWith(3, 3);
  });

  it('does not call onResize when clicking current size', () => {
    onResize.mockClear();
    render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={2}
        onResize={onResize}
        defaultOpen
      />,
    );
    const cells = document.querySelectorAll('.grid-resize-cell');
    fireEvent.click(cells[5]); // row=1, col=1 -> 2x2 = current
    expect(onResize).not.toHaveBeenCalled();
  });
});

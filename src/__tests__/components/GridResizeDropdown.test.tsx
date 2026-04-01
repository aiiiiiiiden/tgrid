import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GridResizeDropdown from '../../renderer/components/GridResizeDropdown';

function createAnchor(): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => ({
    top: 40,
    bottom: 60,
    left: 100,
    right: 200,
    width: 100,
    height: 20,
    x: 100,
    y: 40,
    toJSON: () => {},
  });
  document.body.appendChild(el);
  return el;
}

describe('GridResizeDropdown', () => {
  const onResize = vi.fn();
  const onClose = vi.fn();

  it('renders 16 resize cells', () => {
    const anchor = createAnchor();
    const { container } = render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={2}
        anchorEl={anchor}
        onResize={onResize}
        onClose={onClose}
      />,
    );
    const cells = container.querySelectorAll('.grid-resize-cell');
    expect(cells).toHaveLength(16);
  });

  it('shows current grid size', () => {
    const anchor = createAnchor();
    render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={3}
        anchorEl={anchor}
        onResize={onResize}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('calls onResize on cell click with new size', () => {
    const anchor = createAnchor();
    const { container } = render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={2}
        anchorEl={anchor}
        onResize={onResize}
        onClose={onClose}
      />,
    );
    // Click cell at row 2, col 2 (0-indexed) -> 3x3
    const cells = container.querySelectorAll('.grid-resize-cell');
    fireEvent.click(cells[10]); // row=2, col=2 -> 2*4+2=10
    expect(onResize).toHaveBeenCalledWith(3, 3);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes without resize when clicking current size', () => {
    const anchor = createAnchor();
    const { container } = render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={2}
        anchorEl={anchor}
        onResize={onResize}
        onClose={onClose}
      />,
    );
    // Click cell at row 1, col 1 (0-indexed) -> 2x2 = current
    const cells = container.querySelectorAll('.grid-resize-cell');
    fireEvent.click(cells[5]); // row=1, col=1 -> 1*4+1=5
    expect(onResize).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const anchor = createAnchor();
    render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={2}
        anchorEl={anchor}
        onResize={onResize}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on outside click', () => {
    const anchor = createAnchor();
    render(
      <GridResizeDropdown
        currentRows={2}
        currentCols={2}
        anchorEl={anchor}
        onResize={onResize}
        onClose={onClose}
      />,
    );
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});

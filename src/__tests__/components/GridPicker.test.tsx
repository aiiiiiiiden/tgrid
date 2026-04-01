import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GridPicker from '../../renderer/components/GridPicker';

describe('GridPicker', () => {
  const onSelect = vi.fn();

  it('renders with title', () => {
    render(<GridPicker lastGrid={{ rows: 2, cols: 2 }} onSelect={onSelect} />);
    expect(screen.getByText('Choose Grid Size')).toBeInTheDocument();
  });

  it('shows Start button', () => {
    render(<GridPicker lastGrid={{ rows: 2, cols: 2 }} onSelect={onSelect} />);
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('shows initial size info', () => {
    render(<GridPicker lastGrid={{ rows: 2, cols: 3 }} onSelect={onSelect} />);
    // Should show "2 × 3" and "6 agents"
    expect(screen.getByText(/6 agents/)).toBeInTheDocument();
  });

  it('calls onSelect on Start click', () => {
    render(<GridPicker lastGrid={{ rows: 2, cols: 2 }} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Start'));
    expect(onSelect).toHaveBeenCalledWith(2, 2);
  });

  it('renders 16 grid cells (4x4)', () => {
    const { container } = render(
      <GridPicker lastGrid={{ rows: 2, cols: 2 }} onSelect={onSelect} />,
    );
    const cells = container.querySelectorAll('.grid-cell');
    expect(cells).toHaveLength(16);
  });

  it('updates selection on cell click', () => {
    const { container } = render(
      <GridPicker lastGrid={{ rows: 1, cols: 1 }} onSelect={onSelect} />,
    );
    // Click the cell at position (1,2) = 3rd row, 3rd column
    const cells = container.querySelectorAll('.grid-cell');
    // cells[10] = row 2, col 2 (0-indexed: row=2, col=2 -> 2*4+2=10)
    fireEvent.click(cells[10]);
    // Now click Start
    fireEvent.click(screen.getByText('Start'));
    expect(onSelect).toHaveBeenCalledWith(3, 3);
  });

  it('navigates with arrow keys', () => {
    const { container } = render(
      <GridPicker lastGrid={{ rows: 1, cols: 1 }} onSelect={onSelect} />,
    );
    const overlay = container.querySelector('.grid-picker-overlay')!;
    fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    fireEvent.keyDown(overlay, { key: 'ArrowDown' });
    fireEvent.keyDown(overlay, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(2, 2);
  });

  it('does not go below 1x1 with arrow keys', () => {
    const { container } = render(
      <GridPicker lastGrid={{ rows: 1, cols: 1 }} onSelect={onSelect} />,
    );
    const overlay = container.querySelector('.grid-picker-overlay')!;
    fireEvent.keyDown(overlay, { key: 'ArrowLeft' });
    fireEvent.keyDown(overlay, { key: 'ArrowUp' });
    fireEvent.keyDown(overlay, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(1, 1);
  });

  it('does not exceed 4x4 with arrow keys', () => {
    const { container } = render(
      <GridPicker lastGrid={{ rows: 4, cols: 4 }} onSelect={onSelect} />,
    );
    const overlay = container.querySelector('.grid-picker-overlay')!;
    fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    fireEvent.keyDown(overlay, { key: 'ArrowDown' });
    fireEvent.keyDown(overlay, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(4, 4);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Grid from '../../renderer/components/Grid';
import { GridProvider, useGridLayout } from '../../renderer/context/GridContext';
import { ThemeProvider } from '../../renderer/context/ThemeContext';

// Helper to set grid state before rendering
function GridWithState({
  rows,
  cols,
  panelCwds,
  onSwap,
}: {
  rows: number;
  cols: number;
  panelCwds: Record<number, string>;
  onSwap: (s: number, t: number) => void;
}) {
  return (
    <GridProvider>
      <ThemeProvider initialTheme="dark">
        <GridInitializer rows={rows} cols={cols}>
          <Grid panelCwds={panelCwds} ptyMap={{}} onSwap={onSwap} />
        </GridInitializer>
      </ThemeProvider>
    </GridProvider>
  );
}

function GridInitializer({
  rows,
  cols,
  children,
}: {
  rows: number;
  cols: number;
  children: React.ReactNode;
}) {
  const { setGrid } = useGridLayout();
  React.useEffect(() => {
    setGrid(rows, cols);
  }, [rows, cols, setGrid]);
  return <>{children}</>;
}

describe('Grid', () => {
  const onSwap = vi.fn();

  it('renders correct number of panels for 2x2', () => {
    render(<GridWithState rows={2} cols={2} panelCwds={{}} onSwap={onSwap} />);
    const panels = screen.getAllByRole('region');
    expect(panels).toHaveLength(4);
  });

  it('renders correct number of panels for 3x3', () => {
    render(<GridWithState rows={3} cols={3} panelCwds={{}} onSwap={onSwap} />);
    const panels = screen.getAllByRole('region');
    expect(panels).toHaveLength(9);
  });

  it('renders 1x1 grid', () => {
    render(<GridWithState rows={1} cols={1} panelCwds={{}} onSwap={onSwap} />);
    const panels = screen.getAllByRole('region');
    expect(panels).toHaveLength(1);
  });

  it('applies grid template styles', () => {
    const { container } = render(
      <GridWithState rows={2} cols={3} panelCwds={{}} onSwap={onSwap} />,
    );
    const grid = container.querySelector('.grid');
    expect(grid).toHaveStyle({
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(2, 1fr)',
    });
  });

  it('labels panels with Terminal N', () => {
    render(<GridWithState rows={1} cols={3} panelCwds={{}} onSwap={onSwap} />);
    expect(screen.getByLabelText('Terminal 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal 3')).toBeInTheDocument();
  });
});

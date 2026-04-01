import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { GridLayoutProvider, useGridLayout } from '../../renderer/context/GridLayoutContext';

function TestConsumer() {
  const { rows, cols, setGrid } = useGridLayout();
  return (
    <div>
      <span data-testid="rows">{rows}</span>
      <span data-testid="cols">{cols}</span>
      <button onClick={() => setGrid(3, 4)}>setGrid</button>
    </div>
  );
}

describe('GridLayoutContext', () => {
  it('initializes with 0x0', () => {
    render(<GridLayoutProvider><TestConsumer /></GridLayoutProvider>);
    expect(screen.getByTestId('rows').textContent).toBe('0');
    expect(screen.getByTestId('cols').textContent).toBe('0');
  });

  it('setGrid updates rows and cols', () => {
    render(<GridLayoutProvider><TestConsumer /></GridLayoutProvider>);
    act(() => { screen.getByText('setGrid').click(); });
    expect(screen.getByTestId('rows').textContent).toBe('3');
    expect(screen.getByTestId('cols').textContent).toBe('4');
  });
});

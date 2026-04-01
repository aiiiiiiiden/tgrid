import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { GridSelectionProvider, useGridSelection } from '../../renderer/context/GridSelectionContext';

function TestConsumer() {
  const { activeIndex, fullscreenIndex, setActiveIndex, setFullscreenIndex } = useGridSelection();
  return (
    <div>
      <span data-testid="active">{activeIndex}</span>
      <span data-testid="fullscreen">{fullscreenIndex}</span>
      <button onClick={() => setActiveIndex(3)}>setActive</button>
      <button onClick={() => setFullscreenIndex(2)}>setFullscreen</button>
    </div>
  );
}

describe('GridSelectionContext', () => {
  it('initializes with activeIndex=0, fullscreenIndex=-1', () => {
    render(<GridSelectionProvider><TestConsumer /></GridSelectionProvider>);
    expect(screen.getByTestId('active').textContent).toBe('0');
    expect(screen.getByTestId('fullscreen').textContent).toBe('-1');
  });

  it('setActiveIndex updates active panel', () => {
    render(<GridSelectionProvider><TestConsumer /></GridSelectionProvider>);
    act(() => { screen.getByText('setActive').click(); });
    expect(screen.getByTestId('active').textContent).toBe('3');
  });

  it('setFullscreenIndex updates fullscreen panel', () => {
    render(<GridSelectionProvider><TestConsumer /></GridSelectionProvider>);
    act(() => { screen.getByText('setFullscreen').click(); });
    expect(screen.getByTestId('fullscreen').textContent).toBe('2');
  });
});

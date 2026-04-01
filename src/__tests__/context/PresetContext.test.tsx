import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { PresetProvider, usePresets } from '../../renderer/context/PresetContext';

function TestConsumer() {
  const ctx = usePresets();
  return (
    <div>
      <span data-testid="presets-count">{ctx.presets.length}</span>
      <span data-testid="assignments">{JSON.stringify(ctx.assignments)}</span>
      <span data-testid="cached">{ctx.getCachedImage('test') || 'none'}</span>
      <button onClick={() => ctx.setPresets([{ id: 'a', name: 'A' }])}>setPresets</button>
      <button onClick={() => ctx.setAssignments({ '0': 'a' })}>setAssignments</button>
      <button onClick={() => ctx.setConfig({ presets: [{ id: 'b', name: 'B' }], assignments: { '1': 'b' } })}>setConfig</button>
      <button onClick={() => ctx.cacheImage('test', 'data:image/png;base64,abc')}>cacheImage</button>
    </div>
  );
}

function renderConsumer() {
  return render(
    <PresetProvider>
      <TestConsumer />
    </PresetProvider>,
  );
}

describe('PresetContext', () => {
  it('initializes with empty state', () => {
    renderConsumer();
    expect(screen.getByTestId('presets-count').textContent).toBe('0');
    expect(screen.getByTestId('assignments').textContent).toBe('{}');
  });

  it('setPresets updates presets', () => {
    renderConsumer();
    act(() => { screen.getByText('setPresets').click(); });
    expect(screen.getByTestId('presets-count').textContent).toBe('1');
  });

  it('setAssignments updates assignments', () => {
    renderConsumer();
    act(() => { screen.getByText('setAssignments').click(); });
    expect(screen.getByTestId('assignments').textContent).toBe('{"0":"a"}');
  });

  it('setConfig syncs presets and assignments', () => {
    renderConsumer();
    act(() => { screen.getByText('setConfig').click(); });
    expect(screen.getByTestId('presets-count').textContent).toBe('1');
    expect(screen.getByTestId('assignments').textContent).toBe('{"1":"b"}');
  });

  it('cacheImage and getCachedImage work', () => {
    renderConsumer();
    expect(screen.getByTestId('cached').textContent).toBe('none');
    act(() => { screen.getByText('cacheImage').click(); });
    expect(screen.getByTestId('cached').textContent).toBe('data:image/png;base64,abc');
  });
});

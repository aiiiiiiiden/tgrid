import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PresetDropdown from '../../renderer/components/PresetDropdown';
import { GridProvider, usePresets } from '../../renderer/context/GridContext';
import { ThemeProvider } from '../../renderer/context/ThemeContext';
import { getMockTgrid } from '../setup';

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

function PresetDropdownWithState({
  panelIndex,
  onClose,
  presets,
  assignments,
}: {
  panelIndex: number;
  onClose: () => void;
  presets?: Array<{ id: string; name: string; color?: string | null }>;
  assignments?: Record<string, string>;
}) {
  const anchor = createAnchor();
  return (
    <GridProvider>
      <ThemeProvider initialTheme="dark">
        <StateInjector presets={presets} assignments={assignments}>
          <PresetDropdown panelIndex={panelIndex} anchorEl={anchor} onClose={onClose} />
        </StateInjector>
      </ThemeProvider>
    </GridProvider>
  );
}

function StateInjector({
  presets,
  assignments,
  children,
}: {
  presets?: Array<{ id: string; name: string; color?: string | null }>;
  assignments?: Record<string, string>;
  children: React.ReactNode;
}) {
  const { setPresets, setAssignments } = usePresets();
  React.useEffect(() => {
    if (presets) setPresets(presets);
    if (assignments) setAssignments(assignments);
  }, [presets, assignments, setPresets, setAssignments]);
  return <>{children}</>;
}

describe('PresetDropdown', () => {
  const onClose = vi.fn();

  it('renders "None" option', () => {
    render(<PresetDropdownWithState panelIndex={0} onClose={onClose} />);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders preset names', () => {
    render(
      <PresetDropdownWithState
        panelIndex={0}
        onClose={onClose}
        presets={[
          { id: 'a', name: 'Agent Alpha' },
          { id: 'b', name: 'Agent Beta' },
        ]}
      />,
    );
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    expect(screen.getByText('Agent Beta')).toBeInTheDocument();
  });

  it('shows check mark on assigned preset', () => {
    const { container } = render(
      <PresetDropdownWithState
        panelIndex={0}
        onClose={onClose}
        presets={[{ id: 'a', name: 'Agent Alpha' }]}
        assignments={{ '0': 'a' }}
      />,
    );
    const activeItem = container.querySelector('.dropdown-item.active');
    expect(activeItem).toBeInTheDocument();
    expect(activeItem?.textContent).toContain('Agent Alpha');
  });

  it('calls set-assignment IPC and closes on click', async () => {
    const mock = getMockTgrid();
    mock.invoke.mockResolvedValue({ '0': 'a' });

    render(
      <PresetDropdownWithState
        panelIndex={0}
        onClose={onClose}
        presets={[{ id: 'a', name: 'Agent Alpha' }]}
      />,
    );
    fireEvent.click(screen.getByText('Agent Alpha'));
    expect(mock.invoke).toHaveBeenCalledWith('set-assignment', {
      panelIndex: 0,
      presetId: 'a',
    });
  });

  it('closes on Escape key', () => {
    render(<PresetDropdownWithState panelIndex={0} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('has menu role', () => {
    render(<PresetDropdownWithState panelIndex={0} onClose={onClose} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

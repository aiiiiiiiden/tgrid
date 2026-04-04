import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PresetDropdown from '../../renderer/components/PresetDropdown';
import { GridProvider, usePresets } from '../../renderer/context/GridContext';
import { ThemeProvider } from '../../renderer/context/ThemeContext';
import { getMockTgrid } from '../setup';

function PresetDropdownWithState({
  panelIndex,
  presets,
  assignments,
}: {
  panelIndex: number;
  presets?: Array<{ id: string; name: string; color?: string | null }>;
  assignments?: Record<string, string>;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <GridProvider>
      <ThemeProvider initialTheme="dark">
        <StateInjector presets={presets} assignments={assignments}>
          <PresetDropdown panelIndex={panelIndex} open={open} onOpenChange={setOpen}>
            <button>trigger</button>
          </PresetDropdown>
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
  it('renders "None" option', () => {
    render(<PresetDropdownWithState panelIndex={0} />);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders preset names', () => {
    render(
      <PresetDropdownWithState
        panelIndex={0}
        presets={[
          { id: 'a', name: 'Agent Alpha' },
          { id: 'b', name: 'Agent Beta' },
        ]}
      />,
    );
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    expect(screen.getByText('Agent Beta')).toBeInTheDocument();
  });

  it('calls set-assignment IPC on click', async () => {
    const mock = getMockTgrid();
    mock.invoke.mockResolvedValue({ '0': 'a' });

    render(
      <PresetDropdownWithState
        panelIndex={0}
        presets={[{ id: 'a', name: 'Agent Alpha' }]}
      />,
    );
    fireEvent.click(screen.getByText('Agent Alpha'));

    await waitFor(() => {
      expect(mock.invoke).toHaveBeenCalledWith('set-assignment', {
        panelIndex: 0,
        presetId: 'a',
      });
    });
  });

  it('renders menu items for presets', () => {
    render(
      <PresetDropdownWithState
        panelIndex={0}
        presets={[{ id: 'a', name: 'Agent Alpha' }]}
      />,
    );
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThanOrEqual(2); // None + preset
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PresetEditor from '../../renderer/components/PresetEditor';
import { renderWithProviders } from '../test-utils';
import { getMockTgrid } from '../setup';

function renderEditor(preset: { id: string; name: string; image?: string; shell?: string; color?: string | null } | null = null) {
  const onClose = vi.fn();
  const result = renderWithProviders(
    <PresetEditor preset={preset} onClose={onClose} />,
  );
  return { ...result, onClose };
}

describe('PresetEditor', () => {
  it('renders "New Preset" title when no preset', () => {
    renderEditor(null);
    expect(screen.getByText('New Preset')).toBeInTheDocument();
  });

  it('renders "Edit Preset" title for existing preset', () => {
    renderEditor({ id: 'test', name: 'Test' });
    expect(screen.getByText('Edit Preset')).toBeInTheDocument();
  });

  it('populates name field from preset', () => {
    renderEditor({ id: 'test', name: 'Claude' });
    const input = screen.getByPlaceholderText('Character name') as HTMLInputElement;
    expect(input.value).toBe('Claude');
  });

  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderEditor(null);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not save when name is empty', async () => {
    const mock = getMockTgrid();
    renderEditor(null);
    fireEvent.click(screen.getByText('Save'));
    expect(mock.invoke).not.toHaveBeenCalledWith('save-preset', expect.anything());
  });

  it('saves preset with trimmed name', async () => {
    const mock = getMockTgrid();
    mock.invoke.mockResolvedValueOnce([{ id: 'test', name: 'Test' }]);

    renderEditor(null);
    const input = screen.getByPlaceholderText('Character name');
    fireEvent.change(input, { target: { value: '  Test  ' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mock.invoke).toHaveBeenCalledWith('save-preset', expect.objectContaining({ name: 'Test' }));
    });
  });

  it('shows Delete button for existing preset', () => {
    renderEditor({ id: 'test', name: 'Test' });
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('does not show Delete button for new preset', () => {
    renderEditor(null);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows confirmation on Delete click', () => {
    renderEditor({ id: 'test', name: 'Test' });
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText(/Delete preset/)).toBeInTheDocument();
  });

  it('has color palette', () => {
    renderEditor(null);
    expect(screen.getByRole('radiogroup', { name: 'Preset color' })).toBeInTheDocument();
  });

  it('has image picker', () => {
    renderEditor(null);
    expect(screen.getByText('Click to choose image')).toBeInTheDocument();
  });

  it('saves on Enter in name field', async () => {
    const mock = getMockTgrid();
    mock.invoke.mockResolvedValueOnce([]);

    renderEditor(null);
    const input = screen.getByPlaceholderText('Character name');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mock.invoke).toHaveBeenCalledWith('save-preset', expect.objectContaining({ name: 'Test' }));
    });
  });
});

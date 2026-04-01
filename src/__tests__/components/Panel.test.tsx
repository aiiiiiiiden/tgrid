import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Panel from '../../renderer/components/Panel';
import { GridProvider, useGrid } from '../../renderer/context/GridContext';
import { ThemeProvider } from '../../renderer/context/ThemeContext';

function PanelWithProviders(props: {
  index: number;
  ptyId?: string;
  isActive?: boolean;
  isFullscreen?: boolean;
  isHidden?: boolean;
  onActivate?: () => void;
  onSwap?: (s: number, t: number) => void;
}) {
  return (
    <GridProvider>
      <ThemeProvider initialTheme="dark">
        <Panel
          index={props.index}
          ptyId={props.ptyId ?? `pty-${props.index}`}
          isActive={props.isActive ?? false}
          isFullscreen={props.isFullscreen ?? false}
          isHidden={props.isHidden ?? false}
          onActivate={props.onActivate ?? vi.fn()}
          onSwap={props.onSwap ?? vi.fn()}
        />
      </ThemeProvider>
    </GridProvider>
  );
}

describe('Panel', () => {
  it('renders with terminal label', () => {
    render(<PanelWithProviders index={0} />);
    expect(screen.getByLabelText('Terminal 1')).toBeInTheDocument();
  });

  it('renders panel name as "Terminal N" when no preset', () => {
    render(<PanelWithProviders index={2} />);
    expect(screen.getByText('Terminal 3')).toBeInTheDocument();
  });

  it('shows keyboard shortcut for panels 1-9', () => {
    render(<PanelWithProviders index={0} />);
    expect(screen.getByText('\u23181')).toBeInTheDocument();
  });

  it('does not show shortcut for panel 10+', () => {
    const { container } = render(<PanelWithProviders index={9} />);
    const index = container.querySelector('.index');
    expect(index?.textContent).toBe('');
  });

  it('applies active class when active', () => {
    const { container } = render(<PanelWithProviders index={0} isActive />);
    expect(container.querySelector('.panel.active')).toBeInTheDocument();
  });

  it('applies fullscreen class when fullscreen', () => {
    const { container } = render(<PanelWithProviders index={0} isFullscreen />);
    expect(container.querySelector('.panel.fullscreen')).toBeInTheDocument();
  });

  it('returns null when hidden', () => {
    const { container } = render(<PanelWithProviders index={0} isHidden />);
    expect(container.querySelector('.panel')).not.toBeInTheDocument();
  });

  it('calls onActivate on mousedown', () => {
    const onActivate = vi.fn();
    render(<PanelWithProviders index={0} onActivate={onActivate} />);
    fireEvent.mouseDown(screen.getByLabelText('Terminal 1'));
    expect(onActivate).toHaveBeenCalled();
  });

  it('has menu button with aria-label', () => {
    render(<PanelWithProviders index={0} />);
    expect(screen.getByLabelText('Panel options')).toBeInTheDocument();
  });

  it('does not show onboarding hint', () => {
    render(<PanelWithProviders index={0} />);
    expect(screen.queryByText(/assign a character/)).not.toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AgentOverlay from '../../renderer/components/AgentOverlay';

describe('AgentOverlay', () => {
  it('renders nothing when no image', () => {
    const { container } = render(
      <AgentOverlay imageDataUrl={null} name="Test" opacity={0.5} />,
    );
    expect(container.querySelector('.character-overlay')).not.toBeInTheDocument();
  });

  it('renders image when provided', () => {
    render(
      <AgentOverlay imageDataUrl="data:image/png;base64,abc" name="Agent" opacity={0.3} />,
    );
    const img = screen.getByAltText('Agent');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc');
  });

  it('renders overlay with opacity when image is provided', () => {
    const { container } = render(
      <AgentOverlay imageDataUrl="data:image/png;base64,abc" name="Agent" opacity={0.5} />,
    );
    const overlay = container.querySelector('.character-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveStyle({ opacity: '0.5' });
  });

  it('applies different opacity values', () => {
    const { container, rerender } = render(
      <AgentOverlay imageDataUrl="data:image/png;base64,abc" name="" opacity={0.1} />,
    );
    expect(container.querySelector('.character-overlay')).toHaveStyle({ opacity: '0.1' });

    rerender(<AgentOverlay imageDataUrl="data:image/png;base64,abc" name="" opacity={0.9} />);
    expect(container.querySelector('.character-overlay')).toHaveStyle({ opacity: '0.9' });
  });
});

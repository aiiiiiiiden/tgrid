import React from 'react';

interface AgentOverlayProps {
  imageDataUrl: string | null;
  name: string;
  opacity: number;
}

export default function AgentOverlay({ imageDataUrl, name, opacity }: AgentOverlayProps) {
  if (!imageDataUrl) return null;

  return (
    <div className="character-overlay" style={{ opacity }}>
      <img src={imageDataUrl} alt={name} />
    </div>
  );
}

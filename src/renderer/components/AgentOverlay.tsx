import React from 'react';
import { cn } from '@/lib/utils';

interface AgentOverlayProps {
  imageDataUrl: string | null;
  name: string;
  opacity: number;
  isActive?: boolean;
}

export default function AgentOverlay({ imageDataUrl, name, opacity, isActive }: AgentOverlayProps) {
  if (!imageDataUrl) return null;

  return (
    <div
      className={cn(
        'character-overlay absolute bottom-2 right-2 w-[35%] h-[70%] pointer-events-none z-50 flex items-end justify-end transition-[opacity,transform] duration-200 ease',
        'before:content-[""] before:absolute before:bottom-0 before:right-0 before:w-full before:h-1/4 before:bg-gradient-to-t before:from-panel before:to-transparent before:pointer-events-none before:z-0 before:rounded-[inherit]',
        isActive ? 'scale-[1.04]' : 'scale-100',
      )}
      style={{ opacity }}
    >
      <img src={imageDataUrl} alt={name} className="max-w-full max-h-full object-contain relative z-[2]" />
    </div>
  );
}

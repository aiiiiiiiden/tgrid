import React, { useState, useCallback, useEffect, useRef } from 'react';
import TerminalView, { type TerminalViewHandle } from './TerminalView';
import AgentOverlay from './AgentOverlay';
import PresetDropdown from './PresetDropdown';
import { useDragSwap } from '../hooks/useDragSwap';
import { useLazyImage } from '../hooks/useImageLoader';
import { usePresets, useGridSelection } from '../context/GridContext';
import { useTheme } from '../context/ThemeContext';
import { getDisplayColor } from '../utils/colors';
import { cn } from '@/lib/utils';

const DEFAULT_OPACITY = 0.15;
const ACTIVE_OPACITY = 0.25;

interface PanelProps {
  index: number;
  ptyId: string;
  isActive: boolean;
  isFullscreen: boolean;
  isHidden: boolean;
  cwd?: string | null;
  onActivate: (index: number) => void;
  onSwap: (sourceIndex: number, targetIndex: number) => void;
  onEditPreset?: (preset: import('../../shared/types').Preset | null) => void;
}

export default React.memo(function Panel({
  index, ptyId, isActive, isFullscreen, isHidden, cwd, onActivate, onSwap, onEditPreset,
}: PanelProps) {
  const { presets, assignments, config } = usePresets();
  const { fullscreenIndex } = useGridSelection();
  const { theme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const terminalRef = useRef<TerminalViewHandle>(null);

  const presetId = assignments[String(index)] || null;
  const preset = presetId ? presets.find((p) => p.id === presetId) : null;

  const panelColor = preset?.color ? getDisplayColor(preset.color, theme) : null;
  const imageDataUrl = useLazyImage(preset?.image || null);
  const opacity = isActive
    ? config.activeOpacity || ACTIVE_OPACITY
    : config.defaultOpacity || DEFAULT_OPACITY;

  const { dragHandlers, dropHandlers } = useDragSwap({ panelIndex: index, fullscreenIndex, onSwap });

  useEffect(() => {
    if (isActive) terminalRef.current?.focus();
  }, [isActive]);

  const handleExit = useCallback((code: number) => {
    setExitCode(code);
  }, []);

  const handleRestart = useCallback(() => {
    setExitCode(null);
    terminalRef.current?.restart();
  }, []);

  return (
    <div
      className={cn(
        'group panel bg-panel border border-border rounded-md flex flex-col relative overflow-hidden transition-[border-color,box-shadow,ring-color] duration-200 min-w-0 min-h-0 ring-0 ring-transparent',
        isActive && 'active ring-2 ring-[var(--panel-color,var(--accent))] border-[var(--panel-color,var(--accent))] shadow-[0_0_14px_color-mix(in_srgb,var(--panel-color,var(--accent))_20%,transparent)]',
        isFullscreen && 'fullscreen fixed top-[38px] inset-x-0 bottom-6 z-[100] rounded-none',
        isHidden && 'hidden',
      )}
      style={{ order: index, ...(panelColor ? { '--panel-color': panelColor } : {}) } as React.CSSProperties}
      onMouseDown={() => onActivate(index)}
      role="region"
      aria-label={`Panel ${index + 1}`}
      {...dropHandlers}
    >
      <div
        className={cn(
          'panel-header px-2.5 py-[3px] flex items-center justify-between border-b border-border text-[11px] shrink-0 h-6',
          isActive
            ? 'bg-[color-mix(in_srgb,var(--panel-color,var(--accent))_8%,var(--bg-surface))]'
            : 'bg-background',
        )}
        title="Drag to reorder"
        {...dragHandlers}
      >
        <span className="text-foreground font-medium whitespace-nowrap overflow-hidden text-ellipsis">
          {preset ? preset.name : `Panel ${index + 1}`}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="index text-muted-foreground text-[10px]">
            {index < 9 ? `\u2318${index + 1}` : ''}
          </span>
          <PresetDropdown panelIndex={index} open={showDropdown} onOpenChange={setShowDropdown} onEditPreset={onEditPreset}>
            <button
              type="button"
              className={cn(
                'size-3 rounded-full shrink-0 cursor-pointer outline-none [-webkit-app-region:no-drag]',
                'transition-[transform,border-color] duration-150 hover:scale-110',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                panelColor
                  ? 'border border-transparent hover:border-foreground/20'
                  : 'border border-dashed border-muted-foreground/50 hover:border-muted-foreground/80',
              )}
              style={panelColor ? { background: panelColor } : undefined}
              aria-label="Assign preset"
              aria-haspopup="menu"
              title="Assign preset"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </PresetDropdown>
        </span>
      </div>
      <div className="terminal-wrap flex-1 relative overflow-hidden min-h-0">
        <AgentOverlay
          imageDataUrl={imageDataUrl}
          name={preset?.name || ''}
          opacity={opacity}
          isActive={isActive}
        />
        <TerminalView
          ref={terminalRef}
          ptyId={ptyId}
          shell={preset?.shell}
          cwd={cwd || undefined}
          theme={theme}
          cursorColor={panelColor}
          onExit={handleExit}
        />
        {exitCode !== null && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-panel/70 animate-[fade-in_200ms_ease]">
            <div className="text-center">
              <p className="text-muted-foreground text-xs mb-2">
                Process exited with code {exitCode}
              </p>
              <button
                type="button"
                className="text-xs text-primary/70 hover:text-primary border border-primary/30 hover:border-primary/60 rounded-md px-3 py-1 transition-colors"
                onClick={handleRestart}
              >
                Restart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

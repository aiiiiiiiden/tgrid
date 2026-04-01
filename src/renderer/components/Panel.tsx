import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import TerminalView from './TerminalView';
import AgentOverlay from './AgentOverlay';
import PresetDropdown from './PresetDropdown';
import { useDragSwap } from '../hooks/useDragSwap';
import { useLazyImage } from '../hooks/useImageLoader';
import { usePresets, useGridSelection } from '../context/GridContext';
import { useTheme } from '../context/ThemeContext';
import { getDisplayColor } from '../utils/colors';

const DEFAULT_OPACITY = 0.15;
const ACTIVE_OPACITY = 0.25;

interface PanelProps {
  index: number;
  ptyId: string;
  isActive: boolean;
  isFullscreen: boolean;
  isHidden: boolean;
  cwd?: string | null;
  onActivate: () => void;
  onSwap: (sourceIndex: number, targetIndex: number) => void;
}

export default function Panel({
  index,
  ptyId,
  isActive,
  isFullscreen,
  isHidden,
  cwd,
  onActivate,
  onSwap,
}: PanelProps) {
  const { presets, assignments, config } = usePresets();
  const { fullscreenIndex } = useGridSelection();
  const { theme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const presetId = assignments[String(index)] || null;
  const preset = presetId ? presets.find((p) => p.id === presetId) : null;

  const panelColor = preset?.color ? getDisplayColor(preset.color, theme) : null;
  const imageDataUrl = useLazyImage(preset?.image || null);
  const opacity = isActive
    ? config.activeOpacity || ACTIVE_OPACITY
    : config.defaultOpacity || DEFAULT_OPACITY;

  const dragHandlers = useDragSwap({ panelIndex: index, fullscreenIndex, onSwap });

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown((v) => !v);
  }, []);

  const panelClassName = `panel${isActive ? ' active' : ''}${isFullscreen ? ' fullscreen' : ''}`;

  if (isHidden) return null;

  return (
    <div
      className={panelClassName}
      style={{ order: index, ...(panelColor ? { '--panel-color': panelColor } : {}) } as React.CSSProperties}
      onMouseDown={onActivate}
      role="region"
      aria-label={`Terminal ${index + 1}`}
    >
      <div
        className="panel-header"
        {...dragHandlers}
      >
        <span className="name">{preset ? preset.name : `Terminal ${index + 1}`}</span>
        <span className="panel-header-right">
          <span className="index">{index < 9 ? `\u2318${index + 1}` : ''}</span>
          <button
            ref={menuBtnRef}
            className="panel-menu-btn"
            aria-label="Panel options"
            aria-haspopup="menu"
            draggable={false}
            onClick={handleMenuClick}
          >
            &middot;&middot;&middot;
          </button>
        </span>
      </div>
      <div className="terminal-wrap">
        <AgentOverlay
          imageDataUrl={imageDataUrl}
          name={preset?.name || ''}
          opacity={opacity}
        />
        <TerminalView
          ptyId={ptyId}
          shell={preset?.shell}
          cwd={cwd || undefined}
          theme={theme}
          cursorColor={panelColor}
        />
      </div>
      {showDropdown && menuBtnRef.current && createPortal(
        <PresetDropdown
          panelIndex={index}
          anchorEl={menuBtnRef.current}
          onClose={() => setShowDropdown(false)}
        />,
        document.body,
      )}
    </div>
  );
}

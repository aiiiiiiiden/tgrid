import React, { useState, useCallback } from 'react';
import type { Preset } from '../../shared/types';
import { usePresets } from '../context/GridContext';
import { useTheme } from '../context/ThemeContext';
import { getDisplayColor } from '../utils/colors';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

interface PresetDropdownProps {
  panelIndex: number;
  anchorEl: HTMLElement;
  onClose: () => void;
}

export default function PresetDropdown({ panelIndex, anchorEl, onClose }: PresetDropdownProps) {
  const { presets, assignments, setAssignments, imageCache } = usePresets();
  const { theme } = useTheme();
  const dropdownRef = useDropdownPosition<HTMLDivElement>({ anchorEl, onClose });
  const [focusedIdx, setFocusedIdx] = useState(0);
  const currentPresetId = assignments[String(panelIndex)] || null;

  const items: Array<{ id: string | null; label: string; isCheck: boolean; color?: string; imgSrc?: string }> = [
    { id: null, label: 'None', isCheck: currentPresetId === null },
  ];
  for (const p of presets) {
    items.push({
      id: p.id,
      label: p.name,
      isCheck: currentPresetId === p.id,
      color: getDisplayColor(p.color, theme) || undefined,
      imgSrc: imageCache[p.image || ''] || undefined,
    });
  }

  const assign = useCallback(
    async (presetId: string | null) => {
      const newAssignments = await window.tgrid.invoke('set-assignment', { panelIndex, presetId });
      setAssignments(newAssignments);
      onClose();
    },
    [panelIndex, setAssignments, onClose],
  );

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx((i) => (i < items.length - 1 ? i + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx((i) => (i > 0 ? i - 1 : items.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        assign(items[focusedIdx].id);
      }
    },
    [items, focusedIdx, assign],
  );

  return (
    <div
      ref={dropdownRef}
      className="dropdown"
      role="menu"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.id ?? 'none'}>
          {i === 1 && <div className="dropdown-separator" />}
          <div
            className={`dropdown-item${item.isCheck ? ' active' : ''}${focusedIdx === i ? ' focused' : ''}`}
            role="menuitem"
            onClick={() => assign(item.id)}
            onMouseEnter={() => setFocusedIdx(i)}
          >
            <span className="check">{item.isCheck ? '\u2713' : ''}</span>
            {item.color && (
              <span className="preset-color-dot" style={{ background: item.color }} />
            )}
            {item.imgSrc && <img src={item.imgSrc} alt="" />}
            <span>{item.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

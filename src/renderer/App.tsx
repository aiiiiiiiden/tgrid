import React, { useState, useCallback, useEffect, useRef } from 'react';
import Grid from './components/Grid';
import GridPicker from './components/GridPicker';
import GridResizeDropdown from './components/GridResizeDropdown';
import PresetEditor from './components/PresetEditor';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { GridProvider, useGrid, usePresets } from './context/GridContext';
import { useIpcEvent } from './hooks/useIpc';
import { useDropdownPosition } from './hooks/useDropdownPosition';
import { usePreloadImages } from './hooks/useImageLoader';
import { getDisplayColor } from './utils/colors';
import { ptyIdFor, buildInitialPtyMap } from './utils/ptyMap';
import type { Preset, TGridConfig, SessionData, SessionPanel } from '../shared/types';

const IS_MAC = navigator.platform.indexOf('Mac') !== -1;
const MOD_KEY = IS_MAC ? '\u2318' : 'Ctrl+';

function AppInner() {
  const {
    rows, cols, activeIndex, fullscreenIndex, presets, assignments,
    setGrid, setActiveIndex, setFullscreenIndex, setPresets, setAssignments,
    setConfig, config, cacheImage, getCachedImage, imageCache,
  } = useGrid();
  const { theme, toggleTheme } = useTheme();

  const [phase, setPhase] = useState<'loading' | 'grid-picker' | 'running'>('loading');
  const [pickerLastGrid, setPickerLastGrid] = useState({ rows: 2, cols: 2 });
  const [panelCwds, setPanelCwds] = useState<Record<number, string>>({});
  const [ptyMap, setPtyMap] = useState<Record<number, string>>({});
  const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);
  const [showGridResize, setShowGridResize] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null | undefined>(undefined);
  const [helpOpen, setHelpOpen] = useState(false);

  const presetsRef = useRef<HTMLButtonElement>(null);
  const gridIndicatorRef = useRef<HTMLButtonElement>(null);
  const helpRef = useRef<HTMLButtonElement>(null);
  const shiftDetected = useRef(false);

  // Shift detection for session restore bypass
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftDetected.current = true;
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const preloadImages = usePreloadImages();

  // IPC: show-grid-picker
  useIpcEvent('show-grid-picker', async (data) => {
    setConfig(data.config);
    setPickerLastGrid(data.lastGrid);
    setPhase('grid-picker');
  }, [setConfig]);

  // IPC: restore-session
  useIpcEvent('restore-session', async (data) => {
    const cfg = data.config;
    setConfig(cfg);

    // Brief window for Shift detection
    await new Promise((r) => setTimeout(r, 100));

    if (shiftDetected.current) {
      const lastGrid = data.session.grid || { rows: 2, cols: 2 };
      setPickerLastGrid(lastGrid);
      setPhase('grid-picker');
      return;
    }

    const session = data.session;
    setGrid(session.grid.rows, session.grid.cols);

    // Rebuild assignments from session
    const newAssignments: Record<string, string> = {};
    session.panels.forEach((p: SessionPanel) => {
      if (p.presetId) newAssignments[String(p.index)] = p.presetId;
    });
    setAssignments(newAssignments);

    // Set per-panel cwds
    const cwds: Record<number, string> = {};
    session.panels.forEach((p: SessionPanel) => {
      cwds[p.index] = p.cwd;
    });
    setPanelCwds(cwds);

    setPtyMap(buildInitialPtyMap(session.grid.rows * session.grid.cols));

    await preloadImages(cfg.presets || []);

    setPhase('running');

    // Persist updated assignments
    await window.tgrid.invoke('restore-assignments', {
      assignments: newAssignments,
      grid: { rows: session.grid.rows, cols: session.grid.cols },
    });
  }, [setConfig, setGrid, setAssignments, preloadImages]);

  // IPC: init (from grid picker selection or CLI args)
  useIpcEvent('init', async (data) => {
    setGrid(data.rows, data.cols);
    setConfig(data.config);
    await preloadImages(data.config.presets || []);

    setPtyMap(buildInitialPtyMap(data.rows * data.cols));
    setPhase('running');
  }, [setGrid, setConfig, preloadImages]);

  // IPC: focus-panel
  useIpcEvent('focus-panel', (index) => {
    if (typeof index === 'number' && index >= 0 && index < rows * cols) {
      setActiveIndex(index);
    }
  }, [rows, cols, setActiveIndex]);

  // IPC: focus-direction
  useIpcEvent('focus-direction', (dir) => {
    const row = Math.floor(activeIndex / cols);
    const col = activeIndex % cols;
    let newRow = row;
    let newCol = col;
    switch (dir) {
      case 'up': newRow = (row - 1 + rows) % rows; break;
      case 'down': newRow = (row + 1) % rows; break;
      case 'left': newCol = (col - 1 + cols) % cols; break;
      case 'right': newCol = (col + 1) % cols; break;
    }
    const newIdx = newRow * cols + newCol;
    if (newIdx < rows * cols) setActiveIndex(newIdx);
  }, [activeIndex, rows, cols, setActiveIndex]);

  // IPC: toggle-fullscreen
  useIpcEvent('toggle-fullscreen', () => {
    setFullscreenIndex(fullscreenIndex >= 0 ? -1 : activeIndex);
  }, [fullscreenIndex, activeIndex, setFullscreenIndex]);

  // Grid picker selection
  const handleGridSelect = useCallback(async (r: number, c: number) => {
    await window.tgrid.invoke('grid-selected', { rows: r, cols: c });
  }, []);

  // Grid resize — spatial remapping preserves row/col positions
  const handleGridResize = useCallback(async (newRows: number, newCols: number) => {
    const oldRows = rows;
    const oldCols = cols;
    const newTotal = newRows * newCols;

    // Build new ptyMap and assignments with spatial mapping
    const newPtyMap: Record<number, string> = {};
    const newAssigns: Record<string, string> = {};
    const keptPtyIds = new Set<string>();

    for (let r = 0; r < newRows; r++) {
      for (let c = 0; c < newCols; c++) {
        const newIdx = r * newCols + c;
        if (r < oldRows && c < oldCols) {
          const oldIdx = r * oldCols + c;
          const pid = ptyMap[oldIdx] || ptyIdFor(oldIdx);
          newPtyMap[newIdx] = pid;
          keptPtyIds.add(pid);
          const presetId = assignments[String(oldIdx)];
          if (presetId) newAssigns[String(newIdx)] = presetId;
        }
      }
    }

    // Generate ptyIds for new positions (expansion)
    const usedIds = new Set(Object.values(newPtyMap));
    let nextNum = 0;
    for (let i = 0; i < newTotal; i++) {
      if (!newPtyMap[i]) {
        while (usedIds.has(ptyIdFor(nextNum))) nextNum++;
        newPtyMap[i] = ptyIdFor(nextNum);
        usedIds.add(newPtyMap[i]);
        nextNum++;
      }
    }

    // Determine PTYs to kill (old ones not kept)
    const oldTotal = oldRows * oldCols;
    const killPtyIds: string[] = [];
    for (let i = 0; i < oldTotal; i++) {
      const pid = ptyMap[i] || ptyIdFor(i);
      if (!keptPtyIds.has(pid)) killPtyIds.push(pid);
    }

    // Adjust active/fullscreen indices
    if (fullscreenIndex >= newTotal) setFullscreenIndex(-1);
    if (activeIndex >= newTotal) setActiveIndex(newTotal - 1);

    // Persist to main process
    await window.tgrid.invoke('resize-grid', {
      rows: newRows,
      cols: newCols,
      killPtyIds,
      assignments: newAssigns,
    });

    setGrid(newRows, newCols);
    setPtyMap(newPtyMap);
    setAssignments(newAssigns);
  }, [rows, cols, ptyMap, assignments, fullscreenIndex, activeIndex, setGrid, setFullscreenIndex, setActiveIndex, setAssignments]);

  // Swap panel assignments + PTY mapping
  const handleSwap = useCallback(async (sourceIdx: number, targetIdx: number) => {
    const sourcePresetId = assignments[String(sourceIdx)] || null;
    const targetPresetId = assignments[String(targetIdx)] || null;

    const newAssignments = { ...assignments };
    if (targetPresetId) newAssignments[String(sourceIdx)] = targetPresetId;
    else delete newAssignments[String(sourceIdx)];
    if (sourcePresetId) newAssignments[String(targetIdx)] = sourcePresetId;
    else delete newAssignments[String(targetIdx)];

    setAssignments(newAssignments);

    // Swap PTY mapping so terminal content follows the drag
    setPtyMap((prev) => {
      const next = { ...prev };
      const tmp = next[sourceIdx];
      next[sourceIdx] = next[targetIdx];
      next[targetIdx] = tmp;
      return next;
    });

    await window.tgrid.invoke('swap-assignments', {
      indexA: sourceIdx,
      presetIdA: targetPresetId,
      indexB: targetIdx,
      presetIdB: sourcePresetId,
    });
  }, [assignments, setAssignments]);

  // Presets dropdown
  const handlePresetsClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await preloadImages(presets);
    setShowPresetsDropdown((v) => !v);
  }, [presets, preloadImages]);

  // Status bar info
  const statusPresetId = assignments[String(activeIndex)] || null;
  const statusPreset = statusPresetId ? presets.find((p) => p.id === statusPresetId) : null;
  const statusText = statusPreset
    ? `${statusPreset.name} \u00b7 Panel ${activeIndex + 1}`
    : `Panel ${activeIndex + 1}`;
  const panelCountText = `${rows * cols} panel${rows * cols !== 1 ? 's' : ''}`;

  if (phase === 'loading') {
    return <div style={{ background: 'var(--bg-base)', flex: 1 }} />;
  }

  if (phase === 'grid-picker') {
    return <GridPicker lastGrid={pickerLastGrid} onSelect={handleGridSelect} />;
  }


  return (
    <>
      <div className="titlebar">
        <h1>tgrid</h1>
        <div className="titlebar-controls">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            aria-label={
              theme === 'light'
                ? 'Current theme: light. Switch to dark theme'
                : 'Current theme: dark. Switch to light theme'
            }
          >
            {theme === 'light' ? 'Light' : 'Dark'} &#9662;
          </button>
          <button
            ref={presetsRef}
            className="presets-btn"
            aria-haspopup="menu"
            onClick={handlePresetsClick}
          >
            Presets &#9662;
          </button>
          <button
            ref={gridIndicatorRef}
            className="grid-indicator"
            aria-label="Grid size"
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              setShowGridResize((v) => !v);
            }}
          >
            {rows} &times; {cols} &middot; {rows * cols} agents &#9662;
          </button>
        </div>
      </div>

      <Grid panelCwds={panelCwds} ptyMap={ptyMap} onSwap={handleSwap} />

      <div className="statusbar">
        <span role="status" aria-live="polite">{statusText}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{panelCountText}</span>
          <button
            ref={helpRef}
            className="help-btn"
            aria-label="Keyboard shortcuts"
            onClick={(e) => {
              e.stopPropagation();
              setHelpOpen((v) => !v);
            }}
          >
            ?
          </button>
        </span>
      </div>

      {/* Presets dropdown */}
      {showPresetsDropdown && presetsRef.current && (
        <PresetsDropdownPanel
          anchorEl={presetsRef.current}
          onClose={() => setShowPresetsDropdown(false)}
          onEdit={(p) => {
            setShowPresetsDropdown(false);
            setEditingPreset(p);
          }}
        />
      )}

      {/* Grid resize dropdown */}
      {showGridResize && gridIndicatorRef.current && (
        <GridResizeDropdown
          currentRows={rows}
          currentCols={cols}
          anchorEl={gridIndicatorRef.current}
          onResize={handleGridResize}
          onClose={() => setShowGridResize(false)}
        />
      )}

      {/* Preset editor modal */}
      {editingPreset !== undefined && (
        <PresetEditor
          preset={editingPreset}
          onClose={() => setEditingPreset(undefined)}
        />
      )}

      {/* Help dropdown */}
      {helpOpen && helpRef.current && (
        <HelpDropdown anchorEl={helpRef.current} onClose={() => setHelpOpen(false)} />
      )}
    </>
  );
}

// ── Presets dropdown in titlebar ──

function PresetsDropdownPanel({
  anchorEl,
  onClose,
  onEdit,
}: {
  anchorEl: HTMLElement;
  onClose: () => void;
  onEdit: (preset: Preset | null) => void;
}) {
  const { presets, setPresets, imageCache } = usePresets();
  const { theme } = useTheme();
  const ddRef = useDropdownPosition<HTMLDivElement>({ anchorEl, onClose });
  const preloadImages = usePreloadImages();

  const handleInstallPack = useCallback(async (packName: string) => {
    const updatedPresets = await window.tgrid.invoke('install-preset-pack', packName);
    setPresets(updatedPresets);
    await preloadImages(updatedPresets);
    onClose();
  }, [setPresets, preloadImages, onClose]);

  const hasHarryPotter = presets.some((p) =>
    ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'].includes(p.name),
  );

  return (
    <div ref={ddRef} className="dropdown presets-dropdown-container" role="menu">
      {presets.map((p) => (
        <div
          key={p.id}
          className="dropdown-item"
          role="menuitem"
          onClick={() => onEdit(p)}
        >
          {p.color && (
            <span
              className="preset-color-dot"
              style={{ background: getDisplayColor(p.color, theme) || undefined }}
            />
          )}
          {p.image && imageCache[p.image] && <img src={imageCache[p.image]} alt="" />}
          <span>{p.name}</span>
          <span
            className="edit-icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(p);
            }}
          >
            &#9998;
          </span>
        </div>
      ))}
      <div className="dropdown-separator" />
      <div className="dropdown-action" onClick={() => onEdit(null)}>
        Create Preset
      </div>
      {!hasHarryPotter && (
        <div className="dropdown-action" onClick={() => handleInstallPack('harry-potter')}>
          Add Harry Potter Pack
        </div>
      )}
    </div>
  );
}

// ── Help dropdown ──

function HelpDropdown({
  anchorEl,
  onClose,
}: {
  anchorEl: HTMLElement;
  onClose: () => void;
}) {
  const ddRef = useDropdownPosition<HTMLDivElement>({ anchorEl, onClose, above: true });

  const items = [
    `${MOD_KEY}1-9  Focus panel`,
    `${MOD_KEY}\u2191\u2193\u2190\u2192  Navigate panels`,
    `${MOD_KEY}\u23CE  Toggle fullscreen`,
    null,
    `Shift  New session (on launch)`,
  ];

  return (
    <div ref={ddRef} className="dropdown" role="menu">
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="dropdown-separator" />
        ) : (
          <div key={i} className="dropdown-item" role="menuitem">
            <span>{item}</span>
          </div>
        ),
      )}
    </div>
  );
}

// ── Root component ──

export default function App() {
  return (
    <GridProvider>
      <ThemeProviderWrapper>
        <AppInner />
      </ThemeProviderWrapper>
    </GridProvider>
  );
}

function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const { config } = useGrid();
  return (
    <ThemeProvider initialTheme={config.theme}>
      {children}
    </ThemeProvider>
  );
}

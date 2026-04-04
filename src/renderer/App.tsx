import React, { useState, useCallback, useEffect, useRef } from 'react';
import Grid from './components/Grid';
import GridPicker from './components/GridPicker';
import GridResizeDropdown from './components/GridResizeDropdown';
import PresetEditor from './components/PresetEditor';
import PresetAvatar from './components/PresetAvatar';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { GridProvider, useGrid, usePresets } from './context/GridContext';
import { useIpcEvent } from './hooks/useIpc';
import { usePreloadImages } from './hooks/useImageLoader';
import { getDisplayColor } from './utils/colors';
import { ptyIdFor, buildInitialPtyMap } from './utils/ptyMap';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import type { Preset, TGridConfig, SessionData, SessionPanel } from '../shared/types';
import { TOOLBAR_BTN } from './utils/styles';
import { cn } from '@/lib/utils';

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
  const [editingPreset, setEditingPreset] = useState<Preset | null | undefined>(undefined);

  const shiftDetected = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftDetected.current = true;
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const preloadImages = usePreloadImages();

  useIpcEvent('show-grid-picker', async (data) => {
    setConfig(data.config);
    setPickerLastGrid(data.lastGrid);
    setPhase('grid-picker');
  }, [setConfig]);

  useIpcEvent('restore-session', async (data) => {
    const cfg = data.config;
    setConfig(cfg);
    await new Promise((r) => setTimeout(r, 100));

    if (shiftDetected.current) {
      const lastGrid = data.session.grid || { rows: 2, cols: 2 };
      setPickerLastGrid(lastGrid);
      setPhase('grid-picker');
      return;
    }

    const session = data.session;
    setGrid(session.grid.rows, session.grid.cols);

    const newAssignments: Record<string, string> = {};
    session.panels.forEach((p: SessionPanel) => {
      if (p.presetId) newAssignments[String(p.index)] = p.presetId;
    });
    setAssignments(newAssignments);

    const cwds: Record<number, string> = {};
    session.panels.forEach((p: SessionPanel) => {
      cwds[p.index] = p.cwd;
    });
    setPanelCwds(cwds);
    setPtyMap(buildInitialPtyMap(session.grid.rows * session.grid.cols));
    await preloadImages(cfg.presets || []);
    setPhase('running');

    await window.tgrid.invoke('restore-assignments', {
      assignments: newAssignments,
      grid: { rows: session.grid.rows, cols: session.grid.cols },
    });
  }, [setConfig, setGrid, setAssignments, preloadImages]);

  useIpcEvent('init', async (data) => {
    setGrid(data.rows, data.cols);
    setConfig(data.config);
    await preloadImages(data.config.presets || []);
    setPtyMap(buildInitialPtyMap(data.rows * data.cols));
    setPhase('running');
  }, [setGrid, setConfig, preloadImages]);

  useIpcEvent('focus-panel', (index) => {
    if (typeof index === 'number' && index >= 0 && index < rows * cols) {
      setActiveIndex(index);
    }
  }, [rows, cols, setActiveIndex]);

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

  useIpcEvent('toggle-fullscreen', () => {
    setFullscreenIndex(fullscreenIndex >= 0 ? -1 : activeIndex);
  }, [fullscreenIndex, activeIndex, setFullscreenIndex]);

  const handleGridSelect = useCallback(async (r: number, c: number) => {
    await window.tgrid.invoke('grid-selected', { rows: r, cols: c });
  }, []);

  const handleGridResize = useCallback(async (newRows: number, newCols: number) => {
    const oldRows = rows;
    const oldCols = cols;
    const newTotal = newRows * newCols;

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

    const oldTotal = oldRows * oldCols;
    const killPtyIds: string[] = [];
    for (let i = 0; i < oldTotal; i++) {
      const pid = ptyMap[i] || ptyIdFor(i);
      if (!keptPtyIds.has(pid)) killPtyIds.push(pid);
    }

    if (fullscreenIndex >= newTotal) setFullscreenIndex(-1);
    if (activeIndex >= newTotal) setActiveIndex(newTotal - 1);

    await window.tgrid.invoke('resize-grid', {
      rows: newRows, cols: newCols, killPtyIds, assignments: newAssigns,
    });

    setGrid(newRows, newCols);
    setPtyMap(newPtyMap);
    setAssignments(newAssigns);
  }, [rows, cols, ptyMap, assignments, fullscreenIndex, activeIndex, setGrid, setFullscreenIndex, setActiveIndex, setAssignments]);

  const handleSwap = useCallback(async (sourceIdx: number, targetIdx: number) => {
    const sourcePresetId = assignments[String(sourceIdx)] || null;
    const targetPresetId = assignments[String(targetIdx)] || null;

    const newAssignments = { ...assignments };
    if (targetPresetId) newAssignments[String(sourceIdx)] = targetPresetId;
    else delete newAssignments[String(sourceIdx)];
    if (sourcePresetId) newAssignments[String(targetIdx)] = sourcePresetId;
    else delete newAssignments[String(targetIdx)];

    setAssignments(newAssignments);

    setPtyMap((prev) => {
      const next = { ...prev };
      const tmp = next[sourceIdx];
      next[sourceIdx] = next[targetIdx];
      next[targetIdx] = tmp;
      return next;
    });

    await window.tgrid.invoke('swap-assignments', {
      indexA: sourceIdx, presetIdA: targetPresetId,
      indexB: targetIdx, presetIdB: sourcePresetId,
    });
  }, [assignments, setAssignments]);

  const statusPresetId = assignments[String(activeIndex)] || null;
  const statusPreset = statusPresetId ? presets.find((p) => p.id === statusPresetId) : null;
  const statusColor = statusPreset?.color ? getDisplayColor(statusPreset.color, theme) : null;
  const panelCountText = `${rows * cols} panel${rows * cols !== 1 ? 's' : ''}`;

  if (phase === 'loading') {
    return <div className="flex-1 bg-canvas" />;
  }

  if (phase === 'grid-picker') {
    return <GridPicker lastGrid={pickerLastGrid} onSelect={handleGridSelect} />;
  }

  return (
    <>
      <div className="bg-secondary border-b border-border flex items-center justify-end [-webkit-app-region:drag] shrink-0 h-[38px] py-2 pr-4 pl-20">
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <Button
            variant="secondary"
            size="icon-xs"
            className={cn(TOOLBAR_BTN, 'px-0')}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? '\u263C' : '\u263E'}
          </Button>

          <PresetsDropdownPanel onEdit={(p) => setEditingPreset(p)} />

          <GridResizeDropdown
            currentRows={rows}
            currentCols={cols}
            onResize={handleGridResize}
          />
        </div>
      </div>

      <Grid panelCwds={panelCwds} ptyMap={ptyMap} onSwap={handleSwap} onEditPreset={(p) => setEditingPreset(p)} />

      <div className="bg-secondary border-t border-border px-4 py-[3px] text-[11px] text-muted-foreground flex items-center justify-between shrink-0 h-6">
        <span role="status" aria-live="polite" className="flex items-center gap-1.5">
          {statusColor && (
            <span className="size-3 rounded-full shrink-0" style={{ background: statusColor }} />
          )}
          {statusPreset && (
            <span className="text-foreground">{statusPreset.name}</span>
          )}
          <span>{statusPreset ? '\u00b7' : ''} Panel {activeIndex + 1}</span>
          {panelCwds[activeIndex] && (
            <span>{'\u00b7'} {panelCwds[activeIndex].split(/[/\\]/).filter(Boolean).pop() || '/'}</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span>{panelCountText}</span>
          <HelpDropdown />
        </span>
      </div>

      {editingPreset !== undefined && (
        <PresetEditor preset={editingPreset} onClose={() => setEditingPreset(undefined)} />
      )}
    </>
  );
}

function PresetsDropdownPanel({ onEdit }: { onEdit: (preset: Preset | null) => void }) {
  const { presets, setPresets, imageCache } = usePresets();
  const { theme } = useTheme();
  const preloadImages = usePreloadImages();

  const handleInstallPack = useCallback(async (packName: string) => {
    const updatedPresets = await window.tgrid.invoke('install-preset-pack', packName);
    setPresets(updatedPresets);
    await preloadImages(updatedPresets);
  }, [setPresets, preloadImages]);

  const hasHarryPotter = presets.some((p) =>
    ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'].includes(p.name),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="xs" className={TOOLBAR_BTN} title="Manage presets">
          Presets &#9662;
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {presets.map((p) => {
          const color = getDisplayColor(p.color, theme) || undefined;
          const imgSrc = p.image ? imageCache[p.image] : undefined;
          return (
            <DropdownMenuItem key={p.id} className="gap-2" onClick={() => onEdit(p)}>
              <PresetAvatar imgSrc={imgSrc} color={color} />
              <span>{p.name}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={() => onEdit(null)}>Create Preset</DropdownMenuItem>
        {!hasHarryPotter && (
          <DropdownMenuItem onClick={() => handleInstallPack('harry-potter')}>
            Add Harry Potter Pack
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HelpDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon-xs"
          className="text-[10px] border border-input text-subtle hover:border-primary hover:text-primary"
          aria-label="Keyboard shortcuts"
        >
          ?
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuItem disabled>
          <span>{MOD_KEY}1-9</span>
          <DropdownMenuShortcut>Focus panel</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <span>{MOD_KEY}{'\u2191\u2193\u2190\u2192'}</span>
          <DropdownMenuShortcut>Navigate</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <span>{MOD_KEY}{'\u23CE'}</span>
          <DropdownMenuShortcut>Fullscreen</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <span>Shift</span>
          <DropdownMenuShortcut>New session</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

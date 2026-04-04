import React, { useCallback } from 'react';
import { usePresets } from '../context/GridContext';
import { useTheme } from '../context/ThemeContext';
import { getDisplayColor } from '../utils/colors';
import PresetAvatar from './PresetAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PresetDropdownProps {
  panelIndex: number;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditPreset?: (preset: import('../../shared/types').Preset | null) => void;
}

export default function PresetDropdown({ panelIndex, children, open, onOpenChange, onEditPreset }: PresetDropdownProps) {
  const { presets, assignments, setAssignments, imageCache } = usePresets();
  const { theme } = useTheme();
  const currentPresetId = assignments[String(panelIndex)] || '';

  const assign = useCallback(
    async (presetId: string) => {
      const newAssignments = await window.tgrid.invoke('set-assignment', {
        panelIndex,
        presetId: presetId || null,
      });
      setAssignments(newAssignments);
      onOpenChange(false);
    },
    [panelIndex, setAssignments, onOpenChange],
  );

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        <DropdownMenuItem className="gap-2" onClick={() => assign('')}>
          <span className="size-5 rounded-full shrink-0 border border-dashed border-muted-foreground/60" />
          <span className="text-muted-foreground">None</span>
          {currentPresetId === '' && <span className="ml-auto text-primary text-xs">&#10003;</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {presets.map((p) => {
          const color = getDisplayColor(p.color, theme) || undefined;
          const imgSrc = imageCache[p.image || ''] || undefined;
          const isSelected = currentPresetId === p.id;

          return (
            <DropdownMenuItem key={p.id} className="gap-2" onClick={() => assign(p.id)}>
              <PresetAvatar imgSrc={imgSrc} color={color} />
              <span>{p.name}</span>
              {isSelected && <span className="ml-auto text-primary text-xs">&#10003;</span>}
            </DropdownMenuItem>
          );
        })}

        {onEditPreset && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-muted-foreground"
              onClick={() => { onOpenChange(false); onEditPreset(null); }}
            >
              Manage Presets&#8230;
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

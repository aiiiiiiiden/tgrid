import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Preset } from '../../shared/types';
import { useTheme } from '../context/ThemeContext';
import { usePresets } from '../context/GridContext';
import { useLazyImage } from '../hooks/useImageLoader';
import { PRESET_COLORS, getPresetColors } from '../utils/colors';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PresetEditorProps {
  preset: Preset | null;
  onClose: () => void;
}

export default function PresetEditor({ preset, onClose }: PresetEditorProps) {
  const isNew = !preset;
  const { theme } = useTheme();
  const { setPresets, setAssignments, cacheImage } = usePresets();

  const [name, setName] = useState(preset?.name || '');
  const [shell, setShell] = useState(preset?.shell || '');
  const [imagePath, setImagePath] = useState(preset?.image || '');
  const [color, setColor] = useState<string | null>(preset?.color ?? null);
  const [showConfirm, setShowConfirm] = useState(false);

  const imageDataUrl = useLazyImage(imagePath || null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handlePickImage = useCallback(async () => {
    const path = await window.tgrid.invoke('pick-image');
    if (path) {
      setImagePath(path);
      const dataUrl = await window.tgrid.invoke('load-image', path);
      if (dataUrl) cacheImage(path, dataUrl);
    }
  }, [cacheImage]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) { nameRef.current?.focus(); return; }
    const data: Preset = {
      id: preset?.id || '',
      name: trimmed,
      image: imagePath || undefined,
      shell: shell.trim() || undefined,
      color,
    };
    const updatedPresets = await window.tgrid.invoke('save-preset', data);
    setPresets(updatedPresets);
    onClose();
  }, [name, preset, imagePath, shell, color, setPresets, onClose]);

  const handleDelete = useCallback(async () => {
    if (!preset) return;
    const result = await window.tgrid.invoke('delete-preset', preset.id);
    setPresets(result.presets);
    setAssignments(result.assignments);
    onClose();
  }, [preset, setPresets, setAssignments, onClose]);

  const displayColors = useMemo(() => getPresetColors(theme), [theme]);

  if (showConfirm) {
    return (
      <Dialog open onOpenChange={() => setShowConfirm(false)}>
        <DialogContent showCloseButton={false} className="max-w-[320px] gap-3 p-4 bg-background border-input">
          <DialogHeader>
            <DialogTitle className="text-sm font-normal">
              Delete preset &ldquo;{preset?.name}&rdquo;?
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="max-w-[400px] gap-3 bg-background border-input">
        <DialogHeader>
          <DialogTitle className="text-sm">{isNew ? 'New Preset' : 'Edit Preset'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <label className="block text-[11px] text-secondary-foreground mb-1.5">Name</label>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          <div>
            <label className="block text-[11px] text-secondary-foreground mb-1.5">Image</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePickImage}
                className="group/img relative cursor-pointer rounded-lg overflow-hidden shrink-0 border-0 bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
              >
                {imageDataUrl ? (
                  <div className="relative">
                    <img src={imageDataUrl} alt="Preview" className="size-16 rounded-lg object-cover bg-secondary border border-input" />
                    <div className="absolute inset-0 rounded-lg bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white/0 group-hover/img:text-white/90 text-xs transition-colors">Change</span>
                    </div>
                  </div>
                ) : (
                  <div className="size-16 rounded-lg bg-secondary border border-dashed border-input flex items-center justify-center text-muted-foreground text-xl group-hover/img:border-primary group-hover/img:text-foreground transition-colors">+</div>
                )}
              </button>
              <span className="text-[11px] text-muted-foreground">Click to choose image</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-secondary-foreground mb-1.5">Color</label>
            <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="Preset color">
              {PRESET_COLORS.map((c, idx) => {
                const displayC = displayColors[idx];
                const isSelected = color === c.value || (color == null && c.value === null);
                const isNone = c.value === null;
                return (
                  <button
                    key={c.label}
                    type="button"
                    className={cn(
                      'size-7 rounded-full border-2 border-transparent cursor-pointer transition-[border-color,transform] duration-150 relative p-0 outline-none hover:scale-[1.15] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isNone && 'bg-muted border-dashed border-input',
                      isSelected && !isNone && 'border-foreground',
                      isSelected && isNone && 'border-solid border-foreground',
                    )}
                    style={displayC.value ? { background: displayC.value } : undefined}
                    title={c.label}
                    aria-label={c.label}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setColor(c.value)}
                  >
                    {isSelected && (
                      <span className={cn(
                        'absolute inset-0 flex items-center justify-center text-[11px] font-bold',
                        isNone ? 'text-muted-foreground' : 'text-foreground [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]',
                      )}>
                        &#10003;
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-secondary-foreground mb-1.5">Shell override (optional)</label>
            <Input
              value={shell}
              onChange={(e) => setShell(e.target.value)}
              placeholder="default"
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between">
          {!isNew && (
            <Button variant="destructive" size="sm" className="mr-auto" onClick={() => setShowConfirm(true)}>
              Delete
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="border border-input" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

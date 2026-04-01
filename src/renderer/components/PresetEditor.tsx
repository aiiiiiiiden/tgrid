import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Preset } from '../../shared/types';
import { useTheme } from '../context/ThemeContext';
import { usePresets } from '../context/GridContext';
import { PRESET_COLORS, getPresetColors } from '../utils/colors';

interface PresetEditorProps {
  preset: Preset | null;
  onClose: () => void;
}

export default function PresetEditor({ preset, onClose }: PresetEditorProps) {
  const isNew = !preset;
  const { theme } = useTheme();
  const { setPresets, setAssignments, cacheImage, getCachedImage } = usePresets();

  const [name, setName] = useState(preset?.name || '');
  const [shell, setShell] = useState(preset?.shell || '');
  const [imagePath, setImagePath] = useState(preset?.image || '');
  const [color, setColor] = useState<string | null>(preset?.color ?? null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Load existing image preview
  useEffect(() => {
    if (!imagePath) return;
    const cached = getCachedImage(imagePath);
    if (cached) {
      setImageDataUrl(cached);
      return;
    }
    window.tgrid.invoke('load-image', imagePath).then((dataUrl) => {
      if (dataUrl) {
        cacheImage(imagePath, dataUrl);
        setImageDataUrl(dataUrl);
      }
    });
  }, [imagePath, getCachedImage, cacheImage]);

  const handlePickImage = useCallback(async () => {
    const path = await window.tgrid.invoke('pick-image');
    if (path) {
      setImagePath(path);
      const dataUrl = await window.tgrid.invoke('load-image', path);
      if (dataUrl) {
        cacheImage(path, dataUrl);
        setImageDataUrl(dataUrl);
      }
    }
  }, [cacheImage]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
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

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirm) setShowConfirm(false);
        else onClose();
      }
    },
    [onClose, showConfirm],
  );

  const displayColors = getPresetColors(theme);

  if (showConfirm) {
    return (
      <div className="modal-backdrop" onClick={() => setShowConfirm(false)} onKeyDown={handleKeyDown}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <p>Delete preset "{preset?.name}"?</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? 'New Preset' : 'Edit Preset'}</h3>

        <label>Name</label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Character name"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        />

        <label>Image</label>
        <div className="modal-image-picker">
          <div>
            {imageDataUrl ? (
              <img src={imageDataUrl} alt="Preview" />
            ) : (
              <div className="placeholder">+</div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handlePickImage}>
            Choose Image
          </button>
        </div>

        <label>Color</label>
        <div className="color-palette" role="radiogroup" aria-label="Preset color">
          {PRESET_COLORS.map((c, idx) => {
            const displayC = displayColors[idx];
            const isSelected = color === c.value || (color == null && c.value === null);
            return (
              <button
                key={c.label}
                type="button"
                className={`color-swatch${c.value === null ? ' none-swatch' : ''}${isSelected ? ' selected' : ''}`}
                style={displayC.value ? { background: displayC.value } : undefined}
                title={c.label}
                aria-label={c.label}
                role="radio"
                aria-checked={isSelected}
                onClick={() => setColor(c.value)}
              />
            );
          })}
        </div>

        <label>Shell override (optional)</label>
        <input
          type="text"
          value={shell}
          onChange={(e) => setShell(e.target.value)}
          placeholder="default"
        />

        <div className="modal-actions">
          {!isNew && (
            <button
              className="btn btn-danger modal-actions-left"
              onClick={() => setShowConfirm(true)}
            >
              Delete
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

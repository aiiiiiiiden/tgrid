import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Preset, TGridConfig } from '../../shared/types';

interface PresetState {
  presets: Preset[];
  assignments: Record<string, string>;
  config: TGridConfig;
  imageCache: Record<string, string>;
}

interface PresetContextValue extends PresetState {
  setPresets: (p: Preset[]) => void;
  setAssignments: (a: Record<string, string>) => void;
  setConfig: (c: TGridConfig) => void;
  cacheImage: (path: string, dataUrl: string) => void;
  getCachedImage: (path: string) => string | undefined;
}

const PresetContext = createContext<PresetContextValue>(null!);

export function usePresets() {
  return useContext(PresetContext);
}

export function PresetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PresetState>({
    presets: [],
    assignments: {},
    config: { presets: [], assignments: {} },
    imageCache: {},
  });

  const setPresets = useCallback((presets: Preset[]) => {
    setState((s) => ({ ...s, presets }));
  }, []);

  const setAssignments = useCallback((assignments: Record<string, string>) => {
    setState((s) => ({ ...s, assignments }));
  }, []);

  const setConfig = useCallback((config: TGridConfig) => {
    setState((s) => ({
      ...s,
      config,
      presets: config.presets || [],
      assignments: config.assignments || {},
    }));
  }, []);

  const cacheImage = useCallback((path: string, dataUrl: string) => {
    setState((s) => ({ ...s, imageCache: { ...s.imageCache, [path]: dataUrl } }));
  }, []);

  const getCachedImage = useCallback(
    (path: string) => state.imageCache[path],
    [state.imageCache],
  );

  return (
    <PresetContext.Provider
      value={{
        ...state,
        setPresets,
        setAssignments,
        setConfig,
        cacheImage,
        getCachedImage,
      }}
    >
      {children}
    </PresetContext.Provider>
  );
}

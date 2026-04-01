import React from 'react';
import { GridLayoutProvider, useGridLayout } from './GridLayoutContext';
import { GridSelectionProvider, useGridSelection } from './GridSelectionContext';
import { PresetProvider, usePresets } from './PresetContext';

// Re-export individual hooks for targeted consumption
export { useGridLayout } from './GridLayoutContext';
export { useGridSelection } from './GridSelectionContext';
export { usePresets } from './PresetContext';

/**
 * Composite hook for components that need everything.
 * Prefer the targeted hooks (useGridLayout, useGridSelection, usePresets)
 * to avoid unnecessary re-renders.
 */
export function useGrid() {
  const layout = useGridLayout();
  const selection = useGridSelection();
  const presets = usePresets();
  return { ...layout, ...selection, ...presets };
}

/**
 * Composite provider. Wraps all three context providers.
 */
export function GridProvider({ children }: { children: React.ReactNode }) {
  return (
    <GridLayoutProvider>
      <GridSelectionProvider>
        <PresetProvider>
          {children}
        </PresetProvider>
      </GridSelectionProvider>
    </GridLayoutProvider>
  );
}

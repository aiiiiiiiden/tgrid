import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface GridSelectionState {
  activeIndex: number;
  fullscreenIndex: number;
}

interface GridSelectionContextValue extends GridSelectionState {
  setActiveIndex: (i: number) => void;
  setFullscreenIndex: (i: number) => void;
}

const GridSelectionContext = createContext<GridSelectionContextValue>(null!);

export function useGridSelection() {
  return useContext(GridSelectionContext);
}

export function GridSelectionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GridSelectionState>({
    activeIndex: 0,
    fullscreenIndex: -1,
  });

  const setActiveIndex = useCallback((i: number) => {
    setState((s) => s.activeIndex === i ? s : { ...s, activeIndex: i });
  }, []);

  const setFullscreenIndex = useCallback((i: number) => {
    setState((s) => s.fullscreenIndex === i ? s : { ...s, fullscreenIndex: i });
  }, []);

  const value = useMemo(
    () => ({ ...state, setActiveIndex, setFullscreenIndex }),
    [state, setActiveIndex, setFullscreenIndex],
  );

  return (
    <GridSelectionContext.Provider value={value}>
      {children}
    </GridSelectionContext.Provider>
  );
}

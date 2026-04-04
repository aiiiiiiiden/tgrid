import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface GridLayoutState {
  rows: number;
  cols: number;
}

interface GridLayoutContextValue extends GridLayoutState {
  setGrid: (rows: number, cols: number) => void;
}

const GridLayoutContext = createContext<GridLayoutContextValue>(null!);

export function useGridLayout() {
  return useContext(GridLayoutContext);
}

export function GridLayoutProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GridLayoutState>({ rows: 0, cols: 0 });

  const setGrid = useCallback((rows: number, cols: number) => {
    setState({ rows, cols });
  }, []);

  const value = useMemo(() => ({ ...state, setGrid }), [state, setGrid]);

  return (
    <GridLayoutContext.Provider value={value}>
      {children}
    </GridLayoutContext.Provider>
  );
}

import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { GridProvider } from '../renderer/context/GridContext';
import { ThemeProvider } from '../renderer/context/ThemeContext';

function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <GridProvider>
      <ThemeProvider initialTheme="dark">
        {children}
      </ThemeProvider>
    </GridProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

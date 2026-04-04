import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// Mock window.tgrid (preload bridge)
const mockTgrid = {
  invoke: vi.fn().mockResolvedValue(undefined),
  send: vi.fn(),
  on: vi.fn().mockReturnValue(vi.fn()), // returns unsubscribe
};

Object.defineProperty(window, 'tgrid', {
  value: mockTgrid,
  writable: true,
});

// Mock CSS import for xterm
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

// Mock xterm.js
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onResize: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    loadAddon: vi.fn(),
    refresh: vi.fn(),
    focus: vi.fn(),
    rows: 24,
    options: { theme: {} },
  })),
}));

// Mock FitAddon
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Reset mocks between tests
afterEach(() => {
  vi.clearAllMocks();
});

// Helper to get the mock tgrid
export function getMockTgrid() {
  return window.tgrid as unknown as typeof mockTgrid;
}

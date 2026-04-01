import { describe, it, expect } from 'vitest';
import { ptyIdFor, buildInitialPtyMap } from '../../renderer/utils/ptyMap';

describe('ptyIdFor', () => {
  it('returns pty-{index} format', () => {
    expect(ptyIdFor(0)).toBe('pty-0');
    expect(ptyIdFor(5)).toBe('pty-5');
    expect(ptyIdFor(15)).toBe('pty-15');
  });
});

describe('buildInitialPtyMap', () => {
  it('builds map for given total', () => {
    const map = buildInitialPtyMap(4);
    expect(map).toEqual({
      0: 'pty-0',
      1: 'pty-1',
      2: 'pty-2',
      3: 'pty-3',
    });
  });

  it('returns empty map for total 0', () => {
    expect(buildInitialPtyMap(0)).toEqual({});
  });

  it('builds single-panel map', () => {
    expect(buildInitialPtyMap(1)).toEqual({ 0: 'pty-0' });
  });
});

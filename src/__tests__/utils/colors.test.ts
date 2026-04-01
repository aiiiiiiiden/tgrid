import { describe, it, expect } from 'vitest';
import {
  PRESET_COLORS,
  LIGHT_PRESET_COLORS,
  getPresetColors,
  getDisplayColor,
} from '../../renderer/utils/colors';

describe('getPresetColors', () => {
  it('returns dark colors for dark theme', () => {
    expect(getPresetColors('dark')).toBe(PRESET_COLORS);
  });

  it('returns light colors for light theme', () => {
    expect(getPresetColors('light')).toBe(LIGHT_PRESET_COLORS);
  });
});

describe('getDisplayColor', () => {
  it('returns null for null/undefined input', () => {
    expect(getDisplayColor(null, 'dark')).toBeNull();
    expect(getDisplayColor(undefined, 'dark')).toBeNull();
  });

  it('maps dark color to light equivalent in light theme', () => {
    // '#f87171' (dark Red) should map to '#dc2626' (light Red)
    expect(getDisplayColor('#f87171', 'light')).toBe('#dc2626');
  });

  it('returns same color in dark theme', () => {
    expect(getDisplayColor('#f87171', 'dark')).toBe('#f87171');
  });

  it('returns unknown colors as-is', () => {
    expect(getDisplayColor('#custom', 'dark')).toBe('#custom');
    expect(getDisplayColor('#custom', 'light')).toBe('#custom');
  });

  it('maps all dark colors to their light counterparts', () => {
    for (let i = 1; i < PRESET_COLORS.length; i++) {
      const darkColor = PRESET_COLORS[i].value;
      const lightColor = LIGHT_PRESET_COLORS[i].value;
      expect(getDisplayColor(darkColor!, 'light')).toBe(lightColor);
    }
  });

  it('keeps dark colors unchanged in dark theme', () => {
    for (let i = 1; i < PRESET_COLORS.length; i++) {
      const darkColor = PRESET_COLORS[i].value;
      expect(getDisplayColor(darkColor!, 'dark')).toBe(darkColor);
    }
  });
});

describe('color arrays', () => {
  it('dark and light arrays have same length', () => {
    expect(PRESET_COLORS.length).toBe(LIGHT_PRESET_COLORS.length);
  });

  it('first entry is always None/null', () => {
    expect(PRESET_COLORS[0].value).toBeNull();
    expect(LIGHT_PRESET_COLORS[0].value).toBeNull();
  });

  it('all non-null values are hex color strings', () => {
    for (const c of PRESET_COLORS) {
      if (c.value) expect(c.value).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const c of LIGHT_PRESET_COLORS) {
      if (c.value) expect(c.value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

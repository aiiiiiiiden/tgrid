export const PRESET_COLORS = [
  { value: null, label: 'None' },
  { value: '#f87171', label: 'Red' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#fbbf24', label: 'Yellow' },
  { value: '#4ade80', label: 'Green' },
  { value: '#67e8f9', label: 'Cyan' },
  { value: '#60a5fa', label: 'Blue' },
  { value: '#c084fc', label: 'Purple' },
  { value: '#f472b6', label: 'Pink' },
] as const;

export const LIGHT_PRESET_COLORS = [
  { value: null, label: 'None' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#a16207', label: 'Yellow' },
  { value: '#15803d', label: 'Green' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#db2777', label: 'Pink' },
] as const;

export function getPresetColors(theme: 'dark' | 'light') {
  return theme === 'light' ? LIGHT_PRESET_COLORS : PRESET_COLORS;
}

export function getDisplayColor(
  storedColor: string | null | undefined,
  theme: 'dark' | 'light',
): string | null {
  if (!storedColor) return null;
  const darkIdx = PRESET_COLORS.findIndex((c) => c.value === storedColor);
  if (darkIdx < 0) return storedColor;
  const colors = getPresetColors(theme);
  return colors[darkIdx] ? colors[darkIdx].value : storedColor;
}

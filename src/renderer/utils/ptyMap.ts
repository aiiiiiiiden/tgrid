export function ptyIdFor(index: number): string {
  return `pty-${index}`;
}

export function buildInitialPtyMap(total: number): Record<number, string> {
  const map: Record<number, string> = {};
  for (let i = 0; i < total; i++) map[i] = ptyIdFor(i);
  return map;
}

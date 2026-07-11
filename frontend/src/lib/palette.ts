export const PIECE_COLORS = [
  '#4A90D9', '#E67E22', '#27AE60', '#9B59B6', '#E74C3C',
  '#1ABC9C', '#F39C12', '#2980B9', '#8E44AD', '#16A085',
] as const

export const SHELF_COLORS = [
  '#E67E22', '#E74C3C', '#9B59B6', '#1ABC9C', '#F1C40F', '#3498DB',
] as const

export const SHELF_EDGE_COLORS = [
  '#CA6F1E', '#C0392B', '#7D3C98', '#148F77', '#D4AC0D', '#2471A3',
] as const

export function colorAt(palette: readonly string[], index: number): string {
  if (!palette.length) return '#4A90D9'
  const normalized = ((Math.trunc(index) % palette.length) + palette.length) % palette.length
  return palette[normalized]
}

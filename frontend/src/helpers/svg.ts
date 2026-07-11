export function truncate(s: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  return s.length <= maxChars ? s : s.slice(0, maxChars) + '\u2026'
}

export function efficiencyClass(e: number): string {
  return e >= 80 ? 'eff-good' : e >= 55 ? 'eff-ok' : 'eff-poor'
}

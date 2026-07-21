/**
 * Serialize the cut list to CSV so it can be saved, shared, or re-imported.
 * The column order matches what parsePieceList accepts, so a round-trip
 * (export then paste back) reconstructs the parts. Pure and side-effect free;
 * the component triggers the download.
 */
import type { CutPiece } from '@/services/types'

// Spreadsheet software may ignore leading spaces/apostrophes before deciding
// that a cell is a formula. Prefix every such label with one apostrophe. The
// parser uses the same predicate and removes exactly this added character, so
// even labels that already contain apostrophes round-trip without ambiguity.
function needsFormulaEscape(value: string): boolean {
  let index = 0
  while (value[index] === ' ' || value[index] === "'") index++
  const lead = value[index]
  return lead === '=' || lead === '+' || lead === '-' || lead === '@'
    || lead === '\t' || lead === '\r' || lead === '\n'
}

/**
 * Serialize one field: neutralize formula leads, then quote per RFC 4180 only
 * when the (possibly prefixed) value contains a delimiter, quote, or newline.
 */
function csvField(s: string): string {
  const v = needsFormulaEscape(s) ? `'${s}` : s
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

const HEADER = ['label', 'width', 'height', 'quantity', 'rotation'] as const

export function buildPiecesCsv(pieces: CutPiece[]): string {
  const lines = [HEADER.join(',')]
  for (const p of pieces) {
    lines.push([
      csvField(p.label ?? ''),
      String(p.width),
      String(p.height),
      String(p.quantity),
      p.allowRotation ? '1' : '0',
    ].join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

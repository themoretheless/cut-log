/**
 * Serialize the cut list to CSV so it can be saved, shared, or re-imported.
 * The column order matches what parsePieceList accepts, so a round-trip
 * (export then paste back) reconstructs the parts. Pure and side-effect free;
 * the component triggers the download.
 */
import type { CutPiece } from '@/services/types'

// A field whose first character is one of = + - @ (or a leading tab/CR that some
// spreadsheets also treat as a formula lead-in) is evaluated as a formula when
// the CSV is opened in Excel / Sheets / Numbers. Prefix such a field with a
// single quote so it is treated as text. This is the standard CSV-injection
// (a.k.a. formula/DDE injection) mitigation; piece labels are user-controlled.
const FORMULA_LEAD = /^[=+\-@\t\r]/

/**
 * Serialize one field: neutralize formula leads, then quote per RFC 4180 only
 * when the (possibly prefixed) value contains a delimiter, quote, or newline.
 */
function csvField(s: string): string {
  const v = FORMULA_LEAD.test(s) ? `'${s}` : s
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

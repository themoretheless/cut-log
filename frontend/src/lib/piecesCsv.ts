/**
 * Serialize the cut list to CSV so it can be saved, shared, or re-imported.
 * The column order matches what parsePieceList accepts, so a round-trip
 * (export then paste back) reconstructs the parts. Pure and side-effect free;
 * the component triggers the download.
 */
import type { CutPiece } from '@/services/types'

/** Quote a field only when it contains a delimiter, quote, or newline (RFC 4180). */
function csvField(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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

import type { CutPiece } from '@/services/types'

export type PieceSortMode = 'manual' | 'area_desc' | 'name_asc' | 'quantity_desc'

export interface PieceSummary {
  totalTypes: number
  totalQuantity: number
  totalArea: number
  largestPieceArea: number
  rotationEnabled: number
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function pieceArea(piece: CutPiece): number {
  return piece.width * piece.height
}

export function pieceTotalArea(piece: CutPiece): number {
  return pieceArea(piece) * piece.quantity
}

export function pieceMatchesQuery(piece: CutPiece, query: string): boolean {
  const q = normalized(query)
  if (!q) return true

  const label = normalized(piece.label)
  const w = piece.width.toFixed(0)
  const h = piece.height.toFixed(0)
  const dimensions = `${w}x${h} ${w}×${h} ${h}x${w} ${h}×${w}`

  return label.includes(q)
    || dimensions.includes(q)
    || String(piece.quantity).includes(q)
}

export function summarizePieces(pieces: readonly CutPiece[]): PieceSummary {
  let totalQuantity = 0
  let totalArea = 0
  let largestPieceArea = 0
  let rotationEnabled = 0

  for (const piece of pieces) {
    totalQuantity += piece.quantity
    totalArea += pieceTotalArea(piece)
    largestPieceArea = Math.max(largestPieceArea, pieceArea(piece))
    if (piece.allowRotation) rotationEnabled += 1
  }

  return {
    totalTypes: pieces.length,
    totalQuantity,
    totalArea,
    largestPieceArea,
    rotationEnabled,
  }
}

export function pieceFitsSheet(piece: CutPiece, sheetWidth: number, sheetHeight: number): boolean {
  const direct = piece.width <= sheetWidth && piece.height <= sheetHeight
  const rotated = piece.allowRotation && piece.height <= sheetWidth && piece.width <= sheetHeight
  return direct || rotated
}

export function findOversizedPieces(
  pieces: readonly CutPiece[],
  sheetWidth: number,
  sheetHeight: number,
): CutPiece[] {
  if (sheetWidth <= 0 || sheetHeight <= 0) return []
  return pieces.filter(piece => !pieceFitsSheet(piece, sheetWidth, sheetHeight))
}

export function sortPiecesForEditor(pieces: readonly CutPiece[], mode: PieceSortMode): CutPiece[] {
  const sorted = [...pieces]
  if (mode === 'manual') return sorted

  sorted.sort((a, b) => {
    if (mode === 'area_desc') return pieceTotalArea(b) - pieceTotalArea(a)
    if (mode === 'quantity_desc') return b.quantity - a.quantity
    return normalized(a.label || '').localeCompare(normalized(b.label || ''), undefined, { numeric: true })
  })

  return sorted
}

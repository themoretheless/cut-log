import type { PlacedPiece, Sheet } from '@/services/types'

const MAX_WIDTH = 520
const MAX_HEIGHT = 420

export function sheetScale(sheet: Pick<Sheet, 'width' | 'height'>): number {
  const width = Math.max(1, sheet.width)
  const height = Math.max(1, sheet.height)
  return Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
}

export function grainLines(svgHeight: number, count = 9): number[] {
  if (!Number.isFinite(svgHeight) || svgHeight <= 0 || count <= 0) return []
  return Array.from({ length: count }, (_, index) => svgHeight * (index + 1) / (count + 1))
}

export function badgeWidth(index: number): number {
  return Math.max(12, String(Math.max(0, Math.trunc(index))).length * 5 + 7)
}

export interface PieceAccessibleVocabulary {
  by: string
  millimeters: string
  rotated: string
}

const ENGLISH_ACCESSIBLE_VOCABULARY: PieceAccessibleVocabulary = {
  by: 'by', millimeters: 'millimeters', rotated: 'rotated',
}

export function pieceAccessibleName(
  piece: PlacedPiece,
  index: number,
  vocabulary: PieceAccessibleVocabulary = ENGLISH_ACCESSIBLE_VOCABULARY,
): string {
  const name = piece.source.label?.trim() || `#${index}`
  const rotation = piece.isRotated ? `, ${vocabulary.rotated}` : ''
  return `${name}, ${piece.width.toFixed(0)} ${vocabulary.by} ${piece.height.toFixed(0)} ${vocabulary.millimeters}${rotation}`
}

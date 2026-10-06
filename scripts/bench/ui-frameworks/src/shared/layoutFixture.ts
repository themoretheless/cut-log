import type { CutPiece, Sheet } from '@cutlog/services/types'

export interface LayoutFixture {
  initial: Sheet[]
  shifted: Sheet[]
  pieceIndexes: Readonly<Record<string, number>>
  selectionIds: readonly [string, string]
}

const COLORS = ['#b85c46', '#406f8f', '#6d8b55', '#9b6a99', '#b28a3e', '#4f8c82']

function makeSource(sheetIndex: number, pieceIndex: number): CutPiece {
  const ordinal = sheetIndex * 1000 + pieceIndex + 1
  return {
    id: `piece-${sheetIndex}-${pieceIndex}`,
    label: `Detail ${ordinal}`,
    width: 198 + (pieceIndex % 3) * 4,
    height: 88 + (pieceIndex % 4) * 2,
    quantity: 1,
    allowRotation: true,
    color: COLORS[pieceIndex % COLORS.length]!,
  }
}

function makeSheets(sheetCount: number, piecesPerSheet: number, shifted: boolean): Sheet[] {
  return Array.from({ length: sheetCount }, (_, sheetIndex) => {
    const placedPieces = Array.from({ length: piecesPerSheet }, (_, pieceIndex) => {
      const source = makeSource(sheetIndex, pieceIndex)
      const column = pieceIndex % 10
      const row = Math.floor(pieceIndex / 10)
      const xShift = shifted ? ((pieceIndex % 2) * 6 - 3) : 0
      const yShift = shifted ? ((pieceIndex % 3) * 2 - 2) : 0
      return {
        source,
        x: 18 + column * 240 + xShift,
        y: 12 + row * 116 + yShift,
        width: source.width,
        height: source.height,
        isRotated: pieceIndex % 7 === 0,
      }
    })
    const usedArea = placedPieces.reduce((sum, piece) => sum + piece.width * piece.height, 0)
    const totalArea = 2440 * 1220
    return {
      index: sheetIndex,
      width: 2440,
      height: 1220,
      placedPieces,
      usedArea,
      totalArea,
      efficiency: usedArea / totalArea * 100,
    }
  })
}

export function createLayoutFixture(sheetCount: number, piecesPerSheet: number): LayoutFixture {
  const safeSheetCount = Math.max(1, Math.min(20, Math.trunc(sheetCount)))
  const safePiecesPerSheet = Math.max(1, Math.min(100, Math.trunc(piecesPerSheet)))
  const initial = makeSheets(safeSheetCount, safePiecesPerSheet, false)
  const shifted = makeSheets(safeSheetCount, safePiecesPerSheet, true)
  const pieceIndexes = Object.fromEntries(
    initial.flatMap(sheet => sheet.placedPieces).map((piece, index) => [piece.source.id, index + 1]),
  )
  const ids = initial.flatMap(sheet => sheet.placedPieces).map(piece => piece.source.id)
  return {
    initial,
    shifted,
    pieceIndexes,
    selectionIds: [ids[0]!, ids[ids.length - 1]!],
  }
}

export function layoutFixtureFromLocation(location: Location = window.location): LayoutFixture {
  const params = new URLSearchParams(location.search)
  return createLayoutFixture(Number(params.get('sheets') || 6), Number(params.get('pieces') || 40))
}

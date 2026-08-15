import { pieceArea, pieceTotalArea } from '@/lib/pieceEditor'
import type { CutPiece, CuttingResult } from '@/services/types'

interface ResultSelectionOptions {
  pieces: () => readonly CutPiece[]
  result: () => CuttingResult | null
  selectedPieceId: () => string | null
}

export interface SelectedPiecePlacement {
  sheetIndex: number
  x: number
  y: number
  width: number
  height: number
  isRotated: boolean
}

export interface SelectedPieceStats {
  area: number
  totalArea: number
  placements: SelectedPiecePlacement[]
  firstPlacement: SelectedPiecePlacement | undefined
}

export function useResultSelection(options: ResultSelectionOptions) {
  const selectedPiece = $derived(
    options.pieces().find(piece => piece.id === options.selectedPieceId()) ?? null)

  const placements = $derived.by((): SelectedPiecePlacement[] => {
    const result = options.result()
    const id = options.selectedPieceId()
    if (!result || !id) return []
    return result.sheets.flatMap(sheet =>
      sheet.placedPieces
        .filter(placement => placement.source.id === id)
        .map(placement => ({
          sheetIndex: sheet.index,
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          isRotated: placement.isRotated,
        })),
    )
  })

  const stats = $derived.by((): SelectedPieceStats | null => {
    const piece = selectedPiece
    if (!piece) return null
    return {
      area: pieceArea(piece),
      totalArea: pieceTotalArea(piece),
      placements,
      firstPlacement: placements[0],
    }
  })

  return {
    get selectedPiece() { return selectedPiece },
    get placements() { return placements },
    get stats() { return stats },
  }
}

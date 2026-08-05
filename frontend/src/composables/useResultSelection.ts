import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { pieceArea, pieceTotalArea } from '@/lib/pieceEditor'
import type { CutPiece, CuttingResult } from '@/services/types'

interface ResultSelectionOptions {
  pieces: MaybeRefOrGetter<readonly CutPiece[]>
  result: MaybeRefOrGetter<CuttingResult | null>
  selectedPieceId: Ref<string | null>
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
  const selectedPiece = computed(() =>
    toValue(options.pieces).find(piece => piece.id === options.selectedPieceId.value) ?? null)

  const placements = computed<SelectedPiecePlacement[]>(() => {
    const result = toValue(options.result)
    const id = options.selectedPieceId.value
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

  const stats = computed<SelectedPieceStats | null>(() => {
    const piece = selectedPiece.value
    if (!piece) return null
    return {
      area: pieceArea(piece),
      totalArea: pieceTotalArea(piece),
      placements: placements.value,
      firstPlacement: placements.value[0],
    }
  })

  return { selectedPiece, placements, stats }
}

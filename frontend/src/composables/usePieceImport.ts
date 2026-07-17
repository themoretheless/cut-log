import { computed, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { assertOptimizerCapacity } from '@/lib/optimizerLimits'
import { parsePieceList, type ParsedRow } from '@/lib/parsePieceList'
import { validateNewPiece } from '@/lib/validatePiece'
import type { CutPiece } from '@/services/types'
import type { NewPieceInput } from './usePieceList'

interface PieceImportOptions {
  pieces: MaybeRefOrGetter<readonly CutPiece[]>
  sheetWidth: MaybeRefOrGetter<number>
  sheetHeight: MaybeRefOrGetter<number>
  kerf: MaybeRefOrGetter<number>
  text?: Ref<string>
}

export interface PieceImportPreview {
  validRows: NewPieceInput[]
  parsedCount: number
  acceptedCount: number
  skippedCount: number
  invalidCount: number
  totalSkipped: number
  totalQuantity: number
  capacityExceeded: boolean
}

export interface PieceImportCommit {
  added: number
  skipped: number
  quantity: number
}

function toInput(row: ParsedRow): NewPieceInput {
  return {
    label: row.label,
    width: row.width,
    height: row.height,
    quantity: row.quantity,
    allowRotation: row.allowRotation ?? true,
  }
}

export function usePieceImport(options: PieceImportOptions) {
  const text = options.text ?? ref('')

  const preview = computed<PieceImportPreview>(() => {
    const parsed = parsePieceList(text.value)
    const validRows: NewPieceInput[] = []
    let invalidCount = 0
    for (const row of parsed.rows) {
      const error = validateNewPiece(
        row,
        {
          sheetWidth: toValue(options.sheetWidth),
          sheetHeight: toValue(options.sheetHeight),
          kerf: toValue(options.kerf),
        },
      )
      if (error) invalidCount++
      else validRows.push(toInput(row))
    }

    let capacityExceeded = false
    try {
      assertOptimizerCapacity([
        ...toValue(options.pieces),
        ...validRows.map(row => ({ quantity: row.quantity })),
      ])
    } catch {
      capacityExceeded = true
    }

    return {
      validRows,
      parsedCount: parsed.rows.length,
      acceptedCount: validRows.length,
      skippedCount: parsed.skipped,
      invalidCount,
      totalSkipped: parsed.skipped + invalidCount,
      totalQuantity: validRows.reduce((sum, row) => sum + row.quantity, 0),
      capacityExceeded,
    }
  })

  const canCommit = computed(() => preview.value.acceptedCount > 0 && !preview.value.capacityExceeded)

  function commit(apply: (rows: readonly NewPieceInput[]) => void): PieceImportCommit | null {
    if (!canCommit.value) return null
    const current = preview.value
    apply(current.validRows.map(row => ({ ...row })))
    text.value = ''
    return {
      added: current.acceptedCount,
      skipped: current.totalSkipped,
      quantity: current.totalQuantity,
    }
  }

  function reset() {
    text.value = ''
  }

  return { text, preview, canCommit, commit, reset }
}

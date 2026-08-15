import { assertOptimizerCapacity } from '@/lib/optimizerLimits'
import { parsePieceList, type ParsedRow } from '@/lib/parsePieceList'
import { validateNewPiece } from '@/lib/validatePiece'
import type { CutPiece } from '@/services/types'
import type { NewPieceInput } from './usePieceList.svelte'

interface PieceImportOptions {
  pieces: () => readonly CutPiece[]
  sheetWidth: () => number
  sheetHeight: () => number
  kerf: () => number
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
  const state = $state({ text: '' })

  const preview = $derived.by((): PieceImportPreview => {
    const parsed = parsePieceList(state.text)
    const validRows: NewPieceInput[] = []
    let invalidCount = 0
    for (const row of parsed.rows) {
      const error = validateNewPiece(
        row,
        {
          sheetWidth: options.sheetWidth(),
          sheetHeight: options.sheetHeight(),
          kerf: options.kerf(),
        },
      )
      if (error) invalidCount++
      else validRows.push(toInput(row))
    }

    let capacityExceeded = false
    try {
      assertOptimizerCapacity([
        ...options.pieces(),
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

  const canCommit = $derived(preview.acceptedCount > 0 && !preview.capacityExceeded)

  function commit(apply: (rows: readonly NewPieceInput[]) => void): PieceImportCommit | null {
    if (!canCommit) return null
    const current = preview
    apply(current.validRows.map(row => ({ ...row })))
    state.text = ''
    return {
      added: current.acceptedCount,
      skipped: current.totalSkipped,
      quantity: current.totalQuantity,
    }
  }

  function reset() {
    state.text = ''
  }

  return {
    get text() { return state.text },
    set text(value: string) { state.text = value },
    get preview() { return preview },
    get canCommit() { return canCommit },
    commit,
    reset,
  }
}

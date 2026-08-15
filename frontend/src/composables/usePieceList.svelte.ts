import { PIECE_COLORS } from '@/lib/palette'
import {
  findOversizedPieces,
  pieceMatchesQuery,
  pieceTotalArea,
  sortPiecesForEditor,
  summarizePieces,
  type PieceDimensions,
  type PieceSortMode,
} from '@/lib/pieceEditor'
import { duplicatePiece, reorderByDrag } from '@/lib/pieceOps'
import { normalizeQuantity } from '@/lib/optimizerLimits'
import { withStablePieceIds } from '@/lib/pieceIdentity'
import { newPiece, type CutPiece } from '@/services/types'

export type QuickFilterMode = 'all' | 'unnamed' | 'rotation_off' | 'oversized' | 'locked' | 'machine'

export interface NewPieceInput {
  label: string
  width: number
  height: number
  quantity: number
  allowRotation: boolean
}

export interface VisiblePieceEntry {
  piece: CutPiece
  index: number
}

export interface PieceMutationSummary {
  changed: number
  skipped: number
  beforeArea: number
  afterArea: number
  sampleBefore: string
  sampleAfter: string
}

interface PieceListOptions {
  sheetWidth: () => number
  sheetHeight: () => number
  minMachineCut: () => number
  createId?: () => string
}

export function usePieceList(options: PieceListOptions) {
  const pieces = $state<CutPiece[]>([])
  const ui = $state({
    selectedPieceId: null as string | null,
    pieceQuery: '',
    pieceSortMode: 'manual' as PieceSortMode,
    quickFilterMode: 'all' as QuickFilterMode,
  })
  let colorIndex = 0

  const pieceSummary = $derived(summarizePieces(pieces))
  const oversizedPieces = $derived(findOversizedPieces(
    pieces,
    options.sheetWidth(),
    options.sheetHeight(),
  ))
  const lockedPiecesCount = $derived(pieces.filter(piece => piece.locked).length)
  const smallMachinePieces = $derived(pieces.filter(piece =>
    piece.width < options.minMachineCut() || piece.height < options.minMachineCut()))
  const unnamedPiecesCount = $derived(pieces.filter(piece => !piece.label.trim()).length)
  const rotationLockedCount = $derived(pieces.filter(piece => !piece.allowRotation).length)

  function matchesQuickFilter(piece: CutPiece): boolean {
    if (ui.quickFilterMode === 'unnamed') return !piece.label.trim()
    if (ui.quickFilterMode === 'rotation_off') return !piece.allowRotation
    if (ui.quickFilterMode === 'oversized') return oversizedPieces.some(item => item.id === piece.id)
    if (ui.quickFilterMode === 'locked') return piece.locked === true
    if (ui.quickFilterMode === 'machine') {
      return piece.width < options.minMachineCut() || piece.height < options.minMachineCut()
    }
    return true
  }

  const visiblePieces = $derived(pieces
    .map((piece, index) => ({ piece, index }))
    .filter(({ piece }) => pieceMatchesQuery(piece, ui.pieceQuery) && matchesQuickFilter(piece)) as VisiblePieceEntry[])
  const visibleEditablePieces = $derived(visiblePieces.filter(({ piece }) => !piece.locked))
  const visibleLockedCount = $derived(visiblePieces.length - visibleEditablePieces.length)
  const hasPieceFilter = $derived(ui.pieceQuery.trim().length > 0 || ui.quickFilterMode !== 'all')
  const pieceIndexes = $derived.by(() => {
    const indexes: Record<string, number> = {}
    pieces.forEach((piece, index) => { indexes[piece.id] = index + 1 })
    return indexes
  })

  function allocateColor(): string {
    return PIECE_COLORS[colorIndex++ % PIECE_COLORS.length]
  }

  function create(input: NewPieceInput): CutPiece {
    const piece = newPiece(
      input.label,
      input.width,
      input.height,
      input.quantity,
      input.allowRotation,
      allocateColor(),
    )
    if (options.createId) piece.id = options.createId()
    return piece
  }

  function add(input: NewPieceInput): CutPiece {
    const piece = create(input)
    pieces.push(piece)
    return piece
  }

  function addMany(inputs: readonly NewPieceInput[]): CutPiece[] {
    const added = inputs.map(create)
    pieces.push(...added)
    return added
  }

  // Svelte port note: the Vue version cleared a stale selection through a
  // watcher on the id list. Here the clearing is explicit in every path that
  // removes pieces (remove, clear, replace), which covers restore flows too.
  function reconcileSelection() {
    if (ui.selectedPieceId !== null && !pieces.some(piece => piece.id === ui.selectedPieceId)) {
      ui.selectedPieceId = null
    }
  }

  function replace(next: readonly CutPiece[]) {
    pieces.splice(0, pieces.length, ...withStablePieceIds(next, options.createId))
    colorIndex = pieces.length
    reconcileSelection()
  }

  function remove(piece: CutPiece): boolean {
    const index = pieces.findIndex(item => item.id === piece.id)
    if (index < 0) return false
    pieces.splice(index, 1)
    if (ui.selectedPieceId === piece.id) ui.selectedPieceId = null
    return true
  }

  function duplicate(id: string | null, selectCopy = false): { source: CutPiece; copy: CutPiece } | null {
    if (!pieces.length) return null
    let sourceIndex = id ? pieces.findIndex(piece => piece.id === id) : -1
    if (sourceIndex < 0) sourceIndex = pieces.length - 1
    const source = pieces[sourceIndex]
    const next = duplicatePiece(
      [...pieces],
      source.id,
      options.createId?.() ?? crypto.randomUUID(),
      allocateColor(),
    )
    pieces.splice(0, pieces.length, ...next)
    const copy = pieces[sourceIndex + 1]
    if (selectCopy) ui.selectedPieceId = copy.id
    return { source, copy }
  }

  function clear(): number {
    const count = pieces.length
    pieces.splice(0, pieces.length)
    ui.selectedPieceId = null
    ui.pieceQuery = ''
    ui.pieceSortMode = 'manual'
    ui.quickFilterMode = 'all'
    colorIndex = 0
    return count
  }

  function toggleSelect(id: string) {
    ui.selectedPieceId = ui.selectedPieceId === id ? null : id
  }

  function clearSelection() {
    ui.selectedPieceId = null
  }

  function clearFilters() {
    ui.pieceQuery = ''
    ui.quickFilterMode = 'all'
  }

  // Returns whether anything changed (always true), matching the run() commit
  // contract; read piece.locked for the new state.
  function toggleLock(piece: CutPiece): boolean {
    if (piece.locked) delete piece.locked
    else piece.locked = true
    return true
  }

  function updateLabel(piece: CutPiece, label: string): boolean {
    if (piece.label === label) return false
    piece.label = label
    return true
  }

  function updateWidth(piece: CutPiece, width: number): boolean {
    if (piece.width === width) return false
    piece.width = width
    return true
  }

  function updateHeight(piece: CutPiece, height: number): boolean {
    if (piece.height === height) return false
    piece.height = height
    return true
  }

  function updateQuantity(piece: CutPiece, quantity: number): boolean {
    const clean = normalizeQuantity(quantity)
    if (piece.quantity === clean) return false
    piece.quantity = clean
    return true
  }

  function toggleRotation(piece: CutPiece) {
    piece.allowRotation = !piece.allowRotation
  }

  function setVisibleRotation(allowRotation: boolean): PieceMutationSummary | null {
    const editable = visibleEditablePieces
    if (!editable.length) return null
    const area = pieceSummary.totalArea
    for (const { piece } of editable) piece.allowRotation = allowRotation
    return {
      changed: editable.length,
      skipped: visibleLockedCount,
      beforeArea: area,
      afterArea: area,
      sampleBefore: '',
      sampleAfter: '',
    }
  }

  function mutateVisibleDimensions(
    transform: (piece: CutPiece) => PieceDimensions,
  ): PieceMutationSummary | null {
    const editable = visibleEditablePieces
    if (!editable.length) return null
    const skipped = visibleLockedCount
    const beforeArea = editable.reduce((sum, { piece }) => sum + pieceTotalArea(piece), 0)
    const sample = editable[0]?.piece
    const sampleBefore = sample ? `${sample.width}×${sample.height}` : ''
    for (const { piece } of editable) {
      const next = transform(piece)
      piece.width = next.width
      piece.height = next.height
    }
    return {
      changed: editable.length,
      skipped,
      beforeArea,
      afterArea: editable.reduce((sum, { piece }) => sum + pieceTotalArea(piece), 0),
      sampleBefore,
      sampleAfter: sample ? `${sample.width}×${sample.height}` : '',
    }
  }

  function sort(mode = ui.pieceSortMode): boolean {
    ui.pieceSortMode = mode
    if (mode === 'manual') return false
    const unlockedIndexes = pieces
      .map((piece, index) => piece.locked ? -1 : index)
      .filter(index => index >= 0)
    const sorted = sortPiecesForEditor(unlockedIndexes.map(index => pieces[index]), mode)
    unlockedIndexes.forEach((index, sortedIndex) => { pieces[index] = sorted[sortedIndex] })
    return true
  }

  function reorderTarget(sourceIndex: number, direction: -1 | 1): number | null {
    const visibleIndex = visiblePieces.findIndex(entry => entry.index === sourceIndex)
    if (visibleIndex < 0) return null
    for (let next = visibleIndex + direction; next >= 0 && next < visiblePieces.length; next += direction) {
      const target = visiblePieces[next]
      if (!target.piece.locked) return target.index
    }
    return null
  }

  function canMove(sourceIndex: number, direction: -1 | 1): boolean {
    return !pieces[sourceIndex]?.locked && reorderTarget(sourceIndex, direction) !== null
  }

  function move(sourceIndex: number, direction: -1 | 1): boolean {
    const targetIndex = reorderTarget(sourceIndex, direction)
    if (targetIndex === null || pieces[sourceIndex]?.locked) return false
    const next = reorderByDrag([...pieces], sourceIndex, targetIndex)
    pieces.splice(0, pieces.length, ...next)
    ui.pieceSortMode = 'manual'
    return true
  }

  function drop(sourceIndex: number, targetIndex: number): boolean {
    if (sourceIndex < 0 || sourceIndex === targetIndex || sourceIndex >= pieces.length) return false
    if (pieces[sourceIndex]?.locked || pieces[targetIndex]?.locked) return false
    const next = reorderByDrag([...pieces], sourceIndex, targetIndex)
    pieces.splice(0, pieces.length, ...next)
    ui.pieceSortMode = 'manual'
    return true
  }

  function pieceIndex(source: CutPiece): number {
    return pieceIndexes[source.id] ?? 0
  }

  return {
    get pieces() { return pieces },
    get selectedPieceId() { return ui.selectedPieceId },
    set selectedPieceId(value: string | null) { ui.selectedPieceId = value },
    get pieceQuery() { return ui.pieceQuery },
    set pieceQuery(value: string) { ui.pieceQuery = value },
    get pieceSortMode() { return ui.pieceSortMode },
    set pieceSortMode(value: PieceSortMode) { ui.pieceSortMode = value },
    get quickFilterMode() { return ui.quickFilterMode },
    set quickFilterMode(value: QuickFilterMode) { ui.quickFilterMode = value },
    get pieceSummary() { return pieceSummary },
    get oversizedPieces() { return oversizedPieces },
    get lockedPiecesCount() { return lockedPiecesCount },
    get smallMachinePieces() { return smallMachinePieces },
    get unnamedPiecesCount() { return unnamedPiecesCount },
    get rotationLockedCount() { return rotationLockedCount },
    get visiblePieces() { return visiblePieces },
    get visibleEditablePieces() { return visibleEditablePieces },
    get visibleLockedCount() { return visibleLockedCount },
    get hasPieceFilter() { return hasPieceFilter },
    get pieceIndexes() { return pieceIndexes },
    add,
    addMany,
    replace,
    remove,
    duplicate,
    clear,
    toggleSelect,
    clearSelection,
    clearFilters,
    toggleLock,
    updateLabel,
    updateWidth,
    updateHeight,
    updateQuantity,
    toggleRotation,
    setVisibleRotation,
    mutateVisibleDimensions,
    sort,
    reorderTarget,
    canMove,
    move,
    drop,
    pieceIndex,
  }
}

export type PieceListStore = ReturnType<typeof usePieceList>

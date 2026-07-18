import { computed, reactive, ref, toValue, type MaybeRefOrGetter } from 'vue'
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
  sheetWidth: MaybeRefOrGetter<number>
  sheetHeight: MaybeRefOrGetter<number>
  minMachineCut: MaybeRefOrGetter<number>
  createId?: () => string
}

export function usePieceList(options: PieceListOptions) {
  const pieces = reactive<CutPiece[]>([])
  const selectedPieceId = ref<string | null>(null)
  const pieceQuery = ref('')
  const pieceSortMode = ref<PieceSortMode>('manual')
  const quickFilterMode = ref<QuickFilterMode>('all')
  let colorIndex = 0

  const selectedPiece = computed(() => pieces.find(piece => piece.id === selectedPieceId.value) ?? null)
  const pieceSummary = computed(() => summarizePieces(pieces))
  const oversizedPieces = computed(() => findOversizedPieces(
    pieces,
    toValue(options.sheetWidth),
    toValue(options.sheetHeight),
  ))
  const lockedPiecesCount = computed(() => pieces.filter(piece => piece.locked).length)
  const smallMachinePieces = computed(() => pieces.filter(piece =>
    piece.width < toValue(options.minMachineCut) || piece.height < toValue(options.minMachineCut)))
  const unnamedPiecesCount = computed(() => pieces.filter(piece => !piece.label.trim()).length)
  const rotationLockedCount = computed(() => pieces.filter(piece => !piece.allowRotation).length)

  function matchesQuickFilter(piece: CutPiece): boolean {
    if (quickFilterMode.value === 'unnamed') return !piece.label.trim()
    if (quickFilterMode.value === 'rotation_off') return !piece.allowRotation
    if (quickFilterMode.value === 'oversized') return oversizedPieces.value.some(item => item.id === piece.id)
    if (quickFilterMode.value === 'locked') return piece.locked === true
    if (quickFilterMode.value === 'machine') {
      return piece.width < toValue(options.minMachineCut) || piece.height < toValue(options.minMachineCut)
    }
    return true
  }

  const visiblePieces = computed<VisiblePieceEntry[]>(() => pieces
    .map((piece, index) => ({ piece, index }))
    .filter(({ piece }) => pieceMatchesQuery(piece, pieceQuery.value) && matchesQuickFilter(piece)))
  const visibleEditablePieces = computed(() => visiblePieces.value.filter(({ piece }) => !piece.locked))
  const visibleLockedCount = computed(() => visiblePieces.value.length - visibleEditablePieces.value.length)
  const hasPieceFilter = computed(() => pieceQuery.value.trim().length > 0 || quickFilterMode.value !== 'all')
  const pieceIndexes = computed<Record<string, number>>(() => {
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

  function replace(next: readonly CutPiece[]) {
    pieces.splice(0, pieces.length, ...withStablePieceIds(next, options.createId))
    colorIndex = pieces.length
  }

  function remove(piece: CutPiece): boolean {
    const index = pieces.indexOf(piece)
    if (index < 0) return false
    pieces.splice(index, 1)
    if (selectedPieceId.value === piece.id) selectedPieceId.value = null
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
    if (selectCopy) selectedPieceId.value = copy.id
    return { source, copy }
  }

  function clear(): number {
    const count = pieces.length
    pieces.splice(0, pieces.length)
    selectedPieceId.value = null
    pieceQuery.value = ''
    pieceSortMode.value = 'manual'
    quickFilterMode.value = 'all'
    colorIndex = 0
    return count
  }

  function toggleSelect(id: string) {
    selectedPieceId.value = selectedPieceId.value === id ? null : id
  }

  function clearSelection() {
    selectedPieceId.value = null
  }

  function clearFilters() {
    pieceQuery.value = ''
    quickFilterMode.value = 'all'
  }

  function toggleLock(piece: CutPiece): boolean {
    if (piece.locked) delete piece.locked
    else piece.locked = true
    return piece.locked === true
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
    const editable = visibleEditablePieces.value
    if (!editable.length) return null
    const area = pieceSummary.value.totalArea
    for (const { piece } of editable) piece.allowRotation = allowRotation
    return {
      changed: editable.length,
      skipped: visibleLockedCount.value,
      beforeArea: area,
      afterArea: area,
      sampleBefore: '',
      sampleAfter: '',
    }
  }

  function mutateVisibleDimensions(
    transform: (piece: CutPiece) => PieceDimensions,
  ): PieceMutationSummary | null {
    const editable = visibleEditablePieces.value
    if (!editable.length) return null
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
      skipped: visibleLockedCount.value,
      beforeArea,
      afterArea: editable.reduce((sum, { piece }) => sum + pieceTotalArea(piece), 0),
      sampleBefore,
      sampleAfter: sample ? `${sample.width}×${sample.height}` : '',
    }
  }

  function sort(mode = pieceSortMode.value): boolean {
    pieceSortMode.value = mode
    if (mode === 'manual') return false
    const unlockedIndexes = pieces
      .map((piece, index) => piece.locked ? -1 : index)
      .filter(index => index >= 0)
    const sorted = sortPiecesForEditor(unlockedIndexes.map(index => pieces[index]), mode)
    unlockedIndexes.forEach((index, sortedIndex) => { pieces[index] = sorted[sortedIndex] })
    return true
  }

  function reorderTarget(sourceIndex: number, direction: -1 | 1): number | null {
    const visibleIndex = visiblePieces.value.findIndex(entry => entry.index === sourceIndex)
    if (visibleIndex < 0) return null
    for (let next = visibleIndex + direction; next >= 0 && next < visiblePieces.value.length; next += direction) {
      const target = visiblePieces.value[next]
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
    pieceSortMode.value = 'manual'
    return true
  }

  function drop(sourceIndex: number, targetIndex: number): boolean {
    if (sourceIndex < 0 || sourceIndex === targetIndex || sourceIndex >= pieces.length) return false
    if (pieces[sourceIndex]?.locked || pieces[targetIndex]?.locked) return false
    const next = reorderByDrag([...pieces], sourceIndex, targetIndex)
    pieces.splice(0, pieces.length, ...next)
    pieceSortMode.value = 'manual'
    return true
  }

  function pieceIndex(source: CutPiece): number {
    return pieceIndexes.value[source.id] ?? 0
  }

  return {
    pieces,
    selectedPieceId,
    selectedPiece,
    pieceQuery,
    pieceSortMode,
    quickFilterMode,
    pieceSummary,
    oversizedPieces,
    lockedPiecesCount,
    smallMachinePieces,
    unnamedPiecesCount,
    rotationLockedCount,
    visiblePieces,
    visibleEditablePieces,
    visibleLockedCount,
    hasPieceFilter,
    pieceIndexes,
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

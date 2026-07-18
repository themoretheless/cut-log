<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import OptimizationWorkspace from '@/components/OptimizationWorkspace.vue'
import PieceEditorPanel from '@/components/PieceEditorPanel.vue'
import ProjectActivityPanel from '@/components/ProjectActivityPanel.vue'
import ProjectInputPanel from '@/components/ProjectInputPanel.vue'
import { useCommandPalette, type PaletteCommand } from '@/composables/useCommandPalette'
import { useCosting } from '@/composables/useCosting'
import { useHomeExports } from '@/composables/useHomeExports'
import { useHomeHistory } from '@/composables/useHomeHistory'
import { useHomeStorage } from '@/composables/useHomeStorage'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useOptimizationSession } from '@/composables/useOptimizationSession'
import type { NewPieceInput } from '@/composables/usePieceList'
import { useProjectActions, type ProjectActionName } from '@/composables/useProjectActions'
import { useProjectActivity } from '@/composables/useProjectActivity'
import { useProjectState } from '@/composables/useProjectState'
import { useResultSelection } from '@/composables/useResultSelection'
import { useToast } from '@/composables/useToast'
import { buildShareUrl, readShareFromHash } from '@/lib/shareLink'
import {
  addDimensionDelta,
  roundDimensionsUp,
  swapDimensions,
  type PieceBulkDiff,
  type PieceSortMode,
} from '@/lib/pieceEditor'
import { assertOptimizerCapacity } from '@/lib/optimizerLimits'
import type { CutPiece } from '@/services/types'
import { CuttingStrategy } from '@/services/types'
import { useL10n } from '@/stores/l10n'

const { t } = useL10n()
const { message: toast, tone: toastTone, show: showToast, showError, clear: clearToast } = useToast()
const minMachineCut = ref(30)
const selectedStrategy = ref<CuttingStrategy>(CuttingStrategy.Auto)
const showImport = ref(false)
const commandInputRef = ref<HTMLInputElement | null>(null)
const projectInputRef = ref<{ submit: () => void } | null>(null)
const transformStep = ref(2)
const roundStep = ref(5)
const lastBulkDiff = ref<PieceBulkDiff | null>(null)
const dragStartIdx = ref(-1)
const dragOverIdx = ref(-1)
const isDragging = ref(false)

const projectState = useProjectState({ minMachineCut })
const { sheetWidth, sheetHeight, kerf, pieceList, read: currentState, apply: applyState } = projectState
const {
  pieces,
  selectedPieceId,
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
  hasPieceFilter,
  pieceIndexes,
} = pieceList

const optimization = useOptimizationSession()
const { state: optimizationState, result } = optimization
const resultSelection = useResultSelection({ pieces: () => pieces, result, selectedPieceId })
const { selectedPiece, stats: selectedPieceStats, toggle: toggleSelect, clear: clearSelection } = resultSelection
const { pricePerSheet, currency, summary: costSummary, isVisible: costingVisible } = useCosting({
  result,
  pricePerSheet: projectState.pricePerSheet,
  currency: projectState.currency,
})
const { exportPiecesCsv, exportSvg, exportDxf, printLayout } = useHomeExports({
  pieces: () => pieces,
  result,
  translate: t,
})

const homeStorage = useHomeStorage({
  capture: currentState,
  apply: applyState,
  onError: () => showError(t('storage_error')),
})
const saveState = homeStorage.scheduleSave
const saveStateNow = homeStorage.saveNow
const loadState = homeStorage.load

function invalidateOptimization() {
  optimization.invalidate()
}

const homeHistory = useHomeHistory({
  capture: currentState,
  apply: applyState,
  saveNow: saveStateNow,
  onRestore: invalidateOptimization,
})
const { canUndo, canRedo, record: recordHistory, undo: doUndo, redo: doRedo } = homeHistory
const projectActions = useProjectActions({
  invalidateLayout: invalidateOptimization,
  scheduleSave: saveState,
  recordHistory,
})

function resetAfterSnapshotRestore() {
  selectedPieceId.value = null
  pieceQuery.value = ''
  quickFilterMode.value = 'all'
  pieceSortMode.value = 'manual'
  lastBulkDiff.value = null
  optimization.invalidate()
  homeHistory.reset()
}

function areaM2(areaMm2: number): string {
  return (areaMm2 / 1_000_000).toFixed(2)
}

const projectActivity = useProjectActivity({
  capture: currentState,
  apply: applyState,
  hasPieces: () => pieces.length > 0,
  snapshotSummary: () => `${pieceSummary.value.totalTypes} ${t('piece_types')} · ${pieceSummary.value.totalQuantity} ${t('pieces_short')} · ${areaM2(pieceSummary.value.totalArea)} ${t('material_area')}`,
  resetAfterRestore: resetAfterSnapshotRestore,
  saveNow: saveStateNow,
  translate: t,
  showToast,
})
const {
  operationLog,
  operationQuery,
  filteredOperationLog,
  snapshotCompare,
  snapshots: projectSnapshots,
  snapshotName,
  recordOperation,
  clearOperationLog,
  compareSnapshot: compareProjectSnapshot,
  saveSnapshot: saveProjectSnapshot,
  saveAutoSnapshot: saveAutoProjectSnapshot,
  restoreSnapshot: restoreProjectSnapshot,
  deleteSnapshot: deleteProjectSnapshot,
} = projectActivity

function runProjectEdit<T>(name: ProjectActionName, mutate: () => T): T {
  return projectActions.run(name, mutate)
}

function onSheetPreset(width: number, height: number) {
  if (sheetWidth.value === width && sheetHeight.value === height) return
  runProjectEdit('sheet.preset', () => {
    sheetWidth.value = width
    sheetHeight.value = height
  })
}

function onSheetWidthChanged(value: number) {
  if (sheetWidth.value !== value) runProjectEdit('sheet.width', () => { sheetWidth.value = value })
}

function onSheetHeightChanged(value: number) {
  if (sheetHeight.value !== value) runProjectEdit('sheet.height', () => { sheetHeight.value = value })
}

function onKerfChanged(value: number) {
  if (kerf.value !== value) runProjectEdit('sheet.kerf', () => { kerf.value = value })
}

function onPricePerSheetChanged(value: number) {
  if (pricePerSheet.value !== value) runProjectEdit('cost.price', () => { pricePerSheet.value = value })
}

function onCurrencyChanged(value: string) {
  if (currency.value !== value) runProjectEdit('cost.currency', () => { currency.value = value })
}

function onStrategyChanged(value: CuttingStrategy) {
  if (selectedStrategy.value !== value) runProjectEdit('strategy.select', () => { selectedStrategy.value = value })
}

function addPiece(input: NewPieceInput) {
  runProjectEdit('piece.add', () => pieceList.add(input))
  recordOperation(t('operation.add_piece'), `${input.label || t('unnamed_piece')} · ${input.width}×${input.height}`)
}

function importPieces(payload: { rows: readonly NewPieceInput[]; added: number; skipped: number }) {
  saveAutoProjectSnapshot(t('snapshot.auto_before_import'))
  runProjectEdit('piece.import', () => pieceList.addMany(payload.rows))
  const message = payload.skipped
    ? t('import_added_skipped').replace('{0}', String(payload.added)).replace('{1}', String(payload.skipped))
    : t('import_added').replace('{0}', String(payload.added))
  showToast(message)
  recordOperation(
    t('operation.import'),
    payload.skipped
      ? t('operation.import_detail_skipped').replace('{0}', String(payload.added)).replace('{1}', String(payload.skipped))
      : t('operation.import_detail').replace('{0}', String(payload.added)),
  )
}

function loadInitialState() {
  const shared = readShareFromHash(location.hash)
  if (shared) {
    applyState(shared)
    saveStateNow()
    history.replaceState(null, '', location.pathname + location.search)
    showToast(t('link_loaded'))
    return
  }
  loadState()
}

function removePiece(piece: CutPiece) {
  saveAutoProjectSnapshot(t('snapshot.auto_before_delete'))
  if (!runProjectEdit('piece.remove', () => pieceList.remove(piece))) return
  recordOperation(t('operation.delete_piece'), piece.label.trim() || t('unnamed_piece'))
}

function duplicate(id: string | null) {
  runProjectEdit('piece.duplicate', () => pieceList.duplicate(id))
}

function clearAll() {
  if (!pieces.length) return
  saveAutoProjectSnapshot(t('snapshot.auto_before_clear'))
  const count = runProjectEdit('piece.clear', () => pieceList.clear())
  lastBulkDiff.value = null
  recordOperation(t('operation.clear'), t('operation.clear_detail').replace('{0}', String(count)))
}

async function calculate() {
  if (!Number.isFinite(sheetWidth.value) || sheetWidth.value <= 0
    || !Number.isFinite(sheetHeight.value) || sheetHeight.value <= 0
    || !Number.isFinite(kerf.value) || kerf.value < 0) {
    showError(t('calc_error'))
    return
  }
  try {
    assertOptimizerCapacity(pieces)
  } catch {
    showError(t('qty_limit'))
    return
  }

  const nextResult = await optimization.run({
    sheetWidth: sheetWidth.value,
    sheetHeight: sheetHeight.value,
    pieces: [...pieces],
    kerf: kerf.value,
    strategy: selectedStrategy.value,
  })
  if (nextResult) {
    recordOperation(
      t('operation.calculate'),
      `${nextResult.totalSheets} ${t('sheets')} · ${nextResult.overallEfficiency.toFixed(1)}%`,
    )
  } else if (optimization.state.value.status === 'error') {
    console.error('Optimization failed', optimization.state.value.error)
    showError(t('calc_error'))
  }
}

async function copyShareLink() {
  const url = buildShareUrl(location.origin, location.pathname, currentState())
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    history.replaceState(null, '', url)
  }
  showToast(t('link_copied'))
  recordOperation(t('operation.share'), t('operation.share_detail'))
}

function setPieceSortMode(mode: PieceSortMode) {
  pieceSortMode.value = mode
  applyPieceSort()
}

function clearPieceFilters() {
  pieceList.clearFilters()
}

function duplicatePiece(source = selectedPiece.value) {
  if (!source) return
  if (!runProjectEdit('piece.duplicate', () => pieceList.duplicate(source.id, true))) return
  showToast(t('piece_duplicated'))
  recordOperation(t('operation.duplicate_piece'), source.label.trim() || t('unnamed_piece'))
}

function deleteSelectedPiece() {
  if (selectedPiece.value) removePiece(selectedPiece.value)
}

function togglePieceLock(piece: CutPiece) {
  runProjectEdit('piece.lock', () => { pieceList.toggleLock(piece) })
  showToast(piece.locked ? t('piece_locked') : t('piece_unlocked'))
  recordOperation(piece.locked ? t('operation.lock_piece') : t('operation.unlock_piece'), piece.label.trim() || t('unnamed_piece'))
}

function updatePieceLabel(piece: CutPiece, label: string) {
  runProjectEdit('piece.label', () => pieceList.updateLabel(piece, label))
}

function updatePieceWidth(piece: CutPiece, width: number) {
  runProjectEdit('piece.width', () => pieceList.updateWidth(piece, width))
}

function updatePieceHeight(piece: CutPiece, height: number) {
  runProjectEdit('piece.height', () => pieceList.updateHeight(piece, height))
}

function updatePieceQuantity(piece: CutPiece, quantity: number) {
  runProjectEdit('piece.quantity', () => pieceList.updateQuantity(piece, quantity))
}

function togglePieceRotation(piece: CutPiece) {
  runProjectEdit('piece.rotation', () => pieceList.toggleRotation(piece))
}

function setVisibleRotation(allowRotation: boolean) {
  if (!visibleEditablePieces.value.length) return
  saveAutoProjectSnapshot(t('snapshot.auto_before_rotation'))
  const change = runProjectEdit('pieces.rotation', () => pieceList.setVisibleRotation(allowRotation))
  if (!change) return
  showToast(allowRotation ? t('rotation_enabled') : t('rotation_disabled'))
  lastBulkDiff.value = {
    title: allowRotation ? t('bulk.rotation_on') : t('bulk.rotation_off'),
    changed: change.changed,
    skipped: change.skipped,
    beforeArea: areaM2(change.beforeArea),
    afterArea: areaM2(change.afterArea),
    sampleBefore: t('bulk.rotation'),
    sampleAfter: allowRotation ? t('bulk.enabled') : t('bulk.disabled'),
  }
  recordOperation(
    allowRotation ? t('operation.rotation_on') : t('operation.rotation_off'),
    t('operation.visible_count').replace('{0}', String(change.changed)),
  )
}

function mutateVisibleDimensions(
  transform: (piece: CutPiece) => { width: number; height: number },
  title = t('bulk.transform'),
) {
  if (!visibleEditablePieces.value.length) return
  saveAutoProjectSnapshot(t('snapshot.auto_before_transform'))
  const change = runProjectEdit('pieces.transform', () => pieceList.mutateVisibleDimensions(transform))
  if (!change) return
  lastBulkDiff.value = {
    title,
    changed: change.changed,
    skipped: change.skipped,
    beforeArea: areaM2(change.beforeArea),
    afterArea: areaM2(change.afterArea),
    sampleBefore: change.sampleBefore,
    sampleAfter: change.sampleAfter,
  }
  showToast(t('transform_done'))
  recordOperation(title, t('operation.visible_count').replace('{0}', String(change.changed)))
}

function addVisibleAllowance(sign = 1) {
  const delta = Math.max(1, Math.round(transformStep.value)) * sign
  mutateVisibleDimensions(piece => addDimensionDelta(piece, delta), `${delta > 0 ? '+' : ''}${delta} ${t('bulk.allowance')}`)
}

function addVisibleAllowancePreset(delta: number) {
  transformStep.value = delta
  mutateVisibleDimensions(piece => addDimensionDelta(piece, delta), `+${delta} ${t('bulk.allowance')}`)
}

function swapVisibleDimensions() {
  mutateVisibleDimensions(piece => swapDimensions(piece), t('bulk.swap'))
}

function roundVisibleDimensions() {
  const step = Math.max(1, Math.round(roundStep.value))
  mutateVisibleDimensions(piece => roundDimensionsUp(piece, step), `${t('bulk.round')} ${step}`)
}

function applyPieceSort() {
  if (!runProjectEdit('pieces.sort', () => pieceList.sort())) return
  showToast(t('pieces_sorted'))
  recordOperation(t('operation.sort'), t(`sort.${pieceSortMode.value}`))
}

function loadExample() {
  saveAutoProjectSnapshot(t('snapshot.auto_before_import'))
  const example = [
    { label: t('example.side'), width: 1800, height: 300, quantity: 2, allowRotation: true },
    { label: t('example.shelf'), width: 760, height: 300, quantity: 4, allowRotation: true },
    { label: t('example.back'), width: 1800, height: 800, quantity: 1, allowRotation: true },
  ]
  runProjectEdit('example.load', () => pieceList.addMany(example))
  recordOperation(t('operation.load_example'), t('operation.import_detail').replace('{0}', String(example.length)))
  calculate()
}

function onDragStart(index: number) {
  if (pieces[index]?.locked) return
  dragStartIdx.value = index
  isDragging.value = true
}

function movePiece(sourceIndex: number, direction: -1 | 1) {
  if (!runProjectEdit('pieces.reorder', () => pieceList.move(sourceIndex, direction))) return
  recordOperation(t('operation.reorder'), t('operation.visible_count').replace('{0}', '1'))
}

function dropPiece(targetIndex: number) {
  const unlockedCount = pieces.filter(piece => !piece.locked).length
  if (!runProjectEdit('pieces.reorder', () => pieceList.drop(dragStartIdx.value, targetIndex))) return
  dragStartIdx.value = -1
  dragOverIdx.value = -1
  recordOperation(t('operation.reorder'), t('operation.visible_count').replace('{0}', String(unlockedCount)))
}

function onDragEnd() {
  dragStartIdx.value = -1
  dragOverIdx.value = -1
  isDragging.value = false
}

const paletteCommands = computed<PaletteCommand[]>(() => [
  { id: 'calculate', label: t('calculate'), shortcut: 'Ctrl+Enter', disabled: !pieces.length, run: calculate },
  { id: 'add', label: t('add_piece'), shortcut: 'Enter', run: () => { projectInputRef.value?.submit() } },
  { id: 'duplicate', label: t('duplicate_selected'), disabled: !selectedPiece.value, run: () => duplicatePiece() },
  { id: 'delete', label: t('delete'), disabled: !selectedPiece.value, run: deleteSelectedPiece },
  { id: 'lock-toggle', label: selectedPiece.value?.locked ? t('command.unlock_selected') : t('command.lock_selected'), disabled: !selectedPiece.value, run: () => { if (selectedPiece.value) togglePieceLock(selectedPiece.value) } },
  { id: 'import', label: t('command.open_import'), disabled: showImport.value, run: () => { showImport.value = true } },
  { id: 'share', label: t('command.copy_share'), disabled: !pieces.length, run: copyShareLink },
  { id: 'snapshot-save', label: t('command.snapshot_save'), disabled: !pieces.length, run: saveProjectSnapshot },
  { id: 'snapshot-restore', label: t('command.snapshot_restore_latest'), disabled: !projectSnapshots.value.length, run: () => restoreProjectSnapshot(projectSnapshots.value[0]) },
  { id: 'undo', label: t('hotkey.undo'), shortcut: 'Ctrl+Z', disabled: !canUndo.value, run: () => { doUndo() } },
  { id: 'redo', label: t('hotkey.redo'), shortcut: 'Ctrl+Shift+Z', disabled: !canRedo.value, run: () => { doRedo() } },
  { id: 'clear-filter', label: t('command.clear_filter'), disabled: !hasPieceFilter.value, run: clearPieceFilters },
  { id: 'sort-area', label: t('command.sort_area'), run: () => setPieceSortMode('area_desc') },
  { id: 'sort-name', label: t('command.sort_name'), run: () => setPieceSortMode('name_asc') },
  { id: 'sort-quantity', label: t('command.sort_quantity'), run: () => setPieceSortMode('quantity_desc') },
  { id: 'rotation-on', label: t('command.rotation_visible_on'), disabled: !visibleEditablePieces.value.length, run: () => setVisibleRotation(true) },
  { id: 'rotation-off', label: t('command.rotation_visible_off'), disabled: !visibleEditablePieces.value.length, run: () => setVisibleRotation(false) },
  { id: 'transform-add', label: t('command.transform_add'), disabled: !visibleEditablePieces.value.length, run: () => addVisibleAllowance(1) },
  { id: 'transform-sub', label: t('command.transform_sub'), disabled: !visibleEditablePieces.value.length, run: () => addVisibleAllowance(-1) },
  { id: 'transform-swap', label: t('command.transform_swap'), disabled: !visibleEditablePieces.value.length, run: swapVisibleDimensions },
  { id: 'transform-round', label: t('command.transform_round'), disabled: !visibleEditablePieces.value.length, run: roundVisibleDimensions },
  { id: 'clear-log', label: t('command.clear_log'), disabled: !operationLog.value.length, run: clearOperationLog },
  { id: 'clear-all', label: t('command.clear_all'), disabled: !pieces.length, run: clearAll },
])

const {
  isOpen: commandPaletteOpen,
  query: commandQuery,
  activeIndex: activePaletteIndex,
  visibleCommands: visiblePaletteCommands,
  open: openCommandPalette,
  close: closeCommandPalette,
  run: runPaletteCommand,
  onKeydown: onPaletteKeydown,
} = useCommandPalette({
  commands: paletteCommands,
  focusSearch: () => commandInputRef.value?.focus(),
  scrollToIndex: index => document.getElementById(`command-option-${index}`)?.scrollIntoView({ block: 'nearest' }),
  onError: () => showError(t('command_error')),
})

useKeyboardShortcuts([
  { key: 'k', ctrlOrMeta: true, allowInEditable: true, run: openCommandPalette },
  { key: 'Escape', allowInEditable: true, when: () => commandPaletteOpen.value, run: closeCommandPalette },
  { key: 'Enter', ctrlOrMeta: true, allowInEditable: true, run: () => { if (pieces.length) calculate() } },
  { key: 'Enter', run: () => { projectInputRef.value?.submit() } },
  { key: 'z', ctrlOrMeta: true, run: doUndo },
  { key: 'z', ctrlOrMeta: true, shift: true, run: doRedo },
  { key: 'y', ctrlOrMeta: true, run: doRedo },
  { key: 'd', ctrlOrMeta: true, run: () => { duplicate(selectedPieceId.value) } },
  {
    key: 'Escape',
    run: () => {
      if (selectedPieceId.value !== null) pieceList.clearSelection()
      else optimization.invalidate()
    },
  },
])

onMounted(() => {
  loadInitialState()
  projectActivity.load()
  homeHistory.reset()
})

onUnmounted(() => {
  optimization.dispose()
  projectActivity.dispose()
  homeStorage.dispose()
  homeHistory.dispose()
  clearToast()
  saveStateNow()
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>{{ t('app.title') }}</h1>
      <p class="subtitle">{{ t('home.subtitle') }}</p>
    </header>

    <div class="hotkey-bar">
      <span><kbd>Enter</kbd> {{ t('hotkey.add') }}</span>
      <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> {{ t('hotkey.calculate') }}</span>
      <span><kbd>Ctrl</kbd>+<kbd>K</kbd> {{ t('command_palette') }}</span>
      <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> {{ t('hotkey.undo') }}</span>
      <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> {{ t('hotkey.redo') }}</span>
      <span><kbd>Ctrl</kbd>+<kbd>D</kbd> {{ t('hotkey.duplicate') }}</span>
      <span><kbd>Esc</kbd> {{ t('hotkey.clear') }}</span>
    </div>

    <div class="main-layout">
      <aside class="panel panel-input">
        <ProjectInputPanel
          ref="projectInputRef"
          v-model:show-import="showImport"
          :sheet-width="sheetWidth"
          :sheet-height="sheetHeight"
          :kerf="kerf"
          :price-per-sheet="pricePerSheet"
          :currency="currency"
          :selected-strategy="selectedStrategy"
          :pieces="pieces"
          @sheet-preset="onSheetPreset"
          @sheet-width="onSheetWidthChanged"
          @sheet-height="onSheetHeightChanged"
          @kerf="onKerfChanged"
          @price-per-sheet="onPricePerSheetChanged"
          @currency="onCurrencyChanged"
          @strategy="onStrategyChanged"
          @add-piece="addPiece"
          @import-pieces="importPieces"
        />
        <ProjectActivityPanel
          v-model:snapshot-name="snapshotName"
          v-model:operation-query="operationQuery"
          :snapshots="projectSnapshots"
          :operation-log="filteredOperationLog"
          :snapshot-compare="snapshotCompare"
          :has-pieces="pieces.length > 0"
          @save="saveProjectSnapshot"
          @restore="restoreProjectSnapshot"
          @compare="compareProjectSnapshot"
          @delete="deleteProjectSnapshot"
          @clear-log="clearOperationLog"
        />
      </aside>

      <main class="panel panel-result">
        <PieceEditorPanel
          v-model:piece-query="pieceQuery"
          v-model:piece-sort-mode="pieceSortMode"
          v-model:quick-filter-mode="quickFilterMode"
          v-model:transform-step="transformStep"
          v-model:round-step="roundStep"
          v-model:min-machine-cut="minMachineCut"
          :pieces="pieces"
          :piece-summary="pieceSummary"
          :oversized-pieces="oversizedPieces"
          :small-machine-pieces="smallMachinePieces"
          :locked-pieces-count="lockedPiecesCount"
          :unnamed-pieces-count="unnamedPiecesCount"
          :rotation-locked-count="rotationLockedCount"
          :visible-pieces="visiblePieces"
          :visible-editable-count="visibleEditablePieces.length"
          :has-piece-filter="hasPieceFilter"
          :selected-piece="selectedPiece"
          :selected-piece-stats="selectedPieceStats"
          :selected-piece-id="selectedPieceId"
          :piece-indexes="pieceIndexes"
          :result="result"
          :can-undo="canUndo"
          :can-redo="canRedo"
          :last-bulk-diff="lastBulkDiff"
          :is-dragging="isDragging"
          :drag-over-index="dragOverIdx"
          :drag-start-index="dragStartIdx"
          :can-move-piece="pieceList.canMove"
          @open-commands="openCommandPalette"
          @undo="doUndo"
          @redo="doRedo"
          @calculate="calculate"
          @clear-filters="clearPieceFilters"
          @sort="applyPieceSort"
          @duplicate-selected="duplicatePiece()"
          @visible-rotation="setVisibleRotation"
          @add-allowance="addVisibleAllowance"
          @allowance-preset="addVisibleAllowancePreset"
          @round-dimensions="roundVisibleDimensions"
          @swap-dimensions="swapVisibleDimensions"
          @toggle-lock="togglePieceLock"
          @delete-selected="deleteSelectedPiece"
          @clear-selection="clearSelection"
          @drag-start="onDragStart"
          @drag-over="dragOverIdx = $event"
          @drag-leave="dragOverIdx = -1"
          @drop="dropPiece"
          @drag-end="onDragEnd"
          @move-piece="movePiece"
          @select-piece="toggleSelect"
          @update-label="updatePieceLabel"
          @update-width="updatePieceWidth"
          @update-height="updatePieceHeight"
          @update-quantity="updatePieceQuantity"
          @toggle-rotation="togglePieceRotation"
          @duplicate="duplicate"
          @remove="removePiece"
          @clear-all="clearAll"
          @share="copyShareLink"
          @export-csv="exportPiecesCsv"
        />

        <OptimizationWorkspace
          :state="optimizationState"
          :costing-visible="costingVisible"
          :cost-summary="costSummary"
          :currency="currency"
          :selected-piece-id="selectedPieceId"
          :piece-indexes="pieceIndexes"
          :can-retry="pieces.length > 0"
          @load-example="loadExample"
          @cancel="optimization.cancel"
          @retry="calculate"
          @export-svg="exportSvg"
          @export-dxf="exportDxf"
          @print="printLayout"
          @select="toggleSelect"
        />
      </main>
    </div>

    <transition name="palette-fade">
      <div v-if="commandPaletteOpen" class="command-palette-backdrop" @click.self="closeCommandPalette">
        <div class="command-palette" role="dialog" aria-modal="true" :aria-label="t('command_palette')">
          <label class="command-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input
              ref="commandInputRef"
              v-model="commandQuery"
              type="search"
              role="combobox"
              aria-controls="command-options"
              aria-autocomplete="list"
              :aria-expanded="commandPaletteOpen"
              :aria-activedescendant="visiblePaletteCommands.length ? `command-option-${activePaletteIndex}` : undefined"
              :placeholder="t('command_search')"
              @keydown="onPaletteKeydown"
            />
          </label>
          <div id="command-options" class="command-list" role="listbox">
            <button
              v-for="(command, commandIndex) in visiblePaletteCommands"
              :key="command.id"
              :id="`command-option-${commandIndex}`"
              class="command-item"
              :class="{ active: commandIndex === activePaletteIndex }"
              :disabled="command.disabled"
              role="option"
              :aria-selected="commandIndex === activePaletteIndex"
              @mouseenter="activePaletteIndex = commandIndex"
              @click="runPaletteCommand(command)"
            >
              <span>{{ command.label }}</span>
              <kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
            </button>
            <p v-if="!visiblePaletteCommands.length" class="command-empty">{{ t('command_no_results') }}</p>
          </div>
        </div>
      </div>
    </transition>

    <transition name="toast-fade">
      <div v-if="toast" class="toast" :class="`toast-${toastTone}`" :role="toastTone === 'error' ? 'alert' : 'status'">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  background: rgba(20, 20, 22, 0.92);
  color: #fff;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
  z-index: 1000;
  pointer-events: none;
}
.toast-error {
  border-color: var(--eff-poor-tx);
  box-shadow: 0 12px 32px rgba(0,0,0,.25), inset 3px 0 0 var(--eff-poor-tx);
}
.toast-fade-enter-active,
.toast-fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-fade-enter-from,
.toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>

<script lang="ts">
  import { untrack } from 'svelte'
  import { fade } from 'svelte/transition'
  import OptimizationWorkspace from '@/components/OptimizationWorkspace.svelte'
  import PieceEditorPanel from '@/components/PieceEditorPanel.svelte'
  import ProjectActivityPanel from '@/components/ProjectActivityPanel.svelte'
  import ProjectInputPanel from '@/components/ProjectInputPanel.svelte'
  import { useCommandPalette, type PaletteCommand } from '@/composables/useCommandPalette.svelte'
  import { useCosting } from '@/composables/useCosting.svelte'
  import { useHomeExports } from '@/composables/useHomeExports.svelte'
  import { useHomeHistory } from '@/composables/useHomeHistory.svelte'
  import { useHomeStorage } from '@/composables/useHomeStorage.svelte'
  import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts.svelte'
  import { useOptimizationSession } from '@/composables/useOptimizationSession.svelte'
  import type { NewPieceInput } from '@/composables/usePieceList.svelte'
  import { useProjectActions, type ProjectActionName } from '@/composables/useProjectActions.svelte'
  import { safetySnapshotAllowsMutation, useProjectActivity } from '@/composables/useProjectActivity.svelte'
  import { useProjectState } from '@/composables/useProjectState.svelte'
  import { useResultSelection } from '@/composables/useResultSelection.svelte'
  import { useToast } from '@/composables/useToast.svelte'
  import { buildShareUrl, readShareFromHash } from '@/lib/shareLink'
  import {
    addDimensionDelta,
    formatAreaM2,
    roundDimensionsUp,
    swapDimensions,
    type PieceBulkDiff,
    type PieceSortMode,
  } from '@/lib/pieceEditor'
  import { assertOptimizerCapacity } from '@/lib/optimizerLimits'
  import { isDefaultHomeState } from '@/lib/homeState'
  import type { CutPiece } from '@/services/types'
  import { CuttingStrategy } from '@/services/types'
  import { useL10n } from '@/stores/l10n.svelte'

  const l10n = useL10n()
  const t = l10n.t
  const toast = useToast()
  const showToast = toast.show
  const showError = toast.showError
  let minMachineCut = $state(30)
  let selectedStrategy = $state<CuttingStrategy>(CuttingStrategy.Auto)
  let showImport = $state(false)
  let commandInputRef = $state<HTMLInputElement | null>(null)
  let projectInputRef = $state<{ submit: () => void } | null>(null)
  let transformStep = $state(2)
  let roundStep = $state(5)
  let lastBulkDiff = $state.raw<PieceBulkDiff | null>(null)
  let dragStartIdx = $state(-1)
  let dragOverIdx = $state(-1)
  let isDragging = $state(false)

  const projectState = useProjectState({ minMachineCut: () => minMachineCut })
  const pieceList = projectState.pieceList
  const currentState = projectState.read
  const applyState = projectState.apply
  const projectHasContent = $derived(!isDefaultHomeState(currentState()))

  const optimization = useOptimizationSession()
  const resultSelection = useResultSelection({
    pieces: () => pieceList.pieces,
    result: () => optimization.result,
    selectedPieceId: () => pieceList.selectedPieceId,
  })
  const costing = useCosting({
    result: () => optimization.result,
    pricePerSheet: () => projectState.pricePerSheet,
  })
  const { exportPiecesCsv, exportSvg, exportDxf, printLayout } = useHomeExports({
    pieces: () => pieceList.pieces,
    result: () => optimization.result,
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
    persist: homeStorage.saveState,
    onRestore: invalidateOptimization,
  })
  const recordHistory = homeHistory.record
  const doUndo = homeHistory.undo
  const doRedo = homeHistory.redo
  const projectActions = useProjectActions({
    invalidateLayout: invalidateOptimization,
    scheduleSave: saveState,
    recordHistory,
  })

  function resetAfterSnapshotRestore() {
    pieceList.selectedPieceId = null
    pieceList.pieceQuery = ''
    pieceList.quickFilterMode = 'all'
    pieceList.pieceSortMode = 'manual'
    lastBulkDiff = null
    optimization.invalidate()
    homeHistory.reset()
  }

  const projectActivity = useProjectActivity({
    capture: currentState,
    apply: applyState,
    hasContent: () => projectHasContent,
    snapshotSummary: () => `${pieceList.pieceSummary.totalTypes} ${t('piece_types')} · ${pieceList.pieceSummary.totalQuantity} ${t('pieces_short')} · ${formatAreaM2(pieceList.pieceSummary.totalArea)} ${t('material_area')}`,
    resetAfterRestore: resetAfterSnapshotRestore,
    persist: homeStorage.saveState,
    translate: t,
    showToast,
    showError,
  })
  const recordOperation = projectActivity.recordOperation
  const clearOperationLog = projectActivity.clearOperationLog
  const compareProjectSnapshot = projectActivity.compareSnapshot
  const saveProjectSnapshot = projectActivity.saveSnapshot
  const saveAutoProjectSnapshot = projectActivity.saveAutoSnapshot
  const restoreProjectSnapshot = projectActivity.restoreSnapshot
  const deleteProjectSnapshot = projectActivity.deleteSnapshot

  function saveSafetySnapshot(name: string): boolean {
    return safetySnapshotAllowsMutation(saveAutoProjectSnapshot(name))
  }

  function runProjectEdit<T>(name: ProjectActionName, mutate: () => T): T {
    return projectActions.run(name, mutate)
  }

  function onSheetPreset(width: number, height: number) {
    if (projectState.sheetWidth === width && projectState.sheetHeight === height) return
    runProjectEdit('sheet.preset', () => {
      projectState.sheetWidth = width
      projectState.sheetHeight = height
    })
  }

  function onSheetWidthChanged(value: number) {
    if (projectState.sheetWidth !== value) runProjectEdit('sheet.width', () => { projectState.sheetWidth = value })
  }

  function onSheetHeightChanged(value: number) {
    if (projectState.sheetHeight !== value) runProjectEdit('sheet.height', () => { projectState.sheetHeight = value })
  }

  function onKerfChanged(value: number) {
    if (projectState.kerf !== value) runProjectEdit('sheet.kerf', () => { projectState.kerf = value })
  }

  function onPricePerSheetChanged(value: number) {
    if (projectState.pricePerSheet !== value) runProjectEdit('cost.price', () => { projectState.pricePerSheet = value })
  }

  function onCurrencyChanged(value: string) {
    if (projectState.currency !== value) runProjectEdit('cost.currency', () => { projectState.currency = value })
  }

  function onStrategyChanged(value: CuttingStrategy) {
    if (selectedStrategy !== value) runProjectEdit('strategy.select', () => { selectedStrategy = value })
  }

  function addPiece(input: NewPieceInput) {
    runProjectEdit('piece.add', () => pieceList.add(input))
    recordOperation(t('operation.add_piece'), `${input.label || t('unnamed_piece')} · ${input.width}×${input.height}`)
  }

  function importPieces(payload: { rows: readonly NewPieceInput[]; added: number; skipped: number }) {
    if (!saveSafetySnapshot(t('snapshot.auto_before_import'))) return
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
    // The stored project is loaded first so that a share link never replaces the
    // user's only copy without an automatic snapshot of it.
    loadState()
    if (!shared) return
    if (!saveSafetySnapshot(t('snapshot.auto_before_share'))) return
    applyState(shared)
    saveStateNow()
    history.replaceState(null, '', location.pathname + location.search)
    showToast(t('link_loaded'))
  }

  function removePiece(piece: CutPiece) {
    if (!saveSafetySnapshot(t('snapshot.auto_before_delete'))) return
    if (!runProjectEdit('piece.remove', () => pieceList.remove(piece))) return
    recordOperation(t('operation.delete_piece'), piece.label.trim() || t('unnamed_piece'))
  }

  function duplicate(id: string | null) {
    runProjectEdit('piece.duplicate', () => pieceList.duplicate(id))
  }

  function clearAll() {
    if (!pieceList.pieces.length) return
    if (!saveSafetySnapshot(t('snapshot.auto_before_clear'))) return
    const count = runProjectEdit('piece.clear', () => pieceList.clear())
    lastBulkDiff = null
    recordOperation(t('operation.clear'), t('operation.clear_detail').replace('{0}', String(count)))
  }

  async function calculate() {
    if (!Number.isFinite(projectState.sheetWidth) || projectState.sheetWidth <= 0
      || !Number.isFinite(projectState.sheetHeight) || projectState.sheetHeight <= 0
      || !Number.isFinite(projectState.kerf) || projectState.kerf < 0) {
      showError(t('calc_error'))
      return
    }
    try {
      assertOptimizerCapacity(pieceList.pieces)
    } catch {
      showError(t('qty_limit'))
      return
    }

    const nextResult = await optimization.run({
      sheetWidth: projectState.sheetWidth,
      sheetHeight: projectState.sheetHeight,
      pieces: [...pieceList.pieces],
      kerf: projectState.kerf,
      strategy: selectedStrategy,
    })
    if (nextResult) {
      recordOperation(
        t('operation.calculate'),
        `${nextResult.totalSheets} ${t('sheets')} · ${nextResult.overallEfficiency.toFixed(1)}%`,
      )
    } else if (optimization.state.status === 'error') {
      console.error('Optimization failed', optimization.state.error)
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
    pieceList.pieceSortMode = mode
    applyPieceSort()
  }

  function clearPieceFilters() {
    pieceList.clearFilters()
  }

  function duplicatePiece(source: CutPiece | null = resultSelection.selectedPiece) {
    if (!source) return
    if (!runProjectEdit('piece.duplicate', () => pieceList.duplicate(source.id, true))) return
    showToast(t('piece_duplicated'))
    recordOperation(t('operation.duplicate_piece'), source.label.trim() || t('unnamed_piece'))
  }

  function deleteSelectedPiece() {
    if (resultSelection.selectedPiece) removePiece(resultSelection.selectedPiece)
  }

  function togglePieceLock(piece: CutPiece) {
    runProjectEdit('piece.lock', () => pieceList.toggleLock(piece))
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
    if (!pieceList.visibleEditablePieces.length) return
    if (!saveSafetySnapshot(t('snapshot.auto_before_rotation'))) return
    const change = runProjectEdit('pieces.rotation', () => pieceList.setVisibleRotation(allowRotation))
    if (!change) return
    showToast(allowRotation ? t('rotation_enabled') : t('rotation_disabled'))
    lastBulkDiff = {
      title: allowRotation ? t('bulk.rotation_on') : t('bulk.rotation_off'),
      changed: change.changed,
      skipped: change.skipped,
      beforeArea: formatAreaM2(change.beforeArea),
      afterArea: formatAreaM2(change.afterArea),
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
    if (!pieceList.visibleEditablePieces.length) return
    if (!saveSafetySnapshot(t('snapshot.auto_before_transform'))) return
    const change = runProjectEdit('pieces.transform', () => pieceList.mutateVisibleDimensions(transform))
    if (!change) return
    lastBulkDiff = {
      title,
      changed: change.changed,
      skipped: change.skipped,
      beforeArea: formatAreaM2(change.beforeArea),
      afterArea: formatAreaM2(change.afterArea),
      sampleBefore: change.sampleBefore,
      sampleAfter: change.sampleAfter,
    }
    showToast(t('transform_done'))
    recordOperation(title, t('operation.visible_count').replace('{0}', String(change.changed)))
  }

  function addVisibleAllowance(sign = 1) {
    const delta = Math.max(1, Math.round(transformStep)) * sign
    mutateVisibleDimensions(piece => addDimensionDelta(piece, delta), `${delta > 0 ? '+' : ''}${delta} ${t('bulk.allowance')}`)
  }

  function addVisibleAllowancePreset(delta: number) {
    transformStep = delta
    mutateVisibleDimensions(piece => addDimensionDelta(piece, delta), `+${delta} ${t('bulk.allowance')}`)
  }

  function swapVisibleDimensions() {
    mutateVisibleDimensions(piece => swapDimensions(piece), t('bulk.swap'))
  }

  function roundVisibleDimensions() {
    const step = Math.max(1, Math.round(roundStep))
    mutateVisibleDimensions(piece => roundDimensionsUp(piece, step), `${t('bulk.round')} ${step}`)
  }

  function applyPieceSort() {
    if (!runProjectEdit('pieces.sort', () => pieceList.sort())) return
    showToast(t('pieces_sorted'))
    recordOperation(t('operation.sort'), t(`sort.${pieceList.pieceSortMode}`))
  }

  function loadExample() {
    if (!saveSafetySnapshot(t('snapshot.auto_before_import'))) return
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
    if (pieceList.pieces[index]?.locked) return
    dragStartIdx = index
    isDragging = true
  }

  function movePiece(sourceIndex: number, direction: -1 | 1) {
    if (!runProjectEdit('pieces.reorder', () => pieceList.move(sourceIndex, direction))) return
    recordOperation(t('operation.reorder'), t('operation.visible_count').replace('{0}', '1'))
  }

  function dropPiece(targetIndex: number) {
    const unlockedCount = pieceList.pieces.filter(piece => !piece.locked).length
    if (!runProjectEdit('pieces.reorder', () => pieceList.drop(dragStartIdx, targetIndex))) return
    dragStartIdx = -1
    dragOverIdx = -1
    recordOperation(t('operation.reorder'), t('operation.visible_count').replace('{0}', String(unlockedCount)))
  }

  function onDragEnd() {
    dragStartIdx = -1
    dragOverIdx = -1
    isDragging = false
  }

  const paletteCommands = $derived<PaletteCommand[]>([
    { id: 'calculate', label: t('calculate'), shortcut: 'Ctrl+Enter', disabled: !pieceList.pieces.length, run: calculate },
    { id: 'add', label: t('add_piece'), shortcut: 'Enter', run: () => { projectInputRef?.submit() } },
    { id: 'duplicate', label: t('duplicate_selected'), disabled: !resultSelection.selectedPiece, run: () => duplicatePiece() },
    { id: 'delete', label: t('delete'), disabled: !resultSelection.selectedPiece, run: deleteSelectedPiece },
    { id: 'lock-toggle', label: resultSelection.selectedPiece?.locked ? t('command.unlock_selected') : t('command.lock_selected'), disabled: !resultSelection.selectedPiece, run: () => { if (resultSelection.selectedPiece) togglePieceLock(resultSelection.selectedPiece) } },
    { id: 'import', label: t('command.open_import'), disabled: showImport, run: () => { showImport = true } },
    { id: 'share', label: t('command.copy_share'), disabled: !pieceList.pieces.length, run: copyShareLink },
    { id: 'snapshot-save', label: t('command.snapshot_save'), disabled: !projectHasContent, run: () => { saveProjectSnapshot() } },
    { id: 'snapshot-restore', label: t('command.snapshot_restore_latest'), disabled: !projectActivity.snapshots.length, run: () => { restoreProjectSnapshot(projectActivity.snapshots[0]) } },
    { id: 'undo', label: t('hotkey.undo'), shortcut: 'Ctrl+Z', disabled: !homeHistory.canUndo, run: () => { doUndo() } },
    { id: 'redo', label: t('hotkey.redo'), shortcut: 'Ctrl+Shift+Z', disabled: !homeHistory.canRedo, run: () => { doRedo() } },
    { id: 'clear-filter', label: t('command.clear_filter'), disabled: !pieceList.hasPieceFilter, run: clearPieceFilters },
    { id: 'sort-area', label: t('command.sort_area'), run: () => setPieceSortMode('area_desc') },
    { id: 'sort-name', label: t('command.sort_name'), run: () => setPieceSortMode('name_asc') },
    { id: 'sort-quantity', label: t('command.sort_quantity'), run: () => setPieceSortMode('quantity_desc') },
    { id: 'rotation-on', label: t('command.rotation_visible_on'), disabled: !pieceList.visibleEditablePieces.length, run: () => setVisibleRotation(true) },
    { id: 'rotation-off', label: t('command.rotation_visible_off'), disabled: !pieceList.visibleEditablePieces.length, run: () => setVisibleRotation(false) },
    { id: 'transform-add', label: t('command.transform_add'), disabled: !pieceList.visibleEditablePieces.length, run: () => addVisibleAllowance(1) },
    { id: 'transform-sub', label: t('command.transform_sub'), disabled: !pieceList.visibleEditablePieces.length, run: () => addVisibleAllowance(-1) },
    { id: 'transform-swap', label: t('command.transform_swap'), disabled: !pieceList.visibleEditablePieces.length, run: swapVisibleDimensions },
    { id: 'transform-round', label: t('command.transform_round'), disabled: !pieceList.visibleEditablePieces.length, run: roundVisibleDimensions },
    { id: 'clear-log', label: t('command.clear_log'), disabled: !projectActivity.operationLog.length, run: clearOperationLog },
    { id: 'clear-all', label: t('command.clear_all'), disabled: !pieceList.pieces.length, run: clearAll },
  ])

  const palette = useCommandPalette({
    commands: () => paletteCommands,
    focusSearch: () => commandInputRef?.focus(),
    scrollToIndex: index => document.getElementById(`command-option-${index}`)?.scrollIntoView({ block: 'nearest' }),
    onError: () => showError(t('command_error')),
  })
  const openCommandPalette = palette.open
  const closeCommandPalette = palette.close

  useKeyboardShortcuts([
    { key: 'k', ctrlOrMeta: true, allowInEditable: true, run: openCommandPalette },
    { key: 'Escape', allowInEditable: true, when: () => palette.isOpen, run: closeCommandPalette },
    { key: 'Enter', ctrlOrMeta: true, allowInEditable: true, run: () => { if (pieceList.pieces.length) calculate() } },
    { key: 'Enter', run: () => { projectInputRef?.submit() } },
    { key: 'z', ctrlOrMeta: true, run: () => { doUndo() } },
    { key: 'z', ctrlOrMeta: true, shift: true, run: () => { doRedo() } },
    { key: 'y', ctrlOrMeta: true, run: () => { doRedo() } },
    { key: 'd', ctrlOrMeta: true, run: () => { duplicate(pieceList.selectedPieceId) } },
    {
      key: 'Escape',
      run: () => {
        if (pieceList.selectedPieceId !== null) pieceList.clearSelection()
        else optimization.invalidate()
      },
    },
  ])

  $effect(() => {
    untrack(() => {
      // Snapshots must be loaded before loadInitialState so that the share-link
      // safety snapshot is appended to the stored list instead of replacing it.
      projectActivity.load()
      loadInitialState()
      homeHistory.reset()
    })
    return () => {
      optimization.dispose()
      projectActivity.dispose()
      homeStorage.dispose()
      homeHistory.dispose()
      toast.clear()
      saveStateNow()
    }
  })

  function toastFade(_node: Element, { duration = 250 }: { duration?: number } = {}) {
    return {
      duration,
      css: (progress: number, remaining: number) =>
        `opacity: ${progress}; transform: translateX(-50%) translateY(${remaining * 8}px);`,
    }
  }
</script>

<div class="app-container">
  <header class="app-header">
    <h1>{t('app.title')}</h1>
    <p class="subtitle">{t('home.subtitle')}</p>
  </header>

  <div class="hotkey-bar">
    <span><kbd>Enter</kbd> {t('hotkey.add')}</span>
    <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> {t('hotkey.calculate')}</span>
    <span><kbd>Ctrl</kbd>+<kbd>K</kbd> {t('command_palette')}</span>
    <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> {t('hotkey.undo')}</span>
    <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> {t('hotkey.redo')}</span>
    <span><kbd>Ctrl</kbd>+<kbd>D</kbd> {t('hotkey.duplicate')}</span>
    <span><kbd>Esc</kbd> {t('hotkey.clear')}</span>
  </div>

  <div class="main-layout">
    <aside class="panel panel-input">
      <ProjectInputPanel
        bind:this={projectInputRef}
        bind:showImport
        sheetWidth={projectState.sheetWidth}
        sheetHeight={projectState.sheetHeight}
        kerf={projectState.kerf}
        pricePerSheet={projectState.pricePerSheet}
        currency={projectState.currency}
        {selectedStrategy}
        pieces={pieceList.pieces}
        {onSheetPreset}
        onSheetWidth={onSheetWidthChanged}
        onSheetHeight={onSheetHeightChanged}
        onKerf={onKerfChanged}
        onPricePerSheet={onPricePerSheetChanged}
        onCurrency={onCurrencyChanged}
        onStrategy={onStrategyChanged}
        onAddPiece={addPiece}
        onImportPieces={importPieces}
      />
      <ProjectActivityPanel
        bind:snapshotName={projectActivity.snapshotName}
        bind:operationQuery={projectActivity.operationQuery}
        snapshots={projectActivity.snapshots}
        operationLog={projectActivity.filteredOperationLog}
        snapshotCompare={projectActivity.snapshotCompare}
        hasPieces={projectHasContent}
        onSave={() => { saveProjectSnapshot() }}
        onRestore={snapshot => { restoreProjectSnapshot(snapshot) }}
        onCompare={compareProjectSnapshot}
        onDelete={snapshot => { deleteProjectSnapshot(snapshot) }}
        onClearLog={clearOperationLog}
      />
    </aside>

    <main class="panel panel-result">
      <PieceEditorPanel
        bind:pieceQuery={pieceList.pieceQuery}
        bind:pieceSortMode={pieceList.pieceSortMode}
        bind:quickFilterMode={pieceList.quickFilterMode}
        bind:transformStep
        bind:roundStep
        bind:minMachineCut
        pieces={pieceList.pieces}
        pieceSummary={pieceList.pieceSummary}
        oversizedPieces={pieceList.oversizedPieces}
        smallMachinePieces={pieceList.smallMachinePieces}
        lockedPiecesCount={pieceList.lockedPiecesCount}
        unnamedPiecesCount={pieceList.unnamedPiecesCount}
        rotationLockedCount={pieceList.rotationLockedCount}
        visiblePieces={pieceList.visiblePieces}
        visibleEditableCount={pieceList.visibleEditablePieces.length}
        hasPieceFilter={pieceList.hasPieceFilter}
        selectedPiece={resultSelection.selectedPiece}
        selectedPieceStats={resultSelection.stats}
        selectedPieceId={pieceList.selectedPieceId}
        pieceIndexes={pieceList.pieceIndexes}
        result={optimization.result}
        canUndo={homeHistory.canUndo}
        canRedo={homeHistory.canRedo}
        {lastBulkDiff}
        {isDragging}
        dragOverIndex={dragOverIdx}
        dragStartIndex={dragStartIdx}
        canMovePiece={pieceList.canMove}
        onOpenCommands={openCommandPalette}
        onUndo={() => { doUndo() }}
        onRedo={() => { doRedo() }}
        onCalculate={calculate}
        onClearFilters={clearPieceFilters}
        onSort={applyPieceSort}
        onDuplicateSelected={() => duplicatePiece()}
        onVisibleRotation={setVisibleRotation}
        onAddAllowance={addVisibleAllowance}
        onAllowancePreset={addVisibleAllowancePreset}
        onRoundDimensions={roundVisibleDimensions}
        onSwapDimensions={swapVisibleDimensions}
        onToggleLock={togglePieceLock}
        onDeleteSelected={deleteSelectedPiece}
        onClearSelection={pieceList.clearSelection}
        {onDragStart}
        onDragOver={index => { dragOverIdx = index }}
        onDragLeave={() => { dragOverIdx = -1 }}
        onDrop={dropPiece}
        {onDragEnd}
        onMovePiece={movePiece}
        onSelectPiece={pieceList.toggleSelect}
        onUpdateLabel={updatePieceLabel}
        onUpdateWidth={updatePieceWidth}
        onUpdateHeight={updatePieceHeight}
        onUpdateQuantity={updatePieceQuantity}
        onToggleRotation={togglePieceRotation}
        onDuplicate={duplicate}
        onRemove={removePiece}
        onClearAll={clearAll}
        onShare={copyShareLink}
        onExportCsv={() => { exportPiecesCsv() }}
      />

      <OptimizationWorkspace
        state={optimization.state}
        costingVisible={costing.isVisible}
        costSummary={costing.summary}
        currency={projectState.currency}
        selectedPieceId={pieceList.selectedPieceId}
        pieceIndexes={pieceList.pieceIndexes}
        canRetry={pieceList.pieces.length > 0}
        onLoadExample={loadExample}
        onCancel={optimization.cancel}
        onRetry={calculate}
        onExportSvg={() => { exportSvg() }}
        onExportDxf={() => { exportDxf() }}
        onPrint={() => { printLayout() }}
        onSelect={pieceList.toggleSelect}
      />
    </main>
  </div>

  {#if palette.isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="command-palette-backdrop"
      transition:fade={{ duration: 160 }}
      onclick={event => { if (event.target === event.currentTarget) closeCommandPalette() }}
    >
      <div class="command-palette" role="dialog" aria-modal="true" aria-label={t('command_palette')}>
        <label class="command-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input
            bind:this={commandInputRef}
            bind:value={palette.query}
            type="search"
            role="combobox"
            aria-controls="command-options"
            aria-autocomplete="list"
            aria-expanded={palette.isOpen}
            aria-activedescendant={palette.visibleCommands.length ? `command-option-${palette.activeIndex}` : undefined}
            placeholder={t('command_search')}
            onkeydown={palette.onKeydown}
          />
        </label>
        <div id="command-options" class="command-list" role="listbox">
          {#each palette.visibleCommands as command, commandIndex (command.id)}
            <button
              id={`command-option-${commandIndex}`}
              class="command-item"
              class:active={commandIndex === palette.activeIndex}
              disabled={command.disabled}
              role="option"
              aria-selected={commandIndex === palette.activeIndex}
              onmouseenter={() => { palette.activeIndex = commandIndex }}
              onclick={() => { palette.run(command) }}
            >
              <span>{command.label}</span>
              {#if command.shortcut}<kbd>{command.shortcut}</kbd>{/if}
            </button>
          {/each}
          {#if !palette.visibleCommands.length}
            <p class="command-empty">{t('command_no_results')}</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if toast.message}
    <div
      class="toast"
      class:toast-error={toast.tone === 'error'}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      transition:toastFade
    >{toast.message}</div>
  {/if}
</div>

<style>
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
</style>

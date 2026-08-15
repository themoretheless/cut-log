<script lang="ts">
  import NumberField from '@/components/NumberField.svelte'
  import type { SelectedPieceStats } from '@/composables/useResultSelection.svelte'
  import type { QuickFilterMode, VisiblePieceEntry } from '@/composables/usePieceList.svelte'
  import { formatAreaM2, type PieceBulkDiff, type PieceSortMode, type PieceSummary } from '@/lib/pieceEditor'
  import { MAX_PIECE_QUANTITY } from '@/lib/optimizerLimits'
  import type { CutPiece, CuttingResult } from '@/services/types'
  import { useL10n } from '@/stores/l10n.svelte'

  interface Props {
    pieces: readonly CutPiece[]
    pieceSummary: PieceSummary
    oversizedPieces: readonly CutPiece[]
    smallMachinePieces: readonly CutPiece[]
    lockedPiecesCount: number
    unnamedPiecesCount: number
    rotationLockedCount: number
    visiblePieces: readonly VisiblePieceEntry[]
    visibleEditableCount: number
    hasPieceFilter: boolean
    selectedPiece: CutPiece | null
    selectedPieceStats: SelectedPieceStats | null
    selectedPieceId: string | null
    pieceIndexes: Readonly<Record<string, number>>
    result: CuttingResult | null
    canUndo: boolean
    canRedo: boolean
    lastBulkDiff: PieceBulkDiff | null
    isDragging: boolean
    dragOverIndex: number
    dragStartIndex: number
    canMovePiece: (sourceIndex: number, direction: -1 | 1) => boolean
    pieceQuery: string
    pieceSortMode: PieceSortMode
    quickFilterMode: QuickFilterMode
    transformStep: number
    roundStep: number
    minMachineCut: number
    onOpenCommands: () => void
    onUndo: () => void
    onRedo: () => void
    onCalculate: () => void
    onClearFilters: () => void
    onSort: () => void
    onDuplicateSelected: () => void
    onVisibleRotation: (allowRotation: boolean) => void
    onAddAllowance: (sign: number) => void
    onAllowancePreset: (value: number) => void
    onRoundDimensions: () => void
    onSwapDimensions: () => void
    onToggleLock: (piece: CutPiece) => void
    onDeleteSelected: () => void
    onClearSelection: () => void
    onDragStart: (index: number) => void
    onDragOver: (index: number) => void
    onDragLeave: () => void
    onDrop: (index: number) => void
    onDragEnd: () => void
    onMovePiece: (index: number, direction: -1 | 1) => void
    onSelectPiece: (id: string) => void
    onUpdateLabel: (piece: CutPiece, value: string) => void
    onUpdateWidth: (piece: CutPiece, value: number) => void
    onUpdateHeight: (piece: CutPiece, value: number) => void
    onUpdateQuantity: (piece: CutPiece, value: number) => void
    onToggleRotation: (piece: CutPiece) => void
    onDuplicate: (id: string) => void
    onRemove: (piece: CutPiece) => void
    onClearAll: () => void
    onShare: () => void
    onExportCsv: () => void
  }

  let {
    pieces,
    pieceSummary,
    oversizedPieces,
    smallMachinePieces,
    lockedPiecesCount,
    unnamedPiecesCount,
    rotationLockedCount,
    visiblePieces,
    visibleEditableCount,
    hasPieceFilter,
    selectedPiece,
    selectedPieceStats,
    selectedPieceId,
    pieceIndexes,
    result,
    canUndo,
    canRedo,
    lastBulkDiff,
    isDragging,
    dragOverIndex,
    dragStartIndex,
    canMovePiece,
    pieceQuery = $bindable(),
    pieceSortMode = $bindable(),
    quickFilterMode = $bindable(),
    transformStep = $bindable(),
    roundStep = $bindable(),
    minMachineCut = $bindable(),
    onOpenCommands,
    onUndo,
    onRedo,
    onCalculate,
    onClearFilters,
    onSort,
    onDuplicateSelected,
    onVisibleRotation,
    onAddAllowance,
    onAllowancePreset,
    onRoundDimensions,
    onSwapDimensions,
    onToggleLock,
    onDeleteSelected,
    onClearSelection,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    onMovePiece,
    onSelectPiece,
    onUpdateLabel,
    onUpdateWidth,
    onUpdateHeight,
    onUpdateQuantity,
    onToggleRotation,
    onDuplicate,
    onRemove,
    onClearAll,
    onShare,
    onExportCsv,
  }: Props = $props()

  const l10n = useL10n()
  const t = l10n.t
  const allowancePresets = [1, 2, 5]
  const quickFilters = $derived<{ id: QuickFilterMode; label: string; count: number }[]>([
    { id: 'all', label: t('filter.all'), count: pieces.length },
    { id: 'unnamed', label: t('filter.unnamed'), count: unnamedPiecesCount },
    { id: 'rotation_off', label: t('filter.rotation_off'), count: rotationLockedCount },
    { id: 'oversized', label: t('filter.oversized'), count: oversizedPieces.length },
    { id: 'locked', label: t('filter.locked'), count: lockedPiecesCount },
    { id: 'machine', label: t('filter.machine'), count: smallMachinePieces.length },
  ])
  const readinessIssues = $derived.by(() => {
    const issues: string[] = []
    if (!pieces.length) return [t('readiness.empty')]
    if (oversizedPieces.length) issues.push(t('readiness.oversized').replace('{0}', String(oversizedPieces.length)))
    if (smallMachinePieces.length) issues.push(t('readiness.machine').replace('{0}', String(smallMachinePieces.length)))
    if (unnamedPiecesCount) issues.push(t('readiness.unnamed').replace('{0}', String(unnamedPiecesCount)))
    if (!result) issues.push(t('readiness.needs_layout'))
    if (result?.unplacedPieces.length) issues.push(t('readiness.unplaced').replace('{0}', String(result.unplacedPieces.length)))
    return issues
  })
  const readinessScore = $derived.by(() => {
    if (!pieces.length) return 0
    let score = 100
    score -= oversizedPieces.length ? 30 : 0
    score -= smallMachinePieces.length ? 18 : 0
    score -= unnamedPiecesCount ? 12 : 0
    score -= result ? 0 : 18
    score -= result?.unplacedPieces.length ? 24 : 0
    if (result && result.overallEfficiency < 70) score -= 8
    return Math.max(0, Math.min(100, score))
  })
  const readinessStatus = $derived(readinessScore >= 86 ? 'ok' : readinessScore >= 60 ? 'idle' : 'warn')
  const readinessMessage = $derived(readinessIssues[0] ?? t('readiness.ready'))
  const preflightChecks = $derived([
    { id: 'oversized', label: t('preflight.oversized'), value: String(oversizedPieces.length), status: oversizedPieces.length ? 'warn' : 'ok' },
    { id: 'unnamed', label: t('preflight.unnamed'), value: String(unnamedPiecesCount), status: unnamedPiecesCount ? 'warn' : 'ok' },
    { id: 'rotation', label: t('preflight.rotation_locked'), value: String(rotationLockedCount), status: rotationLockedCount ? 'idle' : 'ok' },
    { id: 'locked', label: t('preflight.locked'), value: String(lockedPiecesCount), status: lockedPiecesCount ? 'idle' : 'ok' },
    { id: 'machine', label: t('preflight.machine'), value: String(smallMachinePieces.length), status: smallMachinePieces.length ? 'warn' : 'ok' },
    { id: 'layout', label: t('preflight.layout'), value: result ? `${result.totalSheets} ${t('sheets')}` : t('preflight.not_calculated'), status: result ? 'ok' : 'idle' },
  ])

  function pieceIndex(piece: CutPiece): number {
    return pieceIndexes[piece.id] ?? 0
  }

  function onSortChanged(event: Event) {
    pieceSortMode = (event.target as HTMLSelectElement).value as PieceSortMode
    onSort()
  }
</script>

{#if pieces.length}
  <section class="card piece-list-top">
    <div class="piece-list-top-header">
      <div>
        <h2>{t('piece_list')}</h2>
        <p class="editor-subtitle">{pieceSummary.totalTypes} {t('piece_types')} · {pieceSummary.totalQuantity} {t('pieces_short')}</p>
      </div>
      <div class="history-actions">
        <button class="btn btn-ghost btn-square" onclick={onOpenCommands} title={t('command_palette')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h7"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-square" onclick={onUndo} disabled={!canUndo} title={t('hotkey.undo')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-square" onclick={onRedo} disabled={!canRedo} title={t('hotkey.redo')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="editor-summary">
      <span class="metric-pill"><strong>{formatAreaM2(pieceSummary.totalArea)}</strong> {t('material_area')}</span>
      <span class="metric-pill"><strong>{formatAreaM2(pieceSummary.largestPieceArea)}</strong> {t('largest_piece')}</span>
      <span class="metric-pill"><strong>{pieceSummary.rotationEnabled}/{pieceSummary.totalTypes}</strong> {t('rotation')}</span>
    </div>

    <div class="readiness-strip is-{readinessStatus}">
      <div class="readiness-main">
        <span>{t('readiness')}</span>
        <strong>{readinessScore}%</strong>
      </div>
      <div class="readiness-meter" aria-hidden="true"><span style:width={`${readinessScore}%`}></span></div>
      <p>{readinessMessage}</p>
      <button class="btn btn-ghost btn-compact" onclick={onCalculate}>{t('calculate')}</button>
    </div>

    <div class="preflight-strip">
      {#each preflightChecks as check (check.id)}
        <span class="preflight-item is-{check.status}">
          <strong>{check.value}</strong>
          {check.label}
        </span>
      {/each}
    </div>

    <div class="quick-filter-strip">
      {#each quickFilters as filter (filter.id)}
        <button
          class="filter-chip"
          class:active={quickFilterMode === filter.id}
          disabled={filter.id !== 'all' && !filter.count}
          onclick={() => { quickFilterMode = filter.id }}
        >
          <span>{filter.label}</span>
          <strong>{filter.count}</strong>
        </button>
      {/each}
      <button class="filter-chip" disabled={!hasPieceFilter} onclick={onClearFilters}>{t('filter.clear')}</button>
    </div>

    <div class="editor-toolbar">
      <label class="toolbar-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input bind:value={pieceQuery} type="search" placeholder={t('search_pieces')} />
      </label>
      <select class="form-select toolbar-select" value={pieceSortMode} onchange={onSortChanged}>
        <option value="manual">{t('sort.manual')}</option>
        <option value="area_desc">{t('sort.area_desc')}</option>
        <option value="name_asc">{t('sort.name_asc')}</option>
        <option value="quantity_desc">{t('sort.quantity_desc')}</option>
      </select>
      <div class="toolbar-actions">
        <button class="btn btn-ghost btn-tool" onclick={onDuplicateSelected} disabled={!selectedPiece} title={t('duplicate_selected')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>
          </svg>
          {t('duplicate')}
        </button>
        <button class="btn btn-ghost btn-square" onclick={() => onVisibleRotation(true)} disabled={!visiblePieces.length} title={t('rotate_visible_on')}>&#8635;</button>
        <button class="btn btn-ghost btn-square" onclick={() => onVisibleRotation(false)} disabled={!visiblePieces.length} title={t('rotate_visible_off')}>&#8634;</button>
      </div>
    </div>

    <div class="transform-strip">
      <div class="transform-group">
        <span>{t('transform.allowance')}</span>
        <NumberField ariaLabel={t('transform.allowance')} value={transformStep} onUpdate={v => { transformStep = Math.max(1, Math.round(v)) }} min={1} step={1} />
        <button class="btn btn-ghost btn-square" onclick={() => onAddAllowance(1)} disabled={!visibleEditableCount} title={t('transform_add_visible')}>+</button>
        <button class="btn btn-ghost btn-square" onclick={() => onAddAllowance(-1)} disabled={!visibleEditableCount} title={t('transform_sub_visible')}>−</button>
        {#each allowancePresets as preset (preset)}
          <button class="preset-chip" onclick={() => onAllowancePreset(preset)} disabled={!visibleEditableCount}>+{preset}</button>
        {/each}
      </div>
      <div class="transform-group">
        <span>{t('transform.round')}</span>
        <NumberField ariaLabel={t('transform.round')} value={roundStep} onUpdate={v => { roundStep = Math.max(1, Math.round(v)) }} min={1} step={1} />
        <button class="btn btn-ghost btn-square" onclick={onRoundDimensions} disabled={!visibleEditableCount} title={t('transform_round_visible')}>⌈</button>
        <button class="btn btn-ghost btn-square" onclick={onSwapDimensions} disabled={!visibleEditableCount} title={t('transform_swap_visible')}>⇄</button>
      </div>
      <div class="transform-group transform-group-machine">
        <span>{t('machine_min')}</span>
        <NumberField ariaLabel={t('machine_min')} value={minMachineCut} onUpdate={v => { minMachineCut = Math.max(1, Math.round(v)) }} min={1} step={1} />
        <strong>{visibleEditableCount}/{visiblePieces.length}</strong>
      </div>
    </div>

    {#if lastBulkDiff}
      <div class="bulk-diff">
        <strong>{lastBulkDiff.title}</strong>
        <span>{t('bulk_changed')}: {lastBulkDiff.changed}</span>
        {#if lastBulkDiff.skipped}
          <span>{t('bulk_skipped')}: {lastBulkDiff.skipped}</span>
        {/if}
        <span>{lastBulkDiff.sampleBefore} → {lastBulkDiff.sampleAfter}</span>
        <span>{lastBulkDiff.beforeArea} → {lastBulkDiff.afterArea} {t('material_area')}</span>
      </div>
    {/if}

    {#if selectedPiece && selectedPieceStats}
      <div class="selected-inspector">
        <div class="selected-inspector-main">
          <span class="piece-color inspector-color" style:background={selectedPiece.color}>{pieceIndex(selectedPiece)}</span>
          <div class="selected-inspector-title">
            <strong>{selectedPiece.label.trim() || t('unnamed_piece')}</strong>
            <span>{selectedPiece.width.toFixed(0)}&times;{selectedPiece.height.toFixed(0)} mm · {selectedPiece.quantity} {t('pieces_short')}</span>
          </div>
        </div>
        <div class="selected-inspector-metrics">
          <span><strong>{formatAreaM2(selectedPieceStats.area)}</strong> {t('piece_area')}</span>
          <span><strong>{formatAreaM2(selectedPieceStats.totalArea)}</strong> {t('total_piece_area')}</span>
          <span><strong>{selectedPieceStats.placements.length}/{selectedPiece.quantity}</strong> {t('placed_count')}</span>
          {#if selectedPieceStats.firstPlacement}
            <span>
              <strong>{t('sheet')} {selectedPieceStats.firstPlacement.sheetIndex + 1}</strong>
              {t('first_position')}: {selectedPieceStats.firstPlacement.x.toFixed(0)}, {selectedPieceStats.firstPlacement.y.toFixed(0)}
            </span>
          {/if}
        </div>
        <div class="selected-inspector-actions">
          <button class="btn btn-ghost btn-compact" onclick={() => onToggleLock(selectedPiece)}>{selectedPiece.locked ? t('unlock') : t('lock')}</button>
          <button class="btn btn-ghost btn-compact" onclick={onDuplicateSelected}>{t('duplicate')}</button>
          <button class="btn btn-danger btn-compact" onclick={onDeleteSelected}>{t('delete')}</button>
          <button class="btn btn-ghost btn-compact" onclick={onClearSelection}>{t('clear_selection')}</button>
        </div>
      </div>
    {/if}

    {#if oversizedPieces.length}
      <div class="alert alert-warn editor-alert">
        <strong>{t('oversized_existing_warn')}</strong>
        <ul>
          {#each oversizedPieces as piece (piece.id)}
            <li>
              {#if piece.label.trim()}{piece.label.trim()} {/if}({piece.width.toFixed(0)}&times;{piece.height.toFixed(0)})
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if smallMachinePieces.length}
      <div class="alert alert-warn editor-alert">
        <strong>{t('small_machine_warn').replace('{0}', String(minMachineCut))}</strong>
        <ul>
          {#each smallMachinePieces as piece (piece.id)}
            <li>
              {#if piece.label.trim()}{piece.label.trim()} {/if}({piece.width.toFixed(0)}&times;{piece.height.toFixed(0)})
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if hasPieceFilter && !visiblePieces.length}
      <p class="piece-filter-empty">{t('no_matching_pieces')}</p>
    {:else}
      <div class="piece-list piece-list-horizontal" class:is-dragging={isDragging} ondragleave={onDragLeave} role="list">
        {#each visiblePieces as entry (entry.piece.id)}
          <div
            class="piece-item piece-item-editing"
            class:drag-over={dragOverIndex === entry.index}
            class:is-dragging-item={dragStartIndex === entry.index}
            class:selected={selectedPieceId === entry.piece.id}
            class:locked={entry.piece.locked}
            draggable={!entry.piece.locked}
            role="listitem"
            ondragstart={() => onDragStart(entry.index)}
            ondragover={(event: DragEvent) => { event.preventDefault(); onDragOver(entry.index) }}
            ondrop={() => onDrop(entry.index)}
            ondragend={onDragEnd}
          >
            <div class="piece-reorder-actions">
              <button type="button" disabled={!canMovePiece(entry.index, -1)} aria-label={`${t('move_up')}: ${entry.piece.label || t('unnamed_piece')}`} onclick={() => onMovePiece(entry.index, -1)}>↑</button>
              <button type="button" disabled={!canMovePiece(entry.index, 1)} aria-label={`${t('move_down')}: ${entry.piece.label || t('unnamed_piece')}`} onclick={() => onMovePiece(entry.index, 1)}>↓</button>
            </div>
            <span class="drag-handle" title={t('drag_hint')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
              </svg>
            </span>
            <button type="button" class="piece-color" style:background={entry.piece.color} title={t('highlight_hint')} aria-label={`${t('highlight_hint')}: ${entry.piece.label || t('unnamed_piece')}`} onclick={() => onSelectPiece(entry.piece.id)}>{entry.index + 1}</button>
            <div class="piece-edit-fields">
              <input class="piece-edit-label" type="text" value={entry.piece.label} placeholder={t('name')} aria-label={`${t('name')}: ${entry.index + 1}`} maxlength="200" oninput={(event: Event) => onUpdateLabel(entry.piece, (event.target as HTMLInputElement).value)} />
              <div class="piece-edit-dims">
                <NumberField ariaLabel={`${t('width_mm')}: ${entry.piece.label || entry.index + 1}`} value={entry.piece.width} onUpdate={v => onUpdateWidth(entry.piece, v)} min={1} step={1} />
                <span class="unit">&times;</span>
                <NumberField ariaLabel={`${t('height_mm')}: ${entry.piece.label || entry.index + 1}`} value={entry.piece.height} onUpdate={v => onUpdateHeight(entry.piece, v)} min={1} step={1} />
                <span class="unit">mm</span>
                <NumberField ariaLabel={`${t('quantity')}: ${entry.piece.label || entry.index + 1}`} value={entry.piece.quantity} onUpdate={v => onUpdateQuantity(entry.piece, v)} min={1} max={MAX_PIECE_QUANTITY} step={1} />
                <button type="button" class="btn btn-primary btn-sm piece-edit-rot" class:rot-on={entry.piece.allowRotation} title={t('rotation')} aria-label={`${t('rotation')}: ${entry.piece.label || t('unnamed_piece')}`} onclick={() => onToggleRotation(entry.piece)}>&#8635;</button>
                <button type="button" class="btn btn-ghost btn-sm piece-lock-btn" class:active={entry.piece.locked} title={entry.piece.locked ? t('unlock') : t('lock')} aria-label={`${entry.piece.locked ? t('unlock') : t('lock')}: ${entry.piece.label || t('unnamed_piece')}`} onclick={() => onToggleLock(entry.piece)}>
                  {#if entry.piece.locked}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  {:else}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7-2"/></svg>
                  {/if}
                </button>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick={() => onDuplicate(entry.piece.id)} title={t('duplicate')} aria-label={`${t('duplicate')}: ${entry.piece.label || t('unnamed_piece')}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn btn-danger btn-sm" onclick={() => onRemove(entry.piece)} title={t('delete')} aria-label={`${t('delete')}: ${entry.piece.label || t('unnamed_piece')}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <div class="card-actions card-actions-bottom">
      <button class="btn btn-danger" onclick={onClearAll}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        {t('clear_all')}
      </button>
      <button class="btn btn-ghost" onclick={onShare} title={t('share')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
        {t('share')}
      </button>
      <button class="btn btn-ghost" onclick={onExportCsv} title={t('export.parts_csv')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        CSV
      </button>
      <button class="btn btn-primary" onclick={onCalculate}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
        {t('calculate')}
      </button>
    </div>
  </section>
{/if}

<script setup lang="ts">
import { computed } from 'vue'
import NumberField from '@/components/NumberField.vue'
import type { SelectedPieceStats } from '@/composables/useResultSelection'
import type { QuickFilterMode, VisiblePieceEntry } from '@/composables/usePieceList'
import type { PieceBulkDiff, PieceSortMode, PieceSummary } from '@/lib/pieceEditor'
import { MAX_PIECE_QUANTITY } from '@/lib/optimizerLimits'
import type { CutPiece, CuttingResult } from '@/services/types'
import { useL10n } from '@/stores/l10n'

const props = defineProps<{
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
}>()

const pieceQuery = defineModel<string>('pieceQuery', { required: true })
const pieceSortMode = defineModel<PieceSortMode>('pieceSortMode', { required: true })
const quickFilterMode = defineModel<QuickFilterMode>('quickFilterMode', { required: true })
const transformStep = defineModel<number>('transformStep', { required: true })
const roundStep = defineModel<number>('roundStep', { required: true })
const minMachineCut = defineModel<number>('minMachineCut', { required: true })
const emit = defineEmits<{
  openCommands: []
  undo: []
  redo: []
  calculate: []
  clearFilters: []
  sort: []
  duplicateSelected: []
  visibleRotation: [allowRotation: boolean]
  addAllowance: [sign: number]
  allowancePreset: [value: number]
  roundDimensions: []
  swapDimensions: []
  toggleLock: [piece: CutPiece]
  deleteSelected: []
  clearSelection: []
  dragStart: [index: number]
  dragOver: [index: number]
  dragLeave: []
  drop: [index: number]
  dragEnd: []
  movePiece: [index: number, direction: -1 | 1]
  selectPiece: [id: string]
  updateLabel: [piece: CutPiece, value: string]
  updateWidth: [piece: CutPiece, value: number]
  updateHeight: [piece: CutPiece, value: number]
  updateQuantity: [piece: CutPiece, value: number]
  toggleRotation: [piece: CutPiece]
  duplicate: [id: string]
  remove: [piece: CutPiece]
  clearAll: []
  share: []
  exportCsv: []
}>()

const { t } = useL10n()
const allowancePresets = [1, 2, 5]
const quickFilters = computed<{ id: QuickFilterMode; label: string; count: number }[]>(() => [
  { id: 'all', label: t('filter.all'), count: props.pieces.length },
  { id: 'unnamed', label: t('filter.unnamed'), count: props.unnamedPiecesCount },
  { id: 'rotation_off', label: t('filter.rotation_off'), count: props.rotationLockedCount },
  { id: 'oversized', label: t('filter.oversized'), count: props.oversizedPieces.length },
  { id: 'locked', label: t('filter.locked'), count: props.lockedPiecesCount },
  { id: 'machine', label: t('filter.machine'), count: props.smallMachinePieces.length },
])
const readinessIssues = computed(() => {
  const issues: string[] = []
  if (!props.pieces.length) return [t('readiness.empty')]
  if (props.oversizedPieces.length) issues.push(t('readiness.oversized').replace('{0}', String(props.oversizedPieces.length)))
  if (props.smallMachinePieces.length) issues.push(t('readiness.machine').replace('{0}', String(props.smallMachinePieces.length)))
  if (props.unnamedPiecesCount) issues.push(t('readiness.unnamed').replace('{0}', String(props.unnamedPiecesCount)))
  if (!props.result) issues.push(t('readiness.needs_layout'))
  if (props.result?.unplacedPieces.length) issues.push(t('readiness.unplaced').replace('{0}', String(props.result.unplacedPieces.length)))
  return issues
})
const readinessScore = computed(() => {
  if (!props.pieces.length) return 0
  let score = 100
  score -= props.oversizedPieces.length ? 30 : 0
  score -= props.smallMachinePieces.length ? 18 : 0
  score -= props.unnamedPiecesCount ? 12 : 0
  score -= props.result ? 0 : 18
  score -= props.result?.unplacedPieces.length ? 24 : 0
  if (props.result && props.result.overallEfficiency < 70) score -= 8
  return Math.max(0, Math.min(100, score))
})
const readinessStatus = computed(() => readinessScore.value >= 86 ? 'ok' : readinessScore.value >= 60 ? 'idle' : 'warn')
const readinessMessage = computed(() => readinessIssues.value[0] ?? t('readiness.ready'))
const preflightChecks = computed(() => [
  { id: 'oversized', label: t('preflight.oversized'), value: String(props.oversizedPieces.length), status: props.oversizedPieces.length ? 'warn' : 'ok' },
  { id: 'unnamed', label: t('preflight.unnamed'), value: String(props.unnamedPiecesCount), status: props.unnamedPiecesCount ? 'warn' : 'ok' },
  { id: 'rotation', label: t('preflight.rotation_locked'), value: String(props.rotationLockedCount), status: props.rotationLockedCount ? 'idle' : 'ok' },
  { id: 'locked', label: t('preflight.locked'), value: String(props.lockedPiecesCount), status: props.lockedPiecesCount ? 'idle' : 'ok' },
  { id: 'machine', label: t('preflight.machine'), value: String(props.smallMachinePieces.length), status: props.smallMachinePieces.length ? 'warn' : 'ok' },
  { id: 'layout', label: t('preflight.layout'), value: props.result ? `${props.result.totalSheets} ${t('sheets')}` : t('preflight.not_calculated'), status: props.result ? 'ok' : 'idle' },
])

function areaM2(areaMm2: number): string {
  return (areaMm2 / 1_000_000).toFixed(2)
}

function pieceIndex(piece: CutPiece): number {
  return props.pieceIndexes[piece.id] ?? 0
}
</script>

<template>
  <section v-if="pieces.length" class="card piece-list-top">
    <div class="piece-list-top-header">
      <div>
        <h2>{{ t('piece_list') }}</h2>
        <p class="editor-subtitle">{{ pieceSummary.totalTypes }} {{ t('piece_types') }} · {{ pieceSummary.totalQuantity }} {{ t('pieces_short') }}</p>
      </div>
      <div class="history-actions">
        <button class="btn btn-ghost btn-square" @click="emit('openCommands')" :title="t('command_palette')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h7"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-square" @click="emit('undo')" :disabled="!canUndo" :title="t('hotkey.undo')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-square" @click="emit('redo')" :disabled="!canRedo" :title="t('hotkey.redo')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="editor-summary">
      <span class="metric-pill"><strong>{{ areaM2(pieceSummary.totalArea) }}</strong> {{ t('material_area') }}</span>
      <span class="metric-pill"><strong>{{ areaM2(pieceSummary.largestPieceArea) }}</strong> {{ t('largest_piece') }}</span>
      <span class="metric-pill"><strong>{{ pieceSummary.rotationEnabled }}/{{ pieceSummary.totalTypes }}</strong> {{ t('rotation') }}</span>
    </div>

    <div class="readiness-strip" :class="`is-${readinessStatus}`">
      <div class="readiness-main">
        <span>{{ t('readiness') }}</span>
        <strong>{{ readinessScore }}%</strong>
      </div>
      <div class="readiness-meter" aria-hidden="true"><span :style="{ width: `${readinessScore}%` }"></span></div>
      <p>{{ readinessMessage }}</p>
      <button class="btn btn-ghost btn-compact" @click="emit('calculate')">{{ t('calculate') }}</button>
    </div>

    <div class="preflight-strip">
      <span v-for="check in preflightChecks" :key="check.id" class="preflight-item" :class="`is-${check.status}`">
        <strong>{{ check.value }}</strong>
        {{ check.label }}
      </span>
    </div>

    <div class="quick-filter-strip">
      <button
        v-for="filter in quickFilters"
        :key="filter.id"
        class="filter-chip"
        :class="{ active: quickFilterMode === filter.id }"
        :disabled="filter.id !== 'all' && !filter.count"
        @click="quickFilterMode = filter.id"
      >
        <span>{{ filter.label }}</span>
        <strong>{{ filter.count }}</strong>
      </button>
      <button class="filter-chip" :disabled="!hasPieceFilter" @click="emit('clearFilters')">{{ t('filter.clear') }}</button>
    </div>

    <div class="editor-toolbar">
      <label class="toolbar-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input v-model="pieceQuery" type="search" :placeholder="t('search_pieces')" />
      </label>
      <select class="form-select toolbar-select" v-model="pieceSortMode" @change="emit('sort')">
        <option value="manual">{{ t('sort.manual') }}</option>
        <option value="area_desc">{{ t('sort.area_desc') }}</option>
        <option value="name_asc">{{ t('sort.name_asc') }}</option>
        <option value="quantity_desc">{{ t('sort.quantity_desc') }}</option>
      </select>
      <div class="toolbar-actions">
        <button class="btn btn-ghost btn-tool" @click="emit('duplicateSelected')" :disabled="!selectedPiece" :title="t('duplicate_selected')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>
          </svg>
          {{ t('duplicate') }}
        </button>
        <button class="btn btn-ghost btn-square" @click="emit('visibleRotation', true)" :disabled="!visiblePieces.length" :title="t('rotate_visible_on')">&#8635;</button>
        <button class="btn btn-ghost btn-square" @click="emit('visibleRotation', false)" :disabled="!visiblePieces.length" :title="t('rotate_visible_off')">&#8634;</button>
      </div>
    </div>

    <div class="transform-strip">
      <div class="transform-group">
        <span>{{ t('transform.allowance') }}</span>
        <NumberField :aria-label="t('transform.allowance')" :model-value="transformStep" @update:model-value="transformStep = Math.max(1, Math.round($event))" :min="1" :step="1" />
        <button class="btn btn-ghost btn-square" @click="emit('addAllowance', 1)" :disabled="!visibleEditableCount" :title="t('transform_add_visible')">+</button>
        <button class="btn btn-ghost btn-square" @click="emit('addAllowance', -1)" :disabled="!visibleEditableCount" :title="t('transform_sub_visible')">−</button>
        <button v-for="preset in allowancePresets" :key="preset" class="preset-chip" @click="emit('allowancePreset', preset)" :disabled="!visibleEditableCount">+{{ preset }}</button>
      </div>
      <div class="transform-group">
        <span>{{ t('transform.round') }}</span>
        <NumberField :aria-label="t('transform.round')" :model-value="roundStep" @update:model-value="roundStep = Math.max(1, Math.round($event))" :min="1" :step="1" />
        <button class="btn btn-ghost btn-square" @click="emit('roundDimensions')" :disabled="!visibleEditableCount" :title="t('transform_round_visible')">⌈</button>
        <button class="btn btn-ghost btn-square" @click="emit('swapDimensions')" :disabled="!visibleEditableCount" :title="t('transform_swap_visible')">⇄</button>
      </div>
      <div class="transform-group transform-group-machine">
        <span>{{ t('machine_min') }}</span>
        <NumberField :aria-label="t('machine_min')" :model-value="minMachineCut" @update:model-value="minMachineCut = Math.max(1, Math.round($event))" :min="1" :step="1" />
        <strong>{{ visibleEditableCount }}/{{ visiblePieces.length }}</strong>
      </div>
    </div>

    <div v-if="lastBulkDiff" class="bulk-diff">
      <strong>{{ lastBulkDiff.title }}</strong>
      <span>{{ t('bulk_changed') }}: {{ lastBulkDiff.changed }}</span>
      <span v-if="lastBulkDiff.skipped">{{ t('bulk_skipped') }}: {{ lastBulkDiff.skipped }}</span>
      <span>{{ lastBulkDiff.sampleBefore }} → {{ lastBulkDiff.sampleAfter }}</span>
      <span>{{ lastBulkDiff.beforeArea }} → {{ lastBulkDiff.afterArea }} {{ t('material_area') }}</span>
    </div>

    <div v-if="selectedPiece && selectedPieceStats" class="selected-inspector">
      <div class="selected-inspector-main">
        <span class="piece-color inspector-color" :style="{ background: selectedPiece.color }">{{ pieceIndex(selectedPiece) }}</span>
        <div class="selected-inspector-title">
          <strong>{{ selectedPiece.label.trim() || t('unnamed_piece') }}</strong>
          <span>{{ selectedPiece.width.toFixed(0) }}&times;{{ selectedPiece.height.toFixed(0) }} mm · {{ selectedPiece.quantity }} {{ t('pieces_short') }}</span>
        </div>
      </div>
      <div class="selected-inspector-metrics">
        <span><strong>{{ areaM2(selectedPieceStats.area) }}</strong> {{ t('piece_area') }}</span>
        <span><strong>{{ areaM2(selectedPieceStats.totalArea) }}</strong> {{ t('total_piece_area') }}</span>
        <span><strong>{{ selectedPieceStats.placements.length }}/{{ selectedPiece.quantity }}</strong> {{ t('placed_count') }}</span>
        <span v-if="selectedPieceStats.firstPlacement">
          <strong>{{ t('sheet') }} {{ selectedPieceStats.firstPlacement.sheetIndex + 1 }}</strong>
          {{ t('first_position') }}: {{ selectedPieceStats.firstPlacement.x.toFixed(0) }}, {{ selectedPieceStats.firstPlacement.y.toFixed(0) }}
        </span>
      </div>
      <div class="selected-inspector-actions">
        <button class="btn btn-ghost btn-compact" @click="emit('toggleLock', selectedPiece)">{{ selectedPiece.locked ? t('unlock') : t('lock') }}</button>
        <button class="btn btn-ghost btn-compact" @click="emit('duplicateSelected')">{{ t('duplicate') }}</button>
        <button class="btn btn-danger btn-compact" @click="emit('deleteSelected')">{{ t('delete') }}</button>
        <button class="btn btn-ghost btn-compact" @click="emit('clearSelection')">{{ t('clear_selection') }}</button>
      </div>
    </div>

    <div v-if="oversizedPieces.length" class="alert alert-warn editor-alert">
      <strong>{{ t('oversized_existing_warn') }}</strong>
      <ul>
        <li v-for="piece in oversizedPieces" :key="piece.id">
          <template v-if="piece.label.trim()">{{ piece.label.trim() }} </template>({{ piece.width.toFixed(0) }}&times;{{ piece.height.toFixed(0) }})
        </li>
      </ul>
    </div>

    <div v-if="smallMachinePieces.length" class="alert alert-warn editor-alert">
      <strong>{{ t('small_machine_warn').replace('{0}', String(minMachineCut)) }}</strong>
      <ul>
        <li v-for="piece in smallMachinePieces" :key="piece.id">
          <template v-if="piece.label.trim()">{{ piece.label.trim() }} </template>({{ piece.width.toFixed(0) }}&times;{{ piece.height.toFixed(0) }})
        </li>
      </ul>
    </div>

    <p v-if="hasPieceFilter && !visiblePieces.length" class="piece-filter-empty">{{ t('no_matching_pieces') }}</p>
    <div v-else class="piece-list piece-list-horizontal" :class="{ 'is-dragging': isDragging }" @dragleave="emit('dragLeave')">
      <div
        v-for="entry in visiblePieces"
        :key="entry.piece.id"
        class="piece-item piece-item-editing"
        :class="{ 'drag-over': dragOverIndex === entry.index, 'is-dragging-item': dragStartIndex === entry.index, selected: selectedPieceId === entry.piece.id, locked: entry.piece.locked }"
        :draggable="!entry.piece.locked"
        @dragstart="emit('dragStart', entry.index)"
        @dragover.prevent="emit('dragOver', entry.index)"
        @drop="emit('drop', entry.index)"
        @dragend="emit('dragEnd')"
      >
        <div class="piece-reorder-actions">
          <button type="button" :disabled="!canMovePiece(entry.index, -1)" :aria-label="`${t('move_up')}: ${entry.piece.label || t('unnamed_piece')}`" @click="emit('movePiece', entry.index, -1)">↑</button>
          <button type="button" :disabled="!canMovePiece(entry.index, 1)" :aria-label="`${t('move_down')}: ${entry.piece.label || t('unnamed_piece')}`" @click="emit('movePiece', entry.index, 1)">↓</button>
        </div>
        <span class="drag-handle" :title="t('drag_hint')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
          </svg>
        </span>
        <button type="button" class="piece-color" :style="{ background: entry.piece.color }" :title="t('highlight_hint')" :aria-label="`${t('highlight_hint')}: ${entry.piece.label || t('unnamed_piece')}`" @click="emit('selectPiece', entry.piece.id)">{{ entry.index + 1 }}</button>
        <div class="piece-edit-fields">
          <input class="piece-edit-label" type="text" :value="entry.piece.label" :placeholder="t('name')" :aria-label="`${t('name')}: ${entry.index + 1}`" maxlength="200" @input="emit('updateLabel', entry.piece, ($event.target as HTMLInputElement).value)" />
          <div class="piece-edit-dims">
            <NumberField :aria-label="`${t('width_mm')}: ${entry.piece.label || entry.index + 1}`" :model-value="entry.piece.width" @update:model-value="emit('updateWidth', entry.piece, $event)" :min="1" :step="1" />
            <span class="unit">&times;</span>
            <NumberField :aria-label="`${t('height_mm')}: ${entry.piece.label || entry.index + 1}`" :model-value="entry.piece.height" @update:model-value="emit('updateHeight', entry.piece, $event)" :min="1" :step="1" />
            <span class="unit">mm</span>
            <NumberField :aria-label="`${t('quantity')}: ${entry.piece.label || entry.index + 1}`" :model-value="entry.piece.quantity" @update:model-value="emit('updateQuantity', entry.piece, $event)" :min="1" :max="MAX_PIECE_QUANTITY" :step="1" />
            <button type="button" class="btn btn-primary btn-sm piece-edit-rot" :class="{ 'rot-on': entry.piece.allowRotation }" :title="t('rotation')" :aria-label="`${t('rotation')}: ${entry.piece.label || t('unnamed_piece')}`" @click="emit('toggleRotation', entry.piece)">&#8635;</button>
            <button type="button" class="btn btn-ghost btn-sm piece-lock-btn" :class="{ active: entry.piece.locked }" :title="entry.piece.locked ? t('unlock') : t('lock')" :aria-label="`${entry.piece.locked ? t('unlock') : t('lock')}: ${entry.piece.label || t('unnamed_piece')}`" @click="emit('toggleLock', entry.piece)">
              <svg v-if="entry.piece.locked" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7-2"/></svg>
            </button>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="emit('duplicate', entry.piece.id)" :title="t('duplicate')" :aria-label="`${t('duplicate')}: ${entry.piece.label || t('unnamed_piece')}`">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="btn btn-danger btn-sm" @click="emit('remove', entry.piece)" :title="t('delete')" :aria-label="`${t('delete')}: ${entry.piece.label || t('unnamed_piece')}`">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>

    <div class="card-actions card-actions-bottom">
      <button class="btn btn-danger" @click="emit('clearAll')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        {{ t('clear_all') }}
      </button>
      <button class="btn btn-ghost" @click="emit('share')" :title="t('share')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
        {{ t('share') }}
      </button>
      <button class="btn btn-ghost" @click="emit('exportCsv')" :title="t('export.parts_csv')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        CSV
      </button>
      <button class="btn btn-primary" @click="emit('calculate')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
        {{ t('calculate') }}
      </button>
    </div>
  </section>
</template>

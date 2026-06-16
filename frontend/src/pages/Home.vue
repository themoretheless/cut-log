<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { optimize } from '@/services/optimizer'
import { type CutPiece, type CuttingResult, CuttingStrategy, newPiece } from '@/services/types'
import { PIECE_COLORS, truncate, efficiencyClass } from '@/helpers/svg'
import { type HomeState, HOME_STATE_KEY, serializeHomeState, parseHomeState } from '@/lib/homeState'
import { validateNewPiece } from '@/lib/validatePiece'
import { buildLayoutSvg, buildLayoutDxf, buildPrintHtml } from '@/lib/exportLayout'
import { buildShareUrl, readShareFromHash } from '@/lib/shareLink'
import { parsePieceList } from '@/lib/parsePieceList'
import { createHistory } from '@/lib/history'
import {
  type ProjectSnapshot,
  PROJECT_SNAPSHOTS_KEY,
  createProjectSnapshot,
  parseProjectSnapshots,
  removeProjectSnapshot,
  serializeProjectSnapshots,
  upsertProjectSnapshot,
} from '@/lib/projectSnapshots'
import {
  type PieceSortMode,
  addDimensionDelta,
  findOversizedPieces,
  pieceArea,
  pieceMatchesQuery,
  pieceTotalArea,
  roundDimensionsUp,
  sortPiecesForEditor,
  summarizePieces,
  swapDimensions,
} from '@/lib/pieceEditor'
import { useL10n } from '@/stores/l10n'

const { t } = useL10n()

// ── Sheet presets ────────────────────────────────────────────────────────────
const sheetPresets: { key: string; w: number; h: number }[] = [
  { key: '2440x1220', w: 2440, h: 1220 },
  { key: '2500x1250', w: 2500, h: 1250 },
  { key: '1525x1525', w: 1525, h: 1525 },
  { key: '2800x2070', w: 2800, h: 2070 },
  { key: '2750x1830', w: 2750, h: 1830 },
  { key: '2440x1830', w: 2440, h: 1830 },
  { key: '3050x1525', w: 3050, h: 1525 },
  { key: '1200x600', w: 1200, h: 600 },
]

const selectedPreset = ref('2440x1220')

// ── Sheet params ─────────────────────────────────────────────────────────────
const sheetWidth = ref(2440)
const sheetHeight = ref(1220)
const kerf = ref(3)
const selectedStrategy = ref<CuttingStrategy>(CuttingStrategy.Auto)

function onPresetChanged(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  selectedPreset.value = val
  const preset = sheetPresets.find(p => p.key === val)
  if (preset) {
    sheetWidth.value = preset.w
    sheetHeight.value = preset.h
  }
}

function onSheetWidthChanged(v: number) { sheetWidth.value = v; selectedPreset.value = '' }
function onSheetHeightChanged(v: number) { sheetHeight.value = v; selectedPreset.value = '' }

// ── New piece form ───────────────────────────────────────────────────────────
const newLabel = ref('')
const newWidth = ref(400)
const newHeight = ref(300)
const newQty = ref(1)
const newAllowRotation = ref(true)
const addError = ref('')

// ── Piece list ───────────────────────────────────────────────────────────────
const pieces = reactive<CutPiece[]>([])
const result = ref<CuttingResult | null>(null)
const calculated = ref(false)
let colorIdx = 0

// ── Editor controls ──────────────────────────────────────────────────────────
const pieceQuery = ref('')
const pieceSortMode = ref<PieceSortMode>('manual')
const commandPaletteOpen = ref(false)
const commandQuery = ref('')
const commandInputRef = ref<HTMLInputElement | null>(null)
const projectSnapshots = ref<ProjectSnapshot[]>([])
const snapshotName = ref('')
const transformStep = ref(2)
const roundStep = ref(5)

interface PaletteCommand {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  run: () => void | Promise<void>
}

interface PreflightCheck {
  id: string
  label: string
  value: string
  status: 'ok' | 'warn' | 'idle'
}

// ── Drag state ───────────────────────────────────────────────────────────────
const dragStartIdx = ref(-1)
const dragOverIdx = ref(-1)
const isDragging = ref(false)

// ── SVG constants ────────────────────────────────────────────────────────────
const SVG_MAX_W = 520
const SVG_MAX_H = 420

// ── localStorage persistence ─────────────────────────────────────────────────
let saveTimer: ReturnType<typeof setTimeout> | undefined

function saveState() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveStateNow, 300)
}

function saveStateNow() {
  try {
    localStorage.setItem(HOME_STATE_KEY, serializeHomeState(currentState()))
  } catch { /* ignore */ }
}

function currentState(): HomeState {
  return {
    sheetWidth: sheetWidth.value,
    sheetHeight: sheetHeight.value,
    kerf: kerf.value,
    pieces: [...pieces],
  }
}

function applyState(saved: HomeState) {
  sheetWidth.value = saved.sheetWidth
  sheetHeight.value = saved.sheetHeight
  kerf.value = saved.kerf
  pieces.splice(0, pieces.length, ...saved.pieces)
  colorIdx = pieces.length
}

function loadState() {
  const saved = parseHomeState(localStorage.getItem(HOME_STATE_KEY))
  if (saved) applyState(saved)
}

function loadProjectSnapshots() {
  projectSnapshots.value = parseProjectSnapshots(localStorage.getItem(PROJECT_SNAPSHOTS_KEY))
}

function saveProjectSnapshotsNow() {
  try {
    localStorage.setItem(PROJECT_SNAPSHOTS_KEY, serializeProjectSnapshots(projectSnapshots.value))
  } catch { /* ignore */ }
}

// ── Undo / redo (snapshot-based, matches how editors model history) ────────────
const undoHistory = createHistory<string>(serializeHomeState(currentState()))
const historyTick = ref(0)
let restoring = false
let recordTimer: ReturnType<typeof setTimeout> | undefined

function refreshHistoryState() {
  historyTick.value++
}

const canUndo = computed(() => {
  historyTick.value
  return undoHistory.canUndo()
})

const canRedo = computed(() => {
  historyTick.value
  return undoHistory.canRedo()
})

// Coalesce bursts of edits (e.g. typing in a number field) into one entry.
function recordHistory() {
  if (restoring) return
  clearTimeout(recordTimer)
  recordTimer = setTimeout(() => {
    undoHistory.snapshot(serializeHomeState(currentState()))
    refreshHistoryState()
  }, 350)
}

function restoreSnapshot(snap: string) {
  const st = parseHomeState(snap)
  if (!st) return
  restoring = true
  clearTimeout(recordTimer)
  applyState(st)
  saveStateNow()
  // Release the guard after the watchers triggered by applyState have flushed,
  // so the restore itself isn't recorded as a new history entry.
  nextTick(() => { restoring = false })
}

function doUndo() {
  const snap = undoHistory.undo()
  if (snap !== undefined) {
    restoreSnapshot(snap)
    refreshHistoryState()
  }
}

function doRedo() {
  const snap = undoHistory.redo()
  if (snap !== undefined) {
    restoreSnapshot(snap)
    refreshHistoryState()
  }
}

// A shared link wins over saved state: open the linked project, then strip the
// hash so a later edit + reload doesn't silently re-apply the old link.
function loadInitialState() {
  const shared = readShareFromHash(location.hash)
  if (shared) {
    applyState(shared)
    history.replaceState(null, '', location.pathname + location.search)
    showToast(t('link_loaded'))
    return
  }
  loadState()
}

// ── Actions ──────────────────────────────────────────────────────────────────
function addPiece() {
  const err = validateNewPiece(
    { width: newWidth.value, height: newHeight.value, quantity: newQty.value },
    { sheetWidth: sheetWidth.value, sheetHeight: sheetHeight.value },
  )
  if (err) { addError.value = t(err); return }
  addError.value = ''

  const color = PIECE_COLORS[colorIdx++ % PIECE_COLORS.length]
  pieces.push(newPiece(newLabel.value, newWidth.value, newHeight.value, newQty.value, newAllowRotation.value, color))

  newLabel.value = ''
  newWidth.value = 400
  newHeight.value = 300
  newQty.value = 1
  saveState()
}

// ── Bulk import (paste a cut list from a spreadsheet) ──────────────────────────
const showImport = ref(false)
const importText = ref('')

function importPieces() {
  const { rows, skipped } = parsePieceList(importText.value)
  if (!rows.length) {
    addError.value = t('import_none')
    return
  }
  addError.value = ''
  for (const r of rows) {
    const color = PIECE_COLORS[colorIdx++ % PIECE_COLORS.length]
    pieces.push(newPiece(r.label, r.width, r.height, r.quantity, true, color))
  }
  importText.value = ''
  showImport.value = false
  saveState()
  const msg = skipped
    ? t('import_added_skipped').replace('{0}', String(rows.length)).replace('{1}', String(skipped))
    : t('import_added').replace('{0}', String(rows.length))
  showToast(msg)
}

function removePiece(p: CutPiece) {
  const idx = pieces.indexOf(p)
  if (idx >= 0) pieces.splice(idx, 1)
  if (selectedPieceId.value === p.id) selectedPieceId.value = null
  saveState()
}

function clearAll() {
  pieces.splice(0, pieces.length)
  result.value = null
  calculated.value = false
  selectedPieceId.value = null
  pieceQuery.value = ''
  pieceSortMode.value = 'manual'
  colorIdx = 0
  saveState()
}

async function calculate() {
  calculated.value = true
  result.value = await optimize(sheetWidth.value, sheetHeight.value, [...pieces], kerf.value, selectedStrategy.value)
}

// ── Export (cut-ready SVG / DXF / print) ───────────────────────────────────────
function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function exportSvg() {
  if (result.value) downloadFile('cutlog-layout.svg', buildLayoutSvg(result.value), 'image/svg+xml')
}

function exportDxf() {
  if (result.value) downloadFile('cutlog-layout.dxf', buildLayoutDxf(result.value), 'application/dxf')
}

function printLayout() {
  if (!result.value) return
  const html = buildPrintHtml(result.value, {
    title: t('app.title'),
    layoutTitle: t('export.layout'),
    cols: [t('name'), t('export.size'), t('quantity')],
  })
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ── Share link (encode the project into a copyable URL hash) ───────────────────
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2200)
}

async function copyShareLink() {
  const url = buildShareUrl(location.origin, location.pathname, currentState())
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // Fallback for browsers/contexts without clipboard access: drop the link
    // into the address bar so the user can copy it manually.
    history.replaceState(null, '', url)
  }
  showToast(t('link_copied'))
}

// ── Selection (sync between the piece list and the placed rects) ───────────────
const selectedPieceId = ref<string | null>(null)
const selectedPiece = computed(() => pieces.find(p => p.id === selectedPieceId.value) ?? null)
function toggleSelect(id: string) {
  selectedPieceId.value = selectedPieceId.value === id ? null : id
}

const pieceSummary = computed(() => summarizePieces(pieces))
const oversizedPieces = computed(() => findOversizedPieces(pieces, sheetWidth.value, sheetHeight.value))
const visiblePieces = computed(() => pieces
  .map((piece, index) => ({ piece, index }))
  .filter(({ piece }) => pieceMatchesQuery(piece, pieceQuery.value)))
const hasPieceFilter = computed(() => pieceQuery.value.trim().length > 0)
const unnamedPiecesCount = computed(() => pieces.filter(piece => !piece.label.trim()).length)
const rotationLockedCount = computed(() => pieces.filter(piece => !piece.allowRotation).length)
const preflightChecks = computed<PreflightCheck[]>(() => [
  {
    id: 'oversized',
    label: t('preflight.oversized'),
    value: String(oversizedPieces.value.length),
    status: oversizedPieces.value.length ? 'warn' : 'ok',
  },
  {
    id: 'unnamed',
    label: t('preflight.unnamed'),
    value: String(unnamedPiecesCount.value),
    status: unnamedPiecesCount.value ? 'warn' : 'ok',
  },
  {
    id: 'rotation',
    label: t('preflight.rotation_locked'),
    value: String(rotationLockedCount.value),
    status: rotationLockedCount.value ? 'idle' : 'ok',
  },
  {
    id: 'layout',
    label: t('preflight.layout'),
    value: result.value ? `${result.value.totalSheets} ${t('sheets')}` : t('preflight.not_calculated'),
    status: result.value ? 'ok' : 'idle',
  },
])
const selectedPiecePlacements = computed(() => {
  if (!result.value || !selectedPieceId.value) return []
  return result.value.sheets.flatMap(sheet =>
    sheet.placedPieces
      .filter(pp => pp.source.id === selectedPieceId.value)
      .map(pp => ({
        sheetIndex: sheet.index,
        x: pp.x,
        y: pp.y,
        width: pp.width,
        height: pp.height,
        isRotated: pp.isRotated,
      })),
  )
})
const selectedPieceStats = computed(() => {
  const piece = selectedPiece.value
  if (!piece) return null
  const placements = selectedPiecePlacements.value
  return {
    area: pieceArea(piece),
    totalArea: pieceTotalArea(piece),
    placements,
    firstPlacement: placements[0],
  }
})

function areaM2(areaMm2: number): string {
  return (areaMm2 / 1_000_000).toFixed(2)
}

function snapshotSummaryText(): string {
  return `${pieceSummary.value.totalTypes} ${t('piece_types')} · ${pieceSummary.value.totalQuantity} ${t('pieces_short')} · ${areaM2(pieceSummary.value.totalArea)} ${t('material_area')}`
}

function formatSnapshotDate(createdAt: string): string {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString()
}

function saveProjectSnapshot() {
  if (!pieces.length) return
  const snapshot = createProjectSnapshot({
    id: crypto.randomUUID(),
    name: snapshotName.value.trim() || `${t('snapshot.default_name')} ${projectSnapshots.value.length + 1}`,
    createdAt: new Date().toISOString(),
    summary: snapshotSummaryText(),
    state: currentState(),
  })
  projectSnapshots.value = upsertProjectSnapshot(projectSnapshots.value, snapshot)
  snapshotName.value = ''
  saveProjectSnapshotsNow()
  showToast(t('snapshot_saved'))
}

function saveAutoProjectSnapshot(name: string) {
  if (!pieces.length) return
  const snapshot = createProjectSnapshot({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    summary: snapshotSummaryText(),
    state: currentState(),
  })
  projectSnapshots.value = upsertProjectSnapshot(projectSnapshots.value, snapshot)
  saveProjectSnapshotsNow()
}

function restoreProjectSnapshot(snapshot: ProjectSnapshot) {
  applyState(snapshot.state)
  selectedPieceId.value = null
  pieceQuery.value = ''
  pieceSortMode.value = 'manual'
  result.value = null
  calculated.value = false
  undoHistory.reset(serializeHomeState(currentState()))
  refreshHistoryState()
  saveStateNow()
  showToast(t('snapshot_restored'))
}

function deleteProjectSnapshot(snapshot: ProjectSnapshot) {
  projectSnapshots.value = removeProjectSnapshot(projectSnapshots.value, snapshot.id)
  saveProjectSnapshotsNow()
  showToast(t('snapshot_deleted'))
}

function setPieceSortMode(mode: PieceSortMode) {
  pieceSortMode.value = mode
  applyPieceSort()
}

function duplicatePiece(source = selectedPiece.value) {
  if (!source) return
  const idx = pieces.indexOf(source)
  if (idx < 0) return
  const color = PIECE_COLORS[colorIdx++ % PIECE_COLORS.length]
  const copy = newPiece(source.label, source.width, source.height, source.quantity, source.allowRotation, color)
  pieces.splice(idx + 1, 0, copy)
  selectedPieceId.value = copy.id
  saveState()
  showToast(t('piece_duplicated'))
}

function deleteSelectedPiece() {
  if (selectedPiece.value) removePiece(selectedPiece.value)
}

function clearSelection() {
  selectedPieceId.value = null
}

function setVisibleRotation(allowRotation: boolean) {
  if (!visiblePieces.value.length) return
  for (const { piece } of visiblePieces.value) piece.allowRotation = allowRotation
  saveState()
  showToast(allowRotation ? t('rotation_enabled') : t('rotation_disabled'))
}

function mutateVisibleDimensions(
  transform: (piece: CutPiece) => { width: number; height: number },
  toastKey: string,
) {
  if (!visiblePieces.value.length) return
  saveAutoProjectSnapshot(t('snapshot.auto_before_transform'))
  for (const { piece } of visiblePieces.value) {
    const next = transform(piece)
    piece.width = next.width
    piece.height = next.height
  }
  result.value = null
  calculated.value = false
  saveState()
  showToast(t(toastKey))
}

function addVisibleAllowance(sign = 1) {
  const delta = Math.max(1, Math.round(transformStep.value)) * sign
  mutateVisibleDimensions(piece => addDimensionDelta(piece, delta), 'transform_done')
}

function swapVisibleDimensions() {
  mutateVisibleDimensions(piece => swapDimensions(piece), 'transform_done')
}

function roundVisibleDimensions() {
  const step = Math.max(1, Math.round(roundStep.value))
  mutateVisibleDimensions(piece => roundDimensionsUp(piece, step), 'transform_done')
}

function applyPieceSort() {
  if (pieceSortMode.value === 'manual') return
  const sorted = sortPiecesForEditor(pieces, pieceSortMode.value)
  pieces.splice(0, pieces.length, ...sorted)
  saveState()
  showToast(t('pieces_sorted'))
}

const paletteCommands = computed<PaletteCommand[]>(() => [
  { id: 'calculate', label: t('calculate'), shortcut: 'Ctrl+Enter', disabled: !pieces.length, run: calculate },
  { id: 'add', label: t('add_piece'), shortcut: 'Enter', run: addPiece },
  { id: 'duplicate', label: t('duplicate_selected'), disabled: !selectedPiece.value, run: () => duplicatePiece() },
  { id: 'delete', label: t('delete'), disabled: !selectedPiece.value, run: deleteSelectedPiece },
  { id: 'import', label: t('command.open_import'), disabled: showImport.value, run: () => { showImport.value = true } },
  { id: 'share', label: t('command.copy_share'), disabled: !pieces.length, run: copyShareLink },
  { id: 'snapshot-save', label: t('command.snapshot_save'), disabled: !pieces.length, run: saveProjectSnapshot },
  { id: 'snapshot-restore', label: t('command.snapshot_restore_latest'), disabled: !projectSnapshots.value.length, run: () => restoreProjectSnapshot(projectSnapshots.value[0]) },
  { id: 'undo', label: t('hotkey.undo'), shortcut: 'Ctrl+Z', disabled: !canUndo.value, run: doUndo },
  { id: 'redo', label: t('hotkey.redo'), shortcut: 'Ctrl+Shift+Z', disabled: !canRedo.value, run: doRedo },
  { id: 'clear-filter', label: t('command.clear_filter'), disabled: !hasPieceFilter.value, run: () => { pieceQuery.value = '' } },
  { id: 'sort-area', label: t('command.sort_area'), run: () => setPieceSortMode('area_desc') },
  { id: 'sort-name', label: t('command.sort_name'), run: () => setPieceSortMode('name_asc') },
  { id: 'sort-quantity', label: t('command.sort_quantity'), run: () => setPieceSortMode('quantity_desc') },
  { id: 'rotation-on', label: t('command.rotation_visible_on'), disabled: !visiblePieces.value.length, run: () => setVisibleRotation(true) },
  { id: 'rotation-off', label: t('command.rotation_visible_off'), disabled: !visiblePieces.value.length, run: () => setVisibleRotation(false) },
  { id: 'transform-add', label: t('command.transform_add'), disabled: !visiblePieces.value.length, run: () => addVisibleAllowance(1) },
  { id: 'transform-sub', label: t('command.transform_sub'), disabled: !visiblePieces.value.length, run: () => addVisibleAllowance(-1) },
  { id: 'transform-swap', label: t('command.transform_swap'), disabled: !visiblePieces.value.length, run: swapVisibleDimensions },
  { id: 'transform-round', label: t('command.transform_round'), disabled: !visiblePieces.value.length, run: roundVisibleDimensions },
  { id: 'clear-all', label: t('command.clear_all'), disabled: !pieces.length, run: clearAll },
])

const visiblePaletteCommands = computed(() => {
  const q = commandQuery.value.trim().toLocaleLowerCase()
  if (!q) return paletteCommands.value
  return paletteCommands.value.filter(command => command.label.toLocaleLowerCase().includes(q))
})

function openCommandPalette() {
  commandPaletteOpen.value = true
  commandQuery.value = ''
  nextTick(() => commandInputRef.value?.focus())
}

function closeCommandPalette() {
  commandPaletteOpen.value = false
}

async function runPaletteCommand(command: PaletteCommand) {
  if (command.disabled) return
  closeCommandPalette()
  await command.run()
}

function runFirstPaletteCommand() {
  const command = visiblePaletteCommands.value.find(c => !c.disabled)
  if (command) runPaletteCommand(command)
}

function onPaletteKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    runFirstPaletteCommand()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeCommandPalette()
  }
}

// ── Example project (one-click starter for the empty state) ────────────────────
function loadExample() {
  const ex = [
    { label: t('example.side'), w: 1800, h: 300, q: 2 },
    { label: t('example.shelf'), w: 760, h: 300, q: 4 },
    { label: t('example.back'), w: 1800, h: 800, q: 1 },
  ]
  for (const e of ex) {
    const color = PIECE_COLORS[colorIdx++ % PIECE_COLORS.length]
    pieces.push(newPiece(e.label, e.w, e.h, e.q, true, color))
  }
  saveState()
  calculate()
}

// ── Drag & drop ──────────────────────────────────────────────────────────────
function onDragStart(idx: number) {
  dragStartIdx.value = idx
  isDragging.value = true
}

function onDragOver(idx: number) {
  dragOverIdx.value = idx
}

function onDragLeave() {
  dragOverIdx.value = -1
}

function dropPiece(targetIdx: number) {
  if (dragStartIdx.value < 0 || dragStartIdx.value === targetIdx || dragStartIdx.value >= pieces.length) return
  const item = pieces[dragStartIdx.value]
  pieces.splice(dragStartIdx.value, 1)
  pieces.splice(Math.min(targetIdx, pieces.length), 0, item)
  pieceSortMode.value = 'manual'
  dragStartIdx.value = -1
  dragOverIdx.value = -1
  saveState()
}

function onDragEnd() {
  dragStartIdx.value = -1
  dragOverIdx.value = -1
  isDragging.value = false
}

// ── SVG helpers ──────────────────────────────────────────────────────────────
function svgScale(sheetW: number, sheetH: number) {
  return Math.min(SVG_MAX_W / sheetW, SVG_MAX_H / sheetH)
}

// All sheets in a result share the same dimensions, so one scale serves them all.
const sheetScale = computed(() => {
  const s = result.value?.sheets[0]
  return s ? svgScale(s.width, s.height) : 1
})

const pieceIndexById = computed(() => {
  const m = new Map<string, number>()
  pieces.forEach((p, i) => m.set(p.id, i + 1))
  return m
})

function grainLines(svgH: number): number[] {
  const lines: number[] = []
  for (let g = 1; g < 10; g++) lines.push(svgH * g / 10)
  return lines
}

function pieceIndex(source: CutPiece): number {
  return pieceIndexById.value.get(source.id) ?? 0
}

function badgeWidth(idx: number): number {
  return idx >= 10 ? 16 : 12
}

// ── Strategy display ─────────────────────────────────────────────────────────
// Single source for both the <select> groups and strategyDisplayName.
const strategyGroups: { labelKey: string; items: { value: CuttingStrategy; sortKey: string }[] }[] = [
  { labelKey: 'strategy.best_area', items: [
    { value: CuttingStrategy.BestArea_AreaDesc, sortKey: 'sort.area' },
    { value: CuttingStrategy.BestArea_MaxSideDesc, sortKey: 'sort.max_side' },
    { value: CuttingStrategy.BestArea_PerimeterDesc, sortKey: 'sort.perimeter' },
  ] },
  { labelKey: 'strategy.best_short', items: [
    { value: CuttingStrategy.BestShortSide_AreaDesc, sortKey: 'sort.area' },
    { value: CuttingStrategy.BestShortSide_MaxSideDesc, sortKey: 'sort.max_side' },
    { value: CuttingStrategy.BestShortSide_PerimeterDesc, sortKey: 'sort.perimeter' },
  ] },
  { labelKey: 'strategy.best_long', items: [
    { value: CuttingStrategy.BestLongSide_AreaDesc, sortKey: 'sort.area' },
    { value: CuttingStrategy.BestLongSide_MaxSideDesc, sortKey: 'sort.max_side' },
    { value: CuttingStrategy.BestLongSide_PerimeterDesc, sortKey: 'sort.perimeter' },
  ] },
]

function strategyDisplayName(s: CuttingStrategy): string {
  for (const g of strategyGroups)
    for (const it of g.items)
      if (it.value === s) return `${t(g.labelKey)} \u00b7 ${t(it.sortKey)}`
  return t('strategy.auto')
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    openCommandPalette()
  } else if (commandPaletteOpen.value && e.key === 'Escape') {
    e.preventDefault()
    closeCommandPalette()
  } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    // Only fire if not focused on an input that should handle Enter natively
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    e.preventDefault()
    addPiece()
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (pieces.length) calculate()
  } else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault()
    doUndo()
  } else if ((e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
    || (e.key.toLowerCase() === 'y' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault()
    doRedo()
  } else if (e.key === 'Escape') {
    if (selectedPieceId.value !== null) { selectedPieceId.value = null; return }
    result.value = null
    calculated.value = false
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
// Persist and record history on any sheet/kerf/piece edit.
watch([sheetWidth, sheetHeight, kerf, pieces], () => {
  saveState()
  recordHistory()
}, { deep: true })

onMounted(() => {
  loadInitialState()
  loadProjectSnapshots()
  // Baseline the history on whatever was actually loaded (link/localStorage),
  // so the first undo can't step back into the pre-load default.
  undoHistory.reset(serializeHomeState(currentState()))
  refreshHistoryState()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(saveTimer)
  clearTimeout(toastTimer)
  clearTimeout(recordTimer)
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
      <span><kbd>Esc</kbd> {{ t('hotkey.clear') }}</span>
    </div>

    <div class="main-layout">
      <aside class="panel panel-input">
        <!-- Sheet parameters -->
        <section class="card">
          <h2>{{ t('sheet_params') }}</h2>
          <div class="form-row">
            <label>{{ t('sheet_preset') }}</label>
            <select class="form-select" :value="selectedPreset" @change="onPresetChanged">
              <option value="">{{ t('preset.custom') }}</option>
              <option v-for="p in sheetPresets" :key="p.key" :value="p.key">{{ t(`preset.${p.key}`) }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t('width_mm') }}</label>
            <NumberField :model-value="sheetWidth" @update:model-value="onSheetWidthChanged" :min="1" :step="1" />
          </div>
          <div class="form-row">
            <label>{{ t('height_mm') }}</label>
            <NumberField :model-value="sheetHeight" @update:model-value="onSheetHeightChanged" :min="1" :step="1" />
          </div>
          <div class="form-row">
            <label>{{ t('kerf_mm') }}</label>
            <NumberField v-model="kerf" :min="0" :step="1" />
          </div>
          <div class="form-row">
            <label>{{ t('strategy') }}</label>
            <select class="form-select" v-model.number="selectedStrategy">
              <option :value="CuttingStrategy.Auto">{{ t('strategy.auto') }}</option>
              <optgroup v-for="g in strategyGroups" :key="g.labelKey" :label="t(g.labelKey)">
                <option v-for="it in g.items" :key="it.value" :value="it.value">{{ t(g.labelKey) }} &middot; {{ t(it.sortKey) }}</option>
              </optgroup>
            </select>
          </div>
        </section>

        <!-- Add piece form -->
        <section class="card">
          <h2>{{ t('add_piece') }}</h2>
          <div class="form-row">
            <label>{{ t('name') }}</label>
            <input type="text" v-model="newLabel" :placeholder="t('name_placeholder')" />
          </div>
          <div class="form-row">
            <label>{{ t('width_mm') }}</label>
            <NumberField v-model="newWidth" :min="1" :step="1" />
          </div>
          <div class="form-row">
            <label>{{ t('height_mm') }}</label>
            <NumberField v-model="newHeight" :min="1" :step="1" />
          </div>
          <div class="form-row">
            <label>{{ t('quantity') }}</label>
            <NumberField :model-value="newQty" @update:model-value="v => newQty = Math.max(1, Math.round(v))" :min="1" :step="1" />
          </div>
          <div class="form-row form-row-check">
            <label>
              <input type="checkbox" v-model="newAllowRotation" />
              {{ t('allow_rotation') }}
            </label>
          </div>
          <p v-if="addError" class="error">{{ addError }}</p>
          <div class="card-actions">
            <button class="btn btn-primary" @click="addPiece">+ {{ t('add') }}</button>
            <button class="btn btn-ghost" @click="showImport = !showImport" :class="{ active: showImport }">{{ t('import') }}</button>
          </div>

          <!-- Bulk import: paste a cut list from a spreadsheet -->
          <div v-if="showImport" class="import-box">
            <textarea
              v-model="importText"
              class="import-textarea"
              rows="5"
              :placeholder="t('import_placeholder')"
            ></textarea>
            <p class="import-hint">{{ t('import_hint') }}</p>
            <button class="btn btn-primary btn-compact" @click="importPieces" :disabled="!importText.trim()">
              {{ t('import_add_all') }}
            </button>
          </div>
        </section>

        <!-- Project versions -->
        <section class="card snapshot-card">
          <div class="snapshot-head">
            <h2>{{ t('snapshots') }}</h2>
            <span>{{ projectSnapshots.length }}/8</span>
          </div>
          <div class="snapshot-save-row">
            <input
              v-model="snapshotName"
              type="text"
              class="snapshot-name-input"
              :placeholder="t('snapshot_name_placeholder')"
              @keydown.enter.prevent="saveProjectSnapshot"
            />
            <button class="btn btn-primary btn-compact" @click="saveProjectSnapshot" :disabled="!pieces.length">{{ t('save') }}</button>
          </div>
          <p class="snapshot-hint">{{ t('snapshot_hint') }}</p>
          <div v-if="projectSnapshots.length" class="snapshot-list">
            <div v-for="snapshot in projectSnapshots" :key="snapshot.id" class="snapshot-item">
              <button type="button" class="snapshot-main" @click="restoreProjectSnapshot(snapshot)">
                <strong>{{ snapshot.name }}</strong>
                <span>{{ snapshot.summary }}</span>
                <small>{{ formatSnapshotDate(snapshot.createdAt) }}</small>
              </button>
              <button class="btn btn-danger btn-sm" @click="deleteProjectSnapshot(snapshot)" :title="t('delete')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>
          <p v-else class="snapshot-empty">{{ t('snapshot_empty') }}</p>
        </section>
      </aside>

      <main class="panel panel-result">
        <!-- Piece list -->
        <section v-if="pieces.length" class="card piece-list-top">
          <div class="piece-list-top-header">
            <div>
              <h2>{{ t('piece_list') }}</h2>
              <p class="editor-subtitle">{{ pieceSummary.totalTypes }} {{ t('piece_types') }} · {{ pieceSummary.totalQuantity }} {{ t('pieces_short') }}</p>
            </div>
            <div class="history-actions">
              <button class="btn btn-ghost btn-square" @click="openCommandPalette" :title="t('command_palette')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h7"/>
                </svg>
              </button>
              <button class="btn btn-ghost btn-square" @click="doUndo" :disabled="!canUndo" :title="t('hotkey.undo')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                </svg>
              </button>
              <button class="btn btn-ghost btn-square" @click="doRedo" :disabled="!canRedo" :title="t('hotkey.redo')">
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

          <div class="preflight-strip">
            <span
              v-for="check in preflightChecks"
              :key="check.id"
              class="preflight-item"
              :class="`is-${check.status}`"
            >
              <strong>{{ check.value }}</strong>
              {{ check.label }}
            </span>
          </div>

          <div class="editor-toolbar">
            <label class="toolbar-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
              </svg>
              <input v-model="pieceQuery" type="search" :placeholder="t('search_pieces')" />
            </label>
            <select class="form-select toolbar-select" v-model="pieceSortMode" @change="applyPieceSort">
              <option value="manual">{{ t('sort.manual') }}</option>
              <option value="area_desc">{{ t('sort.area_desc') }}</option>
              <option value="name_asc">{{ t('sort.name_asc') }}</option>
              <option value="quantity_desc">{{ t('sort.quantity_desc') }}</option>
            </select>
            <div class="toolbar-actions">
              <button class="btn btn-ghost btn-tool" @click="duplicatePiece()" :disabled="!selectedPiece" :title="t('duplicate_selected')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
                  <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>
                </svg>
                {{ t('duplicate') }}
              </button>
              <button class="btn btn-ghost btn-square" @click="setVisibleRotation(true)" :disabled="!visiblePieces.length" :title="t('rotate_visible_on')">&#8635;</button>
              <button class="btn btn-ghost btn-square" @click="setVisibleRotation(false)" :disabled="!visiblePieces.length" :title="t('rotate_visible_off')">&#8634;</button>
            </div>
          </div>

          <div class="transform-strip">
            <div class="transform-group">
              <span>{{ t('transform.allowance') }}</span>
              <NumberField
                :model-value="transformStep"
                @update:model-value="v => transformStep = Math.max(1, Math.round(v))"
                :min="1"
                :step="1"
              />
              <button class="btn btn-ghost btn-square" @click="addVisibleAllowance(1)" :disabled="!visiblePieces.length" :title="t('transform_add_visible')">+</button>
              <button class="btn btn-ghost btn-square" @click="addVisibleAllowance(-1)" :disabled="!visiblePieces.length" :title="t('transform_sub_visible')">−</button>
            </div>
            <div class="transform-group">
              <span>{{ t('transform.round') }}</span>
              <NumberField
                :model-value="roundStep"
                @update:model-value="v => roundStep = Math.max(1, Math.round(v))"
                :min="1"
                :step="1"
              />
              <button class="btn btn-ghost btn-square" @click="roundVisibleDimensions" :disabled="!visiblePieces.length" :title="t('transform_round_visible')">⌈</button>
              <button class="btn btn-ghost btn-square" @click="swapVisibleDimensions" :disabled="!visiblePieces.length" :title="t('transform_swap_visible')">⇄</button>
            </div>
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
              <button class="btn btn-ghost btn-compact" @click="duplicatePiece()">{{ t('duplicate') }}</button>
              <button class="btn btn-danger btn-compact" @click="deleteSelectedPiece">{{ t('delete') }}</button>
              <button class="btn btn-ghost btn-compact" @click="clearSelection">{{ t('clear_selection') }}</button>
            </div>
          </div>

          <div v-if="oversizedPieces.length" class="alert alert-warn editor-alert">
            <strong>{{ t('oversized_existing_warn') }}</strong>
            <ul>
              <li v-for="p in oversizedPieces" :key="p.id">
                <template v-if="p.label.trim()">{{ p.label.trim() }} </template>({{ p.width.toFixed(0) }}&times;{{ p.height.toFixed(0) }})
              </li>
            </ul>
          </div>

          <p v-if="hasPieceFilter && !visiblePieces.length" class="piece-filter-empty">{{ t('no_matching_pieces') }}</p>
          <div
            v-else
            class="piece-list piece-list-horizontal"
            :class="{ 'is-dragging': isDragging }"
            @dragleave="onDragLeave"
          >
            <div
              v-for="entry in visiblePieces"
              :key="entry.piece.id"
              class="piece-item piece-item-editing"
              :class="{ 'drag-over': dragOverIdx === entry.index, 'is-dragging-item': dragStartIdx === entry.index, selected: selectedPieceId === entry.piece.id }"
              draggable="true"
              @dragstart="onDragStart(entry.index)"
              @dragover.prevent="onDragOver(entry.index)"
              @drop="dropPiece(entry.index)"
              @dragend="onDragEnd"
            >
              <span class="drag-handle" :title="t('drag_hint')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
                  <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
                  <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
                </svg>
              </span>
              <span class="piece-color" :style="{ background: entry.piece.color, cursor: 'pointer' }" :title="t('highlight_hint')" @click="toggleSelect(entry.piece.id)">{{ entry.index + 1 }}</span>
              <div class="piece-edit-fields">
                <input class="piece-edit-label" type="text" v-model="entry.piece.label" :placeholder="t('name')" />
                <div class="piece-edit-dims">
                  <NumberField v-model="entry.piece.width" :min="1" :step="1" />
                  <span class="unit">&times;</span>
                  <NumberField v-model="entry.piece.height" :min="1" :step="1" />
                  <span class="unit">mm</span>
                  <NumberField
                    :model-value="entry.piece.quantity"
                    @update:model-value="v => entry.piece.quantity = Math.max(1, Math.round(v))"
                    :min="1"
                    :step="1"
                  />
                  <button
                    type="button"
                    class="btn btn-primary btn-sm piece-edit-rot"
                    :class="{ 'rot-on': entry.piece.allowRotation }"
                    :title="t('rotation')"
                    @click="entry.piece.allowRotation = !entry.piece.allowRotation"
                  >&#8635;</button>
                </div>
              </div>
              <button class="btn btn-danger btn-sm" @click="removePiece(entry.piece)" :title="t('delete')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="card-actions card-actions-bottom">
            <button class="btn btn-danger" @click="clearAll">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              {{ t('clear_all') }}
            </button>
            <button class="btn btn-ghost" @click="copyShareLink" :title="t('share')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>
              </svg>
              {{ t('share') }}
            </button>
            <button class="btn btn-primary" @click="calculate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px">
                <polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>
              </svg>
              {{ t('calculate') }}
            </button>
          </div>
        </section>

        <!-- Empty state -->
        <div v-if="!result && !calculated" class="empty-state">
          <div class="empty-icon">&#129690;</div>
          <p>{{ t('empty_hint') }}</p>
          <button class="btn btn-ghost" @click="loadExample">{{ t('load_example') }}</button>
        </div>

        <!-- Results -->
        <template v-else-if="result">
          <div class="stats-bar">
            <div class="stat">
              <span class="stat-value">{{ result.totalSheets }}</span>
              <span class="stat-label">{{ t('sheets') }}</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ result.overallEfficiency.toFixed(1) }}%</span>
              <span class="stat-label">{{ t('efficiency') }}</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ (result.totalArea - result.totalUsedArea).toFixed(0) }} mm&sup2;</span>
              <span class="stat-label">{{ t('waste') }}</span>
            </div>
            <div class="stat">
              <span class="stat-value stat-value-sm">{{ strategyDisplayName(result.autoPickedStrategy ?? result.strategy) }}</span>
              <span class="stat-label">{{ t('strategy.used') }}</span>
            </div>
          </div>

          <!-- Export -->
          <div class="export-bar">
            <span class="export-label">{{ t('export') }}</span>
            <button class="btn btn-ghost btn-export" @click="exportSvg">SVG</button>
            <button class="btn btn-ghost btn-export" @click="exportDxf">DXF</button>
            <button class="btn btn-ghost btn-export" @click="printLayout">{{ t('export.print') }}</button>
          </div>

          <!-- Unplaced warnings -->
          <div v-if="result.unplacedPieces.length" class="alert alert-warn">
            <strong>{{ t('unplaced_warn') }}</strong>
            <ul>
              <li v-for="(u, ui) in result.unplacedPieces" :key="ui">
                <template v-if="u.label.trim()">{{ u.label.trim() }} </template>({{ u.width.toFixed(0) }}&times;{{ u.height.toFixed(0) }})
              </li>
            </ul>
          </div>

          <!-- Sheets grid -->
          <div class="sheets-grid">
            <div v-for="sheet in result.sheets" :key="sheet.index" class="sheet-card">
              <div class="sheet-header">
                <span>{{ t('sheet') }} {{ sheet.index + 1 }}</span>
                <span class="efficiency-badge" :class="efficiencyClass(sheet.efficiency)">
                  {{ sheet.efficiency.toFixed(1) }}%
                </span>
              </div>
              <div class="sheet-svg-wrap" :id="`sheet-svg-${sheet.index}`">
                <svg
                  :width="(sheet.width * sheetScale).toFixed(0)"
                  :height="(sheet.height * sheetScale).toFixed(0)"
                  :viewBox="`0 0 ${(sheet.width * sheetScale).toFixed(0)} ${(sheet.height * sheetScale).toFixed(0)}`"
                  style="display:block;margin:auto;"
                >
                  <!-- Sheet background -->
                  <rect
                    :width="(sheet.width * sheetScale).toFixed(0)"
                    :height="(sheet.height * sheetScale).toFixed(0)"
                    fill="#f5f0e8"
                    stroke="#8B7355"
                    stroke-width="2"
                  />

                  <!-- Wood grain lines -->
                  <line
                    v-for="(gy, gi) in grainLines(sheet.height * sheetScale)"
                    :key="'g' + gi"
                    x1="0"
                    :y1="gy.toFixed(1)"
                    :x2="(sheet.width * sheetScale).toFixed(0)"
                    :y2="gy.toFixed(1)"
                    stroke="#d4c9a8"
                    stroke-width="0.5"
                  />

                  <!-- Placed pieces -->
                  <template v-for="(pp, ppi) in sheet.placedPieces" :key="'p' + ppi">
                    <!-- Piece rect -->
                    <rect
                      :x="(pp.x * sheetScale).toFixed(1)"
                      :y="(pp.y * sheetScale).toFixed(1)"
                      :width="(pp.width * sheetScale).toFixed(1)"
                      :height="(pp.height * sheetScale).toFixed(1)"
                      :fill="pp.source.color"
                      :fill-opacity="selectedPieceId === null ? 0.82 : (pp.source.id === selectedPieceId ? 0.95 : 0.2)"
                      :stroke="pp.source.id === selectedPieceId ? '#4a90d9' : '#fff'"
                      :stroke-width="pp.source.id === selectedPieceId ? 2 : 0.1"
                      style="cursor:pointer"
                      @click="toggleSelect(pp.source.id)"
                    />

                    <!-- Badge background -->
                    <rect
                      :x="(pp.x * sheetScale + 3).toFixed(1)"
                      :y="(pp.y * sheetScale + 3).toFixed(1)"
                      :width="badgeWidth(pieceIndex(pp.source))"
                      height="13"
                      rx="3"
                      fill="rgba(0,0,0,0.35)"
                    />

                    <!-- Badge text -->
                    <text
                      :x="(pp.x * sheetScale + 3 + badgeWidth(pieceIndex(pp.source)) / 2).toFixed(1)"
                      :y="(pp.y * sheetScale + 3 + 13 / 2).toFixed(1)"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      font-size="8"
                      font-weight="700"
                      fill="#fff"
                    >{{ pieceIndex(pp.source) }}</text>

                    <!-- Rotation indicator -->
                    <text
                      v-if="pp.isRotated"
                      :x="(pp.x * sheetScale + pp.width * sheetScale - 6).toFixed(1)"
                      :y="(pp.y * sheetScale + 12).toFixed(1)"
                      font-size="10"
                      fill="#fff"
                      opacity="0.9"
                    >&#8635;</text>

                    <!-- Label and dimensions (only if piece is big enough) -->
                    <template v-if="pp.width * sheetScale > 40 && pp.height * sheetScale > 22">
                      <!-- Label text -->
                      <text
                        v-if="pp.source.label?.trim()"
                        :x="(pp.x * sheetScale + pp.width * sheetScale / 2).toFixed(1)"
                        :y="(pp.y * sheetScale + pp.height * sheetScale / 2 - 5).toFixed(1)"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        :font-size="Math.min(13, pp.width * sheetScale / 6).toFixed(0)"
                        font-weight="600"
                        fill="#fff"
                        style="text-shadow:0 1px 2px rgba(0,0,0,.5)"
                      >{{ truncate(pp.source.label.trim(), Math.floor(pp.width * sheetScale / 7)) }}</text>

                      <!-- Dimensions text -->
                      <text
                        :x="(pp.x * sheetScale + pp.width * sheetScale / 2).toFixed(1)"
                        :y="(pp.y * sheetScale + pp.height * sheetScale / 2 + (pp.source.label?.trim() ? 9 : 0)).toFixed(1)"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        :font-size="Math.min(11, pp.width * sheetScale / 7).toFixed(0)"
                        fill="#fff"
                        opacity="0.85"
                      >{{ pp.width.toFixed(0) }}&times;{{ pp.height.toFixed(0) }}</text>
                    </template>
                  </template>

                  <!-- Bottom dimension label -->
                  <text
                    :x="(sheet.width * sheetScale / 2).toFixed(0)"
                    :y="(sheet.height * sheetScale - 4).toFixed(0)"
                    text-anchor="middle"
                    font-size="11"
                    fill="#8B7355"
                  >{{ sheet.width.toFixed(0) }} mm</text>

                  <!-- Left dimension label -->
                  <text
                    x="4"
                    :y="(sheet.height * sheetScale / 2).toFixed(0)"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="11"
                    fill="#8B7355"
                    :transform="`rotate(-90,4,${(sheet.height * sheetScale / 2).toFixed(0)})`"
                  >{{ sheet.height.toFixed(0) }} mm</text>
                </svg>
              </div>
              <div class="sheet-footer">
                <span>{{ sheet.placedPieces.length }} {{ t('pieces_short') }} &middot; {{ t('waste') }} {{ (sheet.totalArea - sheet.usedArea).toFixed(0) }} mm&sup2;</span>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <transition name="palette-fade">
      <div v-if="commandPaletteOpen" class="command-palette-backdrop" @click.self="closeCommandPalette">
        <div class="command-palette" role="dialog" aria-modal="true" :aria-label="t('command_palette')">
          <label class="command-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              ref="commandInputRef"
              v-model="commandQuery"
              type="search"
              :placeholder="t('command_search')"
              @keydown="onPaletteKeydown"
            />
          </label>
          <div class="command-list">
            <button
              v-for="command in visiblePaletteCommands"
              :key="command.id"
              class="command-item"
              :disabled="command.disabled"
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
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.import-box {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.import-textarea {
  width: 100%;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 8px 10px;
  border: 1px solid var(--border, #d0d0d0);
  border-radius: 6px;
  background: var(--input-bg, #fff);
  color: inherit;
  box-sizing: border-box;
}
.import-hint {
  margin: 0;
  font-size: 11px;
  opacity: 0.7;
}
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
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>

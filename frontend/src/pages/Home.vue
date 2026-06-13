<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, computed } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { optimize } from '@/services/optimizer'
import { type CutPiece, type CuttingResult, CuttingStrategy, newPiece } from '@/services/types'
import { PIECE_COLORS, truncate, efficiencyClass } from '@/helpers/svg'
import { HOME_STATE_KEY, serializeHomeState, parseHomeState } from '@/lib/homeState'
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
    localStorage.setItem(HOME_STATE_KEY, serializeHomeState({
      sheetWidth: sheetWidth.value,
      sheetHeight: sheetHeight.value,
      kerf: kerf.value,
      pieces: [...pieces],
    }))
  } catch { /* ignore */ }
}

function loadState() {
  const saved = parseHomeState(localStorage.getItem(HOME_STATE_KEY))
  if (!saved) return
  sheetWidth.value = saved.sheetWidth
  sheetHeight.value = saved.sheetHeight
  kerf.value = saved.kerf
  if (saved.pieces.length) {
    pieces.splice(0, pieces.length, ...saved.pieces)
    colorIdx = pieces.length
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────
function addPiece() {
  addError.value = ''
  if (newWidth.value <= 0 || newHeight.value <= 0) { addError.value = t('invalid_dims'); return }
  if (
    newWidth.value > sheetWidth.value && newHeight.value > sheetWidth.value &&
    newWidth.value > sheetHeight.value && newHeight.value > sheetHeight.value
  ) { addError.value = t('piece_larger'); return }
  if (newQty.value <= 0) { addError.value = t('qty_min'); return }

  const color = PIECE_COLORS[colorIdx++ % PIECE_COLORS.length]
  pieces.push(newPiece(newLabel.value, newWidth.value, newHeight.value, newQty.value, newAllowRotation.value, color))

  newLabel.value = ''
  newWidth.value = 400
  newHeight.value = 300
  newQty.value = 1
  saveState()
}

function removePiece(p: CutPiece) {
  const idx = pieces.indexOf(p)
  if (idx >= 0) pieces.splice(idx, 1)
  saveState()
}

function clearAll() {
  pieces.splice(0, pieces.length)
  result.value = null
  calculated.value = false
  colorIdx = 0
  saveState()
}

async function calculate() {
  calculated.value = true
  result.value = await optimize(sheetWidth.value, sheetHeight.value, [...pieces], kerf.value, selectedStrategy.value)
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
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    // Only fire if not focused on an input that should handle Enter natively
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    e.preventDefault()
    addPiece()
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (pieces.length) calculate()
  } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault()
    if (pieces.length) {
      pieces.splice(pieces.length - 1, 1)
      saveState()
    }
  } else if (e.key === 'Escape') {
    result.value = null
    calculated.value = false
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
// Auto-save on any piece edit
watch(pieces, () => saveState(), { deep: true })

onMounted(() => {
  loadState()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(saveTimer)
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
      <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> {{ t('hotkey.undo') }}</span>
      <span><kbd>Esc</kbd> {{ t('hotkey.export') }}</span>
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
          <button class="btn btn-primary" @click="addPiece">+ {{ t('add') }}</button>
        </section>
      </aside>

      <main class="panel panel-result">
        <!-- Piece list -->
        <section v-if="pieces.length" class="card piece-list-top">
          <h2>{{ t('piece_list') }}</h2>
          <div
            class="piece-list piece-list-horizontal"
            :class="{ 'is-dragging': isDragging }"
            @dragleave="onDragLeave"
          >
            <div
              v-for="(piece, i) in pieces"
              :key="piece.id"
              class="piece-item piece-item-editing"
              :class="{ 'drag-over': dragOverIdx === i, 'is-dragging-item': dragStartIdx === i }"
              draggable="true"
              @dragstart="onDragStart(i)"
              @dragover.prevent="onDragOver(i)"
              @drop="dropPiece(i)"
              @dragend="onDragEnd"
            >
              <span class="drag-handle" :title="t('drag_hint')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
                  <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
                  <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
                </svg>
              </span>
              <span class="piece-color" :style="{ background: piece.color }">{{ i + 1 }}</span>
              <div class="piece-edit-fields">
                <input class="piece-edit-label" type="text" v-model="piece.label" :placeholder="t('name')" />
                <div class="piece-edit-dims">
                  <NumberField v-model="piece.width" :min="1" :step="1" />
                  <span class="unit">&times;</span>
                  <NumberField v-model="piece.height" :min="1" :step="1" />
                  <span class="unit">mm</span>
                  <NumberField
                    :model-value="piece.quantity"
                    @update:model-value="v => piece.quantity = Math.max(1, Math.round(v))"
                    :min="1"
                    :step="1"
                  />
                  <button
                    type="button"
                    class="btn btn-primary btn-sm piece-edit-rot"
                    :class="{ 'rot-on': piece.allowRotation }"
                    :title="t('rotation')"
                    @click="piece.allowRotation = !piece.allowRotation"
                  >&#8635;</button>
                </div>
              </div>
              <button class="btn btn-danger btn-sm" @click="removePiece(piece)" :title="t('delete')">
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
                      fill-opacity="0.82"
                      stroke="#fff"
                      stroke-width="0.1"
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
  </div>
</template>

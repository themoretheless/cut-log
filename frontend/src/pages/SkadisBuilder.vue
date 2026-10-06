<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { downloadFile } from '@/lib/downloadFile'
import { useL10n } from '@/stores/l10n'
import { skadisDxf, skadisSlots, skadisSvg, type SkadisSettings } from '@/skadis/geometry'

const { t } = useL10n()

const settings = reactive<SkadisSettings>({
  width: 360,
  height: 560,
  cornerRadius: 8,
  slotWidth: 5,
  slotHeight: 15,
  pitch: 40,
  margin: 20,
  rowOffsetPercent: 50,
  columnOffsetPercent: 0,
})

const showDimensions = ref(true)

const slots = computed(() => skadisSlots(settings))
const isStandardGrid = computed(() => settings.slotWidth === 5 && settings.slotHeight === 15 && settings.pitch === 40 && settings.rowOffsetPercent === 50 && settings.columnOffsetPercent === 0)
const boardArea = computed(() => (settings.width * settings.height / 1_000_000).toFixed(3))

/** Drawing unit scaled to the board, so annotations stay readable at any size. */
const unit = computed(() => Math.max(settings.width, settings.height) / 100)
const previewPadding = computed(() => (showDimensions.value ? unit.value * 11 : Math.max(settings.width, settings.height) * 0.025))

/**
 * Bounding box of the slot centres. Dimensions follow the drawing convention of
 * measuring hole positions to their centrelines, so the shown margins and pitch
 * match the entered values exactly.
 */
const gridBounds = computed(() => {
  const list = slots.value
  if (!list.length) return null
  const xs = list.map(slot => slot.x)
  const ys = list.map(slot => slot.y)
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
})

interface Dimension {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  labelX: number
  labelY: number
  rotate: boolean
  /** Arrows are moved outside the extension lines when the span is too short to fit them. */
  outside: boolean
}

const round = (value: number) => Number(value.toFixed(2)).toString()

function horizontalDim(x1: number, x2: number, y: number, above: number, unitValue: number): Dimension {
  const outside = x2 - x1 < unitValue * 3.4
  return { x1, y1: y, x2, y2: y, label: round(x2 - x1), labelX: (x1 + x2) / 2, labelY: y - above, rotate: false, outside }
}

function verticalDim(y1: number, y2: number, x: number, left: number, unitValue: number): Dimension {
  const outside = y2 - y1 < unitValue * 3.4
  return { x1: x, y1, x2: x, y2, label: round(y2 - y1), labelX: x - left, labelY: (y1 + y2) / 2, rotate: true, outside }
}

/** Actual edge margins, from the board outline to the nearest slot centreline. */
const marginDimensions = computed<Dimension[]>(() => {
  const b = gridBounds.value
  if (!b) return []
  const u = unit.value
  return [
    horizontalDim(0, b.left, -u * 4, u * 1.4, u),
    horizontalDim(b.right, settings.width, -u * 4, u * 1.4, u),
    verticalDim(0, b.top, -u * 4, u * 1.4, u),
    verticalDim(b.bottom, settings.height, -u * 4, u * 1.4, u),
  ].filter(dim => Math.abs(dim.x2 - dim.x1) + Math.abs(dim.y2 - dim.y1) > 1e-6)
})

/** Extension lines tying each margin dimension back to the feature it measures. */
const marginExtensions = computed(() => {
  const b = gridBounds.value
  if (!b) return []
  const u = unit.value
  return [
    { x1: 0, y1: 0, x2: 0, y2: -u * 4.8 },
    { x1: b.left, y1: b.top, x2: b.left, y2: -u * 4.8 },
    { x1: b.right, y1: b.top, x2: b.right, y2: -u * 4.8 },
    { x1: settings.width, y1: 0, x2: settings.width, y2: -u * 4.8 },
    { x1: 0, y1: 0, x2: -u * 4.8, y2: 0 },
    { x1: b.left, y1: b.top, x2: -u * 4.8, y2: b.top },
    { x1: b.left, y1: b.bottom, x2: -u * 4.8, y2: b.bottom },
    { x1: 0, y1: settings.height, x2: -u * 4.8, y2: settings.height },
  ]
})

/**
 * Centre-to-centre spacing: between the first pair of slots in the top row
 * (drawn on the row centreline) and between the first two rows (drawn on a
 * dimension track to the right of the board).
 */
const pitchDimensions = computed<Dimension[]>(() => {
  const b = gridBounds.value
  if (!b) return []
  const u = unit.value
  const list = slots.value
  const dims: Dimension[] = []

  const topRow = list.filter(slot => slot.y === b.top).map(slot => slot.x).sort((a, c) => a - c)
  if (topRow.length >= 2) dims.push(horizontalDim(topRow[0], topRow[1], b.top, u * 1.3, u))

  const rows = [...new Set(list.map(slot => slot.y))].sort((a, c) => a - c)
  if (rows.length >= 2) dims.push(verticalDim(rows[0], rows[1], settings.width + u * 4, -u * 1.4, u))

  return dims
})

/** Extension lines from the first two rows out to the right-hand pitch dimension. */
const pitchExtensions = computed(() => {
  const list = slots.value
  if (!list.length) return []
  const u = unit.value
  const rows = [...new Set(list.map(slot => slot.y))].sort((a, c) => a - c)
  if (rows.length < 2) return []
  return rows.slice(0, 2).map(y => ({
    x1: Math.max(...list.filter(slot => slot.y === y).map(slot => slot.x)),
    y1: y,
    x2: settings.width + u * 4.8,
    y2: y,
  }))
})

const allDimensions = computed(() => [...marginDimensions.value, ...pitchDimensions.value])
const allExtensions = computed(() => [...marginExtensions.value, ...pitchExtensions.value])

/** Dimension line segments; short spans get a pair of stubs with arrows pointing inwards. */
function dimLines(dim: Dimension) {
  const stub = unit.value * 2.4
  if (!dim.outside) {
    return [{ x1: dim.x1, y1: dim.y1, x2: dim.x2, y2: dim.y2, start: true }]
  }
  if (dim.rotate) {
    return [
      { x1: dim.x1, y1: dim.y1 - stub, x2: dim.x1, y2: dim.y1, start: false },
      { x1: dim.x2, y1: dim.y2 + stub, x2: dim.x2, y2: dim.y2, start: false },
    ]
  }
  return [
    { x1: dim.x1 - stub, y1: dim.y1, x2: dim.x1, y2: dim.y1, start: false },
    { x1: dim.x2 + stub, y1: dim.y2, x2: dim.x2, y2: dim.y2, start: false },
  ]
}

function applyPreset(width: number, height: number) {
  settings.width = width
  settings.height = height
}

function fileStem() {
  return `skadis-${settings.width}x${settings.height}`.replace(/[^a-z0-9.-]+/gi, '-')
}

function downloadSvg() {
  downloadFile(`${fileStem()}.svg`, skadisSvg(settings), 'image/svg+xml')
}

function downloadDxf() {
  downloadFile(`${fileStem()}.dxf`, skadisDxf(settings), 'application/dxf')
}
</script>

<template>
  <div class="app-container skadis-page">
    <header class="app-header">
      <h1>{{ t('skadis.title') }}</h1>
      <p class="subtitle">{{ t('skadis.subtitle') }}</p>
    </header>

    <div class="main-layout">
      <aside class="panel panel-input">
        <section class="card">
          <h2>{{ t('skadis.board') }}</h2>
          <div class="preset-grid">
            <button type="button" class="preset-button" @click="applyPreset(360, 560)">360 × 560</button>
            <button type="button" class="preset-button" @click="applyPreset(560, 560)">560 × 560</button>
            <button type="button" class="preset-button" @click="applyPreset(760, 560)">760 × 560</button>
          </div>
          <div class="form-row"><label for="skadis-width">{{ t('width_mm') }}</label><NumberField id="skadis-width" :aria-label="t('width_mm')" v-model="settings.width" :min="40" :max="3000" :step="10" /></div>
          <div class="form-row"><label for="skadis-height">{{ t('height_mm') }}</label><NumberField id="skadis-height" :aria-label="t('height_mm')" v-model="settings.height" :min="40" :max="3000" :step="10" /></div>
          <div class="form-row"><label for="skadis-radius">{{ t('skadis.corner_radius') }}</label><NumberField id="skadis-radius" :aria-label="t('skadis.corner_radius')" v-model="settings.cornerRadius" :min="0" :max="100" :step="1" /></div>
        </section>

        <section class="card">
          <h2>{{ t('skadis.grid') }}</h2>
          <div class="form-row"><label for="skadis-slot-width">{{ t('skadis.slot_width') }}</label><NumberField id="skadis-slot-width" :aria-label="t('skadis.slot_width')" v-model="settings.slotWidth" :min="1" :max="20" :step="0.1" /></div>
          <div class="form-row"><label for="skadis-slot-height">{{ t('skadis.slot_height') }}</label><NumberField id="skadis-slot-height" :aria-label="t('skadis.slot_height')" v-model="settings.slotHeight" :min="1" :max="40" :step="0.1" /></div>
          <div class="form-row"><label for="skadis-pitch">{{ t('skadis.pitch') }}</label><NumberField id="skadis-pitch" :aria-label="t('skadis.pitch')" v-model="settings.pitch" :min="10" :max="100" :step="1" /></div>
          <div class="form-row"><label for="skadis-margin">{{ t('skadis.margin') }}</label><NumberField id="skadis-margin" :aria-label="t('skadis.margin')" v-model="settings.margin" :min="0" :max="200" :step="1" /></div>
          <div class="form-row"><label for="skadis-row-offset">{{ t('skadis.row_offset') }}</label><NumberField id="skadis-row-offset" :aria-label="t('skadis.row_offset')" v-model="settings.rowOffsetPercent" :min="0" :max="100" :step="1" /></div>
          <div class="form-row"><label for="skadis-column-offset">{{ t('skadis.column_offset') }}</label><NumberField id="skadis-column-offset" :aria-label="t('skadis.column_offset')" v-model="settings.columnOffsetPercent" :min="0" :max="100" :step="1" /></div>
          <p :class="['compatibility', isStandardGrid ? 'is-compatible' : 'is-custom']">
            <span aria-hidden="true">{{ isStandardGrid ? '✓' : '!' }}</span>
            {{ isStandardGrid ? t('skadis.compatible') : t('skadis.custom_warning') }}
          </p>
        </section>
      </aside>

      <main class="panel panel-result">
        <section class="card preview-card">
          <div class="card-head">
            <h2>{{ t('skadis.preview') }}</h2>
            <div class="head-actions">
              <label class="check-row"><input type="checkbox" v-model="showDimensions"> {{ t('skadis.dimensions') }}</label>
              <span class="slot-count">{{ slots.length }} {{ t('skadis.slots') }}</span>
            </div>
          </div>
          <div class="board-preview">
            <svg
              :viewBox="`${-previewPadding} ${-previewPadding} ${settings.width + previewPadding * 2} ${settings.height + previewPadding * 2}`"
              role="img"
              :aria-label="t('skadis.preview_label')"
            >
              <rect class="board-shadow" x="3" y="5" :width="settings.width" :height="settings.height" :rx="settings.cornerRadius" />
              <rect class="board-shape" x="0" y="0" :width="settings.width" :height="settings.height" :rx="settings.cornerRadius" />
              <rect
                v-for="(slot, index) in slots"
                :key="index"
                class="board-slot"
                :x="slot.x - settings.slotWidth / 2"
                :y="slot.y - settings.slotHeight / 2"
                :width="settings.slotWidth"
                :height="settings.slotHeight"
                :rx="Math.min(settings.slotWidth, settings.slotHeight) / 2"
              />

              <g v-if="showDimensions && gridBounds" class="dim-layer">
                <defs>
                  <marker id="dim-arrow" :markerWidth="unit * 1.6" :markerHeight="unit * 1.1" :refX="unit * 1.5" :refY="unit * 0.55" orient="auto" markerUnits="userSpaceOnUse">
                    <path class="dim-arrowhead" :d="`M0,0 L${unit * 1.6},${unit * 0.55} L0,${unit * 1.1} z`" />
                  </marker>
                  <marker id="dim-arrow-start" :markerWidth="unit * 1.6" :markerHeight="unit * 1.1" :refX="unit * 0.1" :refY="unit * 0.55" orient="auto" markerUnits="userSpaceOnUse">
                    <path class="dim-arrowhead" :d="`M${unit * 1.6},0 L0,${unit * 0.55} L${unit * 1.6},${unit * 1.1} z`" />
                  </marker>
                </defs>

                <rect
                  class="dim-margin-box"
                  :x="gridBounds.left"
                  :y="gridBounds.top"
                  :width="gridBounds.right - gridBounds.left"
                  :height="gridBounds.bottom - gridBounds.top"
                  :stroke-width="unit * 0.28"
                  :stroke-dasharray="`${unit * 1.4} ${unit}`"
                />

                <line
                  v-for="(line, index) in allExtensions"
                  :key="`ext-${index}`"
                  class="dim-extension"
                  :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"
                  :stroke-width="unit * 0.18"
                />

                <g v-for="(dim, index) in allDimensions" :key="`dim-${index}`">
                  <line
                    v-for="(line, part) in dimLines(dim)"
                    :key="part"
                    class="dim-line"
                    :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"
                    :stroke-width="unit * 0.22"
                    :marker-start="line.start ? 'url(#dim-arrow-start)' : undefined"
                    marker-end="url(#dim-arrow)"
                  />
                  <text
                    class="dim-label"
                    :x="dim.labelX"
                    :y="dim.labelY"
                    :font-size="unit * 2.6"
                    :transform="dim.rotate ? `rotate(-90 ${dim.labelX} ${dim.labelY})` : undefined"
                  >{{ dim.label }}</text>
                </g>
              </g>
            </svg>
          </div>
          <div class="board-stats">
            <div><span>{{ t('skadis.size') }}</span><strong>{{ settings.width }} × {{ settings.height }} mm</strong></div>
            <div><span>{{ t('skadis.area') }}</span><strong>{{ boardArea }} m²</strong></div>
            <div><span>{{ t('skadis.slot_size') }}</span><strong>{{ settings.slotWidth }} × {{ settings.slotHeight }} mm</strong></div>
          </div>
        </section>

        <section class="card export-card">
          <div>
            <h2>{{ t('skadis.export') }}</h2>
            <p>{{ t('skadis.export_hint') }}</p>
          </div>
          <div class="export-actions">
            <button type="button" class="btn-primary" @click="downloadSvg">↓ SVG</button>
            <button type="button" class="btn-dl export-dxf" @click="downloadDxf">↓ DXF</button>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.preset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 14px; }
.preset-button { padding: 7px 4px; border: 1px solid var(--border-input); border-radius: 6px; background: var(--input-bg); color: var(--text); cursor: pointer; font-size: .75rem; }
.preset-button:hover { border-color: var(--accent); }
.check-row { display: flex; align-items: center; gap: 9px; margin-top: 12px; color: var(--text); font-size: .84rem; cursor: pointer; }
.check-row input { accent-color: var(--accent); width: 16px; height: 16px; }
.compatibility { display: flex; gap: 8px; align-items: flex-start; margin-top: 14px; padding: 9px 10px; border-radius: 6px; font-size: .78rem; line-height: 1.4; }
.compatibility span { display: grid; place-items: center; flex: 0 0 18px; height: 18px; border-radius: 50%; font-weight: 800; }
.is-compatible { color: var(--eff-good-tx); background: var(--eff-good-bg); }
.is-compatible span { border: 1px solid currentColor; }
.is-custom { color: var(--alert-warn-tx); background: var(--alert-warn-bg); border: 1px solid var(--alert-warn-bd); }
.is-custom span { border: 1px solid currentColor; }
.preview-card { min-height: 560px; }
.slot-count { color: var(--accent); font-size: .8rem; font-weight: 600; }
.board-preview { height: min(62vh, 610px); min-height: 390px; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: var(--svg-bg); }
.board-preview svg { width: 100%; height: 100%; padding: 20px; }
.board-shadow { fill: rgba(0,0,0,.28); }
.board-shape { fill: var(--piece-bg); stroke: var(--heading); stroke-width: 1.5; }
.board-slot { fill: var(--bg); stroke: var(--border-input); stroke-width: .35; }
.head-actions { display: flex; align-items: center; gap: 14px; }
.head-actions .check-row { margin-top: 0; font-size: .78rem; color: var(--muted); white-space: nowrap; }
.head-actions .check-row input { width: 14px; height: 14px; }
.dim-layer { --dim: #e8842a; }
.dim-arrowhead { fill: var(--dim); }
.dim-margin-box { fill: none; stroke: var(--dim); }
.dim-extension { stroke: var(--dim); opacity: .55; }
.dim-line { stroke: var(--dim); }
.dim-label { fill: var(--dim); text-anchor: middle; font-weight: 600; paint-order: stroke; stroke: var(--svg-bg); stroke-width: .3em; stroke-linejoin: round; }
.board-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
.board-stats div { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 7px; background: var(--input-bg); }
.board-stats span { color: var(--muted); font-size: .72rem; }
.board-stats strong { color: var(--text); font-size: .86rem; }
.export-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.export-card h2 { margin-bottom: 5px; }
.export-card p { color: var(--muted); font-size: .8rem; line-height: 1.45; }
.export-actions { display: flex; gap: 8px; flex-shrink: 0; }
.export-dxf { padding: 8px 16px; font-size: .82rem; }
@media (max-width: 620px) {
  .board-stats { grid-template-columns: 1fr; }
  .export-card { align-items: stretch; flex-direction: column; }
  .export-actions > button { flex: 1; }
  .board-preview { min-height: 320px; height: 55vh; }
}
</style>

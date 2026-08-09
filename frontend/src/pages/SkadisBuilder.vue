<script setup lang="ts">
import { computed, reactive } from 'vue'
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
  staggered: true,
})

const slots = computed(() => skadisSlots(settings))
const isStandardGrid = computed(() => settings.slotWidth === 5 && settings.slotHeight === 15 && settings.pitch === 40 && settings.staggered)
const boardArea = computed(() => (settings.width * settings.height / 1_000_000).toFixed(3))
const previewPadding = computed(() => Math.max(settings.width, settings.height) * 0.025)

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
          <label class="check-row">
            <input v-model="settings.staggered" type="checkbox" />
            <span>{{ t('skadis.staggered') }}</span>
          </label>
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
            <span class="slot-count">{{ slots.length }} {{ t('skadis.slots') }}</span>
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

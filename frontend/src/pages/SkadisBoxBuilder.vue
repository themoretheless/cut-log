<script setup lang="ts">
import { computed, reactive } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { downloadFile } from '@/lib/downloadFile'
import { useL10n } from '@/stores/l10n'
import { pointsToPath, skadisBox, skadisBoxDxf, skadisBoxLayout, skadisBoxSvg, type SkadisBoxSettings } from '@/skadis/box'

const { t } = useL10n()

const settings = reactive<SkadisBoxSettings>({
  slotSpan: 2,
  height: 80,
  depth: 60,
  thickness: 4,
  kerf: 0.1,
  tabSize: 10,
  hookRows: 1,
  hookTop: 3,
  neckHeight: 8,
  lipRise: 5,
  lipDepth: 4,
  clearance: 0.5,
  boardThickness: 5,
  slotWidth: 5,
  slotHeight: 15,
  pitch: 40,
})

const model = computed(() => skadisBox(settings))
const layout = computed(() => skadisBoxLayout(model.value))
const padding = computed(() => Math.max(layout.value.width, layout.value.height, 1) * 0.04)
const labelSize = computed(() => Math.max(layout.value.width, layout.value.height, 1) / 42)

function fileStem() {
  return `skadis-box-${model.value.outerWidth}x${settings.height}x${settings.depth}`.replace(/[^a-z0-9.-]+/gi, '-')
}

function downloadSvg() {
  downloadFile(`${fileStem()}.svg`, skadisBoxSvg(settings), 'image/svg+xml')
}

function downloadDxf() {
  downloadFile(`${fileStem()}.dxf`, skadisBoxDxf(settings), 'application/dxf')
}
</script>

<template>
  <div class="app-container skadis-box-page">
    <header class="app-header">
      <h1>{{ t('skadisbox.title') }}</h1>
      <p class="subtitle">{{ t('skadisbox.subtitle') }}</p>
    </header>

    <div class="main-layout">
      <aside class="panel panel-input">
        <section class="card">
          <h2>{{ t('skadisbox.box') }}</h2>
          <div class="form-row"><label for="sb-span">{{ t('skadisbox.slot_span') }}</label><NumberField id="sb-span" :aria-label="t('skadisbox.slot_span')" v-model="settings.slotSpan" :min="1" :max="12" :step="1" /></div>
          <p class="derived">{{ t('skadisbox.outer_width') }}: <strong>{{ model.outerWidth }} mm</strong></p>
          <div class="form-row"><label for="sb-height">{{ t('skadisbox.height') }}</label><NumberField id="sb-height" :aria-label="t('skadisbox.height')" v-model="settings.height" :min="20" :max="600" :step="5" /></div>
          <div class="form-row"><label for="sb-depth">{{ t('skadisbox.depth') }}</label><NumberField id="sb-depth" :aria-label="t('skadisbox.depth')" v-model="settings.depth" :min="20" :max="400" :step="5" /></div>
        </section>

        <section class="card">
          <h2>{{ t('skadisbox.material') }}</h2>
          <div class="form-row"><label for="sb-thickness">{{ t('skadisbox.thickness') }}</label><NumberField id="sb-thickness" :aria-label="t('skadisbox.thickness')" v-model="settings.thickness" :min="1" :max="12" :step="0.1" /></div>
          <div class="form-row"><label for="sb-kerf">{{ t('skadisbox.kerf') }}</label><NumberField id="sb-kerf" :aria-label="t('skadisbox.kerf')" v-model="settings.kerf" :min="0" :max="1" :step="0.05" /></div>
          <div class="form-row"><label for="sb-tab">{{ t('skadisbox.tab_size') }}</label><NumberField id="sb-tab" :aria-label="t('skadisbox.tab_size')" v-model="settings.tabSize" :min="3" :max="60" :step="1" /></div>
        </section>

        <section class="card">
          <h2>{{ t('skadisbox.hooks') }}</h2>
          <div class="form-row"><label for="sb-hook-rows">{{ t('skadisbox.hook_rows') }}</label><NumberField id="sb-hook-rows" :aria-label="t('skadisbox.hook_rows')" v-model="settings.hookRows" :min="1" :max="4" :step="1" /></div>
          <div class="form-row"><label for="sb-hook-top">{{ t('skadisbox.hook_top') }}</label><NumberField id="sb-hook-top" :aria-label="t('skadisbox.hook_top')" v-model="settings.hookTop" :min="0" :max="60" :step="1" /></div>
          <div class="form-row"><label for="sb-neck">{{ t('skadisbox.neck_height') }}</label><NumberField id="sb-neck" :aria-label="t('skadisbox.neck_height')" v-model="settings.neckHeight" :min="2" :max="30" :step="0.5" /></div>
          <div class="form-row"><label for="sb-lip-rise">{{ t('skadisbox.lip_rise') }}</label><NumberField id="sb-lip-rise" :aria-label="t('skadisbox.lip_rise')" v-model="settings.lipRise" :min="0" :max="30" :step="0.5" /></div>
          <div class="form-row"><label for="sb-lip-depth">{{ t('skadisbox.lip_depth') }}</label><NumberField id="sb-lip-depth" :aria-label="t('skadisbox.lip_depth')" v-model="settings.lipDepth" :min="1" :max="20" :step="0.5" /></div>
          <div class="form-row"><label for="sb-clearance">{{ t('skadisbox.clearance') }}</label><NumberField id="sb-clearance" :aria-label="t('skadisbox.clearance')" v-model="settings.clearance" :min="0" :max="3" :step="0.1" /></div>
          <p class="hint">{{ t('skadisbox.hook_rows_hint') }}</p>
        </section>

        <section class="card">
          <h2>{{ t('skadisbox.board') }}</h2>
          <div class="form-row"><label for="sb-board-t">{{ t('skadisbox.board_thickness') }}</label><NumberField id="sb-board-t" :aria-label="t('skadisbox.board_thickness')" v-model="settings.boardThickness" :min="1" :max="20" :step="0.5" /></div>
          <div class="form-row"><label for="sb-slot-w">{{ t('skadis.slot_width') }}</label><NumberField id="sb-slot-w" :aria-label="t('skadis.slot_width')" v-model="settings.slotWidth" :min="1" :max="20" :step="0.1" /></div>
          <div class="form-row"><label for="sb-slot-h">{{ t('skadis.slot_height') }}</label><NumberField id="sb-slot-h" :aria-label="t('skadis.slot_height')" v-model="settings.slotHeight" :min="1" :max="40" :step="0.1" /></div>
          <div class="form-row"><label for="sb-pitch">{{ t('skadis.pitch') }}</label><NumberField id="sb-pitch" :aria-label="t('skadis.pitch')" v-model="settings.pitch" :min="10" :max="100" :step="1" /></div>
        </section>
      </aside>

      <main class="panel panel-result">
        <section class="card preview-card">
          <div class="card-head">
            <h2>{{ t('skadisbox.preview') }}</h2>
            <span class="panel-count">{{ model.panels.length }} × {{ t('pieces_short') }}</span>
          </div>

          <ul v-if="model.warnings.length" class="warnings" role="alert">
            <li v-for="warning in model.warnings" :key="warning">{{ t(`skadisbox.warn.${warning}`) }}</li>
          </ul>

          <div class="layout-preview">
            <svg
              v-if="layout.placed.length"
              :viewBox="`${-padding} ${-padding} ${layout.width + padding * 2} ${layout.height + padding * 2}`"
              role="img"
              :aria-label="t('skadisbox.preview_label')"
            >
              <g v-for="panel in layout.placed" :key="panel.id" :transform="`translate(${panel.x} ${panel.y})`">
                <path class="panel-shape" :d="pointsToPath(panel.points)" />
                <text class="panel-label" :x="panel.width / 2" :y="panel.height / 2" :font-size="labelSize">{{ t(`skadisbox.panel.${panel.id}`) }}</text>
                <text class="panel-size" :x="panel.width / 2" :y="panel.height / 2 + labelSize * 1.3" :font-size="labelSize * 0.75">{{ panel.width }} × {{ panel.height }}</text>
              </g>
            </svg>
          </div>

          <div class="box-stats">
            <div><span>{{ t('skadisbox.size') }}</span><strong>{{ model.outerWidth }} × {{ settings.height }} × {{ settings.depth }} mm</strong></div>
            <div><span>{{ t('skadisbox.hook_spacing') }}</span><strong>{{ model.hookSpacing }} mm</strong></div>
            <div><span>{{ t('skadisbox.sheet') }}</span><strong>{{ layout.width }} × {{ layout.height }} mm</strong></div>
          </div>
        </section>

        <section class="card export-card">
          <div>
            <h2>{{ t('skadisbox.export') }}</h2>
            <p>{{ t('skadisbox.export_hint') }}</p>
          </div>
          <div class="export-actions">
            <button type="button" class="btn-primary" :disabled="!layout.placed.length" @click="downloadSvg">↓ SVG</button>
            <button type="button" class="btn-dl export-dxf" :disabled="!layout.placed.length" @click="downloadDxf">↓ DXF</button>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.derived { margin: -4px 0 10px; color: var(--muted); font-size: .78rem; }
.derived strong { color: var(--text); }
.hint { margin-top: 10px; color: var(--muted); font-size: .76rem; line-height: 1.4; }
.preview-card { min-height: 520px; }
.panel-count { color: var(--accent); font-size: .8rem; font-weight: 600; }
.warnings { margin: 0 0 12px; padding: 10px 12px 10px 28px; border-radius: 6px; color: var(--alert-warn-tx); background: var(--alert-warn-bg); border: 1px solid var(--alert-warn-bd); font-size: .8rem; line-height: 1.45; }
.layout-preview { height: min(58vh, 560px); min-height: 340px; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: var(--svg-bg); }
.layout-preview svg { width: 100%; height: 100%; padding: 16px; }
.panel-shape { fill: var(--piece-bg); stroke: var(--heading); stroke-width: .6; stroke-linejoin: miter; }
.panel-label, .panel-size { fill: var(--text); text-anchor: middle; dominant-baseline: middle; font-weight: 600; pointer-events: none; }
.panel-size { fill: var(--muted); font-weight: 500; }
.box-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
.box-stats div { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 7px; background: var(--input-bg); }
.box-stats span { color: var(--muted); font-size: .72rem; }
.box-stats strong { color: var(--text); font-size: .86rem; }
.export-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.export-card h2 { margin-bottom: 5px; }
.export-card p { color: var(--muted); font-size: .8rem; line-height: 1.45; }
.export-actions { display: flex; gap: 8px; flex-shrink: 0; }
.export-dxf { padding: 8px 16px; font-size: .82rem; }
@media (max-width: 620px) {
  .box-stats { grid-template-columns: 1fr; }
  .export-card { align-items: stretch; flex-direction: column; }
  .export-actions > button { flex: 1; }
  .layout-preview { min-height: 300px; height: 50vh; }
}
</style>

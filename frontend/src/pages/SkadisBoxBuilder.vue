<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { downloadFile } from '@/lib/downloadFile'
import { useL10n } from '@/stores/l10n'
import { skadisBox, skadisBoxStl, skadisBoxVariants, type SkadisBoxSettings, type SkadisBoxVariant } from '@/skadis/box'
import { useSkadisScene } from '@/skadis/three/useSkadisScene'

const { t } = useL10n()

const settings = reactive<SkadisBoxSettings>({
  ...skadisBoxVariants.tray as Required<Pick<SkadisBoxSettings, 'width' | 'height' | 'depth' | 'frontHeight' | 'dividers'>>,
  wall: 2,
  floor: 2,
  hookWidth: 4.4,
  hookEveryColumn: false,
  hookRows: 1,
  hookTop: 3,
  neckHeight: 8,
  lipRise: 5,
  lipDepth: 4,
  clearance: 0.4,
  boardThickness: 5,
  slotWidth: 5,
  slotHeight: 15,
  pitch: 40,
})

const variants = Object.keys(skadisBoxVariants) as SkadisBoxVariant[]
const activeVariant = computed<SkadisBoxVariant | null>(() =>
  variants.find(id => Object.entries(skadisBoxVariants[id]).every(([key, value]) => settings[key as keyof SkadisBoxSettings] === value)) ?? null,
)

function applyVariant(id: SkadisBoxVariant) {
  Object.assign(settings, skadisBoxVariants[id])
  resetView.value = true
}

const model = computed(() => skadisBox(settings))
const volumeCm3 = computed(() => (model.value.volume / 1000).toFixed(1))
const partCount = computed(() => model.value.parts.length)

const viewer = ref<HTMLElement | null>(null)
const scene = useSkadisScene()
const resetView = ref(true)

onMounted(() => {
  if (viewer.value) scene.init(viewer.value)
  scene.update(model.value, settings, true)
  resetView.value = false
})

watch(model, next => {
  scene.update(next, settings, resetView.value)
  resetView.value = false
})

onBeforeUnmount(() => scene.dispose())

function resetCamera() {
  scene.update(model.value, settings, true)
}

function fileStem() {
  return `skadis-box-${settings.width}x${settings.height}x${settings.depth}`.replace(/[^a-z0-9.-]+/gi, '-')
}

function downloadStl() {
  downloadFile(`${fileStem()}.stl`, skadisBoxStl(settings), 'model/stl')
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
          <h2>{{ t('skadisbox.variants') }}</h2>
          <div class="variant-grid">
            <button
              v-for="id in variants"
              :key="id"
              type="button"
              :class="['variant-button', { active: activeVariant === id }]"
              :aria-pressed="activeVariant === id"
              @click="applyVariant(id)"
            >{{ t(`skadisbox.variant.${id}`) }}</button>
          </div>
        </section>

        <section class="card">
          <h2>{{ t('skadisbox.box') }}</h2>
          <div class="form-row"><label for="sb-width">{{ t('skadisbox.width') }}</label><NumberField id="sb-width" :aria-label="t('skadisbox.width')" v-model="settings.width" :min="10" :max="400" :step="1" /></div>
          <div class="form-row"><label for="sb-height">{{ t('skadisbox.height') }}</label><NumberField id="sb-height" :aria-label="t('skadisbox.height')" v-model="settings.height" :min="10" :max="300" :step="5" /></div>
          <div class="form-row"><label for="sb-depth">{{ t('skadisbox.depth') }}</label><NumberField id="sb-depth" :aria-label="t('skadisbox.depth')" v-model="settings.depth" :min="10" :max="200" :step="5" /></div>
          <div class="form-row"><label for="sb-front">{{ t('skadisbox.front_height') }}</label><NumberField id="sb-front" :aria-label="t('skadisbox.front_height')" v-model="settings.frontHeight" :min="0" :max="300" :step="5" /></div>
          <div class="form-row"><label for="sb-dividers">{{ t('skadisbox.dividers') }}</label><NumberField id="sb-dividers" :aria-label="t('skadisbox.dividers')" v-model="settings.dividers" :min="0" :max="12" :step="1" /></div>
        </section>

        <section class="card">
          <h2>{{ t('skadisbox.material') }}</h2>
          <div class="form-row"><label for="sb-wall">{{ t('skadisbox.wall') }}</label><NumberField id="sb-wall" :aria-label="t('skadisbox.wall')" v-model="settings.wall" :min="0.8" :max="10" :step="0.2" /></div>
          <div class="form-row"><label for="sb-floor">{{ t('skadisbox.floor') }}</label><NumberField id="sb-floor" :aria-label="t('skadisbox.floor')" v-model="settings.floor" :min="0.8" :max="10" :step="0.2" /></div>
        </section>

        <section class="card">
          <h2>{{ t('skadisbox.hooks') }}</h2>
          <div class="form-row"><label for="sb-hook-width">{{ t('skadisbox.hook_width') }}</label><NumberField id="sb-hook-width" :aria-label="t('skadisbox.hook_width')" v-model="settings.hookWidth" :min="1" :max="10" :step="0.1" /></div>
          <label class="check-row"><input type="checkbox" v-model="settings.hookEveryColumn"> {{ t('skadisbox.hook_every_column') }}</label>
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
            <div class="head-actions">
              <button type="button" class="btn-dl" @click="resetCamera">{{ t('skadisbox.reset_view') }}</button>
              <span class="part-count">{{ partCount }} × {{ t('pieces_short') }}</span>
            </div>
          </div>

          <ul v-if="model.warnings.length" class="warnings" role="alert">
            <li v-for="warning in model.warnings" :key="warning">{{ t(`skadisbox.warn.${warning}`) }}</li>
          </ul>

          <div ref="viewer" class="viewer" role="img" :aria-label="t('skadisbox.preview_label')"></div>

          <div class="box-stats">
            <div><span>{{ t('skadisbox.size') }}</span><strong>{{ settings.width }} × {{ settings.height }} × {{ model.totalDepth }} mm</strong></div>
            <div><span>{{ t('skadisbox.hook_columns') }}</span><strong>{{ model.hookColumns.length }} × {{ model.hookRows.length }}</strong></div>
            <div><span>{{ t('skadisbox.volume') }}</span><strong>{{ volumeCm3 }} cm³</strong></div>
          </div>
        </section>

        <section class="card export-card">
          <div>
            <h2>{{ t('skadisbox.export') }}</h2>
            <p>{{ t('skadisbox.export_hint') }}</p>
          </div>
          <div class="export-actions">
            <button type="button" class="btn-primary" :disabled="!partCount" @click="downloadStl">↓ STL</button>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.variant-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.variant-button { padding: 7px 4px; border: 1px solid var(--border-input); border-radius: 6px; background: var(--input-bg); color: var(--text); cursor: pointer; font-size: .75rem; }
.variant-button:hover { border-color: var(--accent); }
.variant-button.active { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.check-row { display: flex; align-items: center; gap: 9px; margin: 4px 0 12px; color: var(--text); font-size: .84rem; cursor: pointer; }
.check-row input { accent-color: var(--accent); width: 16px; height: 16px; }
.hint { margin-top: 10px; color: var(--muted); font-size: .76rem; line-height: 1.4; }
.preview-card { min-height: 520px; }
.head-actions { display: flex; align-items: center; gap: 12px; }
.part-count { color: var(--accent); font-size: .8rem; font-weight: 600; }
.warnings { margin: 0 0 12px; padding: 10px 12px 10px 28px; border-radius: 6px; color: var(--alert-warn-tx); background: var(--alert-warn-bg); border: 1px solid var(--alert-warn-bd); font-size: .8rem; line-height: 1.45; }
.viewer { height: min(58vh, 560px); min-height: 340px; overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: #1e1e2e; }
.viewer :deep(canvas) { display: block; width: 100% !important; height: 100% !important; }
.box-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
.box-stats div { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 7px; background: var(--input-bg); }
.box-stats span { color: var(--muted); font-size: .72rem; }
.box-stats strong { color: var(--text); font-size: .86rem; }
.export-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.export-card h2 { margin-bottom: 5px; }
.export-card p { color: var(--muted); font-size: .8rem; line-height: 1.45; }
.export-actions { display: flex; gap: 8px; flex-shrink: 0; }
@media (max-width: 620px) {
  .box-stats { grid-template-columns: 1fr; }
  .export-card { align-items: stretch; flex-direction: column; }
  .export-actions > button { flex: 1; }
  .viewer { min-height: 300px; height: 50vh; }
}
</style>

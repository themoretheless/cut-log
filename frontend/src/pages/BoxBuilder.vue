<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { useL10n } from '@/stores/l10n'
import { wrapCutSvg } from '@/box/geometry'
import { downloadFile } from '@/lib/downloadFile'
import { useBoxModel } from '@/box/useBoxModel'
import { useAssemblyScene } from '@/box/three/useAssemblyScene'
import { usePieceGallery } from '@/box/three/usePieceGallery'

const { t } = useL10n()

const boxLabels = computed(() => ({
  sideShort: t('box.side_short'),
  topShort: t('box.top_short'),
  bottomShort: t('box.bottom_short'),
  backShort: t('box.back_short'),
  shelfShort: t('box.shelf_short'),
  sideWall: t('box.side_wall'),
  topBottomWall: t('box.top_bottom_wall'),
  backWall: t('box.back_wall'),
  shelf: t('box.shelf'),
}))

const model = useBoxModel(boxLabels)
const {
  W, H, D, T, Kerf, TabH, NTab, NShelves, Bevel, BackInset, SheetW, SheetH, CutGap, galIdx, paramLimits,
  Wi, Hi, SideOW, TopD, BotD,
  shelfSlotYs, shelfDepthAt,
  cuttingSheets, cutStats, cutScale, tooBigPieces,
  galPieces, getCutSheetTransform, getCutSheetPath,
} = model

const assembly = useAssemblyScene(model, boxLabels)
const { isoExplode } = assembly
const gallery = usePieceGallery(model)

// ── Gallery navigation ───────────────────────────────────────────────────────
function galPrev() { galIdx.value = (galIdx.value - 1 + galPieces.value.length) % galPieces.value.length }
function galNext() { galIdx.value = (galIdx.value + 1) % galPieces.value.length }

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'ArrowLeft') { e.preventDefault(); galPrev() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); galNext() }
  else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); galDlSvg() }
  else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); gallery.resetView() }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  assembly.init('box3d-container')
  assembly.update()
  gallery.init('piece3d-container')
  gallery.update()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  assembly.dispose()
  gallery.dispose()
})

watch(
  [W, H, D, T, Kerf, TabH, NTab, NShelves, Bevel, BackInset],
  () => { assembly.update(); gallery.update() },
  { flush: 'post' },
)

watch(galIdx, () => { assembly.update(); gallery.update(true) }, { flush: 'post' })
watch(boxLabels, () => { assembly.update() }, { flush: 'post' })

// ── Download helpers ────────────────────────────────────────────────────────
function galDlSvg() {
  const p = galPieces.value[galIdx.value]
  if (!p) return
  downloadFile(`${p.id}.svg`, wrapCutSvg(p.d, p.pw, p.ph, p.xOff), 'image/svg+xml')
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>{{ t('box.title') }}</h1>
      <p class="subtitle">{{ t('box.subtitle') }}</p>
    </header>

    <div class="hotkey-bar">
      <span><kbd>&larr;</kbd><kbd>&rarr;</kbd> {{ t('box.hotkey.nav') }}</span>
      <span><kbd>D</kbd> {{ t('box.hotkey.download') }}</span>
      <span><kbd>R</kbd> {{ t('box.hotkey.reset') }}</span>
    </div>

    <div class="main-layout">
      <aside class="panel panel-input">
        <section class="card">
          <h2>{{ t('sheet_params') }}</h2>
          <div class="form-row"><label for="box-width">{{ t('box.outer_width') }}</label><NumberField id="box-width" :aria-label="t('box.outer_width')" v-model="W" :min="50" :step="10" /></div>
          <div class="form-row"><label for="box-height">{{ t('box.height') }}</label><NumberField id="box-height" :aria-label="t('box.height')" v-model="H" :min="50" :step="10" /></div>
          <div class="form-row"><label for="box-depth">{{ t('box.depth') }}</label><NumberField id="box-depth" :aria-label="t('box.depth')" v-model="D" :min="50" :step="10" /></div>
          <div class="form-row"><label for="box-bevel">{{ t('box.bevel') }}</label><NumberField id="box-bevel" :aria-label="t('box.bevel')" v-model="Bevel" :min="-paramLimits.maxAbsBevel" :max="paramLimits.maxAbsBevel" :step="5" /></div>
          <div class="form-row"><label for="box-back-inset">{{ t('box.back_inset') }}</label><NumberField id="box-back-inset" :aria-label="t('box.back_inset')" v-model="BackInset" :min="0" :max="paramLimits.maxBackInset" :step="1" /></div>
        </section>
        <section class="card">
          <h2>{{ t('box.material') }}</h2>
          <div class="form-row"><label for="box-thickness">{{ t('box.thickness') }}</label><NumberField id="box-thickness" :aria-label="t('box.thickness')" v-model="T" :min="1" :max="paramLimits.maxThickness" :step="0.5" /></div>
          <div class="form-row"><label for="box-kerf">{{ t('box.kerf') }}</label><NumberField id="box-kerf" :aria-label="t('box.kerf')" v-model="Kerf" :min="0" :max="paramLimits.maxKerf" :step="0.05" /></div>
          <div class="form-row"><label for="box-tab-size">{{ t('box.tab_size') }}</label><NumberField id="box-tab-size" :aria-label="t('box.tab_size')" v-model="TabH" :min="1" :max="paramLimits.maxTabSize" :step="5" /></div>
          <div class="form-row"><label for="box-tab-count">{{ t('box.tabs_per_edge') }}</label><NumberField id="box-tab-count" :aria-label="t('box.tabs_per_edge')" v-model="NTab" :min="1" :max="paramLimits.maxTabs" :step="1" /></div>
          <div class="form-row"><label for="box-shelves">{{ t('box.shelves') }}</label><NumberField id="box-shelves" :aria-label="t('box.shelves')" v-model="NShelves" :min="0" :max="paramLimits.maxShelves" :step="1" /></div>
        </section>
        <section class="card shelf-summary">
          <h2>{{ t('box.parts') }}</h2>
          <div class="shelf-part-row"><span>{{ t('box.sides') }}</span><span>2 &times; {{ SideOW.toFixed(0) }}&times;{{ H.toFixed(0) }} mm</span></div>
          <div v-if="Bevel === 0" class="shelf-part-row"><span>{{ t('box.top_bottom') }}</span><span>2 &times; {{ W.toFixed(0) }}&times;{{ D.toFixed(0) }} mm</span></div>
          <div v-else class="shelf-part-row"><span>{{ t('box.top_short') }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ TopD.toFixed(0) }} mm</span></div>
          <div v-if="Bevel !== 0" class="shelf-part-row"><span>{{ t('box.bottom_short') }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ BotD.toFixed(0) }} mm</span></div>
          <div class="shelf-part-row"><span>{{ t('box.back') }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ H.toFixed(0) }} mm</span></div>
          <template v-if="NShelves > 0 && Bevel === 0">
            <div class="shelf-part-row"><span>{{ t('box.shelf') }}</span><span>{{ NShelves }} &times; {{ W.toFixed(0) }}&times;{{ (D - BackInset).toFixed(0) }} mm</span></div>
          </template>
          <template v-else-if="NShelves > 0">
            <div v-for="(sy, i) in shelfSlotYs()" :key="i" class="shelf-part-row"><span>{{ t('box.shelf_short') }}{{ i + 1 }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ shelfDepthAt(sy).toFixed(0) }} mm</span></div>
          </template>
          <div class="shelf-part-row shelf-total"><span>{{ t('box.total') }}</span><span>{{ 5 + NShelves }} {{ t('box.pcs') }}</span></div>
        </section>
        <section class="card">
          <h2>{{ t('box.sheet_title') }}</h2>
          <div class="form-row"><label for="box-sheet-width">{{ t('box.sheet_width') }}</label><NumberField id="box-sheet-width" :aria-label="t('box.sheet_width')" v-model="SheetW" :min="300" :step="10" /></div>
          <div class="form-row"><label for="box-sheet-height">{{ t('box.sheet_height') }}</label><NumberField id="box-sheet-height" :aria-label="t('box.sheet_height')" v-model="SheetH" :min="300" :step="10" /></div>
          <div class="form-row"><label for="box-sheet-gap">{{ t('box.gap') }}</label><NumberField id="box-sheet-gap" :aria-label="t('box.gap')" v-model="CutGap" :min="1" :step="1" /></div>
        </section>
        <section class="card">
          <h2>{{ t('box.assembly') }}</h2>
          <p style="font-size:0.82rem;color:var(--muted);line-height:1.5">
            {{ t('box.inner') }}
            <strong>{{ Wi.toFixed(0) }}&times;{{ Hi.toFixed(0) }}&times;{{ (D - T - BackInset).toFixed(0) }} mm</strong>
          </p>
        </section>
      </aside>

      <main class="panel panel-result">
        <!-- Pieces gallery + 3D -->
        <section class="card gallery">
          <div class="piece3d-wrap">
            <button class="piece3d-nav piece3d-prev" @click="galPrev">&lsaquo;</button>
            <div id="piece3d-container" role="img" :aria-label="t('box.gallery_3d_label')" style="width:100%;height:350px;border-radius:8px;overflow:hidden;"></div>
            <button class="piece3d-nav piece3d-next" @click="galNext">&rsaquo;</button>
            <button class="piece3d-nav piece3d-reset" @click="gallery.resetView()" title="Reset view">&#x21ba;</button>
          </div>
          <div class="gallery-3d-bar">
            <span class="gallery-sel-title">{{ galPieces[galIdx]?.title }} <small>({{ galPieces[galIdx]?.count }} {{ t('box.pcs') }}, {{ galPieces[galIdx]?.pw.toFixed(0) }}&times;{{ galPieces[galIdx]?.ph.toFixed(0) }} mm)</small></span>
            <button class="btn-dl" @click="galDlSvg">&#x2193; SVG</button>
          </div>
          <div class="gallery-thumbs">
            <button
              v-for="(p, i) in galPieces" :key="p.id"
              type="button"
              :class="['gallery-thumb', i === galIdx && 'active']"
              :aria-pressed="i === galIdx"
              :aria-label="`${p.title}, ${p.count} ${t('box.pcs')}`"
              @click="galIdx = i"
            >
              <svg
                :width="p.pw * p.s + 6"
                :height="p.ph * p.s + 6"
                :viewBox="`-3 -3 ${p.pw * p.s + 6} ${p.ph * p.s + 6}`"
              >
                <g :transform="`translate(${(p.xOff * p.s).toFixed(4)}, 0) scale(${p.s.toFixed(4)})`">
                  <path :d="p.d" :fill="p.color" fill-opacity="0.4" fill-rule="evenodd" stroke="var(--laser-cut)" :stroke-width="(2 / p.s).toFixed(1)" stroke-linejoin="miter" />
                </g>
              </svg>
              <span class="gallery-thumb-label">{{ p.title }}</span>
              <span class="gallery-thumb-info">{{ p.count }} {{ t('box.pcs') }}</span>
            </button>
          </div>
        </section>

        <!-- 3D Assembly -->
        <section class="card">
          <h2>{{ t('box.assembly_3d') }}</h2>
          <div class="iso-controls">
            <label for="box-explode">{{ t('box.explode') }}</label>
            <input id="box-explode" type="range" min="0" max="0.5" step="0.01" v-model.number="isoExplode" style="flex:1" />
          </div>
          <div id="box3d-container" role="img" :aria-label="t('box.assembly_3d_label')" style="width:100%;height:450px;border-radius:8px;overflow:hidden;"></div>
        </section>

        <!-- Cutting layout -->
        <section class="card">
          <h2>{{ t('box.cutting_layout') }}</h2>

          <div v-if="tooBigPieces.length > 0" class="cut-warning">
            {{ t('box.too_big') }} ({{ SheetW.toFixed(0) }}&times;{{ SheetH.toFixed(0) }} mm):
            {{ tooBigPieces.map(p => `${p.label} (${p.w.toFixed(0)}×${p.h.toFixed(0)})`).join(', ') }}
          </div>

          <div class="cut-stats">
            {{ t('box.stats')
              .replace('{0}', String(cutStats.sheets))
              .replace('{1}', cutStats.pieceArea)
              .replace('{2}', cutStats.sheetArea)
              .replace('{3}', cutStats.util) }}
          </div>

          <div class="cut-sheets-wrap">
            <div v-for="(sheetPieces, sheetIdx) in cuttingSheets" :key="sheetIdx" class="cut-sheet">
              <div class="cut-sheet-title">
                {{ t('box.sheet_label') }} {{ sheetIdx + 1 }} &mdash; {{ SheetW.toFixed(0) }}&times;{{ SheetH.toFixed(0) }} mm
              </div>
              <svg
                :width="(SheetW * cutScale).toFixed(0)"
                :height="(SheetH * cutScale).toFixed(0)"
                :viewBox="`0 0 ${SheetW.toFixed(1)} ${SheetH.toFixed(1)}`"
                style="display:block;"
                role="img"
                :aria-label="`${t('box.cut_sheet_label')} ${sheetIdx + 1}`"
              >
                <title>{{ t('box.cut_sheet_label') }} {{ sheetIdx + 1 }}</title>
                <rect x="0" y="0" :width="SheetW.toFixed(1)" :height="SheetH.toFixed(1)" fill="var(--laser-sheet-bg)" stroke="var(--laser-sheet-border)" :stroke-width="(1 / cutScale).toFixed(2)" />
                <template v-for="(p, pi) in sheetPieces" :key="pi">
                  <g :transform="getCutSheetTransform(p)">
                    <path :d="getCutSheetPath(p)" :fill="p.color" fill-opacity="0.28" fill-rule="evenodd" stroke="var(--laser-cut)" :stroke-width="(0.8 / cutScale).toFixed(2)" stroke-linejoin="miter" />
                  </g>
                  <text :x="(p.x + p.w / 2).toFixed(1)" :y="(p.y + p.h / 2).toFixed(1)" text-anchor="middle" dominant-baseline="middle" :font-size="(9 / cutScale).toFixed(1)" fill="var(--muted)">
                    {{ p.label }} {{ p.w.toFixed(0) }}&times;{{ p.h.toFixed(0) }}
                  </text>
                </template>
              </svg>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

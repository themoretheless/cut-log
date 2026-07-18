<script setup lang="ts">
import { computed, ref } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { usePieceImport } from '@/composables/usePieceImport'
import type { NewPieceInput } from '@/composables/usePieceList'
import { SHEET_PRESETS, STRATEGY_GROUPS } from '@/lib/cuttingOptions'
import { MAX_PIECE_QUANTITY, normalizeQuantity } from '@/lib/optimizerLimits'
import { validateNewPiece } from '@/lib/validatePiece'
import { CuttingStrategy, type CutPiece } from '@/services/types'
import { useL10n } from '@/stores/l10n'

const props = defineProps<{
  sheetWidth: number
  sheetHeight: number
  kerf: number
  pricePerSheet: number
  currency: string
  selectedStrategy: CuttingStrategy
  pieces: readonly CutPiece[]
}>()

const showImport = defineModel<boolean>('showImport', { required: true })
const emit = defineEmits<{
  sheetPreset: [width: number, height: number]
  sheetWidth: [value: number]
  sheetHeight: [value: number]
  kerf: [value: number]
  pricePerSheet: [value: number]
  currency: [value: string]
  strategy: [value: CuttingStrategy]
  addPiece: [input: NewPieceInput]
  importPieces: [payload: { rows: readonly NewPieceInput[]; added: number; skipped: number }]
}>()

const { t } = useL10n()
const newLabel = ref('')
const newWidth = ref(400)
const newHeight = ref(300)
const newQty = ref(1)
const newAllowRotation = ref(true)
const addError = ref('')
const selectedPreset = computed(() =>
  SHEET_PRESETS.find(preset => preset.width === props.sheetWidth && preset.height === props.sheetHeight)?.key ?? '')
const pieceImport = usePieceImport({
  pieces: () => props.pieces,
  sheetWidth: () => props.sheetWidth,
  sheetHeight: () => props.sheetHeight,
  kerf: () => props.kerf,
})
const { text: importText, preview: importPreview, canCommit: canCommitImport } = pieceImport

function onPresetChanged(event: Event) {
  const key = (event.target as HTMLSelectElement).value
  const preset = SHEET_PRESETS.find(item => item.key === key)
  if (preset) emit('sheetPreset', preset.width, preset.height)
}

function onCurrencyChanged(event: Event) {
  emit('currency', (event.target as HTMLInputElement).value.trim())
}

function onStrategyChanged(event: Event) {
  emit('strategy', Number((event.target as HTMLSelectElement).value) as CuttingStrategy)
}

function addPiece() {
  const error = validateNewPiece(
    { width: newWidth.value, height: newHeight.value, quantity: newQty.value },
    { sheetWidth: props.sheetWidth, sheetHeight: props.sheetHeight, kerf: props.kerf },
  )
  if (error) {
    addError.value = t(error)
    return
  }
  addError.value = ''
  emit('addPiece', {
    label: newLabel.value,
    width: newWidth.value,
    height: newHeight.value,
    quantity: newQty.value,
    allowRotation: newAllowRotation.value,
  })
  newLabel.value = ''
  newWidth.value = 400
  newHeight.value = 300
  newQty.value = 1
}

function importPieces() {
  if (importPreview.value.capacityExceeded) {
    addError.value = t('qty_limit')
    return
  }
  if (!canCommitImport.value) {
    addError.value = t('import_none')
    return
  }

  addError.value = ''
  const preview = importPreview.value
  const committed = pieceImport.commit(rows => {
    emit('importPieces', {
      rows,
      added: preview.acceptedCount,
      skipped: preview.totalSkipped,
    })
  })
  if (committed) showImport.value = false
}

defineExpose({ submit: addPiece })
</script>

<template>
  <section class="card">
    <h2>{{ t('sheet_params') }}</h2>
    <div class="form-row">
      <label for="sheet-preset">{{ t('sheet_preset') }}</label>
      <select id="sheet-preset" class="form-select" :value="selectedPreset" @change="onPresetChanged">
        <option value="">{{ t('preset.custom') }}</option>
        <option v-for="preset in SHEET_PRESETS" :key="preset.key" :value="preset.key">{{ t(`preset.${preset.key}`) }}</option>
      </select>
    </div>
    <div class="form-row">
      <label for="sheet-width">{{ t('width_mm') }}</label>
      <NumberField id="sheet-width" :aria-label="t('width_mm')" :model-value="sheetWidth" @update:model-value="emit('sheetWidth', $event)" :min="1" :step="1" />
    </div>
    <div class="form-row">
      <label for="sheet-height">{{ t('height_mm') }}</label>
      <NumberField id="sheet-height" :aria-label="t('height_mm')" :model-value="sheetHeight" @update:model-value="emit('sheetHeight', $event)" :min="1" :step="1" />
    </div>
    <div class="form-row">
      <label for="sheet-kerf">{{ t('kerf_mm') }}</label>
      <NumberField id="sheet-kerf" :aria-label="t('kerf_mm')" :model-value="kerf" @update:model-value="emit('kerf', $event)" :min="0" :step="1" />
    </div>
    <div class="form-row">
      <label for="sheet-price">{{ t('cost.price_per_sheet') }}</label>
      <div class="price-row">
        <NumberField id="sheet-price" :aria-label="t('cost.price_per_sheet')" :model-value="pricePerSheet" @update:model-value="emit('pricePerSheet', $event)" :min="0" :step="1" />
        <input class="currency-input" type="text" :value="currency" @input="onCurrencyChanged" maxlength="3" :title="t('cost.currency')" :aria-label="t('cost.currency')" />
      </div>
    </div>
    <div class="form-row">
      <label for="cut-strategy">{{ t('strategy') }}</label>
      <select id="cut-strategy" class="form-select" :value="selectedStrategy" @change="onStrategyChanged">
        <option :value="CuttingStrategy.Auto">{{ t('strategy.auto') }}</option>
        <optgroup v-for="group in STRATEGY_GROUPS" :key="group.labelKey" :label="t(group.labelKey)">
          <option v-for="item in group.items" :key="item.value" :value="item.value">{{ t(group.labelKey) }} &middot; {{ t(item.sortKey) }}</option>
        </optgroup>
      </select>
    </div>
  </section>

  <section class="card">
    <h2>{{ t('add_piece') }}</h2>
    <div class="form-row">
      <label for="new-piece-name">{{ t('name') }}</label>
      <input id="new-piece-name" type="text" v-model="newLabel" :placeholder="t('name_placeholder')" maxlength="200" />
    </div>
    <div class="form-row">
      <label for="new-piece-width">{{ t('width_mm') }}</label>
      <NumberField id="new-piece-width" :aria-label="t('width_mm')" v-model="newWidth" :min="1" :step="1" />
    </div>
    <div class="form-row">
      <label for="new-piece-height">{{ t('height_mm') }}</label>
      <NumberField id="new-piece-height" :aria-label="t('height_mm')" v-model="newHeight" :min="1" :step="1" />
    </div>
    <div class="form-row">
      <label for="new-piece-quantity">{{ t('quantity') }}</label>
      <NumberField id="new-piece-quantity" :aria-label="t('quantity')" :model-value="newQty" @update:model-value="newQty = normalizeQuantity($event)" :min="1" :max="MAX_PIECE_QUANTITY" :step="1" />
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

    <div v-if="showImport" class="import-box">
      <textarea v-model="importText" class="import-textarea" rows="5" :placeholder="t('import_placeholder')"></textarea>
      <p class="import-hint">{{ t('import_hint') }}</p>
      <div
        v-if="importText.trim()"
        class="import-preflight"
        :class="{ warn: importPreview.capacityExceeded || !importPreview.acceptedCount }"
        aria-live="polite"
      >
        <span><strong>{{ importPreview.acceptedCount }}</strong> {{ t('import_ready') }}</span>
        <span><strong>{{ importPreview.totalQuantity }}</strong> {{ t('import_units') }}</span>
        <span v-if="importPreview.totalSkipped"><strong>{{ importPreview.totalSkipped }}</strong> {{ t('import_rejected') }}</span>
      </div>
      <p v-if="importPreview.capacityExceeded" class="error import-error">{{ t('import_capacity') }}</p>
      <button class="btn btn-primary btn-compact" @click="importPieces" :disabled="!canCommitImport">
        {{ t('import_add_all') }}
      </button>
    </div>
  </section>
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
.import-preflight {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 7px 9px;
  border-left: 3px solid var(--eff-good-tx);
  background: var(--eff-good-bg);
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
}
.import-preflight strong {
  color: var(--eff-good-tx);
  font-variant-numeric: tabular-nums;
}
.import-preflight.warn {
  border-left-color: var(--alert-warn-bd);
  background: var(--alert-warn-bg);
}
.import-preflight.warn strong { color: var(--alert-warn-tx); }
.import-error { margin: 0; }
.price-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.currency-input {
  width: 48px;
  text-align: center;
  padding: 6px 4px;
  border: 1px solid var(--border, #d0d0d0);
  border-radius: 6px;
  background: var(--input-bg, #fff);
  color: inherit;
  box-sizing: border-box;
}
</style>

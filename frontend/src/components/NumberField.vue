<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useL10n } from '@/stores/l10n'

const props = withDefaults(defineProps<{
  modelValue: number
  id?: string
  ariaLabel?: string
  min?: number
  max?: number
  step?: number
}>(), { step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const { t } = useL10n()
const generatedId = useId()
const draft = ref(toDraft(props.modelValue))

const decreaseLabel = computed(() => `${t('decrease')}: ${props.ariaLabel || t('value')}`)
const increaseLabel = computed(() => `${t('increase')}: ${props.ariaLabel || t('value')}`)
const errorId = computed(() => `${props.id || generatedId}-error`)
const parsedDraft = computed(() => parseDraft(draft.value))
const belowMin = computed(() => parsedDraft.value != null && finiteMin.value != null && parsedDraft.value < finiteMin.value)
const aboveMax = computed(() => parsedDraft.value != null && finiteMax.value != null && parsedDraft.value > finiteMax.value)
const invalid = computed(() => parsedDraft.value == null || belowMin.value || aboveMax.value)
const atMin = computed(() => parsedDraft.value != null && finiteMin.value != null && parsedDraft.value <= finiteMin.value)
const atMax = computed(() => parsedDraft.value != null && finiteMax.value != null && parsedDraft.value >= finiteMax.value)
const finiteMin = computed(() => props.min != null && Number.isFinite(props.min) ? props.min : null)
const finiteMax = computed(() => props.max != null && Number.isFinite(props.max) ? props.max : null)
const effectiveStep = computed(() => Number.isFinite(props.step) && props.step > 0 ? props.step : 1)
const invalidMessage = computed(() => {
  const label = props.ariaLabel || t('value')
  if (parsedDraft.value == null) return t('invalid_dims')
  if (belowMin.value) return `${label}: ≥ ${finiteMin.value}`
  if (aboveMax.value) return `${label}: ≤ ${finiteMax.value}`
  return ''
})

watch(() => props.modelValue, value => {
  draft.value = toDraft(value)
})

function toDraft(value: number): string {
  return Number.isFinite(value) ? String(value) : ''
}

function parseDraft(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(v: number) {
  const aboveMinimum = finiteMin.value != null ? Math.max(finiteMin.value, v) : v
  return finiteMax.value != null ? Math.min(finiteMax.value, aboveMinimum) : aboveMinimum
}

function emitValue(value: number) {
  const next = clamp(value)
  draft.value = toDraft(next)
  if (!Object.is(next, props.modelValue)) emit('update:modelValue', next)
  void nextTick(() => {
    draft.value = toDraft(props.modelValue)
  })
}

function revert() {
  draft.value = toDraft(props.modelValue)
}

function commit() {
  const value = parsedDraft.value
  if (value == null) {
    revert()
    return
  }
  emitValue(value)
}

function stepBy(direction: -1 | 1) {
  const fallback = Number.isFinite(props.modelValue)
    ? props.modelValue
    : finiteMin.value ?? 0
  emitValue((parsedDraft.value ?? fallback) + direction * effectiveStep.value)
}

function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement).value
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    revert()
    return
  }

  if (event.key !== 'Enter') return
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    commit()
    return
  }
  event.preventDefault()
  commit()
}
</script>

<template>
  <div class="num-wrap" :class="{ 'is-invalid': invalid }">
    <button type="button" class="num-btn" :disabled="atMin" :aria-label="decreaseLabel" :aria-controls="id" @click="stepBy(-1)"><span aria-hidden="true">−</span></button>
    <input
      :id="id"
      type="number"
      inputmode="decimal"
      :aria-label="ariaLabel"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-describedby="invalid ? errorId : undefined"
      :value="draft"
      :min="min ?? undefined"
      :max="max ?? undefined"
      :step="step"
      @input="onInput"
      @blur="commit"
      @keydown="onKeydown"
    />
    <button type="button" class="num-btn" :disabled="atMax" :aria-label="increaseLabel" :aria-controls="id" @click="stepBy(1)"><span aria-hidden="true">+</span></button>
    <span v-if="invalid" class="num-field-error-indicator" aria-hidden="true">!</span>
    <span v-if="invalid" :id="errorId" class="num-field-error-text">{{ invalidMessage }}</span>
  </div>
</template>

<style scoped>
.num-wrap.is-invalid {
  border-color: var(--field-error);
}

.num-wrap.is-invalid:focus-within {
  border-color: var(--field-error);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--field-error) 26%, transparent);
}

.num-field-error-indicator {
  position: absolute;
  z-index: 1;
  top: 2px;
  right: calc(var(--num-button-width) + 2px);
  display: grid;
  width: 14px;
  height: 14px;
  place-items: center;
  border-radius: 50%;
  background: var(--field-error);
  color: var(--field-error-contrast);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
}

.num-field-error-text {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

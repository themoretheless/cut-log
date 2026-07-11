<script setup lang="ts">
import { computed } from 'vue'
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

const decreaseLabel = computed(() => `${t('decrease')}: ${props.ariaLabel || t('value')}`)
const increaseLabel = computed(() => `${t('increase')}: ${props.ariaLabel || t('value')}`)
const atMin = computed(() => props.min != null && props.modelValue <= props.min)
const atMax = computed(() => props.max != null && props.modelValue >= props.max)

function clamp(v: number) {
  const aboveMin = props.min != null ? Math.max(props.min, v) : v
  return props.max != null ? Math.min(props.max, aboveMin) : aboveMin
}
function dec() { emit('update:modelValue', clamp(props.modelValue - props.step)) }
function inc() { emit('update:modelValue', clamp(props.modelValue + props.step)) }
function onInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(v)) emit('update:modelValue', clamp(v))
}
</script>

<template>
  <div class="num-wrap">
    <button type="button" class="num-btn" :disabled="atMin" :aria-label="decreaseLabel" :aria-controls="id" @click="dec"><span aria-hidden="true">−</span></button>
    <input
      :id="id"
      type="number"
      inputmode="decimal"
      :aria-label="ariaLabel"
      :value="modelValue"
      :min="min ?? undefined"
      :max="max ?? undefined"
      :step="step"
      @input="onInput"
    />
    <button type="button" class="num-btn" :disabled="atMax" :aria-label="increaseLabel" :aria-controls="id" @click="inc"><span aria-hidden="true">+</span></button>
  </div>
</template>

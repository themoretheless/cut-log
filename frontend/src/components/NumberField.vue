<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: number; min?: number; step?: number }>(), { step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function clamp(v: number) { return props.min != null ? Math.max(props.min, v) : v }
function dec() { emit('update:modelValue', clamp(props.modelValue - props.step)) }
function inc() { emit('update:modelValue', props.modelValue + props.step) }
function onInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(v)) emit('update:modelValue', clamp(v))
}
</script>

<template>
  <div class="num-wrap">
    <button type="button" class="num-btn" @click="dec">−</button>
    <input type="number" :value="modelValue" :min="min ?? undefined" :step="step" @input="onInput" />
    <button type="button" class="num-btn" @click="inc">+</button>
  </div>
</template>

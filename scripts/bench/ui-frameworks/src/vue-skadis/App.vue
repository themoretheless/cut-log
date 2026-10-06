<script setup lang="ts">
import { computed } from 'vue'
import { settings, slots } from './state'

const previewPadding = computed(() => Math.max(settings.value.width, settings.value.height) * 0.025)
const viewBox = computed(() => [
  -previewPadding.value,
  -previewPadding.value,
  settings.value.width + previewPadding.value * 2,
  settings.value.height + previewPadding.value * 2,
].join(' '))
</script>

<template>
  <main class="skadis-benchmark">
    <section class="skadis-controls">
      <h1>SKÅDIS renderer</h1>
      <label for="skadis-pitch">
        <span>Pitch (mm)</span>
        <input id="skadis-pitch" type="number" :value="settings.pitch" readonly />
      </label>
      <label for="skadis-width">
        <span>Board width (mm)</span>
        <input id="skadis-width" type="number" :value="settings.width" readonly />
      </label>
      <label for="skadis-height">
        <span>Board height (mm)</span>
        <input id="skadis-height" type="number" :value="settings.height" readonly />
      </label>
      <p class="slot-count">{{ `Slots: ${slots.length}` }}</p>
    </section>

    <section class="skadis-preview">
      <h2>Preview</h2>
      <p>{{ `Board: ${settings.width} × ${settings.height} mm` }}</p>
      <svg :viewBox="viewBox" role="img" aria-label="SKÅDIS board preview">
        <rect class="board-shadow" x="3" y="5" :width="settings.width" :height="settings.height" :rx="settings.cornerRadius" />
        <rect class="board-shape" x="0" y="0" :width="settings.width" :height="settings.height" :rx="settings.cornerRadius" />
        <rect
          v-for="(slot, index) in slots"
          :key="index"
          :data-benchmark-slot="index"
          class="board-slot"
          :x="slot.x - settings.slotWidth / 2"
          :y="slot.y - settings.slotHeight / 2"
          :width="settings.slotWidth"
          :height="settings.slotHeight"
          :rx="Math.min(settings.slotWidth, settings.slotHeight) / 2"
        />
      </svg>
    </section>
  </main>
</template>

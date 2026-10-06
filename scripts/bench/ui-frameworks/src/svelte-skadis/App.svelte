<script lang="ts">
  import { skadisSlots } from '@cutlog/skadis/geometry'
  import { skadisState } from './state.svelte.ts'

  let slots = $derived(skadisSlots(skadisState.settings))
  let previewPadding = $derived(Math.max(skadisState.settings.width, skadisState.settings.height) * 0.025)
  let viewBox = $derived([
    -previewPadding,
    -previewPadding,
    skadisState.settings.width + previewPadding * 2,
    skadisState.settings.height + previewPadding * 2,
  ].join(' '))
</script>

<main class="skadis-benchmark">
  <section class="skadis-controls">
    <h1>SKÅDIS renderer</h1>
    <label for="skadis-pitch">
      <span>Pitch (mm)</span>
      <input id="skadis-pitch" type="number" value={skadisState.settings.pitch} readonly />
    </label>
    <label for="skadis-width">
      <span>Board width (mm)</span>
      <input id="skadis-width" type="number" value={skadisState.settings.width} readonly />
    </label>
    <label for="skadis-height">
      <span>Board height (mm)</span>
      <input id="skadis-height" type="number" value={skadisState.settings.height} readonly />
    </label>
    <p class="slot-count">{`Slots: ${slots.length}`}</p>
  </section>

  <section class="skadis-preview">
    <h2>Preview</h2>
    <p>{`Board: ${skadisState.settings.width} × ${skadisState.settings.height} mm`}</p>
    <svg {viewBox} role="img" aria-label="SKÅDIS board preview">
      <rect class="board-shadow" x="3" y="5" width={skadisState.settings.width} height={skadisState.settings.height} rx={skadisState.settings.cornerRadius} />
      <rect class="board-shape" x="0" y="0" width={skadisState.settings.width} height={skadisState.settings.height} rx={skadisState.settings.cornerRadius} />
      {#each slots as slot, index (index)}
        <rect
          data-benchmark-slot={index}
          class="board-slot"
          x={slot.x - skadisState.settings.slotWidth / 2}
          y={slot.y - skadisState.settings.slotHeight / 2}
          width={skadisState.settings.slotWidth}
          height={skadisState.settings.slotHeight}
          rx={Math.min(skadisState.settings.slotWidth, skadisState.settings.slotHeight) / 2}
        />
      {/each}
    </svg>
  </section>
</main>

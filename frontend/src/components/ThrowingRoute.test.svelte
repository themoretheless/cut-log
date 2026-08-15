<script module lang="ts">
  /** Throws on its first render only, so a boundary reset can be observed. */
  export let renderAttempts = 0
  export function resetAttempts() {
    renderAttempts = 0
  }
</script>

<script lang="ts">
  renderAttempts += 1
  if (renderAttempts === 1) throw new Error('route render failed')
</script>

<div class="app-container">Route rendered</div>

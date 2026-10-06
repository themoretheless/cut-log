<script lang="ts">
  import SheetCard from './SheetCard.svelte'
  import { layoutState } from './state.svelte.ts'
</script>

<main class="benchmark-grid">
  {#each layoutState.sheets as sheet (sheet.index)}
    <SheetCard
      {sheet}
      selectedPieceId={layoutState.selectedPieceId}
      pieceIndexes={layoutState.pieceIndexes}
      onselect={(id) => layoutState.selectedPieceId = id}
    />
  {/each}
</main>

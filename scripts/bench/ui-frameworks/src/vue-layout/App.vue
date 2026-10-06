<script setup lang="ts">
import SheetCard from './SheetCard.vue'
import { pieceIndexes, selectedPieceId, sheets } from './state'

function selectPiece(id: string): void {
  selectedPieceId.value = id
}
</script>

<template>
  <main class="benchmark-grid">
    <SheetCard
      v-for="sheet in sheets"
      :key="sheet.index"
      :sheet="sheet"
      :selected-piece-id="selectedPieceId"
      :piece-indexes="pieceIndexes"
      @select="selectPiece"
    />
  </main>
</template>

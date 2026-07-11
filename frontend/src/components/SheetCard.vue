<script setup lang="ts">
import { computed } from 'vue'
import type { PlacedPiece, Sheet } from '@/services/types'
import { truncate, efficiencyClass } from '@/helpers/svg'
import { badgeWidth, grainLines, pieceAccessibleName, sheetScale } from '@/lib/sheetPresentation'
import { useL10n } from '@/stores/l10n'

const props = defineProps<{
  sheet: Sheet
  selectedPieceId: string | null
  pieceIndexes: Readonly<Record<string, number>>
}>()

const emit = defineEmits<{ select: [id: string] }>()
const { t } = useL10n()
const scale = computed(() => sheetScale(props.sheet))
const svgWidth = computed(() => props.sheet.width * scale.value)
const svgHeight = computed(() => props.sheet.height * scale.value)
const titleId = computed(() => `sheet-title-${props.sheet.index}`)

function pieceIndex(id: string): number {
  return props.pieceIndexes[id] ?? 0
}

function selectPiece(id: string) {
  emit('select', id)
}

function accessibleName(piece: PlacedPiece): string {
  return pieceAccessibleName(piece, pieceIndex(piece.source.id), {
    by: t('a11y.dimension_by'),
    millimeters: t('a11y.millimeters'),
    rotated: t('a11y.rotated'),
  })
}
</script>

<template>
  <article class="sheet-card">
    <header class="sheet-header">
      <span>{{ t('sheet') }} {{ sheet.index + 1 }}</span>
      <span class="efficiency-badge" :class="efficiencyClass(sheet.efficiency)">
        {{ sheet.efficiency.toFixed(1) }}%
      </span>
    </header>
    <div class="sheet-svg-wrap" :id="`sheet-svg-${sheet.index}`">
      <svg
        :width="svgWidth.toFixed(0)"
        :height="svgHeight.toFixed(0)"
        :viewBox="`0 0 ${svgWidth.toFixed(0)} ${svgHeight.toFixed(0)}`"
        role="group"
        :aria-labelledby="titleId"
        style="display:block;margin:auto;max-width:100%;height:auto"
      >
        <title :id="titleId">{{ t('sheet') }} {{ sheet.index + 1 }}, {{ sheet.efficiency.toFixed(1) }}%</title>
        <rect :width="svgWidth.toFixed(0)" :height="svgHeight.toFixed(0)" fill="#f5f0e8" stroke="#8B7355" stroke-width="2" />
        <line
          v-for="(gy, gi) in grainLines(svgHeight)"
          :key="`grain-${gi}`"
          x1="0"
          :y1="gy.toFixed(1)"
          :x2="svgWidth.toFixed(0)"
          :y2="gy.toFixed(1)"
          stroke="#d4c9a8"
          stroke-width="0.5"
        />

        <template v-for="(piece, piecePosition) in sheet.placedPieces" :key="`${piece.source.id}-${piecePosition}`">
          <rect
            :x="(piece.x * scale).toFixed(1)"
            :y="(piece.y * scale).toFixed(1)"
            :width="(piece.width * scale).toFixed(1)"
            :height="(piece.height * scale).toFixed(1)"
            :fill="piece.source.color"
            :fill-opacity="selectedPieceId === null ? 0.82 : (piece.source.id === selectedPieceId ? 0.95 : 0.2)"
            :stroke="piece.source.id === selectedPieceId ? '#4a90d9' : '#fff'"
            :stroke-width="piece.source.id === selectedPieceId ? 2 : 0.1"
            role="button"
            tabindex="0"
            :aria-label="accessibleName(piece)"
            :aria-pressed="piece.source.id === selectedPieceId"
            style="cursor:pointer"
            @click="selectPiece(piece.source.id)"
            @keydown.enter.prevent="selectPiece(piece.source.id)"
            @keydown.space.prevent="selectPiece(piece.source.id)"
          />

          <rect
            :x="(piece.x * scale + 3).toFixed(1)"
            :y="(piece.y * scale + 3).toFixed(1)"
            :width="badgeWidth(pieceIndex(piece.source.id))"
            height="13"
            rx="3"
            fill="rgba(0,0,0,0.35)"
            pointer-events="none"
          />
          <text
            :x="(piece.x * scale + 3 + badgeWidth(pieceIndex(piece.source.id)) / 2).toFixed(1)"
            :y="(piece.y * scale + 9.5).toFixed(1)"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="8"
            font-weight="700"
            fill="#fff"
            pointer-events="none"
          >{{ pieceIndex(piece.source.id) }}</text>
          <text
            v-if="piece.isRotated"
            :x="(piece.x * scale + piece.width * scale - 6).toFixed(1)"
            :y="(piece.y * scale + 12).toFixed(1)"
            font-size="10"
            fill="#fff"
            opacity="0.9"
            pointer-events="none"
          >&#8635;</text>

          <template v-if="piece.width * scale > 40 && piece.height * scale > 22">
            <text
              v-if="piece.source.label?.trim()"
              :x="(piece.x * scale + piece.width * scale / 2).toFixed(1)"
              :y="(piece.y * scale + piece.height * scale / 2 - 5).toFixed(1)"
              text-anchor="middle"
              dominant-baseline="middle"
              :font-size="Math.min(13, piece.width * scale / 6).toFixed(0)"
              font-weight="600"
              fill="#fff"
              pointer-events="none"
            >{{ truncate(piece.source.label.trim(), Math.floor(piece.width * scale / 7)) }}</text>
            <text
              :x="(piece.x * scale + piece.width * scale / 2).toFixed(1)"
              :y="(piece.y * scale + piece.height * scale / 2 + (piece.source.label?.trim() ? 9 : 0)).toFixed(1)"
              text-anchor="middle"
              dominant-baseline="middle"
              :font-size="Math.min(11, piece.width * scale / 7).toFixed(0)"
              fill="#fff"
              opacity="0.85"
              pointer-events="none"
            >{{ piece.width.toFixed(0) }}&times;{{ piece.height.toFixed(0) }}</text>
          </template>
        </template>

        <text :x="(svgWidth / 2).toFixed(0)" :y="(svgHeight - 4).toFixed(0)" text-anchor="middle" font-size="11" fill="#8B7355">
          {{ sheet.width.toFixed(0) }} mm
        </text>
        <text
          x="4"
          :y="(svgHeight / 2).toFixed(0)"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="11"
          fill="#8B7355"
          :transform="`rotate(-90,4,${(svgHeight / 2).toFixed(0)})`"
        >{{ sheet.height.toFixed(0) }} mm</text>
      </svg>
    </div>
    <footer class="sheet-footer">
      <span>{{ sheet.placedPieces.length }} {{ t('pieces_short') }} &middot; {{ t('waste') }} {{ (sheet.totalArea - sheet.usedArea).toFixed(0) }} mm&sup2;</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { OperationEntry, SnapshotComparison } from '@/composables/useProjectActivity'
import type { ProjectSnapshot } from '@/lib/projectSnapshots'
import { useL10n } from '@/stores/l10n'

defineProps<{
  snapshots: readonly ProjectSnapshot[]
  operationLog: readonly OperationEntry[]
  snapshotCompare: SnapshotComparison | null
  hasPieces: boolean
}>()

const snapshotName = defineModel<string>('snapshotName', { required: true })
const operationQuery = defineModel<string>('operationQuery', { required: true })
const emit = defineEmits<{
  save: []
  restore: [snapshot: ProjectSnapshot]
  compare: [snapshot: ProjectSnapshot]
  delete: [snapshot: ProjectSnapshot]
  clearLog: []
}>()
const { t } = useL10n()

function formatDate(createdAt: string): string {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString()
}
</script>

<template>
  <section class="card snapshot-card">
    <div class="snapshot-head">
      <h2>{{ t('snapshots') }}</h2>
      <span>{{ snapshots.length }}/8</span>
    </div>
    <div class="snapshot-save-row">
      <input
        v-model="snapshotName"
        type="text"
        class="snapshot-name-input"
        :placeholder="t('snapshot_name_placeholder')"
        @keydown.enter.prevent="emit('save')"
      />
      <button class="btn btn-primary btn-compact" @click="emit('save')" :disabled="!hasPieces">{{ t('save') }}</button>
    </div>
    <p class="snapshot-hint">{{ t('snapshot_hint') }}</p>
    <div v-if="snapshots.length" class="snapshot-list">
      <div v-for="snapshot in snapshots" :key="snapshot.id" class="snapshot-item">
        <button type="button" class="snapshot-main" @click="emit('restore', snapshot)">
          <strong>{{ snapshot.name }}</strong>
          <span>{{ snapshot.summary }}</span>
          <small>{{ formatDate(snapshot.createdAt) }}</small>
        </button>
        <button class="btn btn-ghost btn-sm" @click="emit('compare', snapshot)" :title="t('snapshot_compare')">Δ</button>
        <button class="btn btn-danger btn-sm" @click="emit('delete', snapshot)" :title="t('delete')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
    <p v-else class="snapshot-empty">{{ t('snapshot_empty') }}</p>
    <div v-if="snapshotCompare" class="snapshot-compare">
      <strong>{{ snapshotCompare.name }}</strong>
      <span>{{ t('snapshot_compare_pieces') }}: {{ snapshotCompare.piecesDelta >= 0 ? '+' : '' }}{{ snapshotCompare.piecesDelta }}</span>
      <span>{{ t('snapshot_compare_area') }}: {{ snapshotCompare.areaDelta }}</span>
      <span>{{ t('snapshot_compare_changed') }}: {{ snapshotCompare.changed }} · +{{ snapshotCompare.added }} · -{{ snapshotCompare.removed }}</span>
      <span v-if="snapshotCompare.sheetChanged">{{ t('snapshot_compare_sheet') }}</span>
    </div>
  </section>

  <section class="card operation-card">
    <div class="operation-head">
      <h2>{{ t('operation_log') }}</h2>
      <button class="btn btn-ghost btn-sm" @click="emit('clearLog')" :disabled="!operationLog.length" :title="t('clear_all')">×</button>
    </div>
    <input
      v-model="operationQuery"
      type="search"
      class="snapshot-name-input"
      :placeholder="t('operation_search')"
    />
    <div v-if="operationLog.length" class="operation-list">
      <div v-for="entry in operationLog" :key="entry.id" class="operation-item">
        <strong>{{ entry.label }}</strong>
        <span v-if="entry.detail">{{ entry.detail }}</span>
        <small>{{ formatDate(entry.createdAt) }}</small>
      </div>
    </div>
    <p v-else class="snapshot-empty">{{ t('operation_empty') }}</p>
  </section>
</template>

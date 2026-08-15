<script lang="ts">
  import type { OperationEntry, SnapshotComparison } from '@/composables/useProjectActivity.svelte'
  import type { ProjectSnapshot } from '@/lib/projectSnapshots'
  import { useL10n } from '@/stores/l10n.svelte'

  interface Props {
    snapshots: readonly ProjectSnapshot[]
    operationLog: readonly OperationEntry[]
    snapshotCompare: SnapshotComparison | null
    hasPieces: boolean
    snapshotName: string
    operationQuery: string
    onSave: () => void
    onRestore: (snapshot: ProjectSnapshot) => void
    onCompare: (snapshot: ProjectSnapshot) => void
    onDelete: (snapshot: ProjectSnapshot) => void
    onClearLog: () => void
  }

  let {
    snapshots,
    operationLog,
    snapshotCompare,
    hasPieces,
    snapshotName = $bindable(),
    operationQuery = $bindable(),
    onSave,
    onRestore,
    onCompare,
    onDelete,
    onClearLog,
  }: Props = $props()

  const l10n = useL10n()
  const t = l10n.t

  function formatDate(createdAt: string): string {
    const date = new Date(createdAt)
    return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString()
  }

  function onNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSave()
    }
  }
</script>

<section class="card snapshot-card">
  <div class="snapshot-head">
    <h2>{t('snapshots')}</h2>
    <span>{snapshots.length}/8</span>
  </div>
  <div class="snapshot-save-row">
    <input
      bind:value={snapshotName}
      type="text"
      class="snapshot-name-input"
      placeholder={t('snapshot_name_placeholder')}
      onkeydown={onNameKeydown}
    />
    <button class="btn btn-primary btn-compact" onclick={onSave} disabled={!hasPieces}>{t('save')}</button>
  </div>
  <p class="snapshot-hint">{t('snapshot_hint')}</p>
  {#if snapshots.length}
    <div class="snapshot-list">
      {#each snapshots as snapshot (snapshot.id)}
        <div class="snapshot-item">
          <button type="button" class="snapshot-main" onclick={() => onRestore(snapshot)}>
            <strong>{snapshot.name}</strong>
            <span>{snapshot.summary}</span>
            <small>{formatDate(snapshot.createdAt)}</small>
          </button>
          <button class="btn btn-ghost btn-sm" onclick={() => onCompare(snapshot)} title={t('snapshot_compare')}>Δ</button>
          <button class="btn btn-danger btn-sm" onclick={() => onDelete(snapshot)} title={t('delete')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {:else}
    <p class="snapshot-empty">{t('snapshot_empty')}</p>
  {/if}
  {#if snapshotCompare}
    <div class="snapshot-compare">
      <strong>{snapshotCompare.name}</strong>
      <span>{t('snapshot_compare_pieces')}: {snapshotCompare.piecesDelta >= 0 ? '+' : ''}{snapshotCompare.piecesDelta}</span>
      <span>{t('snapshot_compare_area')}: {snapshotCompare.areaDelta}</span>
      <span>{t('snapshot_compare_changed')}: {snapshotCompare.changed} · +{snapshotCompare.added} · -{snapshotCompare.removed}</span>
      {#if snapshotCompare.sheetChanged}
        <span>{t('snapshot_compare_sheet')}</span>
      {/if}
    </div>
  {/if}
</section>

<section class="card operation-card">
  <div class="operation-head">
    <h2>{t('operation_log')}</h2>
    <button class="btn btn-ghost btn-sm" onclick={onClearLog} disabled={!operationLog.length} title={t('clear_all')}>×</button>
  </div>
  <input
    bind:value={operationQuery}
    type="search"
    class="snapshot-name-input"
    placeholder={t('operation_search')}
  />
  {#if operationLog.length}
    <div class="operation-list">
      {#each operationLog as entry (entry.id)}
        <div class="operation-item">
          <strong>{entry.label}</strong>
          {#if entry.detail}
            <span>{entry.detail}</span>
          {/if}
          <small>{formatDate(entry.createdAt)}</small>
        </div>
      {/each}
    </div>
  {:else}
    <p class="snapshot-empty">{t('operation_empty')}</p>
  {/if}
</section>

<script lang="ts">
  import SheetCard from '@/components/SheetCard.svelte'
  import type { OptimizationState } from '@/composables/useOptimizationSession.svelte'
  import type { CostSummary } from '@/lib/costSummary'
  import { strategyDisplayName } from '@/lib/cuttingOptions'
  import { useL10n } from '@/stores/l10n.svelte'

  interface Props {
    state: OptimizationState
    costingVisible: boolean
    costSummary: CostSummary | null
    currency: string
    selectedPieceId: string | null
    pieceIndexes: Readonly<Record<string, number>>
    canRetry: boolean
    onLoadExample: () => void
    onCancel: () => void
    onRetry: () => void
    onExportSvg: () => void
    onExportDxf: () => void
    onPrint: () => void
    onSelect: (id: string) => void
  }

  const {
    state,
    costingVisible,
    costSummary,
    currency,
    selectedPieceId,
    pieceIndexes,
    canRetry,
    onLoadExample,
    onCancel,
    onRetry,
    onExportSvg,
    onExportDxf,
    onPrint,
    onSelect,
  }: Props = $props()

  const l10n = useL10n()
  const t = l10n.t
</script>

{#if state.status === 'idle'}
  <div class="empty-state">
    <div class="empty-icon">&#129690;</div>
    <p>{t('empty_hint')}</p>
    <button class="btn btn-ghost" onclick={onLoadExample}>{t('load_example')}</button>
  </div>
{:else if state.status === 'running'}
  <div class="optimization-state" role="status" aria-live="polite">
    <span class="optimization-spinner" aria-hidden="true"></span>
    <div>
      <strong>{t('optimization.running')}</strong>
      <p>{t('optimization.running_hint')}</p>
    </div>
    <button class="btn btn-ghost btn-compact" onclick={onCancel}>{t('optimization.cancel')}</button>
  </div>
{:else if state.status === 'error'}
  <div class="optimization-state is-error" role="alert">
    <div>
      <strong>{t('optimization.error')}</strong>
      <p>{t('optimization.error_hint')}</p>
    </div>
    <button class="btn btn-primary btn-compact" disabled={!canRetry} onclick={onRetry}>{t('optimization.retry')}</button>
  </div>
{:else if state.status === 'cancelled'}
  <div class="optimization-state" role="status">
    <div>
      <strong>{t('optimization.cancelled')}</strong>
      <p>{t('optimization.cancelled_hint')}</p>
    </div>
    <button class="btn btn-primary btn-compact" disabled={!canRetry} onclick={onRetry}>{t('optimization.retry')}</button>
  </div>
{:else}
  <div class="stats-bar">
    <div class="stat">
      <span class="stat-value">{state.result.totalSheets}</span>
      <span class="stat-label">{t('sheets')}</span>
    </div>
    <div class="stat">
      <span class="stat-value">{state.result.overallEfficiency.toFixed(1)}%</span>
      <span class="stat-label">{t('efficiency')}</span>
    </div>
    <div class="stat">
      <span class="stat-value">{(state.result.totalArea - state.result.totalUsedArea).toFixed(0)} mm&sup2;</span>
      <span class="stat-label">{t('waste')}</span>
    </div>
    <div class="stat">
      <span class="stat-value stat-value-sm">{strategyDisplayName(state.result.autoPickedStrategy ?? state.result.strategy, t)}</span>
      <span class="stat-label">{t('strategy.used')}</span>
    </div>
  </div>

  {#if costingVisible && costSummary}
    <div class="cost-bar">
      <span class="cost-title">{t('cost.summary')}</span>
      <div class="cost-item">
        <span class="cost-value">{costSummary.totalCost.toFixed(0)} {currency}</span>
        <span class="cost-label">{t('cost.total')}</span>
      </div>
      <div class="cost-item">
        <span class="cost-value">{costSummary.costPerPart.toFixed(2)} {currency}</span>
        <span class="cost-label">{t('cost.per_part')}</span>
      </div>
      <div class="cost-item">
        <span class="cost-value">{costSummary.wasteCost.toFixed(0)} {currency}</span>
        <span class="cost-label">{t('cost.waste_cost')}</span>
      </div>
    </div>
  {/if}

  <div class="export-bar">
    <span class="export-label">{t('export')}</span>
    <button class="btn btn-ghost btn-export" onclick={onExportSvg}>SVG</button>
    <button class="btn btn-ghost btn-export" onclick={onExportDxf}>DXF</button>
    <button class="btn btn-ghost btn-export" onclick={onPrint}>{t('export.print')}</button>
  </div>

  {#if state.result.unplacedPieces.length}
    <div class="alert alert-warn">
      <strong>{t('unplaced_warn')}</strong>
      <ul>
        {#each state.result.unplacedPieces as piece, index (`${piece.sourceId}-${index}`)}
          <li>
            {#if piece.label.trim()}{piece.label.trim()} {/if}({piece.width.toFixed(0)}&times;{piece.height.toFixed(0)})
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="sheets-grid">
    {#each state.result.sheets as sheet (sheet.index)}
      <SheetCard {sheet} {selectedPieceId} {pieceIndexes} {onSelect} />
    {/each}
  </div>
{/if}

<style>
  .optimization-state {
    min-height: 112px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px;
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    background: var(--surface);
  }
  .optimization-state.is-error { border-left-color: var(--eff-poor-tx); }
  .optimization-state > div { flex: 1; }
  .optimization-state strong { font-size: 14px; }
  .optimization-state p {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 12px;
  }
  .optimization-spinner {
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: optimization-spin 0.8s linear infinite;
  }
  .cost-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 22px;
    padding: 10px 14px;
    margin-bottom: 12px;
    border: 1px solid var(--border, #d0d0d0);
    border-radius: 8px;
    background: var(--input-bg, #fff);
  }
  .cost-title {
    font-size: 12px;
    font-weight: 600;
    opacity: 0.65;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .cost-item { display: flex; flex-direction: column; }
  .cost-value { font-size: 16px; font-weight: 700; white-space: nowrap; }
  .cost-label { font-size: 11px; opacity: 0.7; }
  @keyframes optimization-spin { to { transform: rotate(360deg); } }
  @media (max-width: 620px) {
    .optimization-state { align-items: flex-start; flex-wrap: wrap; }
    .optimization-state :global(.btn) { margin-left: 36px; }
  }
</style>

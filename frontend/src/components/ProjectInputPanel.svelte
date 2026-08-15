<script lang="ts">
  import NumberField from '@/components/NumberField.svelte'
  import { usePieceImport } from '@/composables/usePieceImport.svelte'
  import type { NewPieceInput } from '@/composables/usePieceList.svelte'
  import { SHEET_PRESETS, STRATEGY_GROUPS } from '@/lib/cuttingOptions'
  import { MAX_PIECE_QUANTITY, normalizeQuantity } from '@/lib/optimizerLimits'
  import { validateNewPiece } from '@/lib/validatePiece'
  import { CuttingStrategy, type CutPiece } from '@/services/types'
  import { useL10n } from '@/stores/l10n.svelte'

  interface Props {
    sheetWidth: number
    sheetHeight: number
    kerf: number
    pricePerSheet: number
    currency: string
    selectedStrategy: CuttingStrategy
    pieces: readonly CutPiece[]
    showImport: boolean
    onSheetPreset: (width: number, height: number) => void
    onSheetWidth: (value: number) => void
    onSheetHeight: (value: number) => void
    onKerf: (value: number) => void
    onPricePerSheet: (value: number) => void
    onCurrency: (value: string) => void
    onStrategy: (value: CuttingStrategy) => void
    onAddPiece: (input: NewPieceInput) => void
    onImportPieces: (payload: { rows: readonly NewPieceInput[]; added: number; skipped: number }) => void
  }

  let {
    sheetWidth,
    sheetHeight,
    kerf,
    pricePerSheet,
    currency,
    selectedStrategy,
    pieces,
    showImport = $bindable(),
    onSheetPreset,
    onSheetWidth,
    onSheetHeight,
    onKerf,
    onPricePerSheet,
    onCurrency,
    onStrategy,
    onAddPiece,
    onImportPieces,
  }: Props = $props()

  const l10n = useL10n()
  const t = l10n.t
  let newLabel = $state('')
  let newWidth = $state(400)
  let newHeight = $state(300)
  let newQty = $state(1)
  let newAllowRotation = $state(true)
  let addError = $state('')
  const selectedPreset = $derived(
    SHEET_PRESETS.find(preset => preset.width === sheetWidth && preset.height === sheetHeight)?.key ?? '')
  const pieceImport = usePieceImport({
    pieces: () => pieces,
    sheetWidth: () => sheetWidth,
    sheetHeight: () => sheetHeight,
    kerf: () => kerf,
  })

  function onPresetChanged(event: Event) {
    const key = (event.target as HTMLSelectElement).value
    const preset = SHEET_PRESETS.find(item => item.key === key)
    if (preset) onSheetPreset(preset.width, preset.height)
  }

  function onCurrencyChanged(event: Event) {
    onCurrency((event.target as HTMLInputElement).value.trim())
  }

  function onStrategyChanged(event: Event) {
    onStrategy(Number((event.target as HTMLSelectElement).value) as CuttingStrategy)
  }

  function addPiece() {
    const error = validateNewPiece(
      {
        width: newWidth,
        height: newHeight,
        quantity: newQty,
        allowRotation: newAllowRotation,
      },
      { sheetWidth, sheetHeight, kerf },
    )
    if (error) {
      addError = t(error)
      return
    }
    addError = ''
    onAddPiece({
      label: newLabel,
      width: newWidth,
      height: newHeight,
      quantity: newQty,
      allowRotation: newAllowRotation,
    })
    newLabel = ''
    newWidth = 400
    newHeight = 300
    newQty = 1
  }

  function importPieces() {
    if (pieceImport.preview.capacityExceeded) {
      addError = t('qty_limit')
      return
    }
    if (!pieceImport.canCommit) {
      addError = t('import_none')
      return
    }

    addError = ''
    const preview = pieceImport.preview
    const committed = pieceImport.commit(rows => {
      onImportPieces({
        rows,
        added: preview.acceptedCount,
        skipped: preview.totalSkipped,
      })
    })
    if (committed) showImport = false
  }

  export function submit() {
    addPiece()
  }
</script>

<section class="card">
  <h2>{t('sheet_params')}</h2>
  <div class="form-row">
    <label for="sheet-preset">{t('sheet_preset')}</label>
    <select id="sheet-preset" class="form-select" value={selectedPreset} onchange={onPresetChanged}>
      <option value="">{t('preset.custom')}</option>
      {#each SHEET_PRESETS as preset (preset.key)}
        <option value={preset.key}>{t(`preset.${preset.key}`)}</option>
      {/each}
    </select>
  </div>
  <div class="form-row">
    <label for="sheet-width">{t('width_mm')}</label>
    <NumberField id="sheet-width" ariaLabel={t('width_mm')} value={sheetWidth} onUpdate={onSheetWidth} min={1} step={1} />
  </div>
  <div class="form-row">
    <label for="sheet-height">{t('height_mm')}</label>
    <NumberField id="sheet-height" ariaLabel={t('height_mm')} value={sheetHeight} onUpdate={onSheetHeight} min={1} step={1} />
  </div>
  <div class="form-row">
    <label for="sheet-kerf">{t('kerf_mm')}</label>
    <NumberField id="sheet-kerf" ariaLabel={t('kerf_mm')} value={kerf} onUpdate={onKerf} min={0} step={1} />
  </div>
  <div class="form-row">
    <label for="sheet-price">{t('cost.price_per_sheet')}</label>
    <div class="price-row">
      <NumberField id="sheet-price" ariaLabel={t('cost.price_per_sheet')} value={pricePerSheet} onUpdate={onPricePerSheet} min={0} step={1} />
      <input class="currency-input" type="text" value={currency} oninput={onCurrencyChanged} maxlength="3" title={t('cost.currency')} aria-label={t('cost.currency')} />
    </div>
  </div>
  <div class="form-row">
    <label for="cut-strategy">{t('strategy')}</label>
    <select id="cut-strategy" class="form-select" value={selectedStrategy} onchange={onStrategyChanged}>
      <option value={CuttingStrategy.Auto}>{t('strategy.auto')}</option>
      {#each STRATEGY_GROUPS as group (group.labelKey)}
        <optgroup label={t(group.labelKey)}>
          {#each group.items as item (item.value)}
            <option value={item.value}>{t(group.labelKey)} &middot; {t(item.sortKey)}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </div>
</section>

<section class="card">
  <h2>{t('add_piece')}</h2>
  <div class="form-row">
    <label for="new-piece-name">{t('name')}</label>
    <input id="new-piece-name" type="text" bind:value={newLabel} placeholder={t('name_placeholder')} maxlength="200" />
  </div>
  <div class="form-row">
    <label for="new-piece-width">{t('width_mm')}</label>
    <NumberField id="new-piece-width" ariaLabel={t('width_mm')} value={newWidth} onUpdate={v => { newWidth = v }} min={1} step={1} />
  </div>
  <div class="form-row">
    <label for="new-piece-height">{t('height_mm')}</label>
    <NumberField id="new-piece-height" ariaLabel={t('height_mm')} value={newHeight} onUpdate={v => { newHeight = v }} min={1} step={1} />
  </div>
  <div class="form-row">
    <label for="new-piece-quantity">{t('quantity')}</label>
    <NumberField id="new-piece-quantity" ariaLabel={t('quantity')} value={newQty} onUpdate={v => { newQty = normalizeQuantity(v) }} min={1} max={MAX_PIECE_QUANTITY} step={1} />
  </div>
  <div class="form-row form-row-check">
    <label>
      <input type="checkbox" bind:checked={newAllowRotation} />
      {t('allow_rotation')}
    </label>
  </div>
  {#if addError}
    <p class="error">{addError}</p>
  {/if}
  <div class="card-actions">
    <button class="btn btn-primary" onclick={addPiece}>+ {t('add')}</button>
    <button class="btn btn-ghost" class:active={showImport} onclick={() => { showImport = !showImport }}>{t('import')}</button>
  </div>

  {#if showImport}
    <div class="import-box">
      <textarea bind:value={pieceImport.text} class="import-textarea" rows="5" placeholder={t('import_placeholder')}></textarea>
      <p class="import-hint">{t('import_hint')}</p>
      {#if pieceImport.text.trim()}
        <div
          class="import-preflight"
          class:warn={pieceImport.preview.capacityExceeded || !pieceImport.preview.acceptedCount}
          aria-live="polite"
        >
          <span><strong>{pieceImport.preview.acceptedCount}</strong> {t('import_ready')}</span>
          <span><strong>{pieceImport.preview.totalQuantity}</strong> {t('import_units')}</span>
          {#if pieceImport.preview.totalSkipped}
            <span><strong>{pieceImport.preview.totalSkipped}</strong> {t('import_rejected')}</span>
          {/if}
        </div>
      {/if}
      {#if pieceImport.preview.capacityExceeded}
        <p class="error import-error">{t('import_capacity')}</p>
      {/if}
      <button class="btn btn-primary btn-compact" onclick={importPieces} disabled={!pieceImport.canCommit}>
        {t('import_add_all')}
      </button>
    </div>
  {/if}
</section>

<style>
  .import-box {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .import-textarea {
    width: 100%;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    padding: 8px 10px;
    border: 1px solid var(--border, #d0d0d0);
    border-radius: 6px;
    background: var(--input-bg, #fff);
    color: inherit;
    box-sizing: border-box;
  }
  .import-hint {
    margin: 0;
    font-size: 11px;
    opacity: 0.7;
  }
  .import-preflight {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    padding: 7px 9px;
    border-left: 3px solid var(--eff-good-tx);
    background: var(--eff-good-bg);
    color: var(--muted);
    font-size: 11px;
    line-height: 1.35;
  }
  .import-preflight strong {
    color: var(--eff-good-tx);
    font-variant-numeric: tabular-nums;
  }
  .import-preflight.warn {
    border-left-color: var(--alert-warn-bd);
    background: var(--alert-warn-bg);
  }
  .import-preflight.warn strong { color: var(--alert-warn-tx); }
  .import-error { margin: 0; }
  .price-row {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }
  .price-row > :global(.num-wrap) {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }
  .price-row > .currency-input {
    flex: 0 0 48px;
    width: 48px;
    min-width: 48px;
    max-width: 48px;
    text-align: center;
    padding: 6px 4px;
    border: 1px solid var(--border, #d0d0d0);
    border-radius: 6px;
    background: var(--input-bg, #fff);
    color: inherit;
    box-sizing: border-box;
  }
</style>

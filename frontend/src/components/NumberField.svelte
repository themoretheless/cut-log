<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { useL10n } from '@/stores/l10n.svelte'

  interface Props {
    value: number
    onUpdate: (value: number) => void
    id?: string
    ariaLabel?: string
    min?: number
    max?: number
    step?: number
  }

  const { value, onUpdate, id, ariaLabel, min, max, step = 1 }: Props = $props()
  const l10n = useL10n()
  const t = l10n.t
  const generatedId = $props.id()
  // Seeded from the initial prop on purpose: the effect below then only reacts
  // to later changes, matching Vue's non-immediate watch.
  let draft = $state(untrack(() => toDraft(value)))
  let lastSyncedValue = untrack(() => value)

  const decreaseLabel = $derived(`${t('decrease')}: ${ariaLabel || t('value')}`)
  const increaseLabel = $derived(`${t('increase')}: ${ariaLabel || t('value')}`)
  const errorId = $derived(`${id || generatedId}-error`)
  const parsedDraft = $derived(parseDraft(draft))
  const finiteMin = $derived(min != null && Number.isFinite(min) ? min : null)
  const finiteMax = $derived(max != null && Number.isFinite(max) ? max : null)
  const belowMin = $derived(parsedDraft != null && finiteMin != null && parsedDraft < finiteMin)
  const aboveMax = $derived(parsedDraft != null && finiteMax != null && parsedDraft > finiteMax)
  const invalid = $derived(parsedDraft == null || belowMin || aboveMax)
  const atMin = $derived(parsedDraft != null && finiteMin != null && parsedDraft <= finiteMin)
  const atMax = $derived(parsedDraft != null && finiteMax != null && parsedDraft >= finiteMax)
  const effectiveStep = $derived(Number.isFinite(step) && step > 0 ? step : 1)
  const invalidMessage = $derived.by(() => {
    const label = ariaLabel || t('value')
    if (parsedDraft == null) return t('invalid_dims')
    if (belowMin) return `${label}: ≥ ${finiteMin}`
    if (aboveMax) return `${label}: ≤ ${finiteMax}`
    return ''
  })

  // Mirrors Vue's watch(modelValue): the draft resyncs when the prop changes,
  // but not on mount. Re-running on mount would make every field render twice,
  // which is measurable when a few hundred rows are created at once.
  $effect(() => {
    if (value === lastSyncedValue) return
    lastSyncedValue = value
    draft = toDraft(value)
  })

  function toDraft(v: number): string {
    return Number.isFinite(v) ? String(v) : ''
  }

  function parseDraft(v: string): number | null {
    if (!v.trim()) return null
    const parsed = Number(v)
    return Number.isFinite(parsed) ? parsed : null
  }

  function clamp(v: number) {
    const aboveMinimum = finiteMin != null ? Math.max(finiteMin, v) : v
    return finiteMax != null ? Math.min(finiteMax, aboveMinimum) : aboveMinimum
  }

  function emitValue(next: number) {
    const clamped = clamp(next)
    draft = toDraft(clamped)
    if (!Object.is(clamped, value)) onUpdate(clamped)
    void tick().then(() => {
      draft = toDraft(value)
    })
  }

  function revert() {
    draft = toDraft(value)
  }

  function commit() {
    const parsed = parsedDraft
    if (parsed == null) {
      revert()
      return
    }
    emitValue(parsed)
  }

  function stepBy(direction: -1 | 1) {
    const fallback = Number.isFinite(value)
      ? value
      : finiteMin ?? 0
    emitValue((parsedDraft ?? fallback) + direction * effectiveStep)
  }

  function onInput(e: Event) {
    draft = (e.target as HTMLInputElement).value
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      revert()
      return
    }

    if (event.key !== 'Enter') return
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      commit()
      return
    }
    event.preventDefault()
    commit()
  }
</script>

<div class="num-wrap" class:is-invalid={invalid}>
  <button type="button" class="num-btn" disabled={atMin} aria-label={decreaseLabel} aria-controls={id} onclick={() => stepBy(-1)}><span aria-hidden="true">−</span></button>
  <input
    {id}
    type="number"
    inputmode="decimal"
    aria-label={ariaLabel}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={invalid ? errorId : undefined}
    value={draft}
    min={min ?? undefined}
    max={max ?? undefined}
    {step}
    oninput={onInput}
    onblur={commit}
    onkeydown={onKeydown}
  />
  <button type="button" class="num-btn" disabled={atMax} aria-label={increaseLabel} aria-controls={id} onclick={() => stepBy(1)}><span aria-hidden="true">+</span></button>
  {#if invalid}
    <span class="num-field-error-indicator" aria-hidden="true">!</span>
    <span id={errorId} class="num-field-error-text">{invalidMessage}</span>
  {/if}
</div>

<style>
  .num-wrap.is-invalid {
    border-color: var(--field-error);
  }

  .num-wrap.is-invalid:focus-within {
    border-color: var(--field-error);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--field-error) 26%, transparent);
  }

  .num-field-error-indicator {
    position: absolute;
    z-index: 1;
    top: 2px;
    right: calc(var(--num-button-width) + 2px);
    display: grid;
    width: 14px;
    height: 14px;
    place-items: center;
    border-radius: 50%;
    background: var(--field-error);
    color: var(--field-error-contrast);
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    pointer-events: none;
  }

  .num-field-error-text {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>

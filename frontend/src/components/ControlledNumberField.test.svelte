<script lang="ts">
  // Test-only harness: stands in for the Vue `mountControlled` parent, i.e. a
  // parent that owns the value and normalizes whatever the field commits.
  import { untrack } from 'svelte'
  import NumberField from './NumberField.svelte'

  interface Props {
    initial: number
    normalize: (value: number) => number
    onValue?: (value: number) => void
    ariaLabel?: string
    min?: number
    max?: number
    step?: number
  }

  const { initial, normalize, onValue, ariaLabel = 'Value', min = 1, max, step = 1 }: Props = $props()

  let value = $state(untrack(() => initial))

  function update(next: number) {
    value = normalize(next)
    onValue?.(value)
  }
</script>

<NumberField {value} onUpdate={update} {ariaLabel} {min} {max} {step} />

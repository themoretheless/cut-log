// @vitest-environment happy-dom
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { createShortcutHandler } from '@/composables/useKeyboardShortcuts.svelte'
import ControlledNumberField from './ControlledNumberField.test.svelte'
import NumberField from './NumberField.svelte'

function renderField(overrides: Record<string, unknown> = {}) {
  const onUpdate = vi.fn()
  const view = render(NumberField, {
    props: {
      value: 12,
      onUpdate,
      ariaLabel: 'Width',
      min: 1,
      max: 20,
      step: 0.5,
      ...overrides,
    },
  })
  const input = view.container.querySelector('input') as HTMLInputElement
  const root = view.container.querySelector('.num-wrap') as HTMLElement
  return { ...view, onUpdate, input, root }
}

function renderControlled(
  initial: number,
  normalize: (value: number) => number,
  overrides: Record<string, unknown> = {},
) {
  const value = { current: initial }
  const view = render(ControlledNumberField, {
    props: {
      initial,
      normalize,
      onValue: (next: number) => { value.current = next },
      ...overrides,
    },
  })
  const input = view.container.querySelector('input') as HTMLInputElement
  return { ...view, value, input }
}

async function type(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await tick()
}

describe('NumberField', () => {
  it('keeps a string draft and commits a finite value on Enter', async () => {
    const { input, root, onUpdate } = renderField()
    let bubbled = false
    root.addEventListener('keydown', () => { bubbled = true })

    await type(input, '15.5')

    expect(onUpdate).not.toHaveBeenCalled()
    expect(input.value).toBe('15.5')
    expect(input.getAttribute('aria-invalid')).toBeNull()

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.dispatchEvent(event)
    await tick()

    expect(onUpdate.mock.calls).toEqual([[15.5]])
    expect(event.defaultPrevented).toBe(true)
    expect(bubbled).toBe(true)
  })

  it('shows one described invalid state with a visible cue and reverts an empty draft on blur', async () => {
    const { container, input, root, onUpdate } = renderField()

    await type(input, '')

    expect(input.getAttribute('aria-invalid')).toBe('true')
    const descriptionId = input.getAttribute('aria-describedby')
    expect(descriptionId).toBeTruthy()
    expect(container.querySelector(`#${descriptionId}`)!.textContent).not.toBe('')
    expect(container.querySelector('.num-field-error-indicator')!.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(root.getAttribute('title')).toBeNull()
    expect(root.classList.contains('is-invalid')).toBe(true)

    input.dispatchEvent(new FocusEvent('blur', { bubbles: false }))
    await tick()

    expect(input.value).toBe('12')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('never emits a non-finite value and reverts an overflow on Enter', async () => {
    const { input, onUpdate } = renderField()

    await type(input, '1e309')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await tick()

    expect(input.value).toBe('12')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('marks an out-of-range draft and clamps it when committed', async () => {
    const { input, value } = renderControlled(12, next => next, { max: 20, step: 0.5 })

    await type(input, '25')
    expect(input.getAttribute('aria-invalid')).toBe('true')

    input.dispatchEvent(new FocusEvent('blur', { bubbles: false }))
    await tick()
    await tick()

    expect(value.current).toBe(20)
    expect(input.value).toBe('20')
  })

  it('resynchronizes after a parent clamps back to the unchanged controlled value', async () => {
    const { input, value } = renderControlled(6.1, next => Math.max(6.1, next), { step: 0.1 })

    await type(input, '1')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await tick()
    await tick()

    expect(value.current).toBe(6.1)
    expect(input.value).toBe('6.1')
    expect(input.getAttribute('aria-invalid')).toBeNull()
  })

  it('resynchronizes after a parent rounds quantity', async () => {
    const { input, value } = renderControlled(2, next => Math.max(1, Math.round(next)))

    await type(input, '2.7')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await tick()
    await tick()

    expect(value.current).toBe(3)
    expect(input.value).toBe('3')
  })

  it.each(['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const)(
    'commits %s+Enter and leaves the event unhandled for global shortcuts',
    async modifier => {
      const { input, root, onUpdate } = renderField()
      let bubbled = false
      root.addEventListener('keydown', () => { bubbled = true })
      await type(input, '15')

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(event)
      await tick()

      expect(event.defaultPrevented).toBe(false)
      expect(bubbled).toBe(true)
      expect(onUpdate.mock.calls).toEqual([[15]])
    },
  )

  it('commits the normalized value before the global calculate shortcut runs', async () => {
    const { input, value } = renderControlled(2, next => Math.max(1, Math.round(next)))
    let calculatedWith: number | null = null
    const globalHandler = createShortcutHandler([{
      key: 'Enter',
      ctrlOrMeta: true,
      allowInEditable: true,
      run: () => { calculatedWith = value.current },
    }])
    window.addEventListener('keydown', globalHandler)

    try {
      await type(input, '2.7')
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(event)
      await tick()
      await tick()

      expect(value.current).toBe(3)
      expect(calculatedWith).toBe(3)
      expect(input.value).toBe('3')
    } finally {
      window.removeEventListener('keydown', globalHandler)
    }
  })

  it('synchronizes the draft when the controlled model changes', async () => {
    const { input, onUpdate, rerender } = renderField()

    await type(input, '15')
    await rerender({ value: 8 })
    await tick()

    expect(input.value).toBe('8')
    expect(onUpdate).not.toHaveBeenCalled()
  })
})

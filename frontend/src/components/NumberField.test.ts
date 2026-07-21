// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createShortcutHandler } from '@/composables/useKeyboardShortcuts'
import NumberField from './NumberField.vue'

function mountField(overrides: Record<string, unknown> = {}) {
  return mount(NumberField, {
    props: {
      modelValue: 12,
      ariaLabel: 'Width',
      min: 1,
      max: 20,
      step: 0.5,
      ...overrides,
    },
  })
}

function mountControlled(
  initialValue: number,
  normalize: (value: number) => number,
  overrides: Record<string, unknown> = {},
) {
  const value = ref(initialValue)
  const Parent = defineComponent({
    setup() {
      return () => h(NumberField, {
        modelValue: value.value,
        ariaLabel: 'Value',
        min: 1,
        step: 1,
        ...overrides,
        'onUpdate:modelValue': (next: number) => {
          value.value = normalize(next)
        },
      })
    },
  })

  return { wrapper: mount(Parent), value }
}

describe('NumberField', () => {
  it('keeps a string draft and commits a finite value on Enter', async () => {
    const wrapper = mountField()
    const input = wrapper.get('input')
    let bubbled = false
    wrapper.element.addEventListener('keydown', () => { bubbled = true })

    await input.setValue('15.5')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(input.element.value).toBe('15.5')
    expect(input.attributes('aria-invalid')).toBeUndefined()

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.element.dispatchEvent(event)
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([[15.5]])
    expect(event.defaultPrevented).toBe(true)
    expect(bubbled).toBe(true)
  })

  it('shows one described invalid state with a visible cue and reverts an empty draft on blur', async () => {
    const wrapper = mountField()
    const input = wrapper.get('input')

    await input.setValue('')

    expect(input.attributes('aria-invalid')).toBe('true')
    const descriptionId = input.attributes('aria-describedby')
    expect(descriptionId).toBeTruthy()
    expect(wrapper.get(`#${descriptionId}`).text()).not.toBe('')
    expect(wrapper.get('.num-field-error-indicator').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.attributes('title')).toBeUndefined()
    expect(wrapper.classes()).toContain('is-invalid')

    await input.trigger('blur')

    expect(input.element.value).toBe('12')
    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('never emits a non-finite value and reverts an overflow on Enter', async () => {
    const wrapper = mountField()
    const input = wrapper.get('input')

    await input.setValue('1e309')
    await input.trigger('keydown', { key: 'Enter' })

    expect(input.element.value).toBe('12')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('marks an out-of-range draft and clamps it when committed', async () => {
    const { wrapper, value } = mountControlled(12, next => next, { max: 20, step: 0.5 })
    const input = wrapper.get('input')

    await input.setValue('25')
    expect(input.attributes('aria-invalid')).toBe('true')

    await input.trigger('blur')

    expect(value.value).toBe(20)
    expect(input.element.value).toBe('20')
  })

  it('resynchronizes after a parent clamps back to the unchanged controlled value', async () => {
    const { wrapper, value } = mountControlled(6.1, next => Math.max(6.1, next), { step: 0.1 })
    const input = wrapper.get('input')

    await input.setValue('1')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(value.value).toBe(6.1)
    expect(input.element.value).toBe('6.1')
    expect(input.attributes('aria-invalid')).toBeUndefined()
  })

  it('resynchronizes after a parent rounds quantity', async () => {
    const { wrapper, value } = mountControlled(2, next => Math.max(1, Math.round(next)))
    const input = wrapper.get('input')

    await input.setValue('2.7')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(value.value).toBe(3)
    expect(input.element.value).toBe('3')
  })

  it.each(['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const)(
    'commits %s+Enter and leaves the event unhandled for global shortcuts',
    async modifier => {
      const wrapper = mountField()
      const input = wrapper.get('input')
      let bubbled = false
      wrapper.element.addEventListener('keydown', () => { bubbled = true })
      await input.setValue('15')

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      })
      input.element.dispatchEvent(event)
      await nextTick()

      expect(event.defaultPrevented).toBe(false)
      expect(bubbled).toBe(true)
      expect(wrapper.emitted('update:modelValue')).toEqual([[15]])
    },
  )

  it('commits the normalized value before the global calculate shortcut runs', async () => {
    const { wrapper, value } = mountControlled(2, next => Math.max(1, Math.round(next)))
    document.body.appendChild(wrapper.element)
    const input = wrapper.get('input')
    let calculatedWith: number | null = null
    const globalHandler = createShortcutHandler([{
      key: 'Enter',
      ctrlOrMeta: true,
      allowInEditable: true,
      run: () => { calculatedWith = value.value },
    }])
    window.addEventListener('keydown', globalHandler)

    try {
      await input.setValue('2.7')
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      input.element.dispatchEvent(event)
      await nextTick()

      expect(value.value).toBe(3)
      expect(calculatedWith).toBe(3)
      expect(input.element.value).toBe('3')
    } finally {
      window.removeEventListener('keydown', globalHandler)
      wrapper.unmount()
    }
  })

  it('synchronizes the draft when the controlled model changes', async () => {
    const wrapper = mountField()
    const input = wrapper.get('input')

    await input.setValue('15')
    await wrapper.setProps({ modelValue: 8 })

    expect(input.element.value).toBe('8')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

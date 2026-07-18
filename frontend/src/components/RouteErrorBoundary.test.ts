// @vitest-environment happy-dom
import { defineComponent, h, nextTick, onUnmounted, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RouteErrorBoundary from './RouteErrorBoundary.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RouteErrorBoundary', () => {
  it('shows a recoverable fallback and remounts the failed route', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const shouldThrow = ref(true)
    const persistProject = vi.fn()
    const RouteView = defineComponent({
      setup() {
        onUnmounted(persistProject)
        return () => {
          if (shouldThrow.value) throw new Error('render failed')
          return h('p', 'Project restored')
        }
      },
    })
    const wrapper = mount(RouteErrorBoundary, {
      slots: {
        default: ({ retryKey }: { retryKey: number }) => h(RouteView, { key: retryKey }),
      },
    })

    await nextTick()
    expect(wrapper.get('[role="alert"]').exists()).toBe(true)
    expect(persistProject).toHaveBeenCalledOnce()
    shouldThrow.value = false
    await wrapper.get('.btn-primary').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Project restored')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})

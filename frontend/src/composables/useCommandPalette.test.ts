import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useCommandPalette, type PaletteCommand } from './useCommandPalette'

function keyEvent(key: string): KeyboardEvent {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent
}

describe('useCommandPalette', () => {
  it('opens, focuses, and filters a declarative command registry', async () => {
    const focusSearch = vi.fn()
    const commands = ref<PaletteCommand[]>([
      { id: 'calculate', label: 'Calculate layout', run: vi.fn() },
      { id: 'import', label: 'Import pieces', run: vi.fn() },
    ])
    const scope = effectScope()
    const palette = scope.run(() => useCommandPalette({ commands, focusSearch }))!

    palette.open()
    await nextTick()
    expect(palette.isOpen.value).toBe(true)
    expect(focusSearch).toHaveBeenCalledOnce()

    palette.query.value = 'IMPORT'
    await nextTick()
    expect(palette.visibleCommands.value.map(command => command.id)).toEqual(['import'])
    expect(palette.activeIndex.value).toBe(0)
    scope.stop()
  })

  it('skips disabled commands and supports wrap, Home, and End navigation', async () => {
    const scrollToIndex = vi.fn()
    const commands: PaletteCommand[] = [
      { id: 'first', label: 'First', disabled: true, run: vi.fn() },
      { id: 'second', label: 'Second', run: vi.fn() },
      { id: 'third', label: 'Third', disabled: true, run: vi.fn() },
      { id: 'fourth', label: 'Fourth', run: vi.fn() },
    ]
    const scope = effectScope()
    const palette = scope.run(() => useCommandPalette({ commands, scrollToIndex }))!
    palette.open()
    expect(palette.activeIndex.value).toBe(1)

    palette.move(-1)
    await nextTick()
    expect(palette.activeIndex.value).toBe(3)
    expect(scrollToIndex).toHaveBeenCalledWith(3)

    palette.onKeydown(keyEvent('Home'))
    expect(palette.activeIndex.value).toBe(1)
    palette.onKeydown(keyEvent('End'))
    expect(palette.activeIndex.value).toBe(3)
    scope.stop()
  })

  it('closes before execution and reports command failures', async () => {
    const error = new Error('failed')
    const onError = vi.fn()
    const run = vi.fn().mockRejectedValue(error)
    const scope = effectScope()
    const palette = scope.run(() => useCommandPalette({
      commands: [{ id: 'broken', label: 'Broken', run }],
      onError,
    }))!
    palette.open()

    await expect(palette.runActive()).resolves.toBe(false)
    expect(palette.isOpen.value).toBe(false)
    expect(onError).toHaveBeenCalledWith(error)
    scope.stop()
  })
})

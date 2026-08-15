// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import { useCommandPalette, type PaletteCommand } from './useCommandPalette.svelte'

function keyEvent(key: string): KeyboardEvent {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent
}

describe('useCommandPalette', () => {
  it('opens, focuses, and filters a declarative command registry', async () => {
    const focusSearch = vi.fn()
    const registry = $state({
      commands: [
        { id: 'calculate', label: 'Calculate layout', run: vi.fn() },
        { id: 'import', label: 'Import pieces', run: vi.fn() },
      ] as PaletteCommand[],
    })
    let palette!: ReturnType<typeof useCommandPalette>
    const stop = $effect.root(() => {
      palette = useCommandPalette({ commands: () => registry.commands, focusSearch })
      return () => {}
    })

    palette.open()
    await tick()
    expect(palette.isOpen).toBe(true)
    expect(focusSearch).toHaveBeenCalledOnce()

    palette.query = 'IMPORT'
    await tick()
    expect(palette.visibleCommands.map(command => command.id)).toEqual(['import'])
    expect(palette.activeIndex).toBe(0)
    stop()
  })

  it('skips disabled commands and supports wrap, Home, and End navigation', async () => {
    const scrollToIndex = vi.fn()
    const commands: PaletteCommand[] = [
      { id: 'first', label: 'First', disabled: true, run: vi.fn() },
      { id: 'second', label: 'Second', run: vi.fn() },
      { id: 'third', label: 'Third', disabled: true, run: vi.fn() },
      { id: 'fourth', label: 'Fourth', run: vi.fn() },
    ]
    let palette!: ReturnType<typeof useCommandPalette>
    const stop = $effect.root(() => {
      palette = useCommandPalette({ commands: () => commands, scrollToIndex })
      return () => {}
    })
    palette.open()
    expect(palette.activeIndex).toBe(1)

    palette.move(-1)
    await tick()
    expect(palette.activeIndex).toBe(3)
    expect(scrollToIndex).toHaveBeenCalledWith(3)

    palette.onKeydown(keyEvent('Home'))
    expect(palette.activeIndex).toBe(1)
    palette.onKeydown(keyEvent('End'))
    expect(palette.activeIndex).toBe(3)
    stop()
  })

  it('closes before execution and reports command failures', async () => {
    const error = new Error('failed')
    const onError = vi.fn()
    const run = vi.fn().mockRejectedValue(error)
    const commands: PaletteCommand[] = [{ id: 'broken', label: 'Broken', run }]
    let palette!: ReturnType<typeof useCommandPalette>
    const stop = $effect.root(() => {
      palette = useCommandPalette({ commands: () => commands, onError })
      return () => {}
    })
    palette.open()

    await expect(palette.runActive()).resolves.toBe(false)
    expect(palette.isOpen).toBe(false)
    expect(onError).toHaveBeenCalledWith(error)
    stop()
  })
})

import {
  computed,
  nextTick,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'

export interface PaletteCommand {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  run: () => void | Promise<void>
}

interface CommandPaletteOptions {
  commands: MaybeRefOrGetter<readonly PaletteCommand[]>
  focusSearch?: () => void
  scrollToIndex?: (index: number) => void
  onError?: (error: unknown) => void
}

export function useCommandPalette(options: CommandPaletteOptions) {
  const isOpen = ref(false)
  const query = ref('')
  const activeIndex = ref(0)

  const visibleCommands = computed(() => {
    const normalized = query.value.trim().toLocaleLowerCase()
    const commands = toValue(options.commands)
    if (!normalized) return commands
    return commands.filter(command => command.label.toLocaleLowerCase().includes(normalized))
  })

  function firstEnabledIndex(commands = visibleCommands.value): number {
    const index = commands.findIndex(command => !command.disabled)
    return index >= 0 ? index : 0
  }

  function lastEnabledIndex(): number {
    for (let index = visibleCommands.value.length - 1; index >= 0; index--) {
      if (!visibleCommands.value[index].disabled) return index
    }
    return 0
  }

  function reconcileActiveIndex() {
    const command = visibleCommands.value[activeIndex.value]
    if (!command || command.disabled) activeIndex.value = firstEnabledIndex()
  }

  watch(query, () => { activeIndex.value = firstEnabledIndex() })
  watch(visibleCommands, reconcileActiveIndex)

  function open() {
    isOpen.value = true
    query.value = ''
    activeIndex.value = firstEnabledIndex()
    nextTick(() => options.focusSearch?.())
  }

  function close() {
    isOpen.value = false
  }

  async function run(command: PaletteCommand): Promise<boolean> {
    if (command.disabled) return false
    close()
    try {
      await command.run()
      return true
    } catch (error) {
      options.onError?.(error)
      return false
    }
  }

  function runActive(): Promise<boolean> {
    const command = visibleCommands.value[activeIndex.value]
    return command ? run(command) : Promise.resolve(false)
  }

  function move(direction: -1 | 1) {
    const commands = visibleCommands.value
    if (!commands.length) return
    let index = activeIndex.value
    for (let attempts = 0; attempts < commands.length; attempts++) {
      index = (index + direction + commands.length) % commands.length
      if (!commands[index].disabled) {
        activeIndex.value = index
        nextTick(() => options.scrollToIndex?.(index))
        return
      }
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void runActive()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      activeIndex.value = firstEnabledIndex()
    } else if (event.key === 'End') {
      event.preventDefault()
      activeIndex.value = lastEnabledIndex()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return {
    isOpen,
    query,
    activeIndex,
    visibleCommands,
    open,
    close,
    run,
    runActive,
    move,
    onKeydown,
  }
}

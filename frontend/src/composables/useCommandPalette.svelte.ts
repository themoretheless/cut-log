import { tick } from 'svelte'

export interface PaletteCommand {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  run: () => void | Promise<void>
}

interface CommandPaletteOptions {
  commands: () => readonly PaletteCommand[]
  focusSearch?: () => void
  scrollToIndex?: (index: number) => void
  onError?: (error: unknown) => void
}

export function useCommandPalette(options: CommandPaletteOptions) {
  const state = $state({
    isOpen: false,
    query: '',
    activeIndex: 0,
  })

  const visibleCommands = $derived.by(() => {
    const normalized = state.query.trim().toLocaleLowerCase()
    const commands = options.commands()
    if (!normalized) return commands
    return commands.filter(command => command.label.toLocaleLowerCase().includes(normalized))
  })

  function firstEnabledIndex(commands: readonly PaletteCommand[] = visibleCommands): number {
    const index = commands.findIndex(command => !command.disabled)
    return index >= 0 ? index : 0
  }

  function lastEnabledIndex(): number {
    for (let index = visibleCommands.length - 1; index >= 0; index--) {
      if (!visibleCommands[index].disabled) return index
    }
    return 0
  }

  // Svelte port note: instead of Vue's watchers on query/visibleCommands the
  // active index is reconciled lazily whenever it is read, which keeps the
  // composable free of effect scopes.
  const activeIndex = $derived.by(() => {
    const command = visibleCommands[state.activeIndex]
    if (!command || command.disabled) return firstEnabledIndex()
    return state.activeIndex
  })

  function open() {
    state.isOpen = true
    state.query = ''
    state.activeIndex = firstEnabledIndex()
    void tick().then(() => options.focusSearch?.())
  }

  function close() {
    state.isOpen = false
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
    const command = visibleCommands[activeIndex]
    return command ? run(command) : Promise.resolve(false)
  }

  function move(direction: -1 | 1) {
    const commands = visibleCommands
    if (!commands.length) return
    let index = activeIndex
    for (let attempts = 0; attempts < commands.length; attempts++) {
      index = (index + direction + commands.length) % commands.length
      if (!commands[index].disabled) {
        state.activeIndex = index
        void tick().then(() => options.scrollToIndex?.(index))
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
      state.activeIndex = firstEnabledIndex()
    } else if (event.key === 'End') {
      event.preventDefault()
      state.activeIndex = lastEnabledIndex()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return {
    get isOpen() { return state.isOpen },
    get query() { return state.query },
    set query(value: string) {
      state.query = value
      state.activeIndex = firstEnabledIndex()
    },
    get activeIndex() { return activeIndex },
    set activeIndex(value: number) { state.activeIndex = value },
    get visibleCommands() { return visibleCommands },
    open,
    close,
    run,
    runActive,
    move,
    onKeydown,
  }
}

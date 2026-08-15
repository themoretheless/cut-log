export type ToastTone = 'status' | 'error'

export function useToast(defaultDuration = 2_200) {
  const state = $state({ message: '', tone: 'status' as ToastTone })
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    clearTimeout(timer)
    timer = undefined
    state.message = ''
  }

  function show(nextMessage: string, nextTone: ToastTone = 'status', duration = defaultDuration) {
    clearTimeout(timer)
    state.message = nextMessage
    state.tone = nextTone
    timer = setTimeout(clear, duration)
  }

  const showError = (nextMessage: string, duration = defaultDuration) => show(nextMessage, 'error', duration)

  return {
    get message() { return state.message },
    get tone() { return state.tone },
    show,
    showError,
    clear,
  }
}

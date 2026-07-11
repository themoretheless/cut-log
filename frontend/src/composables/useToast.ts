import { onScopeDispose, ref } from 'vue'

export type ToastTone = 'status' | 'error'

export function useToast(defaultDuration = 2_200) {
  const message = ref('')
  const tone = ref<ToastTone>('status')
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    clearTimeout(timer)
    timer = undefined
    message.value = ''
  }

  function show(nextMessage: string, nextTone: ToastTone = 'status', duration = defaultDuration) {
    clearTimeout(timer)
    message.value = nextMessage
    tone.value = nextTone
    timer = setTimeout(clear, duration)
  }

  const showError = (nextMessage: string, duration = defaultDuration) => show(nextMessage, 'error', duration)

  onScopeDispose(clear)
  return { message, tone, show, showError, clear }
}

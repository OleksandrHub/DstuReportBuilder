import { ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastMsg {
  id: number
  text: string
  kind: ToastKind
}

const toasts = ref<ToastMsg[]>([])
let nextId = 1

// Global singleton: any component can push, <Toast /> renders.
export function useToast() {
  function push(text: string, kind: ToastKind = 'info', timeout = 6000) {
    const id = nextId++
    toasts.value.push({ id, text, kind })
    setTimeout(() => dismiss(id), timeout)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    dismiss,
    success: (text: string) => push(text, 'success'),
    error: (text: string) => push(text, 'error', 9000),
    info: (text: string) => push(text, 'info'),
  }
}

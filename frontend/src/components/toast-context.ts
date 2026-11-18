import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error'

export interface ToastApi {
  show: (message: string, tone?: ToastTone) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return context
}

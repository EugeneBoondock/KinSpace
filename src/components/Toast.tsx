'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'

type Toast = {
  id: number
  message: string
  kind: ToastKind
}

type ToastContextValue = {
  push: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue>({
  push: () => undefined,
})

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId++
    setToasts((current) => [...current, { id, message, kind }])
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3800)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-6 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((toast) => (
          <ToastBubble key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastBubble({ toast }: { toast: Toast }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const color =
    toast.kind === 'success'
      ? 'bg-[#6B8A83]/95 text-[#eedfc8]'
      : toast.kind === 'error'
        ? 'bg-[#B85C3A]/95 text-[#eedfc8]'
        : 'bg-[#2A4A42]/95 text-[#eedfc8] border border-[#eedfc8]/15'

  const icon =
    toast.kind === 'success' ? 'ri-check-line' : toast.kind === 'error' ? 'ri-error-warning-line' : 'ri-information-line'

  return (
    <div
      className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-[0_12px_32px_rgba(16,28,24,0.4)] backdrop-blur-sm transition-all duration-300 ${color} ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      <i className={icon} />
      <span>{toast.message}</span>
    </div>
  )
}

'use client'

import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type TabsContextValue = { value: string; setValue: (v: string) => void; baseId: string }
const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>')
  return ctx
}

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  children: ReactNode
  className?: string
}) {
  const [internal, setInternal] = useState(defaultValue ?? '')
  const baseId = useId()
  const value = controlled ?? internal
  const setValue = (v: string) => {
    if (controlled === undefined) setInternal(v)
    onValueChange?.(v)
  }
  return (
    <TabsContext.Provider value={{ value, setValue, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex gap-1 rounded-full bg-brand-ink/[0.05] p-1', className)}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: active, setValue, baseId } = useTabs()
  const selected = active === value
  const tabId = `${baseId}-tab-${value}`
  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={selected}
      onClick={() => setValue(value)}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40',
        selected ? 'bg-brand-surface text-brand-ink shadow-[var(--shadow-card)]' : 'text-brand-ink/60 hover:text-brand-ink/90',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: active, baseId } = useTabs()
  if (active !== value) return null
  return (
    <div role="tabpanel" id={`${baseId}-panel-${value}`} aria-labelledby={`${baseId}-tab-${value}`} className={className}>
      {children}
    </div>
  )
}

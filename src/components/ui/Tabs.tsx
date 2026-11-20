import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: string
  badge?: ReactNode
}

export interface TabsProps<T extends string> {
  value: T
  items: TabItem<T>[]
  onChange: (next: T) => void
  label: string
  className?: string
}

export function Tabs<T extends string>({ value, items, onChange, label, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex shrink-0 items-center gap-0.5 border-b border-line/70 px-1.5', className)}
    >
      {items.map((item) => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
              active ? 'text-accent' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {item.label}
            {item.badge}
            {active && (
              <span
                className="absolute inset-x-1.5 -bottom-px h-[2px] rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

import { cn } from '../../lib/cn'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
  title?: string
  disabled?: boolean
}

export interface SegmentedProps<T extends string | number> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (next: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/** 分段选择器。用 aria-pressed 表达当前档位，键盘 Tab 可逐个访问。 */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'sm',
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex rounded-lg border border-line/80 bg-void/40 p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35',
              size === 'sm' ? 'px-2 py-0.5 font-mono text-[10px]' : 'px-2.5 py-1 font-mono text-[11px]',
              active
                ? 'bg-accent font-medium text-void'
                : 'text-ink-3 hover:text-ink-2 hover:bg-white/[0.04]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

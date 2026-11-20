import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'subtle' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'border border-accent/60 bg-accent text-void shadow-[0_10px_30px_-14px_var(--accent)] hover:brightness-110',
  outline:
    'border border-line-2 bg-white/[0.02] text-ink hover:border-accent/45 hover:bg-accent/[0.07] hover:text-accent',
  ghost: 'border border-transparent text-ink-2 hover:bg-white/[0.05] hover:text-ink',
  subtle: 'border border-line/80 bg-panel-2/70 text-ink-2 hover:text-ink hover:border-line-2',
  danger: 'border border-err/40 bg-err/10 text-err hover:bg-err/15',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[12px]',
  md: 'h-9 gap-2 px-4 text-[12.5px]',
}

/**
 * 按钮样式函数单独成文件：`<Link>` 需要按钮外观但必须是锚点，
 * 不能塞进 <button>；同时这也让 Button.tsx 只导出组件，保持 Fast Refresh 有效。
 */
export function buttonClass(
  options: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {},
): string {
  const { variant = 'primary', size = 'md', className } = options
  return cn(
    'inline-flex select-none items-center justify-center rounded-lg font-medium tracking-[0.01em] transition-[background-color,border-color,color,filter,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-40',
    VARIANT[variant],
    SIZE[size],
    className,
  )
}

import { cn } from '../../lib/cn'

export interface ChipMarkProps {
  size?: number
  className?: string
}

/** 品牌标记：一块带引脚的裸片。刻意用 CSS 变量取色，跟随强调色主题。 */
export function ChipMark({ size = 34, className }: ChipMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="chip-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="#a970ff" />
        </linearGradient>
      </defs>
      <rect
        x="17"
        y="17"
        width="30"
        height="30"
        rx="7"
        fill="color-mix(in oklab, var(--accent) 10%, transparent)"
        stroke="url(#chip-mark-gradient)"
        strokeWidth="2"
      />
      <rect x="27" y="27" width="10" height="10" rx="2.5" fill="url(#chip-mark-gradient)" />
      <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" opacity="0.75">
        <path d="M25 17V10M32 17V10M39 17V10M25 54v-7M32 54v-7M39 54v-7" />
        <path d="M17 25H10M17 32H10M17 39H10M54 25h-7M54 32h-7M54 39h-7" />
      </g>
    </svg>
  )
}

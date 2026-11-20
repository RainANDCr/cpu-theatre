import { Link } from 'react-router-dom'
import { ArrowUpRight, Construction } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Panel } from '../components/ui/Panel'
import type { ReactNode } from 'react'

export interface PlaceholderLink {
  label: string
  path: string
}

export interface ModulePlaceholderProps {
  moduleCode: string
  title: string
  english: string
  phase: number
  summary: ReactNode
  planned: string[]
  note: string
  related?: PlaceholderLink[]
}

/**
 * 尚未构建的模块统一走这个页面。
 *
 * 关键取舍：不摆放「示例数据」来充场面。一个教学工具最伤信任的做法，
 * 就是让用户以为自己看到的是真实执行结果。这里只说明将要构建什么、为什么还没到。
 */
export function ModulePlaceholder({
  moduleCode,
  title,
  english,
  phase,
  summary,
  planned,
  note,
  related = [],
}: ModulePlaceholderProps) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-16 pt-8 lg:px-9 lg:pt-10">
      <div className="flex flex-wrap items-center gap-2.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-3">
        <span>{moduleCode}</span>
        <span className="text-line-2">/</span>
        <Badge tone="amber" dot>
          phase {String(phase).padStart(2, '0')} · 待构建
        </Badge>
      </div>

      <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">
        {title}
      </h1>
      <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-3">{english}</p>
      <div className="mt-4 max-w-[700px] text-[13px] leading-[1.9] text-ink-2">{summary}</div>

      <div className="mt-7 grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
        <Panel title="Planned capabilities" subtitle="这个模块交付时必须成立的能力，按依赖顺序排列">
          <ol className="space-y-0">
            {planned.map((item, index) => (
              <li
                key={item}
                className="flex gap-3 border-b border-line/50 py-2.5 last:border-0 last:pb-0 first:pt-0"
              >
                <span className="mt-0.5 size-5 shrink-0 rounded border border-line-2 text-center font-mono text-[9.5px] leading-[18px] text-ink-3">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-[12px] leading-relaxed text-ink-2">{item}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-4">
          <Panel title="Current state" tone="quiet">
            <div className="rounded-lg border border-dashed border-line-2/80 bg-void/30 px-4 py-6 text-center">
              <Construction size={22} className="mx-auto text-ink-3" strokeWidth={1.5} />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-2">
                not implemented
              </p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">{note}</p>
            </div>
          </Panel>

          {related.length > 0 && (
            <Panel title="Related" subtitle="先看这些能少走弯路">
              <ul className="space-y-1.5">
                {related.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-ink/[0.05] hover:text-accent"
                    >
                      <ArrowUpRight size={13} className="text-ink-3 group-hover:text-accent" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

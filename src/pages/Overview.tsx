import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch } from 'lucide-react'
import { DieSchematic } from '../components/dashboard/DieSchematic'
import { Badge } from '../components/ui/Badge'
import { buttonClass } from '../components/ui/buttonStyles'
import { Panel } from '../components/ui/Panel'
import { Readout } from '../components/ui/Readout'
import { SectionHeading } from '../components/ui/SectionHeading'
import { ACCEPTANCE_CASES, ARCHITECTURE, INVARIANTS, STAGES, type Stage } from '../config/project'
import { cn } from '../lib/cn'
import { useCpuStore } from '../store/cpuStore'

const STAGE_TONE = {
  done: { badge: 'green' as const, label: '已交付', card: 'border-ok/25 bg-ok/[0.035]' },
  next: { badge: 'blue' as const, label: '下一步', card: 'border-accent/35 bg-accent/[0.05]' },
  planned: { badge: 'slate' as const, label: '待构建', card: 'border-line/80 bg-panel/40' },
}

function StageCard({ stage }: { stage: Stage }) {
  const tone = STAGE_TONE[stage.status]
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border p-3.5 transition-colors hover:border-line-2',
        tone.card,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] tracking-[0.2em] text-ink-3">{stage.code}</span>
        <Badge tone={tone.badge} dot={stage.status === 'next'}>
          {tone.label}
        </Badge>
      </div>
      <h3 className="mt-2.5 text-[13.5px] font-medium text-ink">{stage.title}</h3>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
        {stage.english}
      </p>
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-2">{stage.deliverable}</p>
    </article>
  )
}

export default function Overview() {
  const mode = useCpuStore((state) => state.mode)
  const engineReady = useCpuStore((state) => state.engineReady)

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-16 pt-8 lg:px-9 lg:pt-10">
      {/* 主视觉 */}
      <section className="grid items-start gap-7 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-[9.5px] uppercase tracking-[0.26em] text-ink-3">
            <span className="h-px w-7 bg-accent/70" />
            CSAPP · Chapter 04 · Processor Architecture
          </div>

          {/* 两句标语各自成行，且第二句主动缩小一号：
              比强行拆行更稳，也不会在大屏上把 MACHINE. 孤立成第三行 */}
          <h1 className="mt-4 text-ink">
            <span className="block whitespace-nowrap text-[clamp(21px,7.6vw,30px)] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[42px] xl:text-[52px]">
              SEE THE <span className="text-accent text-glow">INVISIBLE</span>.
            </span>
            <span className="mt-2 block whitespace-nowrap text-[clamp(15px,5.2vw,20px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink-2 sm:text-[30px] xl:text-[36px]">
              UNDERSTAND THE MACHINE.
            </span>
          </h1>

          <p className="mt-5 max-w-[590px] text-[13px] leading-[1.9] text-ink-2">
            处理器从不解释自己。它只是把同一件事重复十亿次：取一条指令，读懂它，算出结果，写回去，
            再把门牌号往前挪一格。CPU THEATRE
            把这串动作按节拍摊开——数据怎么在总线上走、条件码为什么在这一拍被置位、
            一次押错的跳转如何让流水线白忙一场，全部可见。
          </p>
          <p className="mt-2 max-w-[590px] text-[12px] leading-relaxed text-ink-3">
            所有数值由本地执行引擎算出，界面只负责让它可见。没有预设动画，没有云端请求。
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/simulator" className={buttonClass({ variant: 'primary' })}>
              进入模拟器
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
            <Link to="/learning" className={buttonClass({ variant: 'outline' })}>
              从指令集开始
            </Link>
            <Link
              to="/editor"
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'text-ink-3' })}
            >
              查看内置示例
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-ok" aria-hidden="true" />
              {`phase 00–${String(STAGES.filter((stage) => stage.status === 'done').at(-1)?.index ?? 0).padStart(2, '0')} 已交付`}
            </span>
            <span>vitest 就绪</span>
            <span>offline by design</span>
          </div>
        </div>

        <Panel
          tone="accent"
          title="System Panel"
          subtitle="目标硬件轮廓 · 非实时数据"
          actions={<Badge tone={engineReady ? 'green' : 'amber'} dot>{engineReady ? 'engine' : 'engine offline'}</Badge>}
          padded={false}
        >
          <div className="flex justify-center px-4 pt-4">
            <DieSchematic className="h-[236px] w-[236px]" />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-line/70 p-3">
            <Readout label="ISA" value="Y86-64" tone="blue" />
            <Readout label="Word" value="64 bit" tone="cyan" />
            <Readout label="Endian" value="little" tone="purple" />
            <Readout label="Mode" value={mode} tone="amber" />
          </div>
        </Panel>
      </section>

      {/* 设计铁律 */}
      <section className="mt-9 grid gap-3 md:grid-cols-3">
        {INVARIANTS.map((item) => (
          <div
            key={item.index}
            className="group relative overflow-hidden rounded-xl border border-line/80 bg-panel/45 p-4 transition-colors hover:border-line-2"
          >
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  'font-mono text-[10px] tracking-[0.2em]',
                  item.tone === 'bus' && 'text-bus',
                  item.tone === 'ctrl' && 'text-ctrl',
                  item.tone === 'reg' && 'text-reg',
                )}
              >
                {item.index}
              </span>
              <span className="h-px flex-1 self-center bg-line/50" />
            </div>
            <h3 className="mt-2 text-[13px] font-medium text-ink">{item.title}</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">{item.detail}</p>
          </div>
        ))}
      </section>

      {/* 路线图 */}
      <section className="mt-11">
        <SectionHeading
          eyebrow="Build order"
          title="十一个阶段，逐段验收"
          description="阶段之间不允许跳步：上一阶段的测试不绿，就不动手写下一阶段。灰色卡片代表它还不存在——不是还没画，是还没写。"
          actions={
            <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
              <GitBranch size={12} />
              {STAGES.filter((stage) => stage.status === 'done').length} / {STAGES.length} complete
            </span>
          }
        />
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((stage) => (
            <StageCard key={stage.index} stage={stage} />
          ))}
        </div>
      </section>

      {/* 架构 + 验收 */}
      <section className="mt-11 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel
          title="架构分层"
          subtitle="依赖方向单向：视图 → 状态适配 → 引擎。反向依赖一次都不允许。"
        >
          <ol className="space-y-3">
            {ARCHITECTURE.map((layer, index) => (
              <li key={layer.path} className="flex gap-3">
                <span className="mt-0.5 font-mono text-[9.5px] tabnums text-ink-3">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1 border-b border-line/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-medium text-ink">{layer.name}</span>
                    <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                      {layer.path}
                    </code>
                    {layer.reactFree && <Badge tone="cyan">react-free</Badge>}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{layer.role}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title="验收用例"
          subtitle="界面上不写「已支持」，只写「哪条用例已经绿了」。"
          actions={<Badge tone="amber">0 / 5</Badge>}
        >
          <ul className="space-y-2.5">
            {ACCEPTANCE_CASES.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-line/70 bg-panel-2/40 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded border border-line-2 font-mono text-[10px] text-ink-2">
                    {item.id}
                  </span>
                  <span className="flex-1 truncate text-[12px] text-ink">{item.title}</span>
                  <Badge tone={item.status === 'passed' ? 'green' : 'slate'}>
                    {item.status === 'passed' ? 'pass' : `p${item.phase}`}
                  </Badge>
                </div>
                <p className="mt-1.5 pl-7 font-mono text-[10px] leading-relaxed text-ink-3">
                  {item.expectation}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line/60 pt-3 text-[11px] leading-relaxed text-ink-3">
            目前一条都还没点亮——执行引擎尚不存在。Phase 3 起，它们会逐条变成真实的断言，
            而不是文档里的一句承诺。
          </p>
        </Panel>
      </section>
    </div>
  )
}

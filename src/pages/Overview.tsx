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
import { T, useI18n } from '../i18n'

const STAGE_TONE = {
  done: { badge: 'green' as const, card: 'border-ok/25 bg-ok/[0.035]' },
  next: { badge: 'blue' as const, card: 'border-accent/35 bg-accent/[0.05]' },
  planned: { badge: 'slate' as const, card: 'border-line/80 bg-panel/40' },
} as const

const STATUS_LABEL: Record<'done' | 'next' | 'planned', { zh: string; en: string }> = {
  done: { zh: '已交付', en: 'shipped' },
  next: { zh: '下一步', en: 'next' },
  planned: { zh: '待构建', en: 'planned' },
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
          <T zh={STATUS_LABEL[stage.status].zh} en={STATUS_LABEL[stage.status].en} />
        </Badge>
      </div>
      <h3 className="mt-2.5 text-[13.5px] font-medium text-ink">
        <T zh={stage.title} en={stage.titleEn} />
      </h3>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
        {stage.english}
      </p>
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-2">
        <T block zh={stage.deliverable} en={stage.deliverableEn} />
      </p>
    </article>
  )
}

export default function Overview() {
  const mode = useCpuStore((state) => state.mode)
  const engineReady = useCpuStore((state) => state.engineReady)
  const { t } = useI18n()
  const passed = ACCEPTANCE_CASES.filter((item) => item.status === 'passed').length
  const doneStages = STAGES.filter((stage) => stage.status === 'done')

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
            <T
              block
              zh="处理器从不解释自己。它只是把同一件事重复十亿次：取一条指令，读懂它，算出结果，写回去，再把门牌号往前挪一格。CPU THEATRE 把这串动作按节拍摊开——数据怎么在总线上走、条件码为什么在这一拍被置位、一次押错的跳转如何让流水线白忙一场，全部可见。"
              en="A processor never explains itself. It repeats one thing a billion times: fetch an instruction, decode it, compute, write back, advance the address. CPU THEATRE lays that loop out cycle by cycle — how data moves on the bus, why a condition code flips on this tick, how a mispredicted branch wastes a pipeline."
            />
          </p>
          <p className="mt-2 max-w-[590px] text-[12px] leading-relaxed text-ink-3">
            <T
              block
              zh="所有数值由本地执行引擎算出，界面只负责让它可见。没有预设动画，没有云端请求。"
              en="Every number comes from the local execution engine; the UI only makes it visible. No canned animation, no network calls."
            />
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/simulator" className={buttonClass({ variant: 'primary' })}>
              <T zh="进入模拟器" en="Open simulator" />
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
            <Link to="/learning" className={buttonClass({ variant: 'outline' })}>
              <T zh="从指令集开始" en="Start with the ISA" />
            </Link>
            <Link
              to="/editor"
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'text-ink-3' })}
            >
              <T zh="查看内置示例" en="Browse examples" />
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-ok" aria-hidden="true" />
              {t(
                `phase 00–${String(doneStages.at(-1)?.index ?? 0).padStart(2, '0')} 已交付`,
                `phase 00–${String(doneStages.at(-1)?.index ?? 0).padStart(2, '0')} shipped`,
              )}
            </span>
            <span>{t('vitest 就绪', 'vitest ready')}</span>
            <span>offline by design</span>
          </div>
        </div>

        <Panel
          tone="accent"
          title="System Panel"
          subtitle={<T zh="目标硬件轮廓 · 非实时数据" en="Target hardware outline · not live data" />}
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
            <h3 className="mt-2 text-[13px] font-medium text-ink">
              <T zh={item.title} en={item.titleEn} />
            </h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
              <T block zh={item.detail} en={item.detailEn} />
            </p>
          </div>
        ))}
      </section>

      {/* 路线图 */}
      <section className="mt-11">
        <SectionHeading
          eyebrow="Build order"
          title={t('十一个阶段，逐段验收', 'Eleven phases, each verified')}
          description={t(
            '阶段之间不允许跳步：上一阶段的测试不绿，就不动手写下一阶段。灰色卡片代表它还不存在——不是还没画，是还没写。',
            'No skipping ahead: a phase starts only when the previous one is green. A grey card means it does not exist yet — not unpolished, unwritten.',
          )}
          actions={
            <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
              <GitBranch size={12} />
              {doneStages.length} / {STAGES.length} complete
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
          title={t('架构分层', 'Layering')}
          subtitle={t(
            '依赖方向单向：视图 → 状态适配 → 引擎。反向依赖一次都不允许。',
            'Dependencies point one way: view → adapters → engine. Reverse imports are never allowed.',
          )}
        >
          <ol className="space-y-3">
            {ARCHITECTURE.map((layer, index) => (
              <li key={layer.path} className="flex gap-3">
                <span className="mt-0.5 font-mono text-[9.5px] tabnums text-ink-3">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1 border-b border-line/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-medium text-ink">
                      <T zh={layer.name} en={layer.nameEn} />
                    </span>
                    <code className="rounded bg-ink/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                      {layer.path}
                    </code>
                    {layer.reactFree && <Badge tone="cyan">react-free</Badge>}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
                    <T block zh={layer.role} en={layer.roleEn} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title={t('验收用例', 'Acceptance cases')}
          subtitle={t(
            '界面上不写「已支持」，只写「哪条用例已经绿了」。',
            'The UI never claims support — it shows which case is green.',
          )}
          actions={
            <Badge tone={passed === ACCEPTANCE_CASES.length ? 'green' : 'amber'}>
              {passed} / {ACCEPTANCE_CASES.length}
            </Badge>
          }
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
                  <span className="flex-1 truncate text-[12px] text-ink">
                    <T zh={item.title} en={item.titleEn} />
                  </span>
                  <Badge tone={item.status === 'passed' ? 'green' : 'slate'}>
                    {item.status === 'passed' ? 'pass' : `p${item.phase}`}
                  </Badge>
                </div>
                <p className="mt-1.5 pl-7 font-mono text-[10px] leading-relaxed text-ink-3">
                  {t(item.expectation, item.expectationEn)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line/60 pt-3 text-[11px] leading-relaxed text-ink-3">
            <T
              block
              zh="五条用例全部落在测试里，不是文档里的一句承诺：A/B/C/E 在 tests/seq，D 在 tests/pipe。"
              en="All five live in tests, not in prose: A/B/C/E under tests/seq, D under tests/pipe."
            />
          </p>
        </Panel>
      </section>
    </div>
  )
}

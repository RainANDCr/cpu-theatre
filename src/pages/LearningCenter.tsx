import { useState } from 'react'
import { T, useI18n } from '../i18n'
import { ArrowRight, Check, CheckCircle2, CircleHelp, RotateCcw } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Panel } from '../components/ui/Panel'
import {
  LEARNING_MODULES,
  TOTAL_SECTIONS,
  type LearningModule,
  type LearningSection,
  type SectionDemo,
} from '../content/learning'
import { cn } from '../lib/cn'
import { useLearningStore } from '../store/learningStore'
import { Link } from 'react-router-dom'

const TONE: Record<LearningModule['tone'], string> = {
  blue: 'border-bus/40 text-bus',
  purple: 'border-ctrl/40 text-ctrl',
  cyan: 'border-reg/40 text-reg',
  amber: 'border-alu/40 text-alu',
}

function Demo({ demo }: { demo: SectionDemo }) {
  if (demo.kind === 'encoding' || demo.kind === 'hcl') {
    return (
      <pre className="mt-3 overflow-x-auto rounded-lg border border-line/70 bg-void/50 px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-ink-2">
        {demo.text}
      </pre>
    )
  }

  if (demo.kind === 'stages') {
    const stages = ['FETCH', 'DECODE', 'EXECUTE', 'MEMORY', 'WB', "PC'"]
    return (
      <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg border border-line/70 bg-void/40 px-3 py-2.5">
        {stages.map((stage, index) => (
          <div key={stage} className="flex items-center gap-1">
            {index > 0 && <span className="text-[9px] text-ink-3/50">›</span>}
            <span className="rounded border border-line-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-2">
              {stage}
            </span>
          </div>
        ))}
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3/60">
          <T zh="一拍走完" en="one cycle" />
        </span>
      </div>
    )
  }

  if (demo.kind === 'pipe') {
    return (
      <div className="mt-3 grid grid-cols-5 gap-1">
        {['F', 'D', 'E', 'M', 'W'].map((stage, index) => (
          <div
            key={stage}
            className="rounded border border-line/70 bg-void/40 px-1.5 py-2 text-center"
          >
            <div className="font-mono text-[10px] text-ink">{stage}</div>
            <div className="mt-1 font-mono text-[9px] text-ink-3/60">i{index + 1}</div>
          </div>
        ))}
      </div>
    )
  }

  // registers
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {['%rax', '%rcx', '%rdx', '%rbx', '%rsp', '%rbp', '%rsi', '%rdi', '%r8', '…', '%r14'].map(
        (name) => (
          <span
            key={name}
            className="rounded border border-reg/30 bg-reg/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-reg"
          >
            {name}
          </span>
        ),
      )}
      <span className="ml-1 self-center font-mono text-[9px] text-ink-3/60">15 × 64 bit</span>
    </div>
  )
}

function SectionView({ section, index }: { section: LearningSection; index: number }) {
  const { t } = useI18n()
  const completed = useLearningStore((state) => state.completed.includes(section.id))
  const toggle = useLearningStore((state) => state.toggleSection)

  return (
    <article className="border-t border-line/60 px-4 py-4 first:border-t-0">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => toggle(section.id)}
          aria-pressed={completed}
          aria-label={completed ? t('标记为未读', 'Mark unread') : t('标记为已读', 'Mark read')}
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
            completed
              ? 'border-ok/60 bg-ok/15 text-ok'
              : 'border-line-2 text-ink-3/40 hover:border-accent/50 hover:text-accent',
          )}
        >
          {completed ? <Check size={12} /> : <span className="font-mono text-[9px]">{index + 1}</span>}
        </button>

        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium text-ink">{section.title}</h3>
          <div className="mt-1.5 space-y-2">
            {section.paragraphs.map((paragraph, i) => (
              <p key={i} className="text-[11.5px] leading-relaxed text-ink-2">
                {paragraph}
              </p>
            ))}
          </div>

          {section.demo && <Demo demo={section.demo} />}

          {section.lab && (
            <Link
              to={section.lab.to}
              className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-accent hover:underline"
            >
              {t('实验', 'Lab')}: {section.lab.label}
              <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

function QuizView({ module }: { module: LearningModule }) {
  const { t } = useI18n()
  const answers = useLearningStore((state) => state.answers)
  const answer = useLearningStore((state) => state.answer)

  return (
    <section aria-label={t('自测', 'Self-check')} className="border-t border-line/60 bg-void/20 px-4 py-4">
      <div className="flex items-center gap-2">
        <CircleHelp size={13} className="text-ctrl" />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
          Self check
        </span>
      </div>

      <div className="mt-2 space-y-4">
        {module.quiz.map((question, questionIndex) => {
          const key = `${module.id}:${questionIndex}`
          const chosen = answers[key]
          const answered = chosen !== undefined
          return (
            <div key={key}>
              <p className="text-[12px] leading-relaxed text-ink">{question.question}</p>
              <div className="mt-1.5 grid gap-1">
                {question.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === question.answer
                  const isChosen = chosen === optionIndex
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      onClick={() => answer(key, optionIndex)}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] transition-colors',
                        !answered && 'border-line/80 text-ink-2 hover:border-line-2 hover:text-ink',
                        answered &&
                          isCorrect &&
                          'border-ok/50 bg-ok/10 text-ok',
                        answered &&
                          isChosen &&
                          !isCorrect &&
                          'border-err/50 bg-err/10 text-err',
                        answered && !isChosen && !isCorrect && 'border-line/60 text-ink-3',
                      )}
                    >
                      <span className="font-mono text-[10px] opacity-70">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span>{option}</span>
                    </button>
                  )
                })}
              </div>
              {answered && (
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-3">
                  {chosen === question.answer ? t('✓ 正确。', '✓ Correct.') : t('✗ 再想想。', '✗ Not quite.')}
                  {question.explanation}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function LearningCenter() {
  const { t } = useI18n()
  const [activeId, setActiveId] = useState(LEARNING_MODULES[0]!.id)
  const completed = useLearningStore((state) => state.completed)
  const answers = useLearningStore((state) => state.answers)
  const reset = useLearningStore((state) => state.reset)

  const active = LEARNING_MODULES.find((module) => module.id === activeId) ?? LEARNING_MODULES[0]!
  const done = completed.length
  const percent = Math.round((done / TOTAL_SECTIONS) * 100)
  const answeredCount = Object.keys(answers).length
  const correctCount = LEARNING_MODULES.reduce(
    (sum, module) =>
      sum +
      module.quiz.filter((question, index) => answers[`${module.id}:${index}`] === question.answer)
        .length,
    0,
  )

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-7 lg:px-9">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-3">
          Module 08
        </span>
        <Badge tone="green" dot>
          self-paced
        </Badge>
        <Badge tone="slate">
          <T zh="进度保存在本地" en="progress saved locally" />
        </Badge>
      </div>

      <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-ink">Learning Center</h1>
      <p className="mt-2 max-w-[720px] text-[12.5px] leading-relaxed text-ink-2">
        <T
          block
          zh="四个模块，从指令集到流水线。每个知识点都是「解释 → 演示 → 示例 → 实验 → 自测」，没有需要背诵的段落——看不懂就回到实验里拨一下开关。"
          en="Four modules, from the instruction set to the pipeline. Every topic follows explain → demo → example → lab → self-check; nothing needs memorising — flip a switch in the lab when it does not click."
        />
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-line/80 bg-panel/50 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[22px] leading-none text-accent">{percent}%</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-3">
            {done}/{TOTAL_SECTIONS} {t('已读', 'read')}
          </span>
        </div>
        <div className="h-1.5 min-w-[140px] flex-1 overflow-hidden rounded-full bg-line/70">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-ink-3">
          {t('自测', 'Self-check')} {correctCount}/{answeredCount || 0} {t('正确', 'correct')}
        </span>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-err"
        >
          <RotateCcw size={11} />
          <T zh="重置进度" en="Reset progress" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-1.5" aria-label={t('知识模块', 'Knowledge modules')}>
          {LEARNING_MODULES.map((module) => {
            const activeModule = module.id === activeId
            const moduleDone = module.sections.filter((section) =>
              completed.includes(section.id),
            ).length
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => setActiveId(module.id)}
                aria-pressed={activeModule}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                  activeModule
                    ? 'border-accent/45 bg-accent/[0.07]'
                    : 'border-line/70 hover:border-line-2',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'font-mono text-[9px] uppercase tracking-[0.16em]',
                      activeModule ? 'text-accent' : 'text-ink-3',
                    )}
                  >
                    {module.code}
                  </span>
                  {moduleDone === module.sections.length ? (
                    <CheckCircle2 size={12} className="text-ok" />
                  ) : (
                    <span className="font-mono text-[9px] text-ink-3/60">
                      {moduleDone}/{module.sections.length}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-ink">{module.title}</div>
                <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3/60">
                  {module.english}
                </div>
              </button>
            )
          })}
        </nav>

        <div className="min-w-0">
          <Panel padded={false} className={cn('overflow-hidden border', TONE[active.tone])}>
            <header className="border-b border-line/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">
                  {active.code}
                </span>
                <h2 className="text-[15px] font-medium text-ink">{active.title}</h2>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-3/70">
                  {active.english}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{active.summary}</p>
            </header>

            {active.sections.map((section, index) => (
              <SectionView key={section.id} section={section} index={index} />
            ))}

            <QuizView module={active} />
          </Panel>
        </div>
      </div>
    </div>
  )
}

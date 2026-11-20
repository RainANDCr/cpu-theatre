import { toHex } from '../../core/cpu/word'
import { useI18n } from '../../i18n'
import { formatValue } from '../../core/isa/format'
import { registerName } from '../../core/isa/registers'
import type { InstructionTrace } from '../../core/seq/SEQProcessor'
import { MODULE_DOCS, STAGE_MODULES, type StageModuleId } from './stageModel'

export interface ModuleInspectorProps {
  moduleId: StageModuleId | null
  /** 最近一条指令的阶段记录；没有执行过时显示破折号而不是 0 */
  trace?: InstructionTrace | null
}

function reg(id: number | undefined): string {
  if (id === undefined) return '—'
  return registerName(id) ?? '·'
}

/** 每个模块在「这一拍」的真实输入输出。空数组表示这一拍它没参与。 */
function moduleValues(moduleId: StageModuleId, trace: InstructionTrace | null): Array<[string, string]> {
  if (!trace) return []

  switch (moduleId) {
    case 'pc':
      return trace.pcUpdate
        ? [
            ['PC', toHex(trace.pc, 4)],
            ['PC′', toHex(trace.pcUpdate.nextPc, 4)],
          ]
        : [['PC', toHex(trace.pc, 4)]]
    case 'imem':
      if (!trace.fetch.ok) return [['fetch', trace.fetch.message ?? 'fault']]
      return [
        ['icode', trace.fetch.icode.toString(16).toUpperCase()],
        ['rA/rB', `${reg(trace.fetch.rA)}/${reg(trace.fetch.rB)}`],
        ['valP', toHex(trace.fetch.valP, 4)],
      ]
    case 'regfile':
      if (!trace.decode) return []
      return [
        ['valA', formatValue(trace.decode.valA)],
        ['valB', formatValue(trace.decode.valB)],
        ['dstE', reg(trace.writeback?.dstE)],
      ]
    case 'alu':
      if (!trace.execute) return []
      return [
        ['op', trace.execute.aluOp ?? '—'],
        ['valE', formatValue(trace.execute.valE)],
        ['Cnd', trace.execute.cnd ? '1' : '0'],
      ]
    case 'ctrl':
      if (!trace.execute) return []
      return [
        ['setCC', trace.execute.setCC ? '1' : '0'],
        ['Cnd', trace.execute.cnd ? '1' : '0'],
        ['dstE', reg(trace.writeback?.dstE)],
      ]
    case 'dmem':
      if (!trace.memory || trace.memory.kind === 'none') return [['access', 'none']]
      return [
        ['kind', trace.memory.kind],
        ['addr', trace.memory.address === null ? '—' : toHex(trace.memory.address, 4)],
        [
          trace.memory.kind === 'write' ? 'W' : 'R',
          formatValue((trace.memory.kind === 'write' ? trace.memory.writeValue : trace.memory.readValue) ?? 0n),
        ],
      ]
    case 'cc':
      if (!trace.execute) return []
      return [
        ['ZF', trace.execute.nextCC.ZF ? '1' : '0'],
        ['SF', trace.execute.nextCC.SF ? '1' : '0'],
        ['OF', trace.execute.nextCC.OF ? '1' : '0'],
      ]
    case 'stat':
      return [['Stat', trace.statAfter]]
  }
}

/**
 * 模块说明面板。
 * 上半是静态职责说明（永远正确），右上角是这一拍的真实数值——
 * 后者没有数据时显示破折号：它提醒使用者这里是空的，而不是零。
 */
export function ModuleInspector({ moduleId, trace = null }: ModuleInspectorProps) {
  const { t } = useI18n()
  if (!moduleId) {
    return (
      <div className="shrink-0 border-t border-line/70 px-3 py-2.5 text-[11px] text-ink-3">
        {t(
          '点击数据通路中的任一模块，查看它的功能、输入与输出。',
          'Pick any module in the datapath to see its role, inputs and outputs.',
        )}
      </div>
    )
  }

  const doc = MODULE_DOCS[moduleId]
  const module = STAGE_MODULES.find((item) => item.id === moduleId)
  const values = moduleValues(moduleId, trace)

  return (
    <div className="max-h-[150px] shrink-0 overflow-y-auto border-t border-line/70 bg-void/35 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          {doc.name}
        </span>
        <span className="font-mono text-[9.5px] text-ink-3">{module?.title}</span>
        <div className="ml-auto flex max-w-[62%] items-center gap-2 overflow-hidden font-mono text-[9px]">
          {values.length === 0 ? (
            <span className="text-ink-3/60">{t('当前值 —', 'current —')}</span>
          ) : (
            values.map(([key, value]) => (
              <span key={key} className="whitespace-nowrap">
                <span className="text-ink-3/70">{key}</span>{' '}
                <span className="text-ink">{value}</span>
              </span>
            ))
          )}
        </div>
      </div>

      <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{doc.role}</p>

      <div className="mt-1.5 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            {t('输入', 'in')}
          </div>
          <ul className="mt-0.5">
            {doc.inputs.map((item) => (
              <li key={item} className="text-[10.5px] leading-snug text-ink-2">
                <span className="mr-1 text-ink-3/50">·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            {t('输出', 'out')}
          </div>
          <ul className="mt-0.5">
            {doc.outputs.map((item) => (
              <li key={item} className="text-[10.5px] leading-snug text-ink-2">
                <span className="mr-1 text-ink-3/50">·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

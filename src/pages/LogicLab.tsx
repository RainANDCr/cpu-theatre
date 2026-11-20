import { useMemo, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Panel } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { computeAlu, type AluOp } from '../core/execution/alu'
import { formatConditionCodes } from '../core/cpu/ConditionCodes'
import { asWord, toDec, toHex } from '../core/cpu/word'
import { cn } from '../lib/cn'

type GateKind = 'AND' | 'OR' | 'XOR' | 'NOT' | 'MUX'

const GATES: Record<
  GateKind,
  { inputs: 1 | 2 | 3; hint: string; evaluate: (a: boolean, b: boolean, s: boolean) => boolean }
> = {
  AND: { inputs: 2, hint: '两个都为 1 才输出 1', evaluate: (a, b) => a && b },
  OR: { inputs: 2, hint: '有一个为 1 就输出 1', evaluate: (a, b) => a || b },
  XOR: { inputs: 2, hint: '两个不同才输出 1', evaluate: (a, b) => a !== b },
  NOT: { inputs: 1, hint: '取反', evaluate: (a) => !a },
  MUX: { inputs: 3, hint: 's=0 选 A，s=1 选 B', evaluate: (a, b, s) => (s ? b : a) },
}

function Bit({ value, onClick, label }: { value: boolean; onClick?: () => void; label: string }) {
  const interactive = Boolean(onClick)
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      aria-pressed={value}
      aria-label={label}
      className={cn(
        'flex h-10 w-14 items-center justify-center rounded-lg border font-mono text-[15px] transition-colors',
        value
          ? 'border-reg/60 bg-reg/15 text-reg'
          : 'border-line-2 bg-panel/60 text-ink-3',
        interactive && 'hover:border-reg/50',
        !interactive && 'cursor-default',
      )}
    >
      {value ? '1' : '0'}
    </button>
  )
}

function TruthRow({ cells, highlight }: { cells: string[]; highlight?: boolean }) {
  return (
    <tr className={cn('border-t border-line/30', highlight && 'bg-accent/[0.08]')}>
      {cells.map((cell, index) => (
        <td
          key={index}
          className={cn(
            'px-2 py-[3px] text-center font-mono text-[10.5px]',
            index === cells.length - 1 ? 'text-ok' : 'text-ink-2',
          )}
        >
          {cell}
        </td>
      ))}
    </tr>
  )
}

function GateLab() {
  const [kind, setKind] = useState<GateKind>('AND')
  const [a, setA] = useState(true)
  const [b, setB] = useState(false)
  const [sel, setSel] = useState(false)

  const gate = GATES[kind]
  const output = gate.evaluate(a, b, sel)

  const rows = useMemo(() => {
    if (kind === 'NOT') return [[0], [1]].map(([x]) => [String(x), x ? '0' : '1'])
    if (kind === 'MUX')
      return [0, 1].flatMap((s) =>
        [0, 1].flatMap((x) => [0, 1].map((y) => [String(s), String(x), String(y), String(s ? y : x)])),
      )
    return [0, 1].flatMap((x) =>
      [0, 1].map((y) => [String(x), String(y), gate.evaluate(Boolean(x), Boolean(y), false) ? '1' : '0']),
    )
  }, [kind, gate])

  const headers =
    kind === 'NOT' ? ['A', 'Y'] : kind === 'MUX' ? ['S', 'A', 'B', 'Y'] : ['A', 'B', 'Y']

  return (
    <Panel title="Gate bench" subtitle={gate.hint} actions={<Badge tone="purple">combinational</Badge>}>
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(GATES) as GateKind[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setKind(item)}
            aria-pressed={kind === item}
            className={cn(
              'rounded-md border px-2 py-1 font-mono text-[10.5px] transition-colors',
              kind === item
                ? 'border-ctrl/50 bg-ctrl/10 text-ctrl'
                : 'border-line/80 text-ink-3 hover:border-line-2 hover:text-ink-2',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 rounded-xl border border-line/70 bg-void/40 px-4 py-5">
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">A</span>
          <Bit value={a} onClick={() => setA((v) => !v)} label="输入 A" />
        </div>

        {gate.inputs >= 2 && (
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">B</span>
            <Bit value={b} onClick={() => setB((v) => !v)} label="输入 B" />
          </div>
        )}

        {gate.inputs === 3 && (
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">S</span>
            <Bit value={sel} onClick={() => setSel((v) => !v)} label="选择端 S" />
          </div>
        )}

        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ctrl">
            {kind}
          </span>
          <div className="flex h-10 min-w-[62px] items-center justify-center rounded-lg border border-ctrl/50 bg-ctrl/10 px-3 font-mono text-[12px] text-ctrl">
            {kind === 'MUX' ? 'MUX' : kind === 'NOT' ? '¬' : kind === 'AND' ? '∧' : kind === 'OR' ? '∨' : '⊕'}
          </div>
        </div>

        <span className="text-ink-3" aria-hidden="true">
          →
        </span>

        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">Y</span>
          <Bit value={output} label="输出 Y" />
        </div>
      </div>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-2 pb-1 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-ink-3"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, index) => (
            <TruthRow key={index} cells={cells} />
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

const OPS: Array<{ value: AluOp; label: string; mnemonic: string }> = [
  { value: 'add', label: 'ADD', mnemonic: 'addq' },
  { value: 'sub', label: 'SUB', mnemonic: 'subq' },
  { value: 'and', label: 'AND', mnemonic: 'andq' },
  { value: 'xor', label: 'XOR', mnemonic: 'xorq' },
]

function parseHex(text: string): bigint | null {
  const trimmed = text.trim()
  if (!trimmed) return 0n
  try {
    const negative = trimmed.startsWith('-')
    const body = trimmed.replace(/^[-+]/, '')
    const value = /^0x/i.test(body) ? BigInt(body) : BigInt(body || '0')
    return asWord(negative ? -value : value)
  } catch {
    return null
  }
}

function AluLab() {
  const [op, setOp] = useState<AluOp>('add')
  const [aText, setAText] = useState('0x0A')
  const [bText, setBText] = useState('0x14')

  const a = parseHex(aText)
  const b = parseHex(bText)
  const result = a !== null && b !== null ? computeAlu(op, a, b) : null
  const mnemonic = OPS.find((item) => item.value === op)?.mnemonic ?? 'addq'

  return (
    <Panel
      title="ALU bench"
      subtitle="和引擎里执行 addq/subq/andq/xorq 的是同一个函数"
      actions={<Badge tone="amber">{mnemonic}</Badge>}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Segmented<AluOp>
          label="运算"
          value={op}
          onChange={setOp}
          options={OPS.map((item) => ({ value: item.value, label: item.label }))}
        />

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            valA（源）
          </span>
          <input
            value={aText}
            onChange={(event) => setAText(event.target.value)}
            className="h-8 w-32 rounded-lg border border-line-2 bg-void/60 px-2 font-mono text-[11px] text-ink focus:border-accent/50 focus:outline-none"
            aria-label="valA"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            valB（目的）
          </span>
          <input
            value={bText}
            onChange={(event) => setBText(event.target.value)}
            className="h-8 w-32 rounded-lg border border-line-2 bg-void/60 px-2 font-mono text-[11px] text-ink focus:border-accent/50 focus:outline-none"
            aria-label="valB"
          />
        </label>

        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-3">
          <span>结果</span>
          <span className="rounded-lg border border-alu/40 bg-alu/10 px-2.5 py-1.5 font-mono text-[12px] text-alu">
            {result ? toHex(result.value) : '—'}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-line/80 bg-panel/50 px-3 py-2">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">十进制</div>
          <div className="mt-0.5 truncate font-mono text-[12px] text-ink">
            {result ? toDec(result.value) : '—'}
          </div>
        </div>
        {(['ZF', 'SF', 'OF'] as const).map((flag) => {
          const on = result ? result.cc[flag] : false
          return (
            <div
              key={flag}
              className={cn(
                'rounded-lg border px-3 py-2 transition-colors',
                on ? 'border-ok/40 bg-ok/10' : 'border-line/80 bg-panel/50',
              )}
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
                {flag}
              </div>
              <div className={cn('mt-0.5 font-mono text-[12px]', on ? 'text-ok' : 'text-ink-2')}>
                {result ? (on ? '1' : '0') : '—'}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-2 font-mono text-[10px] text-ink-3">
        条件码 {result ? formatConditionCodes(result.cc) : '———'} · 减法按
        「目的 − 源」计算，与 subq %rA, %rB 一致
      </p>
    </Panel>
  )
}

const HCL_SNIPPETS = [
  {
    title: 'srcA：读哪个寄存器',
    code: `word srcA = [
    icode in { RRMOVQ, RMMOVQ, OPQ, PUSHQ } : rA;
    icode in { POPQ, RET } : RSP;
    1 : RNONE;
]`,
    note: 'popq 与 ret 的指令里根本没有 %rsp，但必须读它——所以这两条被单独列出来。',
  },
  {
    title: 'dstE：写回哪个寄存器',
    code: `word dstE = [
    icode in { RRMOVQ } && Cnd : rB;
    icode in { IRMOVQ, OPQ } : rB;
    icode in { PUSHQ, POPQ, CALL, RET } : RSP;
    1 : RNONE;
]`,
    note: 'Cnd 让 cmov 的写回变成有条件的：条件不成立时写 RNONE，寄存器文件直接忽略。',
  },
  {
    title: 'mem_addr：访存地址从哪来',
    code: `word mem_addr = [
    icode in { RMMOVQ, MRMOVQ, PUSHQ, CALL } : valE;
    icode in { POPQ, RET } : valA;
    1 : 0;
]`,
    note: '压栈类用 ALU 算出的 %rsp-8；出栈类用译码阶段读到的旧 %rsp。',
  },
]

export default function LogicLab() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-7 lg:px-9">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-3">
          Module 07
        </span>
        <Badge tone="purple" dot>
          logic design
        </Badge>
        <Badge tone="slate">interactive</Badge>
      </div>

      <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-ink">Logic Lab</h1>
      <p className="mt-2 max-w-[720px] text-[12.5px] leading-relaxed text-ink-2">
        处理器里没有「如果」，只有门。控制信号不是被程序判断出来的，而是由指令字段
        组合出来的电平——这就是 HCL 描述的东西。下面两个实验台都是真算的：
        门电路按真值表求值，ALU 台用的就是引擎执行 addq 时调用的那个函数。
      </p>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <GateLab />

        <Panel title="HCL：硬件的「如果」" subtitle="三条真实控制逻辑，摘自本项目的译码器">
          <div className="space-y-3">
            {HCL_SNIPPETS.map((snippet) => (
              <div key={snippet.title}>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ctrl">
                  {snippet.title}
                </div>
                <pre className="mt-1 overflow-x-auto rounded-lg border border-line/70 bg-void/50 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ink-2">
                  {snippet.code}
                </pre>
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-3">{snippet.note}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <AluLab />
      </div>
    </div>
  )
}

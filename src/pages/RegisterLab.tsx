import { PaneHeader } from '../components/layout/PaneHeader'
import { FlagPanel, RegisterTable } from '../components/registers/RegisterPanel'
import { Badge } from '../components/ui/Badge'
import { Panel } from '../components/ui/Panel'
import { REGISTER_NAMES } from '../core/isa/registers'
import { useCpuStore } from '../store/cpuStore'

export default function RegisterLab() {
  const registers = useCpuStore((state) => state.registers)
  const cc = useCpuStore((state) => state.cc)
  const stat = useCpuStore((state) => state.status)
  const engineReady = useCpuStore((state) => state.engineReady)

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-14 pt-7 lg:px-9">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-3">
          Module 04
        </span>
        <Badge tone="cyan" dot>
          programmer-visible state
        </Badge>
        <Badge tone={engineReady ? 'green' : 'amber'}>{engineReady ? 'live' : '未装载程序'}</Badge>
      </div>

      <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-ink">Register Lab</h1>
      <p className="mt-2 max-w-[680px] text-[12.5px] leading-relaxed text-ink-2">
        寄存器是处理器唯一记得住的东西。Y86-64 给程序员 15 个 64 位通用寄存器，
        再加上 PC、条件码和状态码——这四样合起来才是完整的「程序员可见状态」。
        读懂一段程序，本质上就是追踪这十几格里的数值怎么流动。这里的数值来自模拟器
        的真实执行——要让它动起来，去 CPU Simulator 点「单步」。
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel padded={false} className="overflow-hidden">
          <PaneHeader
            title="Register file"
            meta="15 × 64 bit"
            actions={<Badge tone="slate">rows by ISA code</Badge>}
          />
          <RegisterTable values={registers} className="h-[404px]" />
        </Panel>

        <div className="space-y-4">
          <Panel title="Flags & status" subtitle="不属于通用寄存器，但同样是可见状态">
            <FlagPanel cc={cc} stat={stat} />
          </Panel>

          <Panel title="为什么按编号排" subtitle="顺序不是随便定的">
            <p className="text-[11.5px] leading-relaxed text-ink-2">
              指令编码里，寄存器只占一个半字节。%rax 编成 0、%rsp 编成 4、%r14 编成 14——
              一旦顺序记错，汇编出来的机器码就会指向另一个寄存器，而且不报错。
              所以这张表按编码值排列，不按字母排列。
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
              0xF 是 RNONE：表示「这个字段没有寄存器」，它不属于{REGISTER_NAMES.length} 个可见寄存器。
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

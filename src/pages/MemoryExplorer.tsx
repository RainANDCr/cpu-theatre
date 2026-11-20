import { MemoryPanel } from '../components/memory/MemoryPanel'
import { T, useI18n } from '../i18n'
import { Badge } from '../components/ui/Badge'
import { Panel } from '../components/ui/Panel'
import { useCpuStore } from '../store/cpuStore'

export default function MemoryExplorer() {
  const { t } = useI18n()
  const getMemory = useCpuStore((state) => state.getMemory)
  const pc = useCpuStore((state) => state.pc)
  const trace = useCpuStore((state) => state.trace)
  const engineReady = useCpuStore((state) => state.engineReady)

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-14 pt-7 lg:px-9">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-3">
          Module 05
        </span>
        <Badge tone="blue" dot>
          byte-addressable
        </Badge>
        <Badge tone={engineReady ? 'green' : 'amber'}>{engineReady ? 'live' : t('未装载程序', 'no program')}</Badge>
      </div>

      <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-ink">
        Memory Explorer
      </h1>
      <p className="mt-2 max-w-[680px] text-[12.5px] leading-relaxed text-ink-2">
        内存里没有「值」，只有字节。你写进去的 123 是一个抽象说法，落到内存里是
        <code className="mx-1 rounded bg-ink/[0.07] px-1 py-0.5 font-mono text-[11.5px] text-ink">
          7B 00 00 00 00 00 00 00
        </code>
        ——八个字节，低位在前。把小端序看熟，是读懂指令编码和栈帧布局的前提。
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel padded={false} className="overflow-hidden">
          <MemoryPanel
            memory={getMemory()}
            anchor={pc}
            highlight={trace?.memory?.address ?? null}
            className="h-[424px]"
          />
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Little-endian"
            subtitle={<T zh="一个 64 位值在内存里的样子" en="How a 64-bit value sits in memory" />}
          >
            <pre className="overflow-x-auto rounded-lg border border-line/70 bg-void/40 px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-ink-2">
{`地址     +0  +1  +2  +3  +4  +5  +6  +7
0x0064   7B  00  00  00  00  00  00  00
         └── 最低有效字节在最前面`}
            </pre>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
              同一个 123 如果用大端序存放，会变成
              <code className="mx-1 font-mono text-[10.5px] text-ink-2">00 00 00 00 00 00 00 7B</code>
              。Y86-64 用前者。
            </p>
          </Panel>

          <Panel
            title={t('这里能看到什么', 'What you can see here')}
            subtitle={<T zh="全部来自真实执行" en="All of it from real execution" />}
          >
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-ink-2">
              <li>· <T zh="程序的机器码字节（装载后即可见）" en="machine-code bytes of the program, once loaded" /></li>
              <li>· <T zh="本拍读写的 8 个字节，橙色标出" en="the 8 bytes touched this cycle, marked in amber" /></li>
              <li>· <T zh="窗口默认跟随 PC，可手动跳转并固定" en="the window follows the PC by default, or pins to an address" /></li>
              <li>· <T zh="越界访问会让处理器以 ADR 停机，可在日志里看到" en="out-of-range access halts with ADR — visible in the log" /></li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

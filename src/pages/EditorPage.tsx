import { useState } from 'react'
import { Play, Terminal } from 'lucide-react'
import { AssemblyEditor } from '../components/editor/AssemblyEditor'
import { ProgramOutput, type OutputTab } from '../components/editor/ProgramOutput'
import { PaneHeader } from '../components/layout/PaneHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/cn'
import { EXAMPLES } from '../lib/y86-examples'
import { useEditorStore } from '../store/editorStore'
import { useProgramStore } from '../store/programStore'

/* 顶栏 56 + 状态条 28 = 84 */
const PAGE_HEIGHT = 'h-[calc(100dvh-84px)]'

export default function EditorPage() {
  const source = useEditorStore((state) => state.source)
  const setSource = useEditorStore((state) => state.setSource)
  const activeExampleId = useEditorStore((state) => state.activeExampleId)
  const loadExample = useEditorStore((state) => state.loadExample)
  const markClean = useEditorStore((state) => state.markClean)
  const dirty = useEditorStore((state) => state.dirty)

  const result = useProgramStore((state) => state.result)
  const assemble = useProgramStore((state) => state.assemble)
  const [tab, setTab] = useState<OutputTab>('listing')

  const activeExample = EXAMPLES.find((example) => example.id === activeExampleId)
  const lineCount = source.replace(/\n$/, '').split('\n').length
  const errorCount = result?.diagnostics.filter((d) => d.severity === 'error').length ?? 0

  const runAssemble = () => {
    const next = assemble(source)
    markClean()
    // 失败时直接把用户送到诊断页，省掉一次「我点了汇编，怎么什么都没发生」
    setTab(next.ok ? 'listing' : 'diagnostics')
  }

  return (
    <div className={`flex ${PAGE_HEIGHT} min-h-[540px] flex-col overflow-hidden`}>
      <h1 className="sr-only">Instruction Editor · Y86-64 汇编</h1>
      <div className="flex h-11 shrink-0 items-center border-b border-line/80 bg-shell/40">
        {/* 示例列表自己横向滚动；操作组钉在右侧，窄屏下也不会被挤出可视区 */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pl-3 no-scrollbar">
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">
            Examples
          </span>
          {EXAMPLES.map((example) => {
            const active = example.id === activeExampleId
            return (
              <button
                key={example.id}
                type="button"
                aria-pressed={active}
                onClick={() => loadExample(example.id)}
                className={cn(
                  'shrink-0 rounded-md border px-2 py-1 text-[11px] transition-colors',
                  active
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-line/80 text-ink-3 hover:border-line-2 hover:text-ink-2',
                )}
              >
                {example.title}
              </button>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-l border-line/60 px-3">
          {activeExample && (
            <span
              className="hidden max-w-[300px] truncate text-[10.5px] text-ink-3 2xl:block"
              title={activeExample.focus}
            >
              {activeExample.focus}
            </span>
          )}
          <span className="hidden font-mono text-[9.5px] text-ink-3 sm:inline">
            {lineCount} lines{dirty ? ' · 已修改' : ''}
          </span>
          <Button size="sm" onClick={runAssemble} title="汇编并查看机器码（Ctrl+Enter）">
            <Terminal size={12} />
            汇编
          </Button>
          <span title="执行引擎在 Phase 3 接入">
            <Button size="sm" variant="outline" disabled>
              <Play size={12} />
              运行
            </Button>
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-abyss/40">
          <PaneHeader
            title="Editor"
            meta="program.y86"
            actions={
              <>
                <Badge tone="slate">Y86-64</Badge>
                <Badge tone={dirty ? 'amber' : 'green'}>{dirty ? 'modified' : 'clean'}</Badge>
                {result && (
                  <Badge tone={result.ok ? 'green' : 'red'}>
                    {result.ok ? `${result.codeLength} B` : `${errorCount} err`}
                  </Badge>
                )}
              </>
            }
          />
          <div className="min-h-0 flex-1">
            <AssemblyEditor
              value={source}
              onChange={setSource}
              onSubmit={runAssemble}
              ariaLabel="Y86-64 汇编编辑器"
            />
          </div>
        </div>

        <ProgramOutput
          result={result}
          stale={dirty && result !== null}
          tab={tab}
          onTabChange={setTab}
          className="h-[232px] shrink-0"
        />
      </div>
    </div>
  )
}

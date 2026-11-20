import { useEffect, useRef, useState } from 'react'
import type * as MonacoApi from 'monaco-editor'
import { cn } from '../../lib/cn'
import { CodeSurface } from './CodeSurface'

type Status = 'loading' | 'ready' | 'fallback'

export interface AssemblyEditorProps {
  value: string
  onChange?: (next: string) => void
  /** Ctrl/Cmd + Enter：与工具栏「汇编」按钮等价 */
  onSubmit?: () => void
  /** 断点所在的源码行（1 起始） */
  breakpointLines?: readonly number[]
  /** 当前 PC 所在的源码行，整行高亮 */
  activeLine?: number | null
  /** 点击行号沟槽时切换该行断点 */
  onToggleBreakpointLine?: (line: number) => void
  readOnly?: boolean
  className?: string
  ariaLabel?: string
}

/**
 * Monaco 的外壳。三条硬要求：
 * 1. 动态 import —— monaco 单独成 chunk，首屏不为它付费；
 * 2. worker 本地打包 —— 断网可高亮（见 monacoRuntime）；
 * 3. 没有 Worker 的环境（jsdom、极端浏览器）降级成 CodeSurface，页面不崩。
 */
export function AssemblyEditor({
  value,
  onChange,
  onSubmit,
  breakpointLines,
  activeLine = null,
  onToggleBreakpointLine,
  readOnly = false,
  className,
  ariaLabel = 'Y86-64 汇编编辑器',
}: AssemblyEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoApi.editor.IStandaloneCodeEditor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit
  const toggleBreakpointRef = useRef(onToggleBreakpointLine)
  toggleBreakpointRef.current = onToggleBreakpointLine
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setStatus('fallback')
      return
    }

    let cancelled = false
    let changeSub: MonacoApi.IDisposable | null = null
    let instance: MonacoApi.editor.IStandaloneCodeEditor | null = null

    void import('./monacoRuntime')
      .then(async ({ loadMonaco, Y86_LANGUAGE_ID, THEME_ID }) => {
        const api = await loadMonaco()
        if (cancelled || !hostRef.current) return

        instance = api.editor.create(hostRef.current, {
          value,
          language: Y86_LANGUAGE_ID,
          theme: THEME_ID,
          readOnly,
          ariaLabel,
          automaticLayout: true,
          fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
          fontSize: 12.5,
          lineHeight: 21,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          renderLineHighlight: 'all',
          scrollBeyondLastLine: false,
          glyphMargin: true,
          folding: false,
          tabSize: 4,
          padding: { top: 12, bottom: 16 },
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        })
        editorRef.current = instance
        changeSub = instance.onDidChangeModelContent(() => {
          onChangeRef.current?.(instance?.getValue() ?? '')
        })
        instance.addAction({
          id: 'cpu-theatre.assemble',
          label: '汇编并查看编码',
          keybindings: [api.KeyMod.CtrlCmd | api.KeyCode.Enter],
          run: () => onSubmitRef.current?.(),
        })
        // 2 = GUTTER_GLYPH_MARGIN，3 = GUTTER_LINE_NUMBERS：点行号也能下断点
        instance.onMouseDown((event) => {
          if (event.target.type !== 2 && event.target.type !== 3) return
          const line = event.target.position?.lineNumber
          if (line) toggleBreakpointRef.current?.(line)
        })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('fallback')
      })

    return () => {
      cancelled = true
      changeSub?.dispose()
      instance?.dispose()
      editorRef.current = null
    }
    // 只在挂载时创建一次；value / readOnly 由下面的 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (editor.getValue() !== value) editor.setValue(value)
  }, [value])

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly })
  }, [readOnly])

  // 断点圆点与当前行高亮：都用 decoration 表达，不改文档内容
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const decorations: MonacoApi.editor.IModelDeltaDecoration[] = []
    for (const line of breakpointLines ?? []) {
      decorations.push({
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'ct-breakpoint-glyph',
          glyphMarginHoverMessage: { value: '断点：执行到这一行之前停下' },
        },
      })
    }
    if (activeLine) {
      decorations.push({
        range: {
          startLineNumber: activeLine,
          startColumn: 1,
          endLineNumber: activeLine,
          endColumn: 1,
        },
        options: { isWholeLine: true, className: 'ct-active-line' },
      })
    }

    const ids = editor.deltaDecorations([], decorations)
    return () => {
      editor.deltaDecorations(ids, [])
    }
  }, [breakpointLines, activeLine, status])

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <div ref={hostRef} className="absolute inset-0" />

      {status !== 'ready' && (
        <div className="absolute inset-0 z-10 bg-abyss">
          <CodeSurface value={value} className="h-full" />
          <div className="absolute right-2 top-2 rounded border border-line/80 bg-panel/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
            {status === 'loading' ? 'loading editor' : 'read-only surface'}
          </div>
        </div>
      )}
    </div>
  )
}

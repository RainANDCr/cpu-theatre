import { useMemo } from 'react'
import { ALL_MNEMONICS } from '../../core/isa/instructions'
import { cn } from '../../lib/cn'

/** 从 ISA 表派生，避免与 instructions.ts 各维护一份（两边一漂移，着色就会认错指令） */
const MNEMONICS = new Set<string>(ALL_MNEMONICS)

type TokenKind = 'comment' | 'keyword' | 'register' | 'number' | 'label' | 'punct' | 'plain'

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: 'text-ink-3 italic',
  keyword: 'text-ctrl',
  register: 'text-reg',
  number: 'text-alu',
  label: 'text-bus',
  punct: 'text-ink-3',
  plain: 'text-ink-2',
}

const TOKEN_PATTERN = /(#.*$)|(%[a-z0-9]+)|(\$?-?(?:0x[0-9a-fA-F]+|\d+))|([,()])|([A-Za-z_.][\w.]*)/g

interface Token {
  text: string
  kind: TokenKind
}

function tokenize(line: string): Token[] {
  if (line.trimStart().startsWith('#')) return [{ text: line, kind: 'comment' }]

  const tokens: Token[] = []
  let cursor = 0
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push({ text: line.slice(cursor, index), kind: 'plain' })

    const [text, comment, register, number, punct, word] = match
    if (comment) tokens.push({ text, kind: 'comment' })
    else if (register) tokens.push({ text, kind: 'register' })
    else if (number) tokens.push({ text, kind: 'number' })
    else if (punct) tokens.push({ text, kind: 'punct' })
    else if (word) {
      const isLabelDef = line.slice(index + text.length).trimStart().startsWith(':')
      tokens.push({
        text,
        kind: MNEMONICS.has(text) ? 'keyword' : isLabelDef ? 'label' : 'plain',
      })
    }
    cursor = index + text.length
  }
  if (cursor < line.length) tokens.push({ text: line.slice(cursor), kind: 'plain' })
  return tokens
}

export interface CodeSurfaceProps {
  value: string
  className?: string
  /** 预留：Phase 3 起高亮当前正在执行的指令 */
  activeLine?: number | null
}

/**
 * 轻量源码视图。两个用途：
 * 1. 没有 Worker 的环境（例如 jsdom 测试）下作为 Monaco 的降级渲染；
 * 2. Phase 3 之后在舞台左侧做「当前行高亮」，比给 Monaco 打标更轻。
 *
 * 它只做着色，不做编辑——编辑交给真正的 Monaco。
 */
export function CodeSurface({ value, className, activeLine = null }: CodeSurfaceProps) {
  const lines = useMemo(() => value.replace(/\n$/, '').split('\n'), [value])

  return (
    <div className={cn('h-full overflow-auto bg-abyss/60 px-2 py-2', className)}>
      <pre className="font-mono text-[11.5px] leading-[1.65]">
        <code>
          {lines.map((line, index) => {
            const active = activeLine === index
            return (
              <div
                key={index}
                className={cn(
                  'flex gap-3 rounded px-1',
                  active && 'bg-accent/10 ring-1 ring-inset ring-accent/25',
                )}
              >
                <span className="w-6 shrink-0 select-none text-right text-ink-3/60">
                  {index + 1}
                </span>
                <span className="whitespace-pre">
                  {tokenize(line).map((token, tokenIndex) => (
                    <span key={tokenIndex} className={TOKEN_CLASS[token.kind]}>
                      {token.text}
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
        </code>
      </pre>
    </div>
  )
}

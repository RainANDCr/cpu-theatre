// 只取 editor.api：editor.main 还会把 HTML/CSS/JSON/TS 的语言服务与全部编辑器贡献
// 一起拉进来。这里只要「能高亮、能编辑、能报错」，不需要 suggest/hover/折叠。
import * as monacoEsm from 'monaco-editor/editor/editor.api'
// 注意这个路径：monaco 的 package.json 把 "./*" 映射到 "./esm/vs/*.js"，
// 所以写 monaco-editor/editor/editor.worker 才是 esm/vs/editor/editor.worker.js。
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
// editor.api 只带核心；下面这些是「写汇编一定会按」的快捷键所对应的贡献。
// 每一条都要能说出用途，否则就是白白付体积。
import 'monaco-editor/editor/contrib/find/browser/findController'
import 'monaco-editor/editor/contrib/contextmenu/browser/contextmenu'
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching'
import 'monaco-editor/editor/contrib/comment/browser/comment'
import 'monaco-editor/editor/contrib/wordOperations/browser/wordOperations'
import { ALL_MNEMONICS } from '../../core/isa/instructions'

export type MonacoApi = typeof import('monaco-editor')
/** 深层入口没有类型，从官方类型定义借一份；两侧的 API 表面由本文件的使用方式保证一致 */
const monaco = monacoEsm as unknown as MonacoApi

export const Y86_LANGUAGE_ID = 'y86'
export const THEME_ID = 'cpu-theatre'

/** 从 ISA 表派生，不在编辑器里另抄一份指令名单 */
const MNEMONICS = ALL_MNEMONICS.join('|')

let configured = false

function configure(api: MonacoApi): void {
  // worker 从 node_modules 打包进来，不走 CDN：断网也必须能高亮
  ;(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
    getWorker: () => new EditorWorker(),
  }

  api.languages.register({ id: Y86_LANGUAGE_ID, extensions: ['.y86', '.ys'] })

  api.languages.setLanguageConfiguration(Y86_LANGUAGE_ID, {
    comments: { lineComment: '#' },
    brackets: [['(', ')']],
    autoClosingPairs: [{ open: '(', close: ')' }],
    surroundingPairs: [{ open: '(', close: ')' }],
  })

  api.languages.setMonarchTokensProvider(Y86_LANGUAGE_ID, {
    defaultToken: '',
    tokenizer: {
      root: [
        // 字符串要排在注释前：`.string "a # b"` 里的 # 不是注释
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/#.*$/, 'comment'],
        [new RegExp(`\\b(${MNEMONICS})\\b`), 'keyword'],
        // 伪指令要在通用标识符之前匹配，否则 `.pos` 会被拆成「点 + 标识符」
        [/\.(pos|org|align|quad)\b/, 'keyword.directive'],
        [/[a-zA-Z_.][\w.]*(?=\s*:)/, 'type.identifier'],
        [/%[a-z0-9]+/, 'variable'],
        [/\$?-?0x[0-9a-fA-F]+/, 'number.hex'],
        [/\$?-?\d+/, 'number'],
        [/[a-zA-Z_.][\w.]*/, 'identifier'],
        [/[,()]/, 'delimiter'],
      ],
    },
  })

  api.editor.defineTheme(THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'a970ff' },
      { token: 'keyword.directive', foreground: 'ff8fb1' },
      { token: 'string', foreground: '7fe0a8' },
      { token: 'variable', foreground: '2ee6d6' },
      { token: 'number', foreground: 'ffb457' },
      { token: 'number.hex', foreground: 'ffb457' },
      { token: 'type.identifier', foreground: '4d9fff' },
      { token: 'comment', foreground: '5b6b85', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '7a8ba8' },
      { token: 'identifier', foreground: 'c7d5ee' },
    ],
    colors: {
      'editor.background': '#080d17',
      'editor.foreground': '#d7e3fa',
      'editorLineNumber.foreground': '#3a4a63',
      'editorLineNumber.activeForeground': '#9fb0cf',
      'editor.lineHighlightBackground': '#0d1524',
      'editor.selectionBackground': '#23395c',
      'editorCursor.foreground': '#4d9fff',
      'editorIndentGuide.background1': '#131e30',
      'editorWidget.background': '#0b1220',
      'editorWidget.border': '#1a2438',
    },
  })

  configured = true
}

/** 动态加载入口。只有真正需要编辑器时才拉这个 chunk。 */
export async function loadMonaco(): Promise<MonacoApi> {
  if (!configured) configure(monaco)
  return monaco
}

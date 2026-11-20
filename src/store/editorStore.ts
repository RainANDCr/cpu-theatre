import { create } from 'zustand'
import { DEFAULT_EXAMPLE, findExample } from '../lib/y86-examples'

export interface EditorState {
  source: string
  activeExampleId: string
  /** 源码自上次汇编后是否被改动；Phase 2 起决定是否允许直接运行旧机器码 */
  dirty: boolean
  setSource: (source: string) => void
  loadExample: (id: string) => void
  markClean: () => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  source: DEFAULT_EXAMPLE.code,
  activeExampleId: DEFAULT_EXAMPLE.id,
  dirty: false,

  setSource: (source) => set({ source, dirty: true }),

  loadExample: (id) => {
    const example = findExample(id)
    if (!example) return
    set({ source: example.code, activeExampleId: id, dirty: false })
  },

  markClean: () => set({ dirty: false }),
}))

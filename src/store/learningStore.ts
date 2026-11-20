import { create } from 'zustand'

const STORAGE_KEY = 'cpu-theatre.learning.v1'

interface Persisted {
  completed: string[]
  answers: Record<string, number>
}

export interface LearningState {
  completed: string[]
  /** 题目 key → 选中的选项下标 */
  answers: Record<string, number>
  toggleSection: (id: string) => void
  answer: (key: string, choice: number) => void
  reset: () => void
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { completed: [], answers: {} }
    const parsed = JSON.parse(raw) as Partial<Persisted>
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
    }
  } catch {
    return { completed: [], answers: {} }
  }
}

function save(state: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 隐私模式下 localStorage 可能不可写：进度丢失不影响学习本身
  }
}

const initial = load()

export const useLearningStore = create<LearningState>()((set, get) => ({
  completed: initial.completed,
  answers: initial.answers,

  toggleSection: (id) => {
    const completed = get().completed.includes(id)
      ? get().completed.filter((item) => item !== id)
      : [...get().completed, id]
    set({ completed })
    save({ completed, answers: get().answers })
  },

  answer: (key, choice) => {
    const answers = { ...get().answers, [key]: choice }
    set({ answers })
    save({ completed: get().completed, answers })
  },

  reset: () => {
    set({ completed: [], answers: {} })
    save({ completed: [], answers: {} })
  },
}))

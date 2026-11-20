import { create } from 'zustand'

/**
 * 纯界面状态（不持久化）。
 *
 * 为什么单独一个 store，而不是塞进 settingsStore？
 * `settingsStore` 会被写进 localStorage，而「抽屉开着」是一个瞬态 UI 状态——
 * 刷新后还保持打开会很怪，也会让 E2E 之间互相影响。
 */
interface UiState {
  mobileNavOpen: boolean
  openMobileNav: () => void
  closeMobileNav: () => void
  toggleMobileNav: () => void
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
}))

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AccentKey = 'blue' | 'purple' | 'cyan' | 'amber'
export type AnimationSpeed = 0.5 | 1 | 2

/**
 * 界面语言。
 * - `zh` / `en`：单一语言，结构完全一致
 * - `both`：中英对照，主语言仍是中文（英文作为次级行），因此 `<html lang>` 取 zh-CN，
 *   英文片段各自带 `lang="en"`
 */
export type Lang = 'zh' | 'en' | 'both'

/**
 * 主题。
 * 只影响语义令牌的取值（`index.css` 里的 `[data-theme]`），
 * 组件不写死任何颜色，因此新增主题不需要改组件。
 */
export type Theme = 'dark' | 'light'

/** 舞台三栏 + 底部面板的尺寸（px）。拖拽结束后才写回，避免每帧都落盘。 */
export interface PaneSizes {
  left: number
  right: number
  bottom: number
}

export interface SettingsValues extends PaneSizes {
  /** 界面语言 */
  lang: Lang
  /** 深色 / 浅色主题；对应 :root[data-theme] */
  theme: Theme
  /** 界面强调色；对应 :root[data-accent] */
  accent: AccentKey
  /** 主动关闭动效（教学场景里常有人只需要静态图） */
  reduceMotion: boolean
  /** 舞台网格背景 */
  showGrid: boolean
  /** 动画速度倍率，Phase 4 起作用于数据流动画与单步节奏 */
  animationSpeed: AnimationSpeed
  sidebarCollapsed: boolean
}

export type PaneKey = keyof PaneSizes

export interface SettingsState extends SettingsValues {
  setLang: (lang: Lang) => void
  setTheme: (theme: Theme) => void
  setAccent: (accent: AccentKey) => void
  setReduceMotion: (value: boolean) => void
  setShowGrid: (value: boolean) => void
  setAnimationSpeed: (speed: AnimationSpeed) => void
  setPaneSize: (key: PaneKey, value: number) => void
  toggleSidebar: () => void
  reset: () => void
}

export const DEFAULT_SETTINGS: SettingsValues = {
  // 默认中文 + 深色：与项目原有外观一致，老用户升级后视觉不跳变
  lang: 'zh',
  theme: 'dark',
  accent: 'blue',
  reduceMotion: false,
  showGrid: true,
  animationSpeed: 1,
  sidebarCollapsed: false,
  left: 430,
  right: 342,
  bottom: 196,
}

/** 面板尺寸的物理边界。上限还会再与容器宽度做一次比较，见 SplitWorkspace。 */
export const PANE_LIMITS: Record<PaneKey, { min: number; max: number }> = {
  left: { min: 300, max: 720 },
  right: { min: 288, max: 560 },
  bottom: { min: 132, max: 420 },
}

export const SETTINGS_STORAGE_KEY = 'cpu-theatre:settings'

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setShowGrid: (showGrid) => set({ showGrid }),
      setAnimationSpeed: (animationSpeed) => set({ animationSpeed }),
      setPaneSize: (key, value) => set({ [key]: value } as Pick<PaneSizes, PaneKey>),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      partialize: (state): SettingsValues => ({
        lang: state.lang,
        theme: state.theme,
        accent: state.accent,
        reduceMotion: state.reduceMotion,
        showGrid: state.showGrid,
        animationSpeed: state.animationSpeed,
        sidebarCollapsed: state.sidebarCollapsed,
        left: state.left,
        right: state.right,
        bottom: state.bottom,
      }),
    },
  ),
)

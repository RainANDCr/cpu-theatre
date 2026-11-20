import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
} from '../../src/store/settingsStore'

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({ ...DEFAULT_SETTINGS })
})

describe('settingsStore', () => {
  it('默认值即设计稿的第一印象', () => {
    const state = useSettingsStore.getState()
    expect(state.accent).toBe('blue')
    expect(state.reduceMotion).toBe(false)
    expect(state.showGrid).toBe(true)
    expect(state.animationSpeed).toBe(1)
    expect(state.sidebarCollapsed).toBe(false)
  })

  it('强调色可在四个预设间切换', () => {
    useSettingsStore.getState().setAccent('purple')
    expect(useSettingsStore.getState().accent).toBe('purple')
    useSettingsStore.getState().setAccent('amber')
    expect(useSettingsStore.getState().accent).toBe('amber')
  })

  it('折叠侧栏是幂等切换而非置位', () => {
    useSettingsStore.getState().toggleSidebar()
    expect(useSettingsStore.getState().sidebarCollapsed).toBe(true)
    useSettingsStore.getState().toggleSidebar()
    expect(useSettingsStore.getState().sidebarCollapsed).toBe(false)
  })

  it('偏好同步写入 localStorage，且不含函数', () => {
    useSettingsStore.getState().setAccent('cyan')
    useSettingsStore.getState().setAnimationSpeed(2)

    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    expect(raw).not.toBeNull()

    const persisted = JSON.parse(raw as string) as {
      state: Record<string, unknown>
      version: number
    }
    expect(persisted.state.accent).toBe('cyan')
    expect(persisted.state.animationSpeed).toBe(2)
    expect(persisted.version).toBe(1)
    expect(typeof persisted.state.setAccent).toBe('undefined')
  })

  it('面板尺寸写回后一并持久化', () => {
    useSettingsStore.getState().setPaneSize('left', 512)
    useSettingsStore.getState().setPaneSize('bottom', 168)

    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    const persisted = JSON.parse(raw as string) as { state: Record<string, unknown> }
    expect(persisted.state.left).toBe(512)
    expect(persisted.state.bottom).toBe(168)
    expect(useSettingsStore.getState().right).toBe(DEFAULT_SETTINGS.right)
  })

  it('恢复默认会覆盖所有已改动项', () => {
    const store = useSettingsStore.getState()
    store.setAccent('purple')
    store.setReduceMotion(true)
    store.setShowGrid(false)
    store.setAnimationSpeed(0.5)
    store.toggleSidebar()

    useSettingsStore.getState().reset()

    const state = useSettingsStore.getState()
    expect(state.accent).toBe(DEFAULT_SETTINGS.accent)
    expect(state.reduceMotion).toBe(DEFAULT_SETTINGS.reduceMotion)
    expect(state.showGrid).toBe(DEFAULT_SETTINGS.showGrid)
    expect(state.animationSpeed).toBe(DEFAULT_SETTINGS.animationSpeed)
    expect(state.sidebarCollapsed).toBe(DEFAULT_SETTINGS.sidebarCollapsed)
  })
})

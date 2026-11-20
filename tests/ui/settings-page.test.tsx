import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../../src/App'
import { SETTINGS_STORAGE_KEY, useSettingsStore } from '../../src/store/settingsStore'

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('设置页（Phase 0 唯一具备真实行为的模块）', () => {
  it('选择强调色会同时更新状态、根节点属性与本地存储', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Electric Purple' }))

    expect(useSettingsStore.getState().accent).toBe('purple')
    expect(document.documentElement.dataset.accent).toBe('purple')

    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    expect(JSON.parse(raw as string).state.accent).toBe('purple')
  })

  it('减少动效开关反映到状态并保留无障碍语义', async () => {
    const user = userEvent.setup()
    renderSettings()

    const toggle = screen.getByRole('switch', { name: '减少动效' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(useSettingsStore.getState().reduceMotion).toBe(true)
  })

  it('恢复默认会把改动过的选项全部还原', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'ALU Amber' }))
    await user.click(screen.getByRole('button', { name: /恢复默认/ }))

    expect(useSettingsStore.getState().accent).toBe('blue')
    expect(useSettingsStore.getState().animationSpeed).toBe(1)
  })

  it('动画速度用 aria-pressed 表达当前档位', async () => {
    const user = userEvent.setup()
    renderSettings()

    const slow = screen.getByRole('button', { name: '0.5×' })
    await user.click(slow)

    expect(slow).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'false')
    expect(useSettingsStore.getState().animationSpeed).toBe(0.5)
  })
})

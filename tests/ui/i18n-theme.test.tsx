import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppRoutes } from '../../src/App'
import { SETTINGS_STORAGE_KEY, useSettingsStore } from '../../src/store/settingsStore'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

const nav = () => screen.getByRole('navigation')

beforeEach(() => {
  localStorage.clear()
  // 语言与主题是全局状态，逐个用例重置，避免互相污染
  useSettingsStore.setState({ lang: 'zh', theme: 'dark' })
  document.documentElement.dataset.theme = 'dark'
  document.documentElement.lang = 'zh-CN'
})

describe('三语模式：结构一致，只换文字', () => {
  it('中文模式只渲染中文标签', () => {
    renderAt('/')
    expect(within(nav()).getByRole('link', { name: /总览/ })).toBeInTheDocument()
    expect(within(nav()).queryByRole('link', { name: /Overview/ })).not.toBeInTheDocument()
  })

  it('英文模式把同一批标签换成英文，链接数量不变', () => {
    useSettingsStore.setState({ lang: 'en' })
    renderAt('/')
    const links = within(nav()).getAllByRole('link')
    expect(within(nav()).getByRole('link', { name: /Overview/ })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: /Pipeline Lab/ })).toBeInTheDocument()
    expect(within(nav()).queryByRole('link', { name: /流水线实验室/ })).not.toBeInTheDocument()
    // 结构不变：导航项数量与模块数一致（9 个）
    expect(links).toHaveLength(9)
  })

  it('双语模式同一行给出中英对照，英文片段带 lang="en"', () => {
    useSettingsStore.setState({ lang: 'both' })
    renderAt('/')
    const link = within(nav()).getByRole('link', { name: /总览/ })
    expect(link.textContent).toContain('总览')
    expect(link.textContent).toContain('Overview')

    const en = link.querySelector('[lang="en"]')
    expect(en).not.toBeNull()
    expect(en?.textContent).toBe('Overview')
    // 容器标主语言，朗读器先读中文再读英文
    expect(link.querySelector('[lang="zh-CN"]')).not.toBeNull()
  })

  it('切换语言不会改变页面的 h1 层级', async () => {
    const user = userEvent.setup()
    renderAt('/settings')
    // 设置页自己也有一组语言控件，这里只验顶栏那一组
    const banner = within(document.querySelector('header') as HTMLElement)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    await user.click(banner.getByRole('button', { name: 'EN' }))

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Settings')
  })

  it('语言写进 <html lang>，英文模式不再是 zh-CN', async () => {
    const user = userEvent.setup()
    renderAt('/settings')
    const banner = within(document.querySelector('header') as HTMLElement)

    await user.click(banner.getByRole('button', { name: 'EN' }))
    expect(document.documentElement.lang).toBe('en')

    await user.click(banner.getByRole('button', { name: '中/EN' }))
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(document.documentElement.dataset.lang).toBe('both')
  })
})

describe('主题切换', () => {
  it('顶栏开关切换 data-theme 并写进本地存储', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const toggle = screen.getByRole('switch', { name: '浅色主题' })

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(toggle)

    expect(document.documentElement.dataset.theme).toBe('light')
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    expect(JSON.parse(raw as string).state.theme).toBe('light')

    await user.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('设置页的主题分段控件与顶栏开关是同一個状态', async () => {
    const user = userEvent.setup()
    renderAt('/settings')

    await user.click(screen.getByRole('button', { name: '浅色' }))
    expect(useSettingsStore.getState().theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../../src/App'
import { NAV_MODULES } from '../../src/config/nav'
import { PLACEHOLDER } from '../../src/store/cpuStore'

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('应用外壳与路由', () => {
  it('侧栏列出全部九个模块', () => {
    renderAt()
    const nav = screen.getByRole('navigation')
    expect(within(nav).getAllByRole('link')).toHaveLength(NAV_MODULES.length)
    for (const module of NAV_MODULES) {
      expect(within(nav).getByRole('link', { name: new RegExp(module.label) })).toBeInTheDocument()
    }
  })

  it('默认落在总览，并且把「阶段 00 已交付」写在首屏', () => {
    renderAt()
    expect(
      screen.getByRole('heading', { level: 1, name: /SEE THE INVISIBLE/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('phase 00–10 已交付')).toBeInTheDocument()
  })

  it('顶栏在引擎离线时如实显示 OFFLINE 与空读数', () => {
    renderAt()
    expect(screen.getByText('OFFLINE')).toBeInTheDocument()
    // CYCLE 与 PC 未接入，必须是破折号而不是 0
    expect(screen.getAllByText(PLACEHOLDER).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('0x00000000')).not.toBeInTheDocument()
  })

  it('点击侧栏可以切到流水线实验室', async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(screen.getByRole('link', { name: /Pipeline Lab/ }))

    expect(
      screen.getByRole('heading', { level: 1, name: /Pipeline Lab/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/5-stage/)).toBeInTheDocument()
  })

  it('逻辑实验室渲染真实的门电路实验台', () => {
    renderAt('/logic')
    expect(screen.getByRole('heading', { level: 1, name: 'Logic Lab' })).toBeInTheDocument()
    expect(screen.getByText(/两个都为 1 才输出 1/)).toBeInTheDocument()
    expect(screen.getByLabelText('输入 A')).toBeInTheDocument()
  })

  it('流水线页的顶栏读流水线引擎，装载后不再是 OFFLINE', async () => {
    const user = userEvent.setup()
    renderAt('/pipeline')
    const header = screen.getByRole('banner')
    // 还没装载：Mode 已经是 PIPE，状态如实为 OFFLINE
    expect(within(header).getByText('PIPE')).toBeInTheDocument()
    expect(within(header).getByText('OFFLINE')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '装载' }))

    expect(within(header).queryByText('OFFLINE')).not.toBeInTheDocument()
    expect(within(header).getByText('READY')).toBeInTheDocument()
  })

  it('未知地址落到 404 而不是空白页', () => {
    renderAt('/no-such-module')
    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeInTheDocument()
  })
})

/**
 * jsdom 默认让 matchMedia 全部匹配（宽屏）。窄屏用例临时把它翻过来：
 * `min-width` 一律不匹配，`max-width` 一律匹配。
 */
function pretendNarrowViewport(): () => void {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: !query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

describe('窄屏抽屉导航', () => {
  it('汉堡按钮打开抽屉，点模块后自动收起', async () => {
    const restore = pretendNarrowViewport()
    const user = userEvent.setup()
    try {
      renderAt('/')
      // 窄屏不渲染常驻侧栏，导航入口只剩汉堡
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '打开模块导航' }))
      const drawer = screen.getByRole('dialog', { name: '模块导航' })
      expect(within(drawer).getByRole('navigation')).toBeInTheDocument()
      for (const module of NAV_MODULES) {
        expect(within(drawer).getByRole('link', { name: new RegExp(module.label) })).toBeInTheDocument()
      }

      await user.click(within(drawer).getByRole('link', { name: /Pipeline Lab/ }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: /Pipeline Lab/ })).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('ESC 关闭抽屉，焦点回到汉堡按钮', async () => {
    const restore = pretendNarrowViewport()
    const user = userEvent.setup()
    try {
      renderAt('/')
      const trigger = screen.getByRole('button', { name: '打开模块导航' })
      await user.click(trigger)
      expect(screen.getByRole('dialog', { name: '模块导航' })).toBeInTheDocument()

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    } finally {
      restore()
    }
  })
})

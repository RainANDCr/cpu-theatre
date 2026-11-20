import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import LearningCenter from '../../src/pages/LearningCenter'
import { LEARNING_MODULES } from '../../src/content/learning'
import { useLearningStore } from '../../src/store/learningStore'

beforeEach(() => {
  useLearningStore.setState({ completed: [], answers: {} })
  localStorage.clear()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <LearningCenter />
    </MemoryRouter>,
  )
}

describe('Learning Center', () => {
  it('四个模块都在导航里，默认打开第一个', () => {
    renderPage()
    const nav = screen.getByRole('navigation', { name: '知识模块' })
    expect(within(nav).getAllByRole('button')).toHaveLength(LEARNING_MODULES.length)
    expect(screen.getByRole('heading', { level: 2, name: 'Y86-64 指令集' })).toBeInTheDocument()
  })

  it('切换模块会换内容', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /PIPE：流水线实现/ }))

    expect(screen.getByRole('heading', { level: 2, name: 'PIPE：流水线实现' })).toBeInTheDocument()
    expect(screen.getByText(/为什么要流水线/)).toBeInTheDocument()
  })

  it('标记已读会更新进度', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText('0%')).toBeInTheDocument()

    const buttons = screen.getAllByRole('button', { name: '标记为已读' })
    await user.click(buttons[0]!)

    expect(useLearningStore.getState().completed).toHaveLength(1)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('答错会提示，答对会标绿', async () => {
    const user = userEvent.setup()
    renderPage()

    const quiz = screen.getByRole('region', { name: '自测' })
    // 第一题正确答案是「irmovq」
    await user.click(within(quiz).getByRole('button', { name: /irmovq/ }))
    expect(screen.getByText(/✓ 正确/)).toBeInTheDocument()

    await user.click(within(quiz).getByRole('button', { name: /addq/ }))
    expect(screen.getByText(/✗ 再想想/)).toBeInTheDocument()
    expect(useLearningStore.getState().answers['isa:0']).toBe(0)
  })

  it('每个知识点都给了实验入口或演示，不空谈', () => {
    renderPage()
    // 第一模块第三节有「在编辑器里看指令编码」之外的编码演示
    expect(screen.getByText(/icode=3\(irmovq\)/)).toBeInTheDocument()
  })
})

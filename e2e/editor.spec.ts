import { expect, test, waitForHeading } from './fixtures'

/**
 * 编辑器 → 汇编器 → 输出面板的闭环。
 *
 * 这里必须用真实键盘输入，不能用「读源码字符串直接调用 assemble」——
 * 后者测的是函数，前者测的是「用户能不能把代码敲进去并得到机器码」，
 * 而 Monaco 在真实浏览器里出问题的概率远高于汇编器。
 */
test.describe('Instruction Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor')
    await waitForHeading(page, /Instruction Editor/)
  })

  test('默认示例可直接汇编出机器码', async ({ page }) => {
    await page.getByRole('button', { name: '汇编' }).click()

    const output = page.getByRole('region', { name: '汇编输出' })
    await expect(output).toContainText('30 F0 0A')
    await expect(output).toContainText('irmovq $10, %rax')
    // 4 条指令，共 23 字节：两段 irmovq(10+10) + addq(2) + halt(1)
    await expect(output).toContainText('23 B')
  })

  test('写错指令时给出诊断与建议', async ({ page }) => {
    // 0.56 起 Monaco 用 EditContext，textarea 只是 IME 代理（readonly）。
    // 必须点内容区取焦点，键盘事件才会被编辑器接住。
    await page.locator('.monaco-editor .view-lines').click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('irmovq $10, %rax\nmovq %rax, %rbx\nirmovq 5, %rcx\nhalt')

    await page.getByRole('button', { name: '汇编' }).click()

    // 出错时自动切到诊断页：省掉一次「我点了汇编怎么没反应」
    const diagnostics = page.getByRole('region', { name: '汇编输出' })
    await expect(diagnostics).toContainText('未知指令')
    await expect(diagnostics).toContainText('movq')
    // 诊断不只报错，还要给出下一步：这里应建议 rrmovq
    await expect(diagnostics).toContainText('rrmovq')
    // 立即数漏写 $ 要单独指出，且说明缺的是什么
    await expect(diagnostics).toContainText('不是立即数')
    await expect(diagnostics).toContainText('$ 前缀')
  })

  test('Ctrl+Enter 与点按钮等价', async ({ page }) => {
    await page.locator('.monaco-editor .view-lines').click()
    await page.keyboard.press('Control+Enter')

    await expect(page.getByRole('region', { name: '汇编输出' })).toContainText('30 F0 0A')
  })

  test('字符串示例：.string 按 UTF-8 落盘，取字节用 andq 掩码', async ({ page }) => {
    await page.getByRole('button', { name: '字符串' }).click()
    await page.getByRole('button', { name: '汇编' }).click()

    const output = page.getByRole('region', { name: '汇编输出' })
    await expect(output).toContainText('5 ins')
    await expect(output).toContainText('1 dat')
    await expect(output).toContainText('.string "Hello, Y86!"')
    // 'H' 'e' 'l' 'l' ... = 48 65 6C 6C
    await expect(output).toContainText('48 65 6C 6C')
  })

  test('精简 bundle 之后，撤销与查找仍然可用', async ({ page }) => {
    // 这两条守的是「按体积砍依赖」时最容易砍掉的东西：undo 栈与 find 贡献
    await page.locator('.monaco-editor .view-lines').click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('halt')

    const lines = page.locator('.monaco-editor .view-lines')
    await expect(lines).toContainText('halt')

    await page.keyboard.press('Control+Z')
    await expect(lines).toContainText('irmovq')

    await page.keyboard.press('Control+F')
    await expect(page.locator('.monaco-editor .find-widget')).toHaveClass(/visible/)
    await page.keyboard.press('Escape')
  })

  test('数据段示例：.pos/.quad 出现在 Listing 且按小端落盘', async ({ page }) => {
    await page.getByRole('button', { name: '数据段' }).click()
    await page.getByRole('button', { name: '汇编' }).click()

    const output = page.getByRole('region', { name: '汇编输出' })
    // 3 条指令 + 1 行数据；0x40 处 8 字节，镜像到 0x48
    await expect(output).toContainText('3 ins')
    await expect(output).toContainText('1 dat')
    await expect(output).toContainText('72 B')
    await expect(output).toContainText('.quad 123')
    // 123 = 0x7B，小端第一个字节就是 7B
    await expect(output).toContainText('7B 00 00')
  })
})

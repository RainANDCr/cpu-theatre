import { expect, header, logRows, registerRow, test, waitForHeading } from './fixtures'

/**
 * 模拟器的端到端行为。
 *
 * 这些断言刻意只看「用户能看见的事实」：寄存器面板的数值、日志的行数与内容、
 * 顶栏状态。不去读 store，也不依赖内部实现——否则测试只是把实现抄了一遍。
 */
test.describe('CPU Simulator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/simulator')
    await waitForHeading(page, /CPU Simulator/)
  })

  test('未装载时寄存器显示 —，日志为空态', async ({ page }) => {
    await expect(registerRow(page, '%rax')).toContainText('—')
    // 「尚无执行记录」在时间轴与日志里各出现一次，这里只关心日志那一处
    await expect(
      page.getByRole('region', { name: '执行日志' }).getByText('尚无执行记录'),
    ).toBeVisible()
    // 空态必须说明「接下来会发生什么」，而不是摆一个 0 假装有数据
    await expect(page.getByText(/点「单步」或「运行」后/)).toBeVisible()
  })

  test('单步一次只执行一条指令', async ({ page }) => {
    await page.getByRole('button', { name: '单步' }).click()

    await expect(registerRow(page, '%rax')).toContainText('0xA')
    await expect(logRows(page)).toHaveCount(1)
    await expect(logRows(page).first()).toContainText('irmovq $10, %rax')
    await expect(logRows(page).first()).toContainText('%rax=10')
  })

  test('回退一步会真实恢复上一拍状态', async ({ page }) => {
    await page.getByRole('button', { name: '单步' }).click()
    await page.getByRole('button', { name: '单步' }).click()
    await expect(registerRow(page, '%rbx')).toContainText('0x14')

    await page.getByRole('button', { name: '回退' }).click()

    // %rbx 回到 0x0，日志回到 1 行：这不是动画倒放，是状态被恢复
    await expect(registerRow(page, '%rbx')).toContainText('0x0')
    await expect(logRows(page)).toHaveCount(1)
  })

  test('跑完到 HLT，结果与验收用例 A 一致', async ({ page }) => {
    await page.getByRole('button', { name: '跑完' }).click()

    await expect(registerRow(page, '%rbx')).toContainText('0x1E')
    // 顶栏显示的是引擎状态词（HALTED），Stat 码 HLT 在日志列里
    await expect(header(page)).toContainText('HALTED')
    await expect(logRows(page).last()).toContainText('HLT')
    await expect(logRows(page)).toHaveCount(4)
  })

  test('断点会在目标指令之前停住', async ({ page }) => {
    // 第 3 行是 addq；点行号下断点
    const gutter = page.locator('.margin-view-overlays .line-numbers').filter({ hasText: /^3$/ })
    await gutter.click()
    await expect(page.getByText('1 bp')).toBeVisible()

    await page.getByRole('button', { name: '运行' }).click()

    // 停在 addq 之前：%rbx 还是 0x14，状态是暂停而不是 HLT
    await expect(header(page)).toContainText('PAUSED')
    await expect(registerRow(page, '%rbx')).toContainText('0x14')
    await expect(logRows(page)).toHaveCount(2)
  })
})

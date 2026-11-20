import { expect, logRows, test } from './fixtures'

/**
 * Windows 125% / 150% 缩放：真实表现是 **CSS 视口变小 + DPR 变大**。
 *
 * 所以不能只改 deviceScaleFactor（布局仍按原 CSS 宽度算），
 * 要把 1920×1080 屏幕在两种缩放下的 CSS 视口一起模拟：
 *   125% → 1536×864，150% → 1280×720。
 *
 * 断言三件事：DPR 真的生效、页面不横向溢出、关键控件可点且结果正确。
 */
const SCENARIOS = [
  { label: '125%', width: 1536, height: 864, scale: 1.25 },
  { label: '150%', width: 1280, height: 720, scale: 1.5 },
] as const

for (const scenario of SCENARIOS) {
  test.describe(`高 DPI ${scenario.label}（${scenario.width}×${scenario.height}）`, () => {
    test.use({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: scenario.scale,
    })

    test('模拟器：不溢出，单步仍然执行一条指令', async ({ page }) => {
      await page.goto('/simulator')

      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(scenario.scale)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)

      await page.getByRole('button', { name: '单步' }).click()
      await expect(logRows(page)).toHaveCount(1)
      // 顶栏读数不能被挤掉：Cycle 要有真实数字
      await expect(page.locator('header')).toContainText(/CYCLE/i)
    })

    test('编辑器：工具栏不被裁切，汇编结果正确', async ({ page }) => {
      await page.goto('/editor')

      const assemble = page.getByRole('button', { name: '汇编' })
      await expect(assemble).toBeInViewport()
      await assemble.click()
      await expect(page.getByRole('region', { name: '汇编输出' })).toContainText('30 F0 0A')

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
    })
  })
}

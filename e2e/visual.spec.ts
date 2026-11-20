import { expect, test, waitForFonts, waitForHeading } from './fixtures'

/**
 * 视觉回归。
 *
 * 只覆盖**不含 Monaco 与实时数据**的页面。理由很简单：
 * 编辑器的语法高亮、光标、以及日志里的周期数，每次截图都可能差几像素或一行，
 * 那种基线维护成本高而收益低——它报的警大多不是回归，是噪声。
 *
 * 这套基线是**本机字体渲染**的结果。换机器或换 Edge 大版本后，
 * 用 `npm run test:e2e:update` 重建，并在 PR 里说明原因。
 */
const PAGES = [
  { name: 'overview', path: '/', heading: /SEE THE INVISIBLE/ },
  { name: 'logic', path: '/logic', heading: /Logic Lab/ },
  { name: 'pipeline-idle', path: '/pipeline', heading: /Pipeline Lab/ },
  { name: 'settings', path: '/settings', heading: /Settings/ },
] as const

for (const item of PAGES) {
  test(`视觉基线：${item.name}`, async ({ page }) => {
    await page.goto(item.path)
    await waitForHeading(page, item.heading)
    await waitForFonts(page)

    await expect(page).toHaveScreenshot(`${item.name}.png`, {
      animations: 'disabled',
      caret: 'hide',
    })
  })
}

import { expect, test, waitForHeading } from './fixtures'

/**
 * 流水线实验室：五列必须同时显示不同的指令，否则「流水」只是画了五个框。
 */
test.describe('Pipeline Lab', () => {
  test('未装载时五列各自解释自己的职责', async ({ page }) => {
    await page.goto('/pipeline')
    await waitForHeading(page, /Pipeline Lab/)

    await expect(page.getByText(/按预测 PC 取 10 字节指令/)).toBeVisible()
    await expect(page.getByText(/加载互锁被判定出来/)).toBeVisible()

    // 空态不能是「bubble」这种占位词——那既是假数据，也没告诉用户这一段干什么
    const columns = page.locator('div.auto-rows-fr > div')
    await expect(columns).toHaveCount(5)
    for (const text of await columns.allTextContents()) {
      expect(text.toLowerCase()).not.toContain('bubble')
      expect(text.length).toBeGreaterThan(20)
    }
  })

  test('推进五拍后五列同时装着不同指令', async ({ page }) => {
    await page.goto('/pipeline')
    await waitForHeading(page, /Pipeline Lab/)

    await page.getByRole('button', { name: '装载' }).click()
    for (let i = 0; i < 5; i += 1) {
      await page.getByRole('button', { name: '下一拍' }).click()
    }

    const columns = page.locator('div.auto-rows-fr > div')
    await expect(columns).toHaveCount(5)

    const texts = await columns.allTextContents()
    const mnemonics = new Set(
      texts
        .join(' ')
        .match(/irmovq|rrmovq|mrmovq|rmmovq|addq|subq|andq|xorq|j\w+|call|ret|pushq|popq|halt|nop/g) ?? [],
    )
    // 五级流水线的意义就是「多条指令同时在途」
    expect(mnemonics.size).toBeGreaterThanOrEqual(3)

    // CPI 由 cycles / instructions 实时算出，不是写死的常量
    await expect(page.getByText('CPI', { exact: true })).toBeVisible()

    // 顶栏必须读流水线自己的引擎：页面上五列都在动，右上角不能还写着 OFFLINE
    const header = page.locator('header')
    await expect(header).toContainText('PIPE')
    await expect(header).not.toContainText('OFFLINE')
    await expect(header).toContainText(/0*5/)
  })

  test('页面没有横向溢出', async ({ page }) => {
    await page.goto('/pipeline')
    await waitForHeading(page, /Pipeline Lab/)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

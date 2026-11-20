import { expect, test } from './fixtures'

/**
 * 窄屏（390×844，接近 iPhone 14）的导航。
 *
 * 只断言两件事：抽屉能开能关、页面没有横向溢出。
 * 布局细节交给视觉，行为细节交给单元测试——E2E 不重复它们。
 */
test.describe('窄屏抽屉导航', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('汉堡打开抽屉、ESC 关闭并归还焦点', async ({ page }) => {
    await page.goto('/')

    const trigger = page.getByRole('button', { name: '打开模块导航' })
    await expect(trigger).toBeVisible()
    // 窄屏下常驻侧栏应当让位，而不是缩成 78px 图标栏
    await expect(page.getByRole('complementary', { name: '模块导航' })).toBeHidden()

    await trigger.click()
    const drawer = page.getByRole('dialog', { name: '模块导航' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('navigation')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('选择模块后收起，且页面不横向溢出', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '打开模块导航' }).click()
    const drawer = page.getByRole('dialog', { name: '模块导航' })
    await drawer.getByRole('link', { name: /Pipeline Lab|流水线实验室/ }).click()

    await expect(page).toHaveURL(/\/pipeline$/)
    await expect(drawer).toBeHidden()
    await expect(page.getByRole('heading', { level: 1, name: /Pipeline Lab|流水线实验室/ })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

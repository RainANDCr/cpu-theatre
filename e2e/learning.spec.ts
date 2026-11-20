import { expect, test, waitForHeading } from './fixtures'

test.describe('Learning Center', () => {
  test('标记已读后进度增加，并记住状态', async ({ page }) => {
    await page.goto('/learning')
    await waitForHeading(page, /Learning Center/)

    const readButton = page.getByRole('button', { name: '标记为已读' }).first()
    await readButton.click()
    await expect(page.getByRole('button', { name: '标记为未读' }).first()).toBeVisible()

    // 刷新后进度仍在：这是写进 localStorage 的，不是内存里的临时状态
    await page.reload()
    await waitForHeading(page, /Learning Center/)
    await expect(page.getByRole('button', { name: '标记为未读' }).first()).toBeVisible()
  })

  test('自测题答对给正反馈，答错给「再想想」', async ({ page }) => {
    await page.goto('/learning')
    await waitForHeading(page, /Learning Center/)

    const quiz = page.getByRole('region', { name: '自测' })

    await quiz.getByRole('button', { name: /irmovq/ }).click()
    await expect(quiz.getByText(/✓ 正确/)).toBeVisible()

    await quiz.getByRole('button', { name: /addq/ }).first().click()
    await expect(quiz.getByText(/✗ 再想想/)).toBeVisible()
  })
})

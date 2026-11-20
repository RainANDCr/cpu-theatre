import { expect, header, test } from './fixtures'

/**
 * 三语模式 × 双主题。
 *
 * 这里不比对截图，而是断言「结构」与「可读性」：
 * 语言切换后元素数量不变、双语片段带 lang 属性、正文对比度达到 4.5:1。
 * 截图只能告诉你「变了」，告诉不了你「变得对不对」。
 */

/**
 * 页面内计算对比度的工具。
 *
 * 两件容易算错的事：
 * 1. Chromium 对 `color-mix()` 会返回 `color(srgb r g b)`，不是 `rgb()`；
 * 2. 面板背景是半透明的（bg-panel/65），必须逐层合成到不透明为止——
 *    直接取「第一个非透明背景」会得出 1.00 这种假结果。
 */
function measureContrast(input: { selector?: string; sample?: string }) {
  const el = (input.sample
    ? document.querySelector(input.sample)
    : document.querySelector(input.selector!)) as HTMLElement | null
  if (!el) return null

  /*
   * 用 1×1 canvas 把颜色「画出来」再读像素，而不是解析字符串：
   * color-mix() 在 Chromium 里会序列化成 oklab(...)，正则解析必然漏；
   * canvas 的 fillStyle 接受任何 CSS 颜色，还会自动做 alpha 混合——
   * 于是「文字色叠在真实背景上」的结果就是用户看到的那个像素。
   */
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  const read = () => Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3)

  const layers: string[] = []
  let node: HTMLElement | null = el
  while (node) {
    const bg = getComputedStyle(node).backgroundColor
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') layers.push(bg)
    node = node.parentElement
  }

  // 从最底层（最后压入的祖先）开始铺，再叠文字色
  ctx.clearRect(0, 0, 1, 1)
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    ctx.fillStyle = layers[i]
    ctx.fillRect(0, 0, 1, 1)
  }
  const background = read()

  ctx.fillStyle = getComputedStyle(el).color
  ctx.fillRect(0, 0, 1, 1)
  const color = read()

  const luminance = ([r, g, b]: number[]) => {
    const channel = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }

  const a = luminance(color)
  const b = luminance(background)
  return {
    ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    color,
    background,
  }
}

type Contrast = { ratio: number; color: number[]; background: number[] }

async function contrastOf(
  page: Parameters<typeof header>[0],
  input: { selector?: string; sample?: string },
): Promise<Contrast> {
  // 传真实函数而不是字符串：evaluate(string, arg) 不会把 arg 传进去，会静默返回 undefined
  const result = await page.evaluate(measureContrast, input)
  return result as Contrast
}

test.describe('Language & Theme', () => {
  test('顶栏三档语言：标签换、结构不换、html lang 同步', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('heading', { level: 1 }).first().waitFor()

    const navLinks = page.getByRole('navigation').getByRole('link')
    const zhCount = await navLinks.count()
    await expect(navLinks.filter({ hasText: '设置' }).first()).toBeVisible()

    await header(page).getByRole('button', { name: 'EN', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(navLinks.filter({ hasText: 'Settings' }).first()).toBeVisible()
    // 结构一致：导航项数量不变
    expect(await navLinks.count()).toBe(zhCount)

    await header(page).getByRole('button', { name: '中/EN', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page.locator('html')).toHaveAttribute('data-lang', 'both')

    const bilingual = navLinks.filter({ hasText: '设置' }).first()
    await expect(bilingual.locator('[lang="en"]')).toHaveCount(1)
    expect(await navLinks.count()).toBe(zhCount)
  })

  test('双语模式：正文给出英文对照行，而不是只有标题', async ({ page }) => {
    await page.goto('/settings')
    await header(page).getByRole('button', { name: '中/EN', exact: true }).click()

    const block = page.locator('.ct-bi-block').first()
    await expect(block).toBeVisible()
    // 同一块里中文在前、英文在后，是「一条记录的两行」而不是两段并列文字
    await expect(block.locator('.ct-bi-zh')).toHaveCount(1)
    await expect(block.locator('.ct-bi-en')).toHaveCount(1)
  })

  test('浅色主题：底色变亮，正文对比度 ≥ 4.5:1', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('heading', { level: 1 }).first().waitFor()

    const toggle = header(page).getByRole('switch', { name: '浅色主题' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    const contrast = await contrastOf(page, { selector: 'main p' })
    // 浅底：合成后的背景必须接近白色
    expect(contrast.background[0]).toBeGreaterThan(200)
    expect(contrast.ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('双语模式下的英文次级行仍然可读（对比度 ≥ 4.5）', async ({ page }) => {
    await page.goto('/settings')
    await header(page).getByRole('button', { name: '中/EN', exact: true }).click()
    await header(page).getByRole('switch', { name: '浅色主题' }).click()

    const { ratio } = await contrastOf(page, { sample: '.ct-bi-en' })
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('语言与主题写进 localStorage，新标签页直接继承', async ({ page }) => {
    await page.goto('/settings')
    await header(page).getByRole('button', { name: 'EN', exact: true }).click()
    await header(page).getByRole('switch', { name: 'Light theme' }).click()

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cpu-theatre:settings')!))
    expect(saved.state.lang).toBe('en')
    expect(saved.state.theme).toBe('light')

    // 同 context 的新页面共享 localStorage，但不带夹具的「播种」脚本，
    // 因此重新加载时读到的是用户真正保存下来的偏好
    const fresh = await page.context().newPage()
    await fresh.goto('/settings')
    await fresh.getByRole('heading', { level: 1 }).first().waitFor()
    await expect(fresh.locator('html')).toHaveAttribute('lang', 'en')
    await expect(fresh.locator('html')).toHaveAttribute('data-theme', 'light')
    await fresh.close()
  })
})

import { test as base, expect, type Locator, type Page } from '@playwright/test'

/**
 * 共用夹具。
 *
 * 为什么要在每个页面加载前写 localStorage？因为「面板尺寸」和「减少动效」都是持久化的：
 * 上一次运行留下的宽度会让三栏布局与基线图对不上，从而产生一堆与代码无关的红色 diff。
 * 固定成默认值 + 减少动效，截图比较才有意义。
 */
export const SETTINGS_KEY = 'cpu-theatre:settings'

/** 与 src/store/settingsStore.ts 的 DEFAULT_SETTINGS 保持一致，只把 reduceMotion 打开 */
const SEEDED_SETTINGS = {
  state: {
    accent: 'blue',
    reduceMotion: true,
    showGrid: true,
    animationSpeed: 2,
    sidebarCollapsed: false,
    left: 430,
    right: 342,
    bottom: 196,
  },
  version: 1,
}

export const test = base.extend({
  // 第二个参数是 Playwright 的「交还控制权」回调，位置参数、名字随意。
  // 叫 provide 而不是 use：叫 use 会被 react-hooks 规则误判成 React Hook。
  page: async ({ page }, provide) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [SETTINGS_KEY, JSON.stringify(SEEDED_SETTINGS)] as const,
    )
    await provide(page)
  },
})

export { expect }
// 让 spec 只从一个地方取类型，避免两处各 import 一次
export type { Locator, Page }

/** 寄存器面板里的一行。行是 button，文本形如 `0%rax0xA` */
export function registerRow(page: Page, name: string): Locator {
  return page
    .getByRole('tabpanel', { name: '寄存器' })
    .getByRole('button')
    .filter({ hasText: name })
    .first()
}

/** 执行日志的每一行也是一个 button */
export function logRows(page: Page): Locator {
  return page.getByRole('region', { name: '执行日志' }).getByRole('button')
}

/** 顶栏读数（STATUS / CYCLE / PC）都在 header 里 */
export function header(page: Page): Locator {
  return page.locator('header')
}

/** 等页面主内容挂上：路由是动态分包，早抓会抓到空壳 */
export async function waitForHeading(page: Page, text: RegExp | string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(text)
}

/** 字体就位再截图，否则中文可能以回退字体渲染 */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
}

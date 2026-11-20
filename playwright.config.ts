import { defineConfig } from '@playwright/test'

/**
 * E2E 与视觉回归。
 *
 * 三个刻意的决定：
 *
 * 1. **服务目标可切换。** 本地默认跑 dev（`vite build` 会清空 `dist/assets`，
 *    在带批量删除保护的沙箱里会失败）；CI 里用 `E2E_TARGET=preview` 跑**构建产物**，
 *    因为「能跑通源码」和「打出来的包能跑」是两件事。
 * 2. **浏览器按环境选。** 本地复用系统 Edge（不下载 Chromium）；
 *    CI 没有 Edge，用 Playwright 自带的 Chromium。
 * 3. **视觉基线单独一个 project。** 它依赖本机字体渲染，跨平台必挂；
 *    CI 只跑 `functional`，基线比较留在本地。
 */
const PORT = 4176
const TARGET = process.env.E2E_TARGET ?? 'dev'
const isPreview = TARGET === 'preview'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    // CI 上没装 Edge；undefined 让 Playwright 用它自己的 Chromium
    channel: process.env.CI ? undefined : 'msedge',
    viewport: { width: 1600, height: 1000 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    // 让 CSS 过渡与 framer-motion 直接落位，截图才稳定
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // 行为断言：任何平台都该通过
      name: 'functional',
      testIgnore: /visual\.spec\.ts/,
    },
    {
      // 像素基线：只在本机有意义
      name: 'visual',
      testMatch: /visual\.spec\.ts/,
    },
  ],
  webServer: {
    // preview 假定上一行已跑过 build（CI 里是显式的一步），这里只负责起服务
    command: isPreview
      ? `npm run preview -- --port ${PORT} --strictPort`
      : `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
  },
})

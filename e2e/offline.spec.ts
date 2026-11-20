import { expect, test } from './fixtures'

/**
 * 「运行期零外部请求」不能只写在 README 里。
 *
 * 做法不是「断网跑一遍」（CI 里没法可靠断网），而是把这个前提变成断言：
 * 1. 拦截所有 http(s) 请求，非 localhost 的一律 abort，并记下来；
 * 2. 全程收集 console error 与未捕获异常；
 * 3. 走完九个模块 + 一个 404，最后要求「外部请求为空、错误为空」。
 *
 * 任何一次误引入 CDN 字体、远程图标或 analytics，这里都会红。
 */
const ROUTES = [
  '/',
  '/simulator',
  '/editor',
  '/registers',
  '/memory',
  '/pipeline',
  '/logic',
  '/learning',
  '/settings',
  '/no-such-module',
]

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i

test('离线可用：全程零外部请求、零控制台错误', async ({ page }) => {
  const external: string[] = []
  const errors: string[] = []
  let localRequests = 0

  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (/^https?:\/\//i.test(url) && !LOCAL_ORIGIN.test(url)) {
      external.push(url)
      return route.abort('internetdisconnected')
    }
    if (/^https?:\/\//i.test(url)) localRequests += 1
    return route.continue()
  })

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  for (const route of ROUTES) {
    await page.goto(route)
    await page.waitForLoadState('load')
    // 每个模块都要真的渲染出东西，否则「零请求」可能只是白屏
    await expect(page.locator('h1').first()).toBeAttached()
  }

  // 编辑器是唯一会拉 Monaco 与 worker 的页面，单独确认它没悄悄退化
  await page.goto('/editor')
  await expect(page.locator('.monaco-editor .view-line').first()).toBeVisible()
  await page.getByRole('button', { name: '汇编' }).click()
  await expect(page.getByRole('region', { name: '汇编输出' })).toContainText('30 F0 0A')

  expect(external, `发现外部请求：\n${external.join('\n')}`).toEqual([])
  expect(errors, `控制台错误：\n${errors.join('\n')}`).toEqual([])
  // 反向校验：拦截器确实在工作，不是所有请求都被浏览器缓存绕过了
  expect(localRequests).toBeGreaterThan(20)
})

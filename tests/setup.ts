import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { DEFAULT_SETTINGS, useSettingsStore } from '../src/store/settingsStore'

/**
 * jsdom 的 matchMedia 永远返回 matches:false，会让侧栏在测试里始终折叠、
 * 也让 framer-motion 无法判定动效偏好。这里无条件覆盖成「匹配」，
 * 等价于宽屏 + 用户已开启减少动效——测试里不需要动画。
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
})

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverStub,
  })
}

// 因为未开启 vitest globals，自动清理不会生效，这里手动卸载
afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.accent
  useSettingsStore.setState({ ...DEFAULT_SETTINGS })
})

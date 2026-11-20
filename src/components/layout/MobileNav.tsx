import { useEffect, useRef } from 'react'
import { useUiStore } from '../../store/uiStore'
import { Sidebar } from './Sidebar'

/**
 * 窄屏抽屉导航。
 *
 * 三个容易漏掉的细节：
 * 1. **焦点**：打开时把焦点送到「关闭」按钮，关闭时还给触发按钮——
 *    否则键盘用户在抽屉里按 Tab 会一路走到背后的页面上。
 * 2. **ESC**：挂在 document 上，而不是面板上，避免焦点不在面板内时失灵。
 * 3. **路由变化**：点完链接要自动收起，这条在 AppShell 里统一处理，
 *    因为抽屉自己不知道路由变了。
 */
export function MobileNav() {
  const close = useUiStore((state) => state.closeMobileNav)
  const closeButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement | null
    closeButton.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // 触发按钮还在页面上，焦点要还回去；它被卸载时也就自然跳过
      restoreFocus.current?.focus?.()
    }
  }, [close])

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div
        className="absolute inset-0 animate-fade-in bg-void/70 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="模块导航"
        className="absolute inset-y-0 left-0 flex w-[282px] max-w-[86vw] animate-drawer-in flex-col border-r border-line/80 bg-shell shadow-panel"
      >
        <Sidebar variant="drawer" onNavigate={close} />
        <button
          ref={closeButton}
          type="button"
          onClick={close}
          aria-label="关闭模块导航"
          className="absolute right-2 top-3 flex size-8 items-center justify-center rounded-lg border border-line/70 text-ink-3 transition-colors hover:border-accent/40 hover:text-accent"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M2 2l10 10M12 2L2 12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

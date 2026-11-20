import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useSettingsStore } from '../../store/settingsStore'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useUiStore } from '../../store/uiStore'
import { ConsoleBar } from './ConsoleBar'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell() {
  const accent = useSettingsStore((state) => state.accent)
  const theme = useSettingsStore((state) => state.theme)
  const lang = useSettingsStore((state) => state.lang)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const showGrid = useSettingsStore((state) => state.showGrid)
  const pathname = useLocation().pathname
  const isWide = useMediaQuery('(min-width: 1024px)')
  const navOpen = useUiStore((state) => state.mobileNavOpen)
  const closeNav = useUiStore((state) => state.closeMobileNav)

  // 强调色落成 DOM 属性，CSS 侧的 :root[data-accent] 负责换色，
  // 避免把主题色散进几十个组件的 props。
  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  // 主题只换 <html data-theme>，颜色全部由 CSS 令牌决定，组件不需要知道当前是深色还是浅色
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // 语言写进 <html lang>：影响朗读器发音、断词与中文标点的字体回退
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
    document.documentElement.dataset.lang = lang
  }, [lang])

  // 路由一变就收抽屉：用户已经完成选择，让面板继续挡着内容没有意义
  useEffect(() => {
    closeNav()
  }, [pathname, closeNav])

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div className="relative z-10 flex h-screen w-full overflow-hidden">
        <Sidebar />
        {/* 顶栏以外的区域也要能被朗读器跳过重复导航 */}
        {!isWide && navOpen && <MobileNav />}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className={cn(
                'pointer-events-none absolute inset-0 grid-veil mask-fade transition-opacity duration-500',
                showGrid ? 'opacity-[0.55]' : 'opacity-0',
              )}
              aria-hidden="true"
            />
            <div className="relative h-full overflow-y-auto overflow-x-hidden">
              <div key={pathname} className="animate-rise">
                <Outlet />
              </div>
            </div>
          </main>
          <ConsoleBar />
        </div>
      </div>
    </MotionConfig>
  )
}

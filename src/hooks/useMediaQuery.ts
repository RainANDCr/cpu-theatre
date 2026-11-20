import { useCallback, useSyncExternalStore } from 'react'

const getServerSnapshot = () => true

/**
 * 订阅一个 CSS 媒体查询。用于「窄屏自动收起侧栏」这类纯布局决策。
 *
 * 用 useSyncExternalStore 而不是 useState + useEffect：
 * matchMedia 本来就是外部数据源，在 effect 里同步 setState 会多出一次渲染，
 * 而且在首帧之前读到的是过期值。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true
    return window.matchMedia(query).matches
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

import { cn } from '../lib/cn'
import { useSettingsStore } from '../store/settingsStore'
import { pick } from './core'

export interface TProps {
  zh: string
  en: string
  /** 双语模式下英文换到下一行（句子用它，词条用默认的同一行） */
  block?: boolean
  className?: string
  /** 覆盖外层元素，默认 span——不打断 h1/p/button 的既有结构 */
  as?: 'span' | 'div'
}

/**
 * 静态文案。三种语言模式共用同一份标记，因此结构不会随语言变化：
 * 只有 class 与 `lang` 属性不同，DOM 层级始终是「一个容器 + 最多两个文本片段」。
 */
export function T({ zh, en, block = false, className, as = 'span' }: TProps) {
  const lang = useSettingsStore((state) => state.lang)
  const Element = as

  if (lang === 'both') {
    return (
      <Element
        className={cn('ct-bi', block && 'ct-bi-block', className)}
        // 容器标主语言，英文片段单独标 en：朗读器与字体回退都按语言走
        lang="zh-CN"
      >
        <span className="ct-bi-zh">{zh}</span>
        <span className="ct-bi-en" lang="en">
          {en}
        </span>
      </Element>
    )
  }

  return (
    <Element className={className} lang={lang === 'en' ? 'en' : 'zh-CN'}>
      {pick(lang, zh, en)}
    </Element>
  )
}

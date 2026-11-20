import { useCallback } from 'react'
import { useSettingsStore, type Lang } from '../store/settingsStore'

export type { Lang }

export const LANG_OPTIONS: { value: Lang; label: string; title: string }[] = [
  { value: 'zh', label: '中', title: '中文' },
  { value: 'en', label: 'EN', title: 'English' },
  { value: 'both', label: '中/EN', title: '中英对照 · Bilingual' },
]

/**
 * 选文案。
 *
 * 为什么不建「key → 译文」的字典：这个项目的文案是散在 JSX 里的，
 * 抽成 key 会多出一层「改文案要动两个文件」的间接，还会出现「key 在、译文漏」的静默降级。
 * 现在中英两份**写在同一个调用点**（`<T zh="总览" en="Overview" />`），
 * 少写一份就是类型错误，而不是上线后显示中文。
 */
export function pick(lang: Lang, zh: string, en: string): string {
  return lang === 'en' ? en : zh
}

export interface I18n {
  lang: Lang
  /** 双语模式：需要在布局上做额外处理时用（例如表头改为上下两行） */
  isBoth: boolean
  /** 动态文案用：`t('总览', 'Overview')` */
  t: (zh: string, en: string) => string
}

export function useI18n(): I18n {
  const lang = useSettingsStore((state) => state.lang)
  const t = useCallback((zh: string, en: string) => pick(lang, zh, en), [lang])
  return { lang, isBoth: lang === 'both', t }
}


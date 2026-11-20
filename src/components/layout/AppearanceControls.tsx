import { Moon, Sun } from 'lucide-react'
import { useI18n, LANG_OPTIONS } from '../../i18n'
import { cn } from '../../lib/cn'
import { useSettingsStore } from '../../store/settingsStore'
import { Segmented } from '../ui/Segmented'

/**
 * 顶栏上的快捷外观控件：语言三档 + 主题开关。
 *
 * 为什么放在顶栏而不是只放设置页：这两项是「看内容的方式」，不是项目配置。
 * 双语对照的读者常常需要在中英之间来回切，走三层菜单会让人放弃使用。
 */
export function AppearanceControls({ className }: { className?: string }) {
  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const lang = useSettingsStore((state) => state.lang)
  const setLang = useSettingsStore((state) => state.setLang)
  const { t } = useI18n()

  const isLight = theme === 'light'

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Segmented
        label={t('界面语言', 'Interface language')}
        value={lang}
        options={LANG_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          title: option.title,
        }))}
        onChange={setLang}
        className="ct-bi-inline-tight"
      />
      <button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-label={t('浅色主题', 'Light theme')}
        title={isLight ? t('切换为深色主题', 'Switch to dark') : t('切换为浅色主题', 'Switch to light')}
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
          isLight
            ? 'border-accent/50 bg-accent/15 text-accent'
            : 'border-line/80 text-ink-3 hover:border-accent/40 hover:text-accent',
        )}
      >
        {isLight ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
      </button>
    </div>
  )
}

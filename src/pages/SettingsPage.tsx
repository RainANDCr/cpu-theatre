import type { ReactNode } from 'react'
import { Languages, RotateCcw, Sun, Moon } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Panel } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { cn } from '../lib/cn'
import { T, useI18n } from '../i18n'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
  type AccentKey,
  type AnimationSpeed,
  type Lang,
  type Theme,
} from '../store/settingsStore'

const ACCENTS: { key: AccentKey; label: string; labelZh: string; hex: string }[] = [
  { key: 'blue', label: 'Neon Blue', labelZh: '信号蓝', hex: '#4d9fff' },
  { key: 'purple', label: 'Electric Purple', labelZh: '控制紫', hex: '#a970ff' },
  { key: 'cyan', label: 'Signal Cyan', labelZh: '寄存器青', hex: '#2ee6d6' },
  { key: 'amber', label: 'ALU Amber', labelZh: '运算橙', hex: '#ffb457' },
]

const SPEEDS: { value: AnimationSpeed; label: string }[] = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
]

function SettingRow({
  label,
  hint,
  control,
}: {
  label: ReactNode
  hint: ReactNode
  control: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line/50 py-3.5 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[12.5px] text-ink">{label}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{hint}</div>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-full border transition-colors',
        checked ? 'border-accent/60 bg-accent/25' : 'border-line-2 bg-line/70',
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full transition-all duration-200',
          checked ? 'left-[22px] bg-accent' : 'left-[3px] bg-ink-2',
        )}
      />
    </button>
  )
}

export default function SettingsPage() {
  const lang = useSettingsStore((state) => state.lang)
  const theme = useSettingsStore((state) => state.theme)
  const accent = useSettingsStore((state) => state.accent)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const showGrid = useSettingsStore((state) => state.showGrid)
  const animationSpeed = useSettingsStore((state) => state.animationSpeed)
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const setLang = useSettingsStore((state) => state.setLang)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setAccent = useSettingsStore((state) => state.setAccent)
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion)
  const setShowGrid = useSettingsStore((state) => state.setShowGrid)
  const setAnimationSpeed = useSettingsStore((state) => state.setAnimationSpeed)
  const toggleSidebar = useSettingsStore((state) => state.toggleSidebar)
  const reset = useSettingsStore((state) => state.reset)
  const { t } = useI18n()

  const langOptions: { value: Lang; label: string; title: string }[] = [
    { value: 'zh', label: '中文', title: t('仅中文', 'Chinese only') },
    { value: 'en', label: 'EN', title: t('仅英文', 'English only') },
    { value: 'both', label: '中/EN', title: t('中英对照', 'Bilingual') },
  ]

  const themeOptions: { value: Theme; label: string; title: string }[] = [
    { value: 'dark', label: t('深色', 'Dark'), title: t('深色主题', 'Dark theme') },
    { value: 'light', label: t('浅色', 'Light'), title: t('浅色主题', 'Light theme') },
  ]

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 pb-16 pt-8 lg:px-9 lg:pt-10">
      <div className="flex items-center gap-2.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-3">
        <span>Module 09</span>
        <span className="text-line-2">/</span>
        <Badge tone="green" dot>
          available now
        </Badge>
      </div>
      <h1 className="mt-3 flex flex-wrap items-baseline gap-x-3 text-[32px] font-semibold tracking-[-0.02em] text-ink">
        Settings
        {/* 英文名保持原样，中文名作为次级片段：双语模式下不会出现「Settings Settings」 */}
        <span className="text-[15px] font-normal text-ink-3">
          <T zh="设置" en="Preferences" />
        </span>
      </h1>
      <p className="mt-2 max-w-[620px] text-[12.5px] leading-relaxed text-ink-2">
        <T
          block
          zh="这里只放真正生效的开关。没有「即将上线」的假选项——拨动它，界面就会变。"
          en="Only switches that actually work live here. No “coming soon” placeholders — flip one and the interface changes."
        />
      </p>

      <div className="mt-7 space-y-4">
        <Panel
          title="Language & Theme"
          subtitle={
            <T
              zh="语言与主题决定「怎么看内容」，因此排在最前；两项都立即生效并写入本机存储。"
              en="Language and theme decide how you read the content, so they come first. Both apply instantly and persist locally."
            />
          }
        >
          <SettingRow
            label={<T zh="界面语言" en="Interface language" />}
            hint={
              <T
                block
                zh="中文 / 英文 / 中英对照。三档共用同一份结构：切换时布局、编号与控件位置都不动。"
                en="Chinese, English or side-by-side. All three share one structure — layout, numbering and control positions stay put."
              />
            }
            control={
              <Segmented
                label={t('界面语言', 'Interface language')}
                size="md"
                value={lang}
                options={langOptions}
                onChange={setLang}
              />
            }
          />
          <SettingRow
            label={<T zh="主题" en="Theme" />}
            hint={
              <T
                block
                zh="深色与浅色共用同一套语义令牌：只换取值，不换组件。浅色下硬件色会压暗，保证正文对比度不低于 4.5:1。"
                en="Light and dark share one set of semantic tokens — only values change. In light mode the hardware hues are darkened so body text stays above 4.5:1."
              />
            }
            control={
              <div className="flex items-center gap-2">
                <span className="hidden text-ink-3 sm:flex">
                  {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
                </span>
                <Segmented
                  label={t('主题', 'Theme')}
                  size="md"
                  value={theme}
                  options={themeOptions}
                  onChange={setTheme}
                />
              </div>
            }
          />
          <div className="mt-3 rounded-lg border border-line/70 bg-void/40 px-3 py-2.5">
            <div className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
              <Languages size={12} />
              <span>live preview</span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">
              <T
                block
                zh="这一行就是当前语言下的效果：切换语言只替换文字，不改变行的结构与顺序。"
                en="This line renders in the current mode: switching language replaces words, not structure or order."
              />
            </p>
          </div>
        </Panel>

        <Panel
          title="Appearance"
          subtitle={
            <T
              zh="强调色会立刻作用到导航、按钮与数据流高亮"
              en="The accent applies immediately to navigation, buttons and datapath highlights"
            />
          }
        >
          <SettingRow
            label={<T zh="强调色" en="Accent color" />}
            hint={
              <T
                block
                zh="颜色不只是装饰：蓝=数据、紫=控制、青=寄存器、橙=ALU。这里选择的是界面主色。"
                en="Color carries meaning: blue = data, purple = control, cyan = registers, amber = ALU. This picks the interface accent."
              />
            }
            control={
              <div className="flex gap-1.5" role="group" aria-label={t('强调色', 'Accent color')}>
                {ACCENTS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={accent === item.key}
                    aria-label={item.label}
                    title={`${item.labelZh} · ${item.label}`}
                    onClick={() => setAccent(item.key)}
                    className={cn(
                      'size-7 rounded-md border transition-all',
                      accent === item.key
                        ? 'scale-105 border-ink/60'
                        : 'border-line-2 hover:border-ink/30',
                    )}
                    style={{ backgroundColor: item.hex }}
                  />
                ))}
              </div>
            }
          />
        </Panel>

        <Panel
          title="Motion"
          subtitle={
            <T
              zh="动画只用于表达数据流动，不用于制造热闹"
              en="Motion explains dataflow; it is not there to create excitement"
            />
          }
        >
          <SettingRow
            label={<T zh="减少动效" en="Reduce motion" />}
            hint={
              <T
                block
                zh="关闭过渡与粒子动画。适合长时间阅读源码、或对动态效果敏感的使用者；信息不会因此丢失。"
                en="Turns off transitions and datapath particles for long reading sessions or motion sensitivity. No information is lost."
              />
            }
            control={
              <Toggle
                checked={reduceMotion}
                onChange={setReduceMotion}
                label={t('减少动效', 'Reduce motion')}
              />
            }
          />
          <SettingRow
            label={<T zh="动画速度" en="Animation speed" />}
            hint={
              <T
                block
                zh="作用于总线粒子与单步节奏。1× 为真实时钟演示速度。"
                en="Controls bus particles and stepping tempo. 1× matches the real clock demo."
              />
            }
            control={
              <Segmented
                label={t('动画速度', 'Animation speed')}
                size="md"
                value={animationSpeed}
                options={SPEEDS}
                onChange={setAnimationSpeed}
              />
            }
          />
        </Panel>

        <Panel
          title="Stage"
          subtitle={<T zh="执行舞台的背景网格" en="Background grid of the execution stage" />}
        >
          <SettingRow
            label={<T zh="图纸网格" en="Blueprint grid" />}
            hint={
              <T
                block
                zh="舞台与内容区的 44px 网格。关掉它可以让长时间盯屏更舒服。"
                en="The 44px grid behind the stage and content. Turning it off is easier on the eyes over long sessions."
              />
            }
            control={
              <Toggle
                checked={showGrid}
                onChange={setShowGrid}
                label={t('图纸网格', 'Blueprint grid')}
              />
            }
          />
        </Panel>

        <Panel
          title="Navigation"
          subtitle={<T zh="桌面端的侧栏状态" en="Sidebar state on desktop" />}
        >
          <SettingRow
            label={<T zh="折叠侧栏" en="Collapse sidebar" />}
            hint={
              <T
                block
                zh="折叠后只保留图标，给舞台让出 180px 宽度。窄屏下会自动折叠，无需手动切换。"
                en="Icon-only mode frees about 180px for the stage. Narrow viewports collapse automatically."
              />
            }
            control={
              <Toggle
                checked={sidebarCollapsed}
                onChange={toggleSidebar}
                label={t('折叠侧栏', 'Collapse sidebar')}
              />
            }
          />
        </Panel>

        <Panel
          title="Data"
          subtitle={
            <T zh="所有偏好只写在本机 localStorage" en="Preferences live in localStorage only" />
          }
          actions={
            <Button variant="subtle" size="sm" onClick={reset}>
              <RotateCcw size={13} />
              <T zh="恢复默认" en="Reset" />
            </Button>
          }
        >
          <div className="rounded-lg border border-line/70 bg-void/40 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
                storage key
              </span>
              <code className="font-mono text-[11px] text-reg">{SETTINGS_STORAGE_KEY}</code>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
              <T
                block
                zh={`默认值：中文 · 深色 · ${DEFAULT_SETTINGS.accent} · ${DEFAULT_SETTINGS.animationSpeed}× · 网格开启 · 侧栏展开。没有账号系统，也不会上传任何东西。`}
                en={`Defaults: Chinese · dark · ${DEFAULT_SETTINGS.accent} · ${DEFAULT_SETTINGS.animationSpeed}× · grid on · sidebar expanded. No accounts, nothing is uploaded.`}
              />
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}

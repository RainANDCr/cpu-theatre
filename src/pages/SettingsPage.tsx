import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Panel } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { cn } from '../lib/cn'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
  type AccentKey,
  type AnimationSpeed,
} from '../store/settingsStore'

const ACCENTS: { key: AccentKey; label: string; hex: string }[] = [
  { key: 'blue', label: 'Neon Blue', hex: '#4d9fff' },
  { key: 'purple', label: 'Electric Purple', hex: '#a970ff' },
  { key: 'cyan', label: 'Signal Cyan', hex: '#2ee6d6' },
  { key: 'amber', label: 'ALU Amber', hex: '#ffb457' },
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
  label: string
  hint: ReactNode
  control: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line/50 py-3.5 last:border-0 last:pb-0 first:pt-0">
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
  const accent = useSettingsStore((state) => state.accent)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const showGrid = useSettingsStore((state) => state.showGrid)
  const animationSpeed = useSettingsStore((state) => state.animationSpeed)
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const setAccent = useSettingsStore((state) => state.setAccent)
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion)
  const setShowGrid = useSettingsStore((state) => state.setShowGrid)
  const setAnimationSpeed = useSettingsStore((state) => state.setAnimationSpeed)
  const toggleSidebar = useSettingsStore((state) => state.toggleSidebar)
  const reset = useSettingsStore((state) => state.reset)

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 pb-16 pt-8 lg:px-9 lg:pt-10">
      <div className="flex items-center gap-2.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-3">
        <span>Module 09</span>
        <span className="text-line-2">/</span>
        <Badge tone="green" dot>
          available now
        </Badge>
      </div>
      <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.02em] text-ink">Settings</h1>
      <p className="mt-2 max-w-[620px] text-[12.5px] leading-relaxed text-ink-2">
        这里只放真正生效的开关。没有「即将上线」的假选项——拨动它，界面就会变。
      </p>

      <div className="mt-7 space-y-4">
        <Panel title="Appearance" subtitle="强调色会立刻作用到导航、按钮与数据流高亮">
          <SettingRow
            label="强调色"
            hint="颜色不只是装饰：蓝=数据、紫=控制、青=寄存器、橙=ALU。这里选择的是界面主色。"
            control={
              <div className="flex gap-1.5" role="group" aria-label="强调色">
                {ACCENTS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={accent === item.key}
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => setAccent(item.key)}
                    className={cn(
                      'size-7 rounded-md border transition-all',
                      accent === item.key
                        ? 'scale-105 border-white/50'
                        : 'border-line-2 hover:border-white/25',
                    )}
                    style={{ backgroundColor: item.hex }}
                  />
                ))}
              </div>
            }
          />
        </Panel>

        <Panel title="Motion" subtitle="动画只用于表达数据流动，不用于制造热闹">
          <SettingRow
            label="减少动效"
            hint="关闭过渡与粒子动画。适合长时间阅读源码、或对动态效果敏感的使用者；信息不会因此丢失。"
            control={
              <Toggle
                checked={reduceMotion}
                onChange={setReduceMotion}
                label="减少动效"
              />
            }
          />
          <SettingRow
            label="动画速度"
            hint="Phase 4 起作用于总线粒子与单步节奏。1× 为真实时钟演示速度。"
            control={
              <Segmented
                label="动画速度"
                size="md"
                value={animationSpeed}
                options={SPEEDS}
                onChange={setAnimationSpeed}
              />
            }
          />
        </Panel>

        <Panel title="Stage" subtitle="执行舞台的背景网格">
          <SettingRow
            label="图纸网格"
            hint="舞台与内容区的 44px 网格。关掉它可以让长时间盯屏更舒服。"
            control={<Toggle checked={showGrid} onChange={setShowGrid} label="图纸网格" />}
          />
        </Panel>

        <Panel title="Navigation" subtitle="桌面端的侧栏状态">
          <SettingRow
            label="折叠侧栏"
            hint="折叠后只保留图标，给舞台让出 180px 宽度。窄屏下会自动折叠，无需手动切换。"
            control={<Toggle checked={sidebarCollapsed} onChange={toggleSidebar} label="折叠侧栏" />}
          />
        </Panel>

        <Panel
          title="Data"
          subtitle="所有偏好只写在本机 localStorage"
          actions={
            <Button variant="subtle" size="sm" onClick={reset}>
              <RotateCcw size={13} />
              恢复默认
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
              默认值：强调色 {DEFAULT_SETTINGS.accent} · 动画 {DEFAULT_SETTINGS.animationSpeed}× ·
              网格开启 · 侧栏展开。没有账号系统，也不会上传任何东西。
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}

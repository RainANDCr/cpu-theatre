import { STAGES } from '../../config/project'

const LAST_DONE = [...STAGES].reverse().find((stage) => stage.status === 'done')

export function ConsoleBar() {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-line/70 bg-abyss/70 px-4 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3 lg:px-6">
      <span className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-accent" aria-hidden="true" />
        local only
      </span>
      <span className="text-line-2">|</span>
      <span className="hidden sm:inline">y86-64 · 64-bit · little-endian</span>
      <span className="ml-auto hidden md:inline">no network required</span>
      <span className="hidden text-line-2 md:inline">|</span>
      <span>stage {String(LAST_DONE?.index ?? 0).padStart(2, '0')}</span>
    </footer>
  )
}

import { Link } from 'react-router-dom'
import { buttonClass } from '../components/ui/buttonStyles'

export default function NotFound() {
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center px-6 text-center">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.3em] text-ink-3">
        signal lost · 404
      </div>
      <h1 className="mt-4 font-mono text-[64px] font-semibold leading-none tracking-[-0.04em] text-ink">
        404
      </h1>
      <p className="mt-3 max-w-[400px] text-[12.5px] leading-relaxed text-ink-2">
        这条地址上没有指令。可能是链接过期，也可能是这条通路本来就没有接。
      </p>
      <Link to="/" className={buttonClass({ className: 'mt-6' })}>
        返回总览
      </Link>
    </div>
  )
}

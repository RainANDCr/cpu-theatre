const PINS = [62, 97, 132, 167, 202]

const BLOCKS = [
  { x: 56, y: 58, code: 'IF', detail: 'pc → imem' },
  { x: 148, y: 58, code: 'ID', detail: 'valA / valB' },
  { x: 56, y: 114, code: 'EX', detail: 'alu' },
  { x: 148, y: 114, code: 'MEM', detail: 'dmem' },
  { x: 56, y: 170, code: 'WB', detail: '→ regfile' },
  { x: 148, y: 170, code: 'CTRL', detail: 'hcl' },
]

/**
 * 纯装饰性的封装示意图。它不代表某一拍的真实数据，因此不接入模拟器状态，
 * 也不承担任何「看起来在执行」的暗示——真实数据通路留给 Phase 4 的舞台。
 */
export function DieSchematic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 280" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="die-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0c1526" />
          <stop offset="100%" stopColor="#070c16" />
        </linearGradient>
      </defs>

      {/* 引脚 */}
      <g fill="#16233a">
        {PINS.map((p) => (
          <rect key={`t${p}`} x={p} y={30} width={4} height={10} rx={1} />
        ))}
        {PINS.map((p) => (
          <rect key={`b${p}`} x={p} y={240} width={4} height={10} rx={1} />
        ))}
        {PINS.map((p) => (
          <rect key={`l${p}`} x={30} y={p} width={10} height={4} rx={1} />
        ))}
        {PINS.map((p) => (
          <rect key={`r${p}`} x={240} y={p} width={10} height={4} rx={1} />
        ))}
      </g>

      {/* 封装本体 */}
      <rect
        x={40}
        y={40}
        width={200}
        height={200}
        rx={18}
        fill="url(#die-body)"
        stroke="var(--accent)"
        strokeOpacity={0.35}
        strokeWidth={1.2}
      />

      {/* 总线沟槽 */}
      <g stroke="#22304a" strokeWidth={1} fill="none">
        <path d="M140 52V228" />
        <path d="M52 106H228" />
        <path d="M52 162H228" />
      </g>

      {/* 动态数据流：颜色即语义（蓝=数据，紫=控制，青=寄存器） */}
      <g fill="none" strokeWidth={1.6} strokeLinecap="round">
        <path
          d="M132 81H140V137H148"
          stroke="#4d9fff"
          strokeOpacity={0.8}
          className="trace-flow"
        />
        <path
          d="M148 137H140V193H132"
          stroke="#a970ff"
          strokeOpacity={0.75}
          className="trace-flow"
          style={{ animationDelay: '0.7s' }}
        />
        <path
          d="M56 106H50V162H56"
          stroke="#2ee6d6"
          strokeOpacity={0.7}
          className="trace-flow"
          style={{ animationDelay: '1.3s' }}
        />
      </g>

      {/* 功能块 */}
      <g>
        {BLOCKS.map((block) => {
          const isAlu = block.code === 'EX'
          return (
            <g key={block.code}>
              <rect
                x={block.x}
                y={block.y}
                width={76}
                height={46}
                rx={7}
                fill={isAlu ? 'rgba(255,180,87,0.08)' : 'rgba(255,255,255,0.025)'}
                stroke={isAlu ? 'rgba(255,180,87,0.55)' : 'rgba(120,150,200,0.22)'}
                strokeWidth={1}
              />
              <text
                x={block.x + 10}
                y={block.y + 20}
                fill={isAlu ? '#ffb457' : '#d7e3fa'}
                fontSize={9}
                fontFamily="var(--font-mono)"
                letterSpacing="1.4"
              >
                {block.code}
              </text>
              <text
                x={block.x + 10}
                y={block.y + 33}
                fill="#64768f"
                fontSize={6.6}
                fontFamily="var(--font-mono)"
              >
                {block.detail}
              </text>
            </g>
          )
        })}
      </g>

      {/* 封装角标 */}
      <g stroke="var(--accent)" strokeOpacity={0.55} strokeWidth={1.2} fill="none">
        <path d="M46 60V46H60" />
        <path d="M220 46H234V60" />
        <path d="M234 220V234H220" />
        <path d="M60 234H46V220" />
      </g>

      <text
        x={140}
        y={264}
        textAnchor="middle"
        fill="#64768f"
        fontSize={7}
        fontFamily="var(--font-mono)"
        letterSpacing="2.4"
      >
        SEQ DATA PATH · NOT TO SCALE
      </text>
    </svg>
  )
}

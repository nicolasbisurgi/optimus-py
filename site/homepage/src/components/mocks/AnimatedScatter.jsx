import { useEffect, useState } from 'react'

// 47 deterministic (seeded) data points roughly tracing a Pareto-shaped curve.
// (RAM,QueryTime) coords mapped into a 0-100 normalized space.
const POINTS = [
  // RAM higher → query slower (bad), RAM lower → query faster (good)
  { x: 12, y: 92 }, { x: 14, y: 88 }, { x: 16, y: 90 }, { x: 18, y: 84 },
  { x: 19, y: 86 }, { x: 21, y: 82 }, { x: 23, y: 80 }, { x: 24, y: 78 },
  { x: 26, y: 76 }, { x: 27, y: 79 }, { x: 29, y: 73 }, { x: 30, y: 75 },
  { x: 32, y: 70 }, { x: 33, y: 72 }, { x: 35, y: 68 }, { x: 37, y: 66 },
  { x: 39, y: 64 }, { x: 41, y: 67 }, { x: 43, y: 62 }, { x: 45, y: 60 },
  { x: 47, y: 58 }, { x: 48, y: 61 }, { x: 50, y: 56 }, { x: 52, y: 54 },
  { x: 54, y: 52 }, { x: 56, y: 55 }, { x: 58, y: 50 }, { x: 60, y: 48 },
  { x: 62, y: 46 }, { x: 63, y: 49 }, { x: 65, y: 44 }, { x: 67, y: 42 },
  { x: 69, y: 40 }, { x: 71, y: 43 }, { x: 73, y: 38 }, { x: 75, y: 36 },
  { x: 77, y: 34 }, { x: 78, y: 37 }, { x: 80, y: 32 }, { x: 82, y: 30 },
  { x: 84, y: 28 }, { x: 86, y: 31 }, { x: 88, y: 26 }, { x: 90, y: 24 },
  { x: 92, y: 22 }, { x: 94, y: 25 }, { x: 96, y: 18 }, // ← winner
]

const WINNER_INDEX = POINTS.length - 1

export default function AnimatedScatter({ width = '100%', height = 320 }) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= POINTS.length) {
          clearInterval(interval)
          return c
        }
        return c + 1
      })
    }, 55)
    return () => clearInterval(interval)
  }, [])

  // Pixel mapping
  const W = 800
  const H = 380
  const pad = { top: 40, right: 30, bottom: 40, left: 50 }
  const px = (x) => pad.left + (x / 100) * (W - pad.left - pad.right)
  const py = (y) => pad.top + (y / 100) * (H - pad.top - pad.bottom)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={width} height={height} className="block">
      <defs>
        <radialGradient id="winner-glow">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.6"/>
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Subtle grid */}
      <g stroke="#1e293b" strokeWidth="0.5" opacity="0.6">
        {[20, 40, 60, 80].map((p) => (
          <line key={`h-${p}`} x1={pad.left} y1={py(p)} x2={W - pad.right} y2={py(p)} />
        ))}
        {[20, 40, 60, 80].map((p) => (
          <line key={`v-${p}`} x1={px(p)} y1={pad.top} x2={px(p)} y2={H - pad.bottom} />
        ))}
      </g>

      {/* Axis labels */}
      <text x={W / 2} y={20} fill="#cbd5e1" fontFamily="Inter" fontSize="13" textAnchor="middle" fontWeight="600">
        Query speed vs RAM — {POINTS.length} orders tested
      </text>
      <text x={pad.left - 8} y={pad.top - 14} fill="#71717a" fontFamily="Inter" fontSize="10" textAnchor="end">↑ slower</text>
      <text x={W - pad.right + 4} y={H - pad.bottom + 24} fill="#71717a" fontFamily="Inter" fontSize="10" textAnchor="end">RAM →</text>

      {/* Dots */}
      {POINTS.map((p, i) => {
        if (i >= visibleCount) return null
        const isWinner = i === WINNER_INDEX
        return (
          <g key={i} className="animate-dot-drop" style={{ transformOrigin: `${px(p.x)}px ${py(p.y)}px`, animationDelay: `${i * 20}ms` }}>
            {isWinner && <circle cx={px(p.x)} cy={py(p.y)} r="22" fill="url(#winner-glow)" className="animate-pulse-glow" />}
            <circle
              cx={px(p.x)} cy={py(p.y)}
              r={isWinner ? 7 : 4}
              fill={isWinner ? '#22d3ee' : i > POINTS.length * 0.6 ? '#a78bfa' : i > POINTS.length * 0.3 ? '#cbd5e1' : '#475569'}
              stroke={isWinner ? '#fff' : 'none'}
              strokeWidth={isWinner ? 1.5 : 0}
            />
            {isWinner && (
              <text x={px(p.x)} y={py(p.y) - 16} fill="#22d3ee" fontFamily="Inter" fontSize="11" textAnchor="middle" fontWeight="600">★ winner</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

import { useEffect, useState } from 'react'

// 47 deterministic (seeded) data points framed as IMPROVEMENT vs baseline.
// (x = RAM saved %, y = query speedup %), both axes positive — higher = better.
// The greedy search finds many small wins; the winner is in the top-right corner.
const POINTS = [
  // Modest improvements first
  { x:  4, y:  8 }, { x:  8, y:  4 }, { x:  6, y: 14 }, { x: 12, y:  9 },
  { x: 10, y: 18 }, { x: 16, y: 12 }, { x: 14, y: 22 }, { x: 22, y: 16 },
  { x: 18, y: 26 }, { x: 26, y: 20 }, { x: 22, y: 30 }, { x: 30, y: 24 },
  // Mid-range gains
  { x: 28, y: 36 }, { x: 36, y: 30 }, { x: 32, y: 40 }, { x: 40, y: 34 },
  { x: 38, y: 46 }, { x: 46, y: 40 }, { x: 42, y: 50 }, { x: 50, y: 44 },
  { x: 48, y: 54 }, { x: 54, y: 48 }, { x: 52, y: 58 }, { x: 58, y: 54 },
  // Strong gains
  { x: 56, y: 62 }, { x: 62, y: 58 }, { x: 60, y: 66 }, { x: 66, y: 62 },
  { x: 64, y: 70 }, { x: 70, y: 66 }, { x: 68, y: 74 }, { x: 74, y: 70 },
  { x: 72, y: 78 }, { x: 78, y: 74 }, { x: 76, y: 80 }, { x: 82, y: 76 },
  // Top performers
  { x: 80, y: 82 }, { x: 84, y: 78 }, { x: 82, y: 84 }, { x: 86, y: 80 },
  { x: 84, y: 86 }, { x: 88, y: 82 }, { x: 86, y: 88 }, { x: 90, y: 84 },
  { x: 88, y: 90 }, { x: 91, y: 86 }, { x: 94, y: 92 }, // ← winner (top-right)
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
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      height={height}
      className="block"
      role="img"
      aria-label={`Scatter plot of ${POINTS.length} dimension orders benchmarked by OptimusPy, plotted by RAM saved (x) and query speedup (y) versus the baseline order. The winner — the order with the largest gains on both axes — is highlighted in the top-right.`}
    >
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
        Performance gain vs baseline — {POINTS.length} orders tested
      </text>
      <text x={pad.left - 8} y={pad.top + 4} fill="#71717a" fontFamily="Inter" fontSize="10" textAnchor="end">↑ faster queries</text>
      <text x={W - pad.right} y={H - pad.bottom + 24} fill="#71717a" fontFamily="Inter" fontSize="10" textAnchor="end">RAM saved →</text>
      {/* "best on both" hint pointing at the top-right corner */}
      <text x={W - pad.right - 60} y={pad.top + 60} fill="#22d3ee" fontFamily="Inter" fontSize="9" textAnchor="end" fontWeight="600" opacity="0.85">
        best on both ↗
      </text>

      {/* Dots — y axis is inverted in SVG, so we plot at py(100 - p.y) so higher y values render higher on screen */}
      {POINTS.map((p, i) => {
        if (i >= visibleCount) return null
        const isWinner = i === WINNER_INDEX
        const cx = px(p.x)
        const cy = py(100 - p.y)
        return (
          <g key={i} className="animate-dot-drop" style={{ transformOrigin: `${cx}px ${cy}px`, animationDelay: `${i * 20}ms` }}>
            {isWinner && <circle cx={cx} cy={cy} r="22" fill="url(#winner-glow)" className="animate-pulse-glow" />}
            <circle
              cx={cx} cy={cy}
              r={isWinner ? 7 : 4}
              fill={isWinner ? '#22d3ee' : i > POINTS.length * 0.6 ? '#a78bfa' : i > POINTS.length * 0.3 ? '#cbd5e1' : '#475569'}
              stroke={isWinner ? '#fff' : 'none'}
              strokeWidth={isWinner ? 1.5 : 0}
            />
            {isWinner && (
              <text x={cx} y={cy - 16} fill="#22d3ee" fontFamily="Inter" fontSize="11" textAnchor="middle" fontWeight="600">★ winner</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

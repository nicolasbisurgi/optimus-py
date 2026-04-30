import { useState } from 'react'
import { Sparkles, ListChecks, Search, Crosshair, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useScrollAnimation } from '../hooks/useScrollAnimation'

const DOCS_BASE = 'https://cubewise-code.github.io/optimus-py/docs'

const MODES = [
  { icon: Sparkles,    title: 'Optimize',
    body: 'Greedy search finds the best dimension order from scratch by benchmarking every promising permutation.',
    accent: 'cyan',    link: `${DOCS_BASE}/modes/optimize-mode/` },
  { icon: ListChecks,  title: 'Predefined Orders',
    body: 'Test only a curated shortlist of dimension orders you already trust — no greedy search, just head-to-head.',
    accent: 'violet',  link: `${DOCS_BASE}/modes/predefined-orders/` },
  { icon: Search,      title: 'Scan',
    body: 'Discover which cubes are worth optimizing — sized by RAM, ranked by impact, output as ready-to-run JSON configs.',
    accent: 'amber',   link: `${DOCS_BASE}/modes/scan-mode/` },
  { icon: Crosshair,   title: 'Targeted Optimization',
    body: 'Pin a position or pin a dimension; OptimusPy benchmarks all valid placements for the rest. Faster than a full run.',
    accent: 'emerald', link: `${DOCS_BASE}/modes/position-optimization/` },
  { icon: RefreshCw,   title: 'Sync', tag: 'UI only',
    body: 'Promote an optimized order from one TM1 instance to another — drag-and-drop, straight from the browser.',
    accent: 'rose',    link: `${DOCS_BASE}/ui/sync-order-page/` },
]

const ACCENT = {
  cyan:    { bg: 'from-cyan-500/20 to-cyan-700/10',       border: 'border-cyan-400/30',     icon: 'text-cyan-400' },
  violet:  { bg: 'from-violet-500/20 to-violet-700/10',   border: 'border-violet-400/30',   icon: 'text-violet-400' },
  amber:   { bg: 'from-amber-500/20 to-amber-700/10',     border: 'border-amber-400/30',    icon: 'text-amber-400' },
  emerald: { bg: 'from-emerald-500/20 to-emerald-700/10', border: 'border-emerald-400/30',  icon: 'text-emerald-400' },
  rose:    { bg: 'from-rose-500/20 to-rose-700/10',       border: 'border-rose-400/30',     icon: 'text-rose-400' },
}

export default function ModesCarousel() {
  const [ref, isVisible] = useScrollAnimation()
  const [current, setCurrent] = useState(0)

  const next = () => setCurrent((c) => (c + 1) % MODES.length)
  const prev = () => setCurrent((c) => (c - 1 + MODES.length) % MODES.length)

  return (
    <section ref={ref} id="features" className="py-24 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className={`text-3xl sm:text-4xl font-bold text-text-primary mb-4 animate-on-scroll ${isVisible ? 'visible' : ''}`}>
            Five ways to find the right answer
          </h2>
          <p className={`text-text-secondary max-w-2xl mx-auto animate-on-scroll stagger-2 ${isVisible ? 'visible' : ''}`}>
            Pick the mode that matches the question. From "find the best from scratch" to "promote a known-good order to PROD".
          </p>
        </div>

        <div className={`relative animate-on-scroll stagger-3 ${isVisible ? 'visible' : ''}`}>
          <button onClick={prev} aria-label="Previous mode"
                  className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 bg-bg-tertiary border border-white/10 rounded-full p-3 hover:border-accent-cyan transition-colors">
            <ChevronLeft className="w-6 h-6 text-text-secondary" />
          </button>
          <button onClick={next} aria-label="Next mode"
                  className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 bg-bg-tertiary border border-white/10 rounded-full p-3 hover:border-accent-cyan transition-colors">
            <ChevronRight className="w-6 h-6 text-text-secondary" />
          </button>

          {/* Slides */}
          <div className="relative h-[440px] sm:h-[400px] flex items-center justify-center">
            {MODES.map((m, i) => {
              let offset = i - current
              if (offset > MODES.length / 2) offset -= MODES.length
              if (offset < -MODES.length / 2) offset += MODES.length

              const isCenter = offset === 0
              const isAdjacent = Math.abs(offset) === 1
              const Icon = m.icon
              const a = ACCENT[m.accent]

              return (
                <div
                  key={m.title}
                  className="absolute w-full max-w-xl px-4 transition-all duration-500 ease-in-out"
                  style={{
                    transform: `translateX(${offset * 60}%) scale(${isCenter ? 1 : 0.85})`,
                    opacity: isCenter ? 1 : isAdjacent ? 0.4 : 0,
                    zIndex: isCenter ? 10 : isAdjacent ? 5 : 0,
                    pointerEvents: isCenter ? 'auto' : 'none',
                    filter: isCenter ? 'none' : 'blur(3px)',
                  }}
                >
                  <div className={`bg-gradient-to-br ${a.bg} border-2 ${a.border} rounded-3xl p-8 backdrop-blur-sm`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-14 h-14 rounded-xl bg-bg-primary/40 flex items-center justify-center ${a.icon}`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      {m.tag && (
                        <span className="text-[10px] uppercase tracking-wider bg-bg-primary/60 text-text-secondary px-2 py-1 rounded">
                          {m.tag}
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-text-primary mb-3">{m.title}</h3>
                    <p className="text-text-secondary leading-relaxed mb-6">{m.body}</p>
                    <a href={m.link} className={`inline-flex items-center space-x-1 ${a.icon} hover:opacity-80 font-semibold`}>
                      <span>Learn more →</span>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Dot pagination */}
          <div className="flex items-center justify-center space-x-2 mt-6">
            {MODES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to mode ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-accent-cyan' : 'w-2 bg-text-muted/40'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

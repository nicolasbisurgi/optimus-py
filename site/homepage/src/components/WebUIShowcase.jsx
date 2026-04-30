import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { Check } from 'lucide-react'
import AnimatedUI from './mocks/AnimatedUI'

const POINTS = [
  'Single-page app served by a lightweight Python HTTP server — no extra dependencies, no cloud.',
  'Five pages: Optimize, Sync Order, Results, Jobs, Settings. Live progress streamed via Server-Sent Events.',
  'Scan candidates, configure runs, and apply the winning order — all from your browser.',
]

const DOCS_UI = 'https://cubewise-code.github.io/optimus-py/docs/ui/overview/'

export default function WebUIShowcase() {
  const [ref, isVisible] = useScrollAnimation()

  return (
    <section ref={ref} className="py-24 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className={`lg:col-span-5 animate-on-scroll ${isVisible ? 'visible' : ''}`}>
            <span className="inline-block text-accent-cyan text-sm font-semibold uppercase tracking-wider mb-3">New in v2</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4 leading-tight">A real web UI, not just a CLI.</h2>
            <p className="text-text-secondary text-lg mb-6 leading-relaxed">
              OptimusPy v2 ships with a local web app that wraps the entire scan → configure → optimize → apply workflow. Open your browser, pick a TM1 instance, and start optimizing.
            </p>
            <ul className="space-y-3 mb-8">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-accent-cyan mt-0.5 flex-shrink-0" />
                  <span className="text-text-secondary">{p}</span>
                </li>
              ))}
            </ul>
            <a href={DOCS_UI} className="inline-flex items-center space-x-2 text-accent-cyan hover:text-accent-violet transition-colors font-semibold">
              <span>Tour the UI →</span>
            </a>
          </div>

          <div className={`lg:col-span-7 animate-on-scroll stagger-2 ${isVisible ? 'visible' : ''}`}>
            <AnimatedUI />
          </div>
        </div>
      </div>
    </section>
  )
}

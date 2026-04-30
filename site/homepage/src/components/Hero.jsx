import { ArrowRight, BookOpen } from 'lucide-react'
import { OptimusPyLogo } from './logos/OptimusPyLogo'
import AnimatedScatter from './mocks/AnimatedScatter'
import AnimatedUI from './mocks/AnimatedUI'

const DOCS_URL = 'https://cubewise-code.github.io/optimus-py/docs/getting-started/quick-start/'
const GITHUB_URL = 'https://github.com/cubewise-code/optimus-py'

export default function Hero() {
  return (
    <section className="relative pt-28 pb-24 overflow-hidden bg-gradient-to-b from-bg-primary to-bg-secondary">
      {/* Background gradient orbs */}
      <div className="gradient-orb w-[600px] h-[600px] bg-accent-cyan -top-40 -left-40 animate-float" />
      <div className="gradient-orb w-[500px] h-[500px] bg-accent-violet top-1/2 -right-40 animate-float-delayed" />
      <div className="gradient-orb w-[400px] h-[400px] bg-accent-cyan bottom-0 left-1/3 animate-float" style={{ animationDelay: '5s' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-8">
            <OptimusPyLogo height={64} className="drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]" />
          </div>

          {/* Status badge */}
          <div className="inline-flex items-center space-x-2 bg-bg-tertiary/50 border border-white/10 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-text-secondary text-sm">v2 · Open source &amp; free</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight">
            <span className="text-text-primary">Optimal cube order,</span>
            <br />
            <span className="gradient-text">benchmarked, not guessed.</span>
          </h1>

          {/* Subhead */}
          <p className="text-text-secondary text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
            OptimusPy benchmarks dimension permutations of your IBM TM1 / Planning Analytics cubes and tells you the order that minimizes RAM and maximizes query speed. Six modes, a local web UI, and an interactive HTML dashboard.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={DOCS_URL}
               className="inline-flex items-center space-x-2 bg-gradient-to-r from-accent-cyan to-accent-violet text-bg-primary font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
              <span>Get started</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center space-x-2 border border-white/20 text-text-primary px-6 py-3 rounded-lg hover:border-accent-cyan hover:text-accent-cyan transition-colors">
              <BookOpen className="w-4 h-4" />
              <span>View on GitHub</span>
            </a>
          </div>
        </div>

        {/* Hero visualizations — scatter on top, UI mock below */}
        <div className="space-y-12">
          <div className="bg-bg-secondary/60 border border-white/5 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <AnimatedScatter />
          </div>
          <div>
            <AnimatedUI />
          </div>
        </div>
      </div>
    </section>
  )
}

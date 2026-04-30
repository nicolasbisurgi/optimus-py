import { useScrollAnimation } from '../hooks/useScrollAnimation'
import AnimatedScatter from './mocks/AnimatedScatter'

const STEPS = [
  { num: '01', title: 'Generate candidates', body: 'OptimusPy starts from your current dimension order and generates pairwise swap candidates.' },
  { num: '02', title: 'Benchmark each one', body: 'Every candidate is materialized in TM1, the cube is rebuilt, and each registered view is queried N times.' },
  { num: '03', title: 'Keep the wins', body: 'Improvements (lower RAM, faster queries) become the new baseline. The greedy algorithm converges in ~50 iterations.' },
]

const DOCS_HOW = 'https://cubewise-code.github.io/optimus-py/docs/concepts/how-it-works/'

export default function AlgorithmShowcase() {
  const [ref, isVisible] = useScrollAnimation()

  return (
    <section ref={ref} className="py-24 bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className={`inline-block text-accent-violet text-sm font-semibold uppercase tracking-wider mb-3 animate-on-scroll ${isVisible ? 'visible' : ''}`}>The algorithm</span>
          <h2 className={`text-3xl sm:text-4xl font-bold text-text-primary mb-4 animate-on-scroll stagger-2 ${isVisible ? 'visible' : ''}`}>
            Watch it find the winner.
          </h2>
          <p className={`text-text-secondary max-w-3xl mx-auto animate-on-scroll stagger-3 ${isVisible ? 'visible' : ''}`}>
            Every dot is a benchmarked dimension order. Lower-right is better — less RAM, faster queries. The greedy search explores the space and converges on the optimum.
          </p>
        </div>

        <div className={`bg-bg-secondary/60 border border-white/5 rounded-2xl p-6 sm:p-10 mb-12 animate-on-scroll ${isVisible ? 'visible' : ''}`}>
          <AnimatedScatter height={420} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.num}
                 className={`bg-bg-tertiary/40 border border-white/5 rounded-xl p-6 animate-on-scroll stagger-${i + 2} ${isVisible ? 'visible' : ''}`}>
              <div className="text-accent-cyan font-mono text-sm mb-2">{s.num}</div>
              <h3 className="text-text-primary font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a href={DOCS_HOW} className="inline-flex items-center space-x-2 text-accent-cyan hover:text-accent-violet transition-colors font-semibold">
            <span>Read the algorithm deep-dive →</span>
          </a>
        </div>
      </div>
    </section>
  )
}

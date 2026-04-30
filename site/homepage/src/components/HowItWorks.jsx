import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { Database, MousePointer2, Activity, CheckCircle2, ArrowRight } from 'lucide-react'

const STEPS = [
  { icon: Database,      title: 'Scan',      body: 'Point OptimusPy at your TM1 instance.' },
  { icon: MousePointer2, title: 'Pick',      body: 'Choose the cubes / views / TI processes to benchmark.' },
  { icon: Activity,      title: 'Benchmark', body: 'Run executions, collect RAM + query time per permutation.' },
  { icon: CheckCircle2,  title: 'Apply',     body: 'Accept the recommendation, sync the order, ship the change.' },
]

export default function HowItWorks() {
  const [ref, isVisible] = useScrollAnimation()

  return (
    <section ref={ref} id="how-it-works" className="py-24 bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className={`text-3xl sm:text-4xl font-bold text-text-primary mb-3 animate-on-scroll ${isVisible ? 'visible' : ''}`}>
            How it works
          </h2>
          <p className={`text-text-secondary animate-on-scroll stagger-2 ${isVisible ? 'visible' : ''}`}>
            From a fresh install to your first optimized cube in under 10 minutes.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.title} className="flex flex-col md:flex-row items-center w-full md:w-auto">
                <div className={`flex flex-col items-center text-center max-w-[220px] animate-on-scroll stagger-${i + 1} ${isVisible ? 'visible' : ''}`}>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-cyan/20 to-accent-violet/20 border border-accent-cyan/30 flex items-center justify-center mb-3">
                    <Icon className="w-6 h-6 text-accent-cyan" />
                  </div>
                  <div className="text-text-muted font-mono text-xs mb-1">Step {i + 1}</div>
                  <h3 className="text-text-primary font-semibold mb-2">{s.title}</h3>
                  <p className="text-text-secondary text-sm">{s.body}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="hidden md:block w-6 h-6 text-text-muted mx-4 flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

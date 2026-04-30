import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { Search, Cpu, BarChart3 } from 'lucide-react'

const COLUMNS = [
  {
    icon: Search,
    title: 'What it does',
    body: 'Benchmarks every reasonable dimension permutation of your TM1 cubes and tells you the order that minimizes RAM and maximizes query speed.',
  },
  {
    icon: Cpu,
    title: 'Who it\'s for',
    body: 'TM1 / Planning Analytics admins, consultants, and ops teams who want defensible numbers, not gut feel.',
  },
  {
    icon: BarChart3,
    title: 'Why v2 matters',
    body: 'Web UI, JSON-driven CLI, multi-view benchmarking, six optimization modes, an interactive dashboard, and checkpoint/resume.',
  },
]

export default function WhatIsOptimusPy() {
  const [ref, isVisible] = useScrollAnimation()

  return (
    <section ref={ref} className="py-24 bg-bg-primary border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className={`text-3xl sm:text-4xl font-bold text-text-primary mb-3 text-center animate-on-scroll ${isVisible ? 'visible' : ''}`}>
          What is OptimusPy?
        </h2>
        <p className={`text-text-secondary text-center max-w-3xl mx-auto mb-16 animate-on-scroll stagger-2 ${isVisible ? 'visible' : ''}`}>
          A focused tool that answers one expensive question definitively.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {COLUMNS.map((col, i) => {
            const Icon = col.icon
            return (
              <div key={col.title}
                   className={`bg-bg-tertiary/40 border border-white/5 rounded-xl p-8 animate-on-scroll stagger-${i + 2} ${isVisible ? 'visible' : ''}`}>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-cyan/20 to-accent-violet/20 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-accent-cyan" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">{col.title}</h3>
                <p className="text-text-secondary leading-relaxed">{col.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

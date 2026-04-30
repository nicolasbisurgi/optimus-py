import { useState } from 'react'
import { Terminal, BookOpen, Github, Package, Copy, Check } from 'lucide-react'
import { useScrollAnimation } from '../hooks/useScrollAnimation'

const TABS = [
  { key: 'pip',  label: '1. Install',     code: 'pip install optimuspy' },
  { key: 'ui',   label: '2. Launch the UI', code: 'python -m optimuspy.ui\n# Browser opens at http://127.0.0.1:8765' },
  { key: 'cli',  label: '3. Or use the CLI', code: 'optimuspy scan --instance tm1srv01 --output configs/\noptimuspy optimize configs/Sales.json' },
]

const DOCS_BASE = 'https://cubewise-code.github.io/optimus-py/docs'

export default function GetStarted() {
  const [ref, isVisible] = useScrollAnimation()
  const [tab, setTab] = useState('pip')
  const [copied, setCopied] = useState(false)

  const active = TABS.find((t) => t.key === tab)

  const copy = () => {
    navigator.clipboard.writeText(active.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section ref={ref} className="py-24 bg-bg-secondary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className={`text-3xl sm:text-4xl font-bold text-text-primary mb-3 animate-on-scroll ${isVisible ? 'visible' : ''}`}>
          Get started in 60 seconds
        </h2>
        <p className={`text-text-secondary mb-10 animate-on-scroll stagger-2 ${isVisible ? 'visible' : ''}`}>
          Install OptimusPy, launch the UI, optimize your first cube.
        </p>

        {/* Tabs */}
        <div className={`flex items-center justify-center space-x-2 mb-4 animate-on-scroll stagger-3 ${isVisible ? 'visible' : ''}`}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                tab === t.key ? 'bg-bg-tertiary text-accent-cyan border border-accent-cyan/40' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Code panel */}
        <div className={`bg-bg-primary border border-white/10 rounded-xl overflow-hidden text-left animate-on-scroll stagger-4 ${isVisible ? 'visible' : ''}`}>
          <div className="flex items-center justify-between px-4 py-2 bg-bg-tertiary/30 border-b border-white/10">
            <div className="flex items-center space-x-2 text-text-muted text-xs">
              <Terminal className="w-4 h-4" />
              <span className="font-mono">{active.label}</span>
            </div>
            <button onClick={copy} className="text-text-muted hover:text-accent-cyan transition-colors inline-flex items-center space-x-1 text-xs">
              {copied ? <><Check className="w-3.5 h-3.5" /><span>Copied</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
            </button>
          </div>
          <pre className="px-6 py-5 text-sm text-text-secondary font-mono leading-relaxed whitespace-pre-wrap">
            <code>{active.code}</code>
          </pre>
        </div>

        {/* CTAs */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 animate-on-scroll stagger-5 ${isVisible ? 'visible' : ''}`}>
          <a href={`${DOCS_BASE}/`} className="bg-bg-tertiary border border-white/10 rounded-lg px-4 py-4 hover:border-accent-cyan transition-colors inline-flex items-center justify-center space-x-2 text-text-secondary hover:text-text-primary">
            <BookOpen className="w-5 h-5" />
            <span>Read the docs</span>
          </a>
          <a href="https://github.com/cubewise-code/optimus-py" target="_blank" rel="noopener noreferrer"
             className="bg-bg-tertiary border border-white/10 rounded-lg px-4 py-4 hover:border-accent-cyan transition-colors inline-flex items-center justify-center space-x-2 text-text-secondary hover:text-text-primary">
            <Github className="w-5 h-5" />
            <span>View on GitHub</span>
          </a>
          <a href="https://pypi.org/project/optimuspy/" target="_blank" rel="noopener noreferrer"
             className="bg-bg-tertiary border border-white/10 rounded-lg px-4 py-4 hover:border-accent-cyan transition-colors inline-flex items-center justify-center space-x-2 text-text-secondary hover:text-text-primary">
            <Package className="w-5 h-5" />
            <span>Install from PyPI</span>
          </a>
        </div>
      </div>
    </section>
  )
}

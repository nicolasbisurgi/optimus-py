import { Menu, X, Github, BookOpen } from 'lucide-react'
import { useState } from 'react'
import { OptimusPyLogo } from './logos/OptimusPyLogo'

const DOCS_URL = 'https://cubewise-code.github.io/optimus-py/docs/'
const GITHUB_URL = 'https://github.com/cubewise-code/optimus-py'

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/80 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/optimus-py/" className="flex items-center">
            <OptimusPyLogo height={28} />
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-text-secondary hover:text-accent-cyan transition-colors">Features</a>
            <a href="#how-it-works" className="text-text-secondary hover:text-accent-cyan transition-colors">How it works</a>
            <a href={DOCS_URL} className="text-text-secondary hover:text-accent-cyan transition-colors inline-flex items-center space-x-1">
              <BookOpen className="w-4 h-4" />
              <span>Docs</span>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
               className="bg-bg-tertiary border border-white/10 text-text-primary px-4 py-2 rounded-lg hover:border-accent-cyan transition-colors inline-flex items-center space-x-2">
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-text-primary p-2">
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <a href="#features" className="block text-text-secondary hover:text-accent-cyan py-2">Features</a>
            <a href="#how-it-works" className="block text-text-secondary hover:text-accent-cyan py-2">How it works</a>
            <a href={DOCS_URL} className="block text-text-secondary hover:text-accent-cyan py-2">Docs</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="block text-text-secondary hover:text-accent-cyan py-2">GitHub</a>
          </div>
        )}
      </div>
    </nav>
  )
}

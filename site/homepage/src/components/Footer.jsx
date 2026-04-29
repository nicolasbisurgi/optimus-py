import { Github, Package, ExternalLink } from 'lucide-react'
import { OptimusPyLogo } from './logos/OptimusPyLogo'
import { CubewiseLogo } from './logos/CubewiseLogo'

const DOCS_BASE = 'https://cubewise-code.github.io/optimus-py/docs'
const GITHUB_URL = 'https://github.com/cubewise-code/optimus-py'
const PYPI_URL = 'https://pypi.org/project/optimuspy/'

export default function Footer() {
  return (
    <footer className="py-12 bg-bg-secondary border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <OptimusPyLogo height={36} />
            </div>
            <p className="text-text-secondary max-w-sm mb-4">
              Optimal cube order, benchmarked, not guessed. Open source and free for IBM TM1 / Planning Analytics.
            </p>
            <div className="flex items-center space-x-4">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
                 className="text-text-muted hover:text-text-primary transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href={PYPI_URL} target="_blank" rel="noopener noreferrer"
                 className="text-text-muted hover:text-text-primary transition-colors">
                <Package className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Documentation */}
          <div>
            <h4 className="text-text-primary font-semibold mb-4">Documentation</h4>
            <ul className="space-y-2">
              <li><a href={`${DOCS_BASE}/getting-started/quick-start/`} className="text-text-secondary hover:text-accent-cyan transition-colors">Quick Start</a></li>
              <li><a href={`${DOCS_BASE}/v2-features/`}                  className="text-text-secondary hover:text-accent-cyan transition-colors">What's new in v2</a></li>
              <li><a href={`${DOCS_BASE}/ui/overview/`}                  className="text-text-secondary hover:text-accent-cyan transition-colors">Web UI</a></li>
              <li><a href={`${DOCS_BASE}/advanced/cli-reference/`}       className="text-text-secondary hover:text-accent-cyan transition-colors">CLI reference</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-text-primary font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
                     className="text-text-secondary hover:text-accent-cyan transition-colors inline-flex items-center space-x-1">
                <span>GitHub</span><ExternalLink className="w-3 h-3" />
              </a></li>
              <li><a href={PYPI_URL} target="_blank" rel="noopener noreferrer"
                     className="text-text-secondary hover:text-accent-cyan transition-colors inline-flex items-center space-x-1">
                <span>PyPI</span><ExternalLink className="w-3 h-3" />
              </a></li>
              <li><a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer"
                     className="text-text-secondary hover:text-accent-cyan transition-colors inline-flex items-center space-x-1">
                <span>Report issues</span><ExternalLink className="w-3 h-3" />
              </a></li>
              <li><a href="https://www.cubewise.com" target="_blank" rel="noopener noreferrer"
                     className="text-text-secondary hover:text-accent-cyan transition-colors inline-flex items-center space-x-1">
                <span>Cubewise</span><ExternalLink className="w-3 h-3" />
              </a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <p className="text-text-muted text-sm">
            &copy; {new Date().getFullYear()} Cubewise. Open source under MIT License.
          </p>
          <a href="https://www.cubewise.com" target="_blank" rel="noopener noreferrer"
             className="flex items-center space-x-2 text-text-muted hover:text-text-secondary transition-colors">
            <span className="text-sm">A Cubewise Project</span>
            <CubewiseLogo height={24} />
          </a>
        </div>
      </div>
    </footer>
  )
}

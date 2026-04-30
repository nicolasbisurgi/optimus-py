import Navigation from './components/Navigation'
import Hero from './components/Hero'
import WhatIsOptimusPy from './components/WhatIsOptimusPy'
import WebUIShowcase from './components/WebUIShowcase'
import AlgorithmShowcase from './components/AlgorithmShowcase'
import ModesCarousel from './components/ModesCarousel'
import HowItWorks from './components/HowItWorks'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      <Navigation />
      <main>
        <Hero />
        <WhatIsOptimusPy />
        <WebUIShowcase />
        <AlgorithmShowcase />
        <ModesCarousel />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  )
}

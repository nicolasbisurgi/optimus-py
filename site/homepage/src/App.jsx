import Navigation from './components/Navigation'
import Hero from './components/Hero'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      <Navigation />
      <main>
        <Hero />
      </main>
      <Footer />
    </div>
  )
}

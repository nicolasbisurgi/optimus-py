import Navigation from './components/Navigation'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      <Navigation />
      <main className="pt-24 px-8 min-h-[60vh]">
        <p>Footer is below this line.</p>
      </main>
      <Footer />
    </div>
  )
}

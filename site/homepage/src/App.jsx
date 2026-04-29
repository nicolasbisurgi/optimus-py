import Navigation from './components/Navigation'

export default function App() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      <Navigation />
      <main className="pt-24 px-8">
        <p>Nav lives above with the logo, four links, and a mobile menu toggle.</p>
      </main>
    </div>
  )
}

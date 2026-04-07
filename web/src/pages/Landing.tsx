import { Link } from 'react-router-dom'
import './Landing.css'

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="logo">Bookit</div>
      </header>

      <main className="landing-hero">
        <h1>Book beauty, sport & pet care services</h1>
        <p className="tagline">
          Find and book appointments with local professionals in Lithuania
        </p>

        <div className="cta-buttons">
          <Link to="/register" className="btn btn-primary">
            Get Started
          </Link>
          <Link to="/login" className="btn btn-secondary">
            Login
          </Link>
        </div>
      </main>

      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Bookit. All rights reserved.</p>
      </footer>
    </div>
  )
}

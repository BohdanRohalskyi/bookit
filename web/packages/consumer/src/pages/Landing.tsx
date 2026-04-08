import { Link } from 'react-router-dom'
import { Button } from '@bookit/shared'
import { useAuthStore } from '@bookit/shared/stores'
import './Landing.css'

export function Landing() {
  const { user, isAuthenticated, logout } = useAuthStore()

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="logo">Bookit</div>
        {isAuthenticated && user && (
          <div className="user-menu">
            <span className="user-name">{user.name}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        )}
      </header>

      <main className="landing-hero">
        <h1>Book beauty, sport & pet care services</h1>
        <p className="tagline">
          Find and book appointments with local professionals in Lithuania
        </p>

        <div className="cta-buttons">
          {isAuthenticated ? (
            <Link to="/account" className="btn btn-primary">
              My Account
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary">
                Get Started
              </Link>
              <Link to="/login" className="btn btn-secondary">
                Login
              </Link>
            </>
          )}
        </div>
      </main>

      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Bookit. All rights reserved.</p>
      </footer>
    </div>
  )
}

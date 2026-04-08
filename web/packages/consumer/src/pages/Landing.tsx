import { Link } from 'react-router-dom'
import { Button } from '@bookit/shared'
import { useAuthStore } from '@bookit/shared/stores'

export function Landing() {
  const { user, isAuthenticated, logout } = useAuthStore()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 border-b border-border flex justify-between items-center">
        <div className="text-2xl font-semibold text-primary">Bookit</div>
        {isAuthenticated && user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="max-w-[600px] mb-4">Book beauty, sport & pet care services</h1>
        <p className="text-lg text-muted-foreground max-w-[500px] mb-10">
          Find and book appointments with local professionals in Lithuania
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          {isAuthenticated ? (
            <Link
              to="/account"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-px transition-all"
            >
              My Account
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-px transition-all"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
              >
                Login
              </Link>
            </>
          )}
        </div>
      </main>

      <footer className="px-6 py-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Bookit. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

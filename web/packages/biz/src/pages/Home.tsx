import { Link } from 'react-router-dom'
import { Button } from '@bookit/shared'
import { useAuthStore } from '@bookit/shared/stores'
import { useAppSwitch } from '@bookit/shared/hooks'

export function Home() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const { switchTo } = useAppSwitch()
  const consumerUrl = import.meta.env.VITE_CONSUMER_URL || 'https://pt-duo-bookit.web.app'

  const handleSwitchToConsumer = () => {
    switchTo(consumerUrl)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold text-primary">Bookit Business</div>
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user?.name}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button variant="outline" size="sm">Login</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          <h1 className="text-4xl font-bold">Bookit Business Portal</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Manage your business, services, staff, and appointments all in one place.
          </p>

          {isAuthenticated ? (
            <div className="grid gap-4 max-w-md mx-auto">
              <div className="p-6 border rounded-lg bg-card">
                <h2 className="text-lg font-semibold mb-2">Coming Soon</h2>
                <p className="text-muted-foreground text-sm">
                  Dashboard, calendar, service management, and more features are on the way.
                </p>
              </div>
              <Button variant="outline" onClick={handleSwitchToConsumer}>
                Switch to Client View
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Login to manage your business
              </p>
              <div className="flex gap-4 justify-center">
                <Link to="/login">
                  <Button>Login</Button>
                </Link>
                <Button variant="outline" onClick={handleSwitchToConsumer}>
                  Go to Client App
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Bookit. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

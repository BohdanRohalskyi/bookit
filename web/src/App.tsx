import { useCallback, useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

type Status = 'loading' | 'connected' | 'disconnected'

interface HealthResponse {
  status: string
  timestamp: string
  version: string
  checks: Record<string, string>
}

function App() {
  const [status, setStatus] = useState<Status>('loading')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkHealth = useCallback(async () => {
    setStatus('loading')
    try {
      const response = await fetch(`${API_URL}/api/v1/health`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data: HealthResponse = await response.json()
      setHealth(data)
      setStatus('connected')
      setError(null)
    } catch (err) {
      setStatus('disconnected')
      setError(err instanceof Error ? err.message : 'Unknown error')
      setHealth(null)
    }
  }, [])

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [checkHealth])

  return (
    <div className="app">
      <h1>Bookit</h1>

      <div className={`status-card ${status}`}>
        <div className="status-indicator">
          <span className={`dot ${status}`} />
          <span className="status-text">
            {status === 'loading' && 'Checking API...'}
            {status === 'connected' && 'Connected'}
            {status === 'disconnected' && 'Disconnected'}
          </span>
        </div>

        <div className="api-url">
          API: {API_URL}
        </div>

        {status === 'connected' && health && (
          <div className="health-info">
            <p>Status: {health.status}</p>
            <p>Version: {health.version}</p>
            <p>Database: {health.checks.database}</p>
          </div>
        )}

        {status === 'disconnected' && error && (
          <div className="error-info">
            <p>Error: {error}</p>
          </div>
        )}

        <button
          className="refresh-btn"
          onClick={checkHealth}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Checking...' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}

export default App

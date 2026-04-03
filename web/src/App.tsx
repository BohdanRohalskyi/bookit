import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { useFeatureFlag } from './hooks/useFeatureFlag'

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
  const [apiFeature, setApiFeature] = useState<string>('Loading...')
  const { enabled: testFlag, loading: flagLoading } = useFeatureFlag('feature_test')

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

  // Fetch backend feature flag status
  const fetchApiFeature = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/feature-test`)
      const data = await res.json()
      setApiFeature(data.message)
    } catch {
      setApiFeature('Error')
    }
  }, [])

  useEffect(() => {
    fetchApiFeature()
    const interval = setInterval(fetchApiFeature, 30000)
    return () => clearInterval(interval)
  }, [fetchApiFeature])

  return (
    <div className="app">
      <h1>Bookit</h1>

      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1rem' }}>
        <div>Client Feature: {flagLoading ? '...' : testFlag ? 'ON' : 'OFF'}</div>
        <div>Backend Feature: {apiFeature}</div>
        <button
          onClick={fetchApiFeature}
          style={{ fontSize: '0.7rem', marginTop: '0.25rem', cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

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

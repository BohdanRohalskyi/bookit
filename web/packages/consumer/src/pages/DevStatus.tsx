import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeatureFlag, useFeatureFlagsReady } from '@bookit/shared'
import { API_URL } from '@bookit/shared/api'

type Status = 'loading' | 'connected' | 'disconnected'

interface HealthResponse {
  status: string
  timestamp: string
  version: string
  checks: Record<string, string>
}

// Object lookups with full static class strings so Tailwind's analyser
// can detect every class at build time — never use dynamic string concatenation.
const cardBorderClass: Record<Status, string> = {
  connected:    'border-green-500',
  disconnected: 'border-red-500',
  loading:      'border-amber-500',
}

const dotClass: Record<Status, string> = {
  connected:    'bg-green-500 shadow-[0_0_8px_#22c55e]',
  disconnected: 'bg-red-500 shadow-[0_0_8px_#ef4444]',
  loading:      'bg-amber-500 animate-pulse',
}

export function DevStatus() {
  const [status, setStatus] = useState<Status>('loading')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiFeature, setApiFeature] = useState<string>('Loading...')
  const testFlag = useFeatureFlag('FEATURE_TEST')
  const flagLoading = !useFeatureFlagsReady()

  const checkHealth = useCallback(async () => {
    setStatus('loading')
    try {
      const response = await fetch(`${API_URL}/api/v1/health`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
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
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [checkHealth])

  useEffect(() => {
    fetchApiFeature()
    const interval = setInterval(fetchApiFeature, 30000)
    return () => clearInterval(interval)
  }, [fetchApiFeature])

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-5">
      <Link to="/" className="absolute top-6 left-6 text-sm text-primary hover:underline">
        &larr; Back to Home
      </Link>

      <h1 className="mb-4">Dev Status</h1>

      <div className="text-xs text-muted-foreground mb-4">
        <div>Client Feature: {flagLoading ? '...' : testFlag ? 'ON' : 'OFF'}</div>
        <div>Backend Feature: {apiFeature}</div>
        <button
          onClick={fetchApiFeature}
          className="mt-1 text-[0.7rem] cursor-pointer hover:underline"
        >
          Refresh
        </button>
      </div>

      <div className={`bg-card rounded-xl p-6 min-w-[300px] border-2 ${cardBorderClass[status]}`}>
        <div className="flex items-center gap-3 mb-4">
          <span className={`w-3 h-3 rounded-full ${dotClass[status]}`} />
          <span className="text-xl font-semibold text-foreground">
            {status === 'loading' && 'Checking API...'}
            {status === 'connected' && 'Connected'}
            {status === 'disconnected' && 'Disconnected'}
          </span>
        </div>

        <div className="text-sm text-muted-foreground font-mono mb-3">
          API: {API_URL}
        </div>

        {status === 'connected' && health && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="my-1 text-sm text-muted-foreground">Status: {health.status}</p>
            <p className="my-1 text-sm text-muted-foreground">Version: {health.version}</p>
            <p className="my-1 text-sm text-muted-foreground">Database: {health.checks.database}</p>
          </div>
        )}

        {status === 'disconnected' && error && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="my-1 text-sm text-red-500">Error: {error}</p>
          </div>
        )}

        <button
          onClick={checkHealth}
          disabled={status === 'loading'}
          className="mt-4 px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? 'Checking...' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}

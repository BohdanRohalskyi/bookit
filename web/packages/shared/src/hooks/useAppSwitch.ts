import { useCallback } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/auth'
import type { AuthResponse } from '../api/client'

export function useAppSwitch() {
  const { setAuth } = useAuthStore()

  // Generate token and redirect to target app.
  // Read isAuthenticated from getState() to avoid stale closure — the caller
  // may have just called setAuth() and React hasn't re-rendered yet.
  const switchTo = useCallback(async (targetUrl: string) => {
    if (!useAuthStore.getState().isAuthenticated) {
      // Not logged in, just redirect
      window.location.href = targetUrl
      return
    }

    const { data, error } = await api.POST('/api/v1/auth/app-switch-token', {})

    if (error || !data) {
      // If token generation fails, redirect anyway (user will need to login)
      console.warn('Failed to create app switch token, redirecting without session')
      window.location.href = targetUrl
      return
    }

    // Redirect with handoff token
    const token = (data as { token: string }).token
    const url = new URL(targetUrl)
    url.searchParams.set('handoff', token)
    window.location.href = url.toString()
  }, [])

  // Handle incoming handoff token from URL
  const handleHandoff = useCallback(async (): Promise<boolean> => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('handoff')

    if (!token) {
      return false
    }

    try {
      const { data, error } = await api.POST('/api/v1/auth/exchange-app-switch-token', {
        body: { token },
      })

      if (error || !data) {
        console.warn('Failed to exchange app switch token')
        // Remove invalid token from URL
        cleanupUrl(params)
        return false
      }

      const authResponse = data as AuthResponse
      setAuth(authResponse.user, authResponse.tokens)

      // Remove token from URL
      cleanupUrl(params)
      return true
    } catch (err) {
      console.error('Error exchanging app switch token:', err)
      cleanupUrl(params)
      return false
    }
  }, [setAuth])

  return { switchTo, handleHandoff }
}

function cleanupUrl(params: URLSearchParams) {
  params.delete('handoff')
  const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '')
  window.history.replaceState({}, '', newUrl)
}

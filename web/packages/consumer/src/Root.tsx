import { useEffect } from 'react'
import { useAppSwitch } from '@bookit/shared/hooks'
import App from './App'

export function Root() {
  const { handleHandoff } = useAppSwitch()

  useEffect(() => {
    handleHandoff()
  }, [handleHandoff])

  return <App />
}

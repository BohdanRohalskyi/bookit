import { useEffect } from 'react'
import { useAppSwitch } from '@bookit/shared/hooks'
import App from './App'

export function Root() {
  const { handleHandoff } = useAppSwitch()

  useEffect(() => {
    handleHandoff().then((success) => {
      if (success) window.location.replace('/account')
    })
  }, [handleHandoff])

  return <App />
}

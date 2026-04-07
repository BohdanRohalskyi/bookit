import { Link } from 'react-router-dom'
import './AuthPage.css'

export function Register() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="logo">Bookit</Link>
        <h1>Create Account</h1>
        <p className="coming-soon">Registration coming soon</p>
        <Link to="/login" className="auth-link">
          Already have an account? Login
        </Link>
      </div>
    </div>
  )
}

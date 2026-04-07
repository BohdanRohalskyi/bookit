import { Link } from 'react-router-dom'
import './AuthPage.css'

export function Login() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="logo">Bookit</Link>
        <h1>Welcome Back</h1>
        <p className="coming-soon">Login coming soon</p>
        <Link to="/register" className="auth-link">
          Don't have an account? Register
        </Link>
      </div>
    </div>
  )
}

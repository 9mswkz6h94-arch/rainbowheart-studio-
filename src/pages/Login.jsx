import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/studio" replace />

  function switchMode(m) {
    setMode(m)
    setError(null)
    setSuccess(null)
    setName('')
    setEmail('')
    setPassword('')
    setConfirm('')
  }

  async function handleSignIn(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/studio')
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    const { error } = await signUp(email, password, name)
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Account created! Check your email to confirm, then sign in.')
      setMode('signin')
      setEmail('')
      setPassword('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🌈</div>
        <h1>Rainbow Heart Studio</h1>

        <div className="login-tabs">
          <button
            className={mode === 'signin' ? 'login-tab active' : 'login-tab'}
            onClick={() => switchMode('signin')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={mode === 'signup' ? 'login-tab active' : 'login-tab'}
            onClick={() => switchMode('signup')}
            type="button"
          >
            Student Sign Up
          </button>
        </div>

        {success && <p className="login-success">{success}</p>}

        {mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="login-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="login-form">
            <p className="login-tagline">Create your student account below.</p>
            <label>
              Your Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
                required
                autoFocus
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </label>
            <label>
              Confirm Password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
              />
            </label>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Student Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const emptyRegistration = { username: '', designation: '', mobile_number: '', email: '', password: '' }

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [formData, setFormData] = useState(emptyRegistration)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setFormData(emptyRegistration)
  }

  const handleChange = (event) => setFormData({ ...formData, [event.target.name]: event.target.value })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (mode === 'register' && formData.password.length < 8) {
      setError('Your password must be at least 8 characters.')
      return
    }
    setIsSubmitting(true)
    try {
      const response = mode === 'register'
        ? await api.post('/auth/register', formData)
        : await api.post('/auth/login', { email: formData.email, password: formData.password })
      onAuthenticated(response.data)
      navigate('/add')
    } catch (requestError) {
      const detail = requestError.response?.data?.detail
      setError(Array.isArray(detail) ? detail[0]?.msg : detail || 'Authentication failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <p className="eyebrow">Ledger</p>
        <h1>Make money feel less mysterious.</h1>
        <p className="intro-copy">A private, clear place for the choices behind your everyday finances.</p>
      </section>
      <section className="auth-card">
        <div className="auth-tabs" role="tablist">
          <button className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} type="button" onClick={() => switchMode('login')}>Log in</button>
          <button className={mode === 'register' ? 'auth-tab active' : 'auth-tab'} type="button" onClick={() => switchMode('register')}>Create account</button>
        </div>
        <div className="form-heading"><div><p className="section-kicker">{mode === 'login' ? 'Welcome back' : 'Start here'}</p><h2>{mode === 'login' ? 'Log in to Ledger' : 'Create your account'}</h2></div><span className="form-mark" aria-hidden="true">{mode === 'login' ? '>' : '+'}</span></div>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && <>
            <div className="form-row"><div className="field-group"><label htmlFor="username">User name</label><input id="username" name="username" minLength="3" required value={formData.username} onChange={handleChange} /></div><div className="field-group"><label htmlFor="designation">Designation</label><input id="designation" name="designation" required value={formData.designation} onChange={handleChange} /></div></div>
            <div className="field-group"><label htmlFor="mobile_number">Mobile number</label><input id="mobile_number" name="mobile_number" type="tel" pattern="\\+?[0-9][0-9\\s-]{5,18}[0-9]" required value={formData.mobile_number} onChange={handleChange} /></div>
          </>}
          <div className="field-group"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleChange} /></div>
          <div className="field-group"><label htmlFor="password">Password {mode === 'register' && <span>(8 characters minimum)</span>}</label><input id="password" name="password" type="password" minLength="8" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={formData.password} onChange={handleChange} /></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}<span aria-hidden="true">-&gt;</span></button>
        </form>
      </section>
    </main>
  )
}

export default AuthPage
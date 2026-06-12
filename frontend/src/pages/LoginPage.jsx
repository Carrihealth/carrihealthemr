import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm] = useState({ hospital_code: '', email: '', password: '' });
  const [showPass, setShowPass]   = useState(false);
  const [loading,  setLoading]    = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.hospital_code.trim() || !form.email.trim() || !form.password) {
      toast.error('All fields are required');
      return;
    }
    setLoading(true);
    try {
      await login(form.email.trim(), form.password, form.hospital_code.trim().toUpperCase());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo__icon">⚕</span>
          <span className="auth-logo__text">Carri Health EMR</span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your hospital account</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="hospital_code">Hospital Code</label>
            <input
              id="hospital_code"
              name="hospital_code"
              className="form-input"
              type="text"
              placeholder="e.g. LAG123456"
              value={form.hospital_code}
              onChange={handleChange}
              autoComplete="organization"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              className="form-input"
              type="email"
              placeholder="you@hospital.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="input-password-wrap">
              <input
                id="password"
                name="password"
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-password-toggle"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full mt-8"
            disabled={loading}
          >
            {loading
              ? <><span className="btn-spinner" /> Signing in…</>
              : 'Sign In'
            }
          </button>
        </form>

        <p className="auth-footer-link">
          New to Carri Health?{' '}
          <Link to="/register">Register your hospital</Link>
        </p>
      </div>
    </div>
  );
}

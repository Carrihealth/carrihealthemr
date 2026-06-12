import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name:          '',
    address:       '',
    phone:         '',
    email:         '',
    adminFullName: '',
    adminEmail:    '',
    adminPassword: '',
    confirmPass:   '',
  });
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim() || !form.adminFullName.trim() || !form.adminEmail.trim() || !form.adminPassword) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (form.adminPassword !== form.confirmPass) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.adminPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register-hospital', {
        name:          form.name.trim(),
        address:       form.address.trim() || undefined,
        phone:         form.phone.trim()   || undefined,
        email:         form.email.trim()   || undefined,
        adminFullName: form.adminFullName.trim(),
        adminEmail:    form.adminEmail.trim(),
        adminPassword: form.adminPassword,
      });

      const { hospital_code } = res.data.data.hospital;

      toast.success(
        (t) => (
          <div>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>Hospital registered!</p>
            <p style={{ fontSize: 12, marginBottom: 8 }}>
              Save your Hospital Code — you will need it to log in:
            </p>
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: 20,
                fontWeight: 900,
                color: '#0B1E3D',
                letterSpacing: 2,
                textAlign: 'center',
                background: '#eef2ff',
                padding: '8px 16px',
                borderRadius: 6,
              }}
            >
              {hospital_code}
            </p>
            <button
              style={{ marginTop: 8, fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => toast.dismiss(t.id)}
            >
              Dismiss
            </button>
          </div>
        ),
        { duration: 15000 }
      );

      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.errors?.length) {
        toast.error(errData.errors[0].msg);
      } else {
        toast.error(errData?.message ?? 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <div className="auth-logo">
          <span className="auth-logo__icon">⚕</span>
          <span className="auth-logo__text">Carri Health EMR</span>
        </div>

        <h1 className="auth-title">Register Your Hospital</h1>
        <p className="auth-subtitle">Set up your facility and admin account</p>

        <form onSubmit={handleSubmit} noValidate>
          {/* ── Section 1: Hospital Details ────────────────────────────── */}
          <p className="form-section-label">Hospital Details</p>

          <div className="form-group">
            <label className="form-label" htmlFor="name">
              Hospital Name <span className="text-danger">*</span>
            </label>
            <input id="name" name="name" className="form-input" type="text"
              placeholder="e.g. Lagos General Hospital"
              value={form.name} onChange={handleChange} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone</label>
              <input id="phone" name="phone" className="form-input" type="tel"
                placeholder="+234 800 000 0000"
                value={form.phone} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Hospital Email</label>
              <input id="email" name="email" className="form-input" type="email"
                placeholder="info@hospital.com"
                value={form.email} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="address">Address</label>
            <input id="address" name="address" className="form-input" type="text"
              placeholder="123 Hospital Road, Lagos"
              value={form.address} onChange={handleChange} />
          </div>

          {/* ── Section 2: Admin Account ───────────────────────────────── */}
          <p className="form-section-label mt-16">Admin Account</p>

          <div className="form-group">
            <label className="form-label" htmlFor="adminFullName">
              Admin Full Name <span className="text-danger">*</span>
            </label>
            <input id="adminFullName" name="adminFullName" className="form-input" type="text"
              placeholder="Dr. Jane Adeyemi"
              value={form.adminFullName} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="adminEmail">
              Admin Email <span className="text-danger">*</span>
            </label>
            <input id="adminEmail" name="adminEmail" className="form-input" type="email"
              placeholder="admin@hospital.com"
              value={form.adminEmail} onChange={handleChange} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="adminPassword">
                Password <span className="text-danger">*</span>
              </label>
              <input id="adminPassword" name="adminPassword" className="form-input" type="password"
                placeholder="Min. 8 characters"
                value={form.adminPassword} onChange={handleChange}
                autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPass">
                Confirm Password <span className="text-danger">*</span>
              </label>
              <input id="confirmPass" name="confirmPass" className="form-input" type="password"
                placeholder="Repeat password"
                value={form.confirmPass} onChange={handleChange}
                autoComplete="new-password" />
            </div>
          </div>

          {form.confirmPass && form.adminPassword !== form.confirmPass && (
            <p className="form-error mb-8">Passwords do not match</p>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--full mt-8"
            disabled={loading}
          >
            {loading
              ? <><span className="btn-spinner" /> Registering…</>
              : 'Register Hospital'
            }
          </button>
        </form>

        <p className="auth-footer-link">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

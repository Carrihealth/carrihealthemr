import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const ROLE_BADGE = {
  doctor:      'badge--blue',
  nurse:       'badge--green',
  lab:         'badge--yellow',
  admin:       'badge--gray',
  super_admin: 'badge--gray',
};

const ROLE_LABEL = {
  doctor:      'Doctor',
  nurse:       'Nurse',
  lab:         'Lab',
  admin:       'Admin',
  super_admin: 'Super Admin',
};

function roleOptions(currentRole) {
  if (currentRole === 'super_admin') return ['doctor', 'nurse', 'lab', 'admin', 'super_admin'];
  return ['doctor', 'nurse', 'lab'];
}

function fmt(d) {
  return d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

// ─── InviteModal ──────────────────────────────────────────────────────────────
function InviteModal({ currentUserRole, onClose, onCreated }) {
  const [form,    setForm]    = useState({ full_name: '', email: '', password: '', role: '' });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const roles = roleOptions(currentUserRole);

  function handle(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    const { full_name, email, password, role } = form;
    if (!full_name.trim() || !email.trim() || !password || !role) {
      toast.error('All fields are required');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/users', form);
      toast.success(`${res.data.data.full_name} created successfully`);
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.errors?.[0]?.msg ?? d?.message ?? 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-group">
        <label className="form-label">Full Name <span className="text-danger">*</span></label>
        <input name="full_name" className="form-input" type="text"
          value={form.full_name} onChange={handle}
          placeholder="e.g. Dr. Emeka Okonkwo" autoFocus />
      </div>

      <div className="form-group">
        <label className="form-label">Email <span className="text-danger">*</span></label>
        <input name="email" className="form-input" type="email"
          value={form.email} onChange={handle}
          placeholder="user@hospital.com" />
      </div>

      <div className="form-group">
        <label className="form-label">Password <span className="text-danger">*</span></label>
        <div className="input-password-wrap">
          <input name="password" className="form-input"
            type={showPw ? 'text' : 'password'}
            value={form.password} onChange={handle}
            placeholder="Min 8 chars, 1 uppercase, 1 number" />
          <button type="button" className="input-password-toggle" tabIndex={-1}
            onClick={() => setShowPw(p => !p)}>
            {showPw ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Role <span className="text-danger">*</span></label>
        <select name="role" className="form-select" value={form.role} onChange={handle}>
          <option value="">Select role…</option>
          {roles.map(r => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Creating…</> : 'Create User'}
        </button>
      </div>
    </form>
  );
}

// ─── UsersPage ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user }     = useAuth();
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [actionId,   setActionId]   = useState(null);

  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    api.get('/users')
      .then(r => setUsers(r.data.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="page-placeholder"><p>Access denied.</p></div>;
  }

  async function deactivate(u) {
    const confirmed = window.confirm(
      `Deactivate ${u.full_name}?\n\nThey will no longer be able to log in.`
    );
    if (!confirmed) return;
    setActionId(u.id);
    try {
      await api.patch(`/users/${u.id}/deactivate`);
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, is_active: false } : p));
      toast.success(`${u.full_name} deactivated`);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to deactivate user');
    } finally {
      setActionId(null);
    }
  }

  async function reactivate(u) {
    setActionId(u.id);
    try {
      await api.patch(`/users/${u.id}/reactivate`);
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, is_active: true } : p));
      toast.success(`${u.full_name} reactivated`);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to reactivate user');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <button className="btn btn--primary" onClick={() => setShowInvite(true)}>
          + Invite User
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-line" style={{ height: 44, borderRadius: 6 }} />
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Date Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!users.length ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                      No users found.
                    </td>
                  </tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <span className="font-bold">{u.full_name}</span>
                      {u.id === user?.id && (
                        <span className="badge badge--gray" style={{ marginLeft: 6, fontSize: 10 }}>You</span>
                      )}
                    </td>
                    <td className="text-sm" style={{ color: '#6b7280' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[u.role] ?? 'badge--gray'}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge--green' : 'badge--gray'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-sm">{fmt(u.created_at)}</td>
                    <td>
                      {u.id === user?.id ? null : u.is_active ? (
                        <button className="btn btn--danger btn--sm"
                          disabled={actionId === u.id}
                          onClick={() => deactivate(u)}>
                          {actionId === u.id
                            ? <><span className="btn-spinner" /> …</>
                            : 'Deactivate'}
                        </button>
                      ) : (
                        <button className="btn btn--secondary btn--sm"
                          disabled={actionId === u.id}
                          onClick={() => reactivate(u)}>
                          {actionId === u.id
                            ? <><span className="btn-spinner" style={{ borderTopColor: '#374151' }} /> …</>
                            : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvite && (
        <Modal title="Invite New User" onClose={() => setShowInvite(false)}>
          <InviteModal
            currentUserRole={user?.role}
            onClose={() => setShowInvite(false)}
            onCreated={newUser => setUsers(prev => [newUser, ...prev])} />
        </Modal>
      )}
    </div>
  );
}

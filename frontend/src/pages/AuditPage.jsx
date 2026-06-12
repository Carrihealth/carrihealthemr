import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ACTION_TYPES = [
  'login', 'logout', 'record_create', 'record_edit',
  'record_view', 'record_export', 'user_created', 'user_deactivated',
];

const ACTION_BADGE = {
  login:            'badge--green',
  logout:           'badge--gray',
  record_create:    'badge--blue',
  record_edit:      'badge--orange',
  record_view:      'badge--sky',
  record_export:    'badge--purple',
  user_created:     'badge--teal',
  user_deactivated: 'badge--red',
};

const ACTION_LABEL = {
  login:            'Login',
  logout:           'Logout',
  record_create:    'Record Created',
  record_edit:      'Record Edited',
  record_view:      'Record Viewed',
  record_export:    'Exported',
  user_created:     'User Created',
  user_deactivated: 'User Deactivated',
};

const LIMIT = 50;

function fmtDT(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AuditPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [logs,       setLogs]       = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [loading,    setLoading]    = useState(true);
  const [exporting,  setExporting]  = useState(false);
  const [page,       setPage]       = useState(1);

  // Filters: draft state (what's typed) vs applied state (what's fetched)
  const [draft,   setDraft]   = useState({ action_type: '', date_from: '', date_to: '' });
  const [applied, setApplied] = useState({ action_type: '', date_from: '', date_to: '' });

  const canAudit = ['admin', 'super_admin'].includes(user?.role);

  // Role guard — redirect unauthorised users after auth resolves
  useEffect(() => {
    if (user && !['admin', 'super_admin'].includes(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Fetch logs on applied filter or page change
  useEffect(() => {
    if (!user || !canAudit) return;
    setLoading(true);
    const params = { page, limit: LIMIT };
    if (applied.action_type) params.action_type = applied.action_type;
    if (applied.date_from)   params.date_from   = applied.date_from;
    if (applied.date_to)     params.date_to     = applied.date_to;

    api.get('/audit', { params })
      .then(r => {
        setLogs(r.data.data);
        setPagination(r.data.pagination);
      })
      .catch(() => toast.error('Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [applied, page, user]);

  function applyFilters() {
    setApplied({ ...draft });
    setPage(1);
  }

  function clearFilters() {
    const empty = { action_type: '', date_from: '', date_to: '' };
    setDraft(empty);
    setApplied(empty);
    setPage(1);
  }

  async function exportCSV() {
    setExporting(true);
    try {
      const params = {};
      if (applied.date_from) params.date_from = applied.date_from;
      if (applied.date_to)   params.date_to   = applied.date_to;

      const res  = await api.get('/audit/export', { params, responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href  = url;
      link.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Audit log exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  if (!canAudit) return null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
        <button className="btn btn--secondary" onClick={exportCSV} disabled={exporting}>
          {exporting
            ? <><span className="btn-spinner" style={{ borderTopColor: '#374151' }} /> Exporting…</>
            : '⬇ Export CSV'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="card mb-16">
        <div className="audit-filters">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Action Type</label>
            <select className="form-select"
              value={draft.action_type}
              onChange={e => setDraft(p => ({ ...p, action_type: e.target.value }))}>
              <option value="">All Actions</option>
              {ACTION_TYPES.map(a => (
                <option key={a} value={a}>{ACTION_LABEL[a]}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Date From</label>
            <input type="date" className="form-input"
              value={draft.date_from}
              onChange={e => setDraft(p => ({ ...p, date_from: e.target.value }))} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Date To</label>
            <input type="date" className="form-input"
              value={draft.date_to}
              onChange={e => setDraft(p => ({ ...p, date_to: e.target.value }))} />
          </div>

          <div className="audit-filter-btns">
            <button className="btn btn--primary" onClick={applyFilters}>Apply Filters</button>
            <button className="btn btn--secondary" onClick={clearFilters}>Clear</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="skeleton-line" style={{ height: 44, borderRadius: 6 }} />
            ))}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>User Email</th>
                    <th>Role</th>
                    <th>Action</th>
                    <th>Record Type</th>
                    <th>Record ID</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {!logs.length ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                        No audit entries found for the selected filters.
                      </td>
                    </tr>
                  ) : logs.map(log => (
                    <tr key={log.id}>
                      <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>
                        {fmtDT(log.created_at)}
                      </td>
                      <td className="text-sm">{log.user_email ?? '—'}</td>
                      <td>
                        <span className="badge badge--gray" style={{ textTransform: 'capitalize' }}>
                          {log.user_role?.replace('_', ' ') ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${ACTION_BADGE[log.action_type] ?? 'badge--gray'}`}>
                          {ACTION_LABEL[log.action_type] ?? log.action_type}
                        </span>
                      </td>
                      <td className="text-sm" style={{ color: '#6b7280', textTransform: 'capitalize' }}>
                        {log.record_type?.replace('_', ' ') ?? '—'}
                      </td>
                      <td className="text-sm" style={{ color: '#6b7280' }}>
                        {log.record_id ?? '—'}
                      </td>
                      <td className="text-sm" style={{ color: '#9ca3af', fontFamily: 'monospace' }}>
                        {log.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button className="pagination__btn" disabled={page === 1}
                  onClick={() => setPage(1)}>«</button>
                <button className="pagination__btn" disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}>‹</button>
                <span style={{ padding: '0 12px', fontSize: 13, color: '#6b7280' }}>
                  Page {page} of {pagination.totalPages}
                </span>
                <button className="pagination__btn" disabled={page === pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}>›</button>
                <button className="pagination__btn" disabled={page === pagination.totalPages}
                  onClick={() => setPage(pagination.totalPages)}>»</button>
              </div>
            )}

            <p className="text-muted text-sm" style={{ marginTop: 8, textAlign: 'right' }}>
              Showing {logs.length} of {pagination.total?.toLocaleString() ?? 0} entries
            </p>
          </>
        )}
      </div>
    </div>
  );
}

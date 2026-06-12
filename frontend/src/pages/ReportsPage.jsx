import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const VISIT_TYPE_LABELS = {
  outpatient: 'Outpatient',
  inpatient:  'Inpatient',
  emergency:  'Emergency',
  follow_up:  'Follow-up',
};
const VISIT_TYPE_COLORS = {
  outpatient: '#3b82f6',
  inpatient:  '#8b5cf6',
  emergency:  '#ef4444',
  follow_up:  '#10b981',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { user } = useAuth();
  const canView = ['admin', 'super_admin', 'doctor'].includes(user?.role);

  const [draft,     setDraft]     = useState({ date_from: daysAgoStr(30), date_to: todayStr() });
  const [applied,   setApplied]   = useState({ date_from: daysAgoStr(30), date_to: todayStr() });
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    api.get('/reports/range', { params: applied })
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load report data'))
      .finally(() => setLoading(false));
  }, [applied, canView]);

  function applyFilters(e) {
    e.preventDefault();
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      toast.error('"Date From" must be before "Date To"');
      return;
    }
    setApplied({ ...draft });
  }

  function setPreset(days) {
    const p = { date_from: daysAgoStr(days), date_to: todayStr() };
    setDraft(p);
    setApplied(p);
  }

  async function downloadCSV() {
    setExporting(true);
    try {
      const res = await api.get('/reports/export', {
        params: applied,
        responseType: 'blob',
      });
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href  = url;
      link.download = `carri_health_report_${applied.date_from || 'all'}_to_${applied.date_to || 'all'}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Download failed');
    } finally {
      setExporting(false);
    }
  }

  if (!canView) {
    return (
      <div className="page-placeholder">
        <h2>Access Denied</h2>
        <p>You do not have permission to view reports.</p>
      </div>
    );
  }

  const visitTotal = data?.visitTypeBreakdown?.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <button
          className="btn btn--secondary"
          onClick={downloadCSV}
          disabled={exporting || loading || !data}
        >
          {exporting
            ? <><span className="btn-spinner" style={{ borderTopColor: '#374151' }} /> Exporting…</>
            : '⬇ Download CSV'}
        </button>
      </div>

      {/* Date range filter */}
      <div className="card mb-16">
        <form onSubmit={applyFilters}>
          <div className="report-filters">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date From</label>
              <input
                type="date"
                className="form-input"
                value={draft.date_from}
                onChange={e => setDraft(p => ({ ...p, date_from: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date To</label>
              <input
                type="date"
                className="form-input"
                value={draft.date_to}
                max={todayStr()}
                onChange={e => setDraft(p => ({ ...p, date_to: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn--primary">Apply</button>
            </div>
          </div>
        </form>

        {/* Presets */}
        <div className="report-presets">
          <span className="text-muted text-sm">Quick:</span>
          {[
            { label: 'Last 7 days',  days: 7   },
            { label: 'Last 30 days', days: 30  },
            { label: 'Last 90 days', days: 90  },
            { label: 'Last year',    days: 365 },
          ].map(({ label, days }) => (
            <button key={days} type="button" className="btn btn--ghost btn--sm" onClick={() => setPreset(days)}>
              {label}
            </button>
          ))}
        </div>

        {applied.date_from && applied.date_to && (
          <p className="text-muted text-sm" style={{ marginTop: 10 }}>
            Showing data from <strong>{applied.date_from}</strong> to <strong>{applied.date_to}</strong>
          </p>
        )}
      </div>

      {/* Stats cards */}
      <div className="stats-grid mb-24">
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton-line" style={{ width: '60%', marginBottom: 12 }} />
              <div className="skeleton-line" style={{ width: '40%', height: 28, marginBottom: 8 }} />
              <div className="skeleton-line" style={{ width: '50%' }} />
            </div>
          ))
        ) : data ? (
          <>
            <div className="stat-card">
              <p className="stat-card__label">Patients Registered</p>
              <p className="stat-card__value">{data.patientsRegistered.toLocaleString()}</p>
              <p className="stat-card__sub">In selected period</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Total Visits</p>
              <p className="stat-card__value">{data.totalVisits.toLocaleString()}</p>
              <p className="stat-card__sub">In selected period</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Prescriptions Written</p>
              <p className="stat-card__value">{data.prescriptionsWritten.toLocaleString()}</p>
              <p className="stat-card__sub">In selected period</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Lab Requests</p>
              <p className="stat-card__value">{data.labRequests.total.toLocaleString()}</p>
              <p className="stat-card__sub">
                {data.labRequests.pending} pending · {data.labRequests.reviewed} reviewed
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Visit breakdown + Top diagnoses */}
      <div className="dashboard-row2 mb-24">
        {/* Visit type breakdown */}
        <div className="card">
          <p className="card__title">Visit Type Breakdown</p>
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-line" style={{ height: 32, marginBottom: 12 }} />
            ))
          ) : !data?.visitTypeBreakdown?.length ? (
            <p className="text-muted text-sm">No visits in this period.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.visitTypeBreakdown.map(row => {
                const pct   = visitTotal ? Math.round((row.count / visitTotal) * 100) : 0;
                const color = VISIT_TYPE_COLORS[row.visit_type] ?? '#6b7280';
                return (
                  <div key={row.visit_type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {VISIT_TYPE_LABELS[row.visit_type] ?? row.visit_type}
                      </span>
                      <span style={{ fontSize: 13 }}>
                        <strong>{row.count.toLocaleString()}</strong>
                        <span className="text-muted"> ({pct}%)</span>
                      </span>
                    </div>
                    <div className="visit-bar-track">
                      <div className="visit-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-muted text-sm" style={{ marginTop: 4 }}>
                Total: {visitTotal.toLocaleString()} visits
              </p>
            </div>
          )}
        </div>

        {/* Top 10 diagnoses */}
        <div className="card">
          <p className="card__title">Top 10 Diagnoses</p>
          {loading ? (
            [80, 70, 60, 55, 45].map((w, i) => (
              <div key={i} className="skeleton-line" style={{ width: `${w}%`, marginBottom: 10 }} />
            ))
          ) : !data?.topDiagnoses?.length ? (
            <p className="text-muted text-sm">No diagnoses recorded in this period.</p>
          ) : (
            <ol className="diagnosis-list">
              {data.topDiagnoses.map((d, i) => (
                <li key={d.diagnosis} className="diagnosis-item">
                  <span className="diagnosis-item__rank">{i + 1}</span>
                  <span className="diagnosis-item__name">
                    {d.diagnosis.charAt(0).toUpperCase() + d.diagnosis.slice(1)}
                  </span>
                  <span className="badge badge--blue diagnosis-item__count">{d.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Lab request status breakdown */}
      {!loading && data && (
        <div className="card">
          <p className="card__title">Lab Request Status</p>
          <div className="report-lab-grid">
            <div className="report-lab-cell">
              <p className="report-lab-cell__value" style={{ color: '#d97706' }}>
                {data.labRequests.pending}
              </p>
              <span className="badge badge--yellow">Pending</span>
            </div>
            <div className="report-lab-cell">
              <p className="report-lab-cell__value" style={{ color: '#1e40af' }}>
                {data.labRequests.received}
              </p>
              <span className="badge badge--blue">Received</span>
            </div>
            <div className="report-lab-cell">
              <p className="report-lab-cell__value" style={{ color: '#065f46' }}>
                {data.labRequests.reviewed}
              </p>
              <span className="badge badge--green">Reviewed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

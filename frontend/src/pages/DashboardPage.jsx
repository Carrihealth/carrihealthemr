import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
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

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonStatCard() {
  return (
    <div className="stat-card">
      <div className="skeleton-line" style={{ width: '60%', marginBottom: 12 }} />
      <div className="skeleton-line" style={{ width: '40%', height: 28, marginBottom: 8 }} />
      <div className="skeleton-line" style={{ width: '50%' }} />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, highlight }) {
  return (
    <div className={`stat-card ${highlight ? 'stat-card--highlight' : ''}`}>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
      {sub && <p className="stat-card__sub">{sub}</p>}
    </div>
  );
}

// ─── Custom tooltip for recharts ──────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 13,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ color: '#0B1E3D' }}>{payload[0].value} registrations</p>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user }  = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const canView = ['admin', 'super_admin', 'doctor'].includes(user?.role);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    api.get('/reports')
      .then(r => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, [canView]);

  if (!canView) {
    return (
      <div className="page-placeholder">
        <p>Dashboard is not available for your role.</p>
      </div>
    );
  }

  const visitTotal = data?.visitTypeBreakdown?.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2', color: '#991b1b',
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* ── Row 1: Stat cards ── */}
      <div className="stats-grid mb-24">
        {loading ? (
          [1, 2, 3, 4].map(i => <SkeletonStatCard key={i} />)
        ) : data ? (
          <>
            <StatCard
              label="Total Patients"
              value={data.totalPatientsAllTime.toLocaleString()}
              sub={`+${data.totalPatientsThisMonth} registered this month`} />
            <StatCard
              label="Total Visits"
              value={data.totalVisitsAllTime.toLocaleString()}
              sub={`+${data.totalVisitsThisMonth} this month`} />
            <StatCard
              label="Active Prescriptions"
              value={data.activePrescriptionsCount.toLocaleString()}
              sub="Last 7 days" />
            <StatCard
              label="Pending Lab Results"
              value={data.pendingLabResultsCount.toLocaleString()}
              highlight={data.pendingLabResultsCount > 0}
              sub={data.pendingLabResultsCount > 0 ? 'Awaiting upload' : 'All clear'} />
          </>
        ) : null}
      </div>

      {/* ── Row 2: Visit types + Top diagnoses ── */}
      <div className="dashboard-row2 mb-24">

        {/* Visit Type Breakdown */}
        <div className="card">
          <p className="card__title">Visit Type Breakdown</p>
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-line" style={{ height: 32, marginBottom: 12 }} />
            ))
          ) : !data?.visitTypeBreakdown?.length ? (
            <p className="text-muted text-sm">No visit data yet.</p>
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

        {/* Top 10 Diagnoses */}
        <div className="card">
          <p className="card__title">Top 10 Diagnoses</p>
          {loading ? (
            [80, 70, 60, 55, 45].map((w, i) => (
              <div key={i} className="skeleton-line"
                style={{ width: `${w}%`, marginBottom: 10 }} />
            ))
          ) : !data?.topDiagnoses?.length ? (
            <p className="text-muted text-sm">No diagnoses recorded yet.</p>
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

      {/* ── Row 3: Registration trend ── */}
      <div className="card">
        <p className="card__title">New Patient Registrations (Last 12 Months)</p>
        {loading ? (
          <div className="skeleton-line" style={{ height: 220, borderRadius: 6 }} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data?.registrationTrend ?? []}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f0f4ff' }} />
              <Bar dataKey="count" name="Registrations" fill="#0B1E3D" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

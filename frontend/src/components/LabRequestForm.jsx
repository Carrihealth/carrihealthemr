import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const URGENCY_OPTS  = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent',  label: 'Urgent'  },
  { value: 'stat',    label: 'STAT'    },
];
const URGENCY_COLOR = { routine: '#6b7280', urgent: '#d97706', stat: '#dc2626' };

const EMPTY = { test_name: '', urgency: 'routine' };

export default function LabRequestForm({ visitId, patientId, onSaved }) {
  const { user }    = useAuth();
  const [form,      setForm]    = useState({ ...EMPTY });
  const [loading,   setLoading] = useState(false);

  if (!['doctor', 'nurse'].includes(user?.role)) return null;

  function handle(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.test_name.trim()) { toast.error('Test name is required'); return; }
    setLoading(true);
    try {
      const res = await api.post('/lab', {
        visit_id:   visitId,
        patient_id: patientId,
        ...form,
      });
      toast.success('Lab request submitted');
      setForm({ ...EMPTY });
      onSaved?.(res.data.data);
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.errors?.[0]?.msg ?? d?.message ?? 'Failed to submit lab request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Test Name <span className="text-danger">*</span></label>
          <input name="test_name" className="form-input" type="text"
            value={form.test_name} onChange={handle}
            placeholder="e.g. Full Blood Count, Malaria RDT, Liver Function Tests" />
        </div>

        <div className="form-group">
          <label className="form-label">Urgency</label>
          <select name="urgency" className="form-select"
            value={form.urgency} onChange={handle}
            style={{ color: URGENCY_COLOR[form.urgency], fontWeight: 600 }}>
            {URGENCY_OPTS.map(o => (
              <option key={o.value} value={o.value} style={{ color: URGENCY_COLOR[o.value] }}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Submitting…</> : 'Request Lab Test'}
        </button>
      </div>
    </form>
  );
}

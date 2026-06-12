import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SHIFTS = ['morning', 'afternoon', 'night'];
const EMPTY  = { prescription_id: '', dose_given: '', shift_label: 'morning', notes: '' };

export default function MARForm({ patientId, onSaved }) {
  const { user }          = useAuth();
  const [form,            setForm]          = useState({ ...EMPTY });
  const [prescriptions,   setPrescriptions] = useState([]);
  const [loading,         setLoading]       = useState(false);

  useEffect(() => {
    if (user?.role !== 'nurse') return;
    api.get(`/prescriptions/patient/${patientId}`)
      .then(r => setPrescriptions(r.data.data ?? []))
      .catch(() => {});
  }, [patientId, user?.role]);

  if (user?.role !== 'nurse') return null;

  function handle(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.prescription_id) { toast.error('Select a prescription'); return; }
    setLoading(true);
    try {
      const res = await api.post('/nursing/mar', {
        patient_id:      patientId,
        prescription_id: Number(form.prescription_id),
        shift_label:     form.shift_label,
        dose_given:      form.dose_given  || undefined,
        notes:           form.notes       || undefined,
      });
      toast.success('Medication administration recorded');
      setForm({ ...EMPTY });
      onSaved?.(res.data.data);
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.errors?.[0]?.msg ?? d?.message ?? 'Failed to record administration');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Prescription <span className="text-danger">*</span></label>
          <select name="prescription_id" className="form-select"
            value={form.prescription_id} onChange={handle}>
            <option value="">Select prescription…</option>
            {prescriptions.map(rx => (
              <option key={rx.id} value={rx.id}>
                {rx.drug_name} — {rx.dosage} · {rx.frequency}
              </option>
            ))}
          </select>
          {!prescriptions.length && (
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>
              No prescriptions on file for this patient.
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Dose Given</label>
          <input name="dose_given" className="form-input" type="text"
            value={form.dose_given} onChange={handle}
            placeholder="e.g. 500 mg" />
        </div>

        <div className="form-group">
          <label className="form-label">Shift</label>
          <select name="shift_label" className="form-select"
            value={form.shift_label} onChange={handle}>
            {SHIFTS.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Notes</label>
          <textarea name="notes" className="form-textarea" rows={2}
            value={form.notes} onChange={handle}
            placeholder="Patient reaction, reason for dose change, missed dose reason…" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Recording…</> : 'Record Administration'}
        </button>
      </div>
    </form>
  );
}

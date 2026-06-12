import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SHIFTS = ['morning', 'afternoon', 'night'];
const EMPTY  = { note_text: '', shift_label: 'morning' };

export default function NursingNoteForm({ visitId, patientId, onSaved }) {
  const { user }    = useAuth();
  const [form,      setForm]    = useState({ ...EMPTY });
  const [loading,   setLoading] = useState(false);

  if (user?.role !== 'nurse') return null;

  function handle(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.note_text.trim()) { toast.error('Note text is required'); return; }
    setLoading(true);
    try {
      const res = await api.post('/nursing/notes', {
        visit_id:   visitId,
        patient_id: patientId,
        ...form,
      });
      toast.success('Nursing note saved');
      setForm({ ...EMPTY });
      onSaved?.(res.data.data);
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.errors?.[0]?.msg ?? d?.message ?? 'Failed to save nursing note');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Note <span className="text-danger">*</span></label>
          <textarea name="note_text" className="form-textarea" rows={3}
            value={form.note_text} onChange={handle}
            placeholder="Observations, care given, patient response, pain score…" />
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
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Saving…</> : 'Save Nursing Note'}
        </button>
      </div>
    </form>
  );
}

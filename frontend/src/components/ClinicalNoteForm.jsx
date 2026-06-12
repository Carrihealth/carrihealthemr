import { useState } from 'react';
import toast from 'react-hot-toast';
import api  from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY = { subjective: '', objective: '', assessment: '', plan: '', clerking: '', diagnosis: '' };

export default function ClinicalNoteForm({ visitId, patientId, onSaved }) {
  const { user }  = useAuth();
  const [form,    setForm]    = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);

  if (user?.role !== 'doctor') return null;

  function handle(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    const hasContent = Object.values(form).some(v => v.trim());
    if (!hasContent) { toast.error('At least one field must be filled'); return; }

    setLoading(true);
    try {
      const res = await api.post('/clinical-notes', {
        visit_id:   visitId,
        patient_id: patientId,
        ...form,
      });
      toast.success('Clinical note saved');
      setForm({ ...EMPTY });
      onSaved?.(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save note');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="clinical-form">
      <div className="form-group">
        <label className="form-label soap-label"><span className="soap-tag">C</span> Clerking</label>
        <textarea name="clerking" className="form-textarea" rows={3}
          value={form.clerking} onChange={handle}
          placeholder="History of presenting complaint, past medical history…" />
      </div>

      <div className="form-group">
        <label className="form-label soap-label"><span className="soap-tag">S</span> Subjective</label>
        <textarea name="subjective" className="form-textarea" rows={3}
          value={form.subjective} onChange={handle}
          placeholder="Patient's chief complaint in their own words…" />
      </div>

      <div className="form-group">
        <label className="form-label soap-label"><span className="soap-tag">O</span> Objective</label>
        <textarea name="objective" className="form-textarea" rows={3}
          value={form.objective} onChange={handle}
          placeholder="Physical examination findings, observations…" />
      </div>

      <div className="form-group">
        <label className="form-label soap-label"><span className="soap-tag">A</span> Assessment</label>
        <textarea name="assessment" className="form-textarea" rows={3}
          value={form.assessment} onChange={handle}
          placeholder="Clinical impression, differential diagnosis…" />
      </div>

      <div className="form-group">
        <label className="form-label soap-label"><span className="soap-tag">P</span> Plan</label>
        <textarea name="plan" className="form-textarea" rows={3}
          value={form.plan} onChange={handle}
          placeholder="Treatment plan, investigations ordered, referrals…" />
      </div>

      <div className="form-group">
        <label className="form-label">Diagnosis</label>
        <input name="diagnosis" className="form-input" type="text"
          value={form.diagnosis} onChange={handle}
          placeholder="e.g. Malaria, Hypertension, Type 2 Diabetes" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Saving…</> : 'Save Clinical Note'}
        </button>
      </div>
    </form>
  );
}

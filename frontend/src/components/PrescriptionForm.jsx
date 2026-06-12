import { useState } from 'react';
import toast from 'react-hot-toast';
import api  from '../services/api';
import { useAuth } from '../context/AuthContext';

const ROUTES = ['oral', 'intravenous', 'intramuscular', 'topical', 'inhalation', 'sublingual', 'rectal', 'other'];

const EMPTY = { drug_name: '', dosage: '', frequency: '', duration: '', route_of_administration: '' };

export default function PrescriptionForm({ visitId, patientId, onSaved }) {
  const { user }   = useAuth();
  const [form,     setForm]     = useState({ ...EMPTY });
  const [conflict, setConflict] = useState(null);
  const [loading,  setLoading]  = useState(false);

  if (user?.role !== 'doctor') return null;

  function handle(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    const { drug_name, dosage, frequency, duration, route_of_administration } = form;
    if (!drug_name.trim() || !dosage.trim() || !frequency.trim() || !duration.trim() || !route_of_administration) {
      toast.error('All fields are required');
      return;
    }

    setLoading(true);
    setConflict(null);
    try {
      const res = await api.post('/prescriptions', {
        visit_id:   visitId,
        patient_id: patientId,
        ...form,
      });

      if (res.data.allergyConflict) {
        setConflict(res.data.conflictDetail);
      } else {
        toast.success('Prescription added');
      }

      setForm({ ...EMPTY });
      onSaved?.(res.data.data);
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.errors?.[0]?.msg ?? d?.message ?? 'Failed to save prescription');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Allergy conflict alert — persists until dismissed or next submission */}
      {conflict && (
        <div className="allergy-conflict-alert">
          <div className="allergy-conflict-alert__icon">⚠</div>
          <div>
            <p className="allergy-conflict-alert__title">ALLERGY CONFLICT DETECTED</p>
            <p className="allergy-conflict-alert__detail">{conflict}</p>
            <p className="allergy-conflict-alert__note">Prescription was saved. Review before administering.</p>
          </div>
          <button className="allergy-conflict-alert__close" onClick={() => setConflict(null)}>✕</button>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <div className="grid-2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Drug Name <span className="text-danger">*</span></label>
            <input name="drug_name" className="form-input" type="text"
              value={form.drug_name} onChange={handle}
              placeholder="e.g. Amoxicillin, Paracetamol" />
          </div>

          <div className="form-group">
            <label className="form-label">Dosage <span className="text-danger">*</span></label>
            <input name="dosage" className="form-input" type="text"
              value={form.dosage} onChange={handle}
              placeholder="e.g. 500 mg" />
          </div>

          <div className="form-group">
            <label className="form-label">Frequency <span className="text-danger">*</span></label>
            <input name="frequency" className="form-input" type="text"
              value={form.frequency} onChange={handle}
              placeholder="e.g. twice daily" />
          </div>

          <div className="form-group">
            <label className="form-label">Duration <span className="text-danger">*</span></label>
            <input name="duration" className="form-input" type="text"
              value={form.duration} onChange={handle}
              placeholder="e.g. 7 days" />
          </div>

          <div className="form-group">
            <label className="form-label">Route of Administration <span className="text-danger">*</span></label>
            <select name="route_of_administration" className="form-select"
              value={form.route_of_administration} onChange={handle}>
              <option value="">Select route…</option>
              {ROUTES.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Saving…</> : 'Add Prescription'}
          </button>
        </div>
      </form>
    </div>
  );
}

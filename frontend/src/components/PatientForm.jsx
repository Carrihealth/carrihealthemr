import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];
const SEX_OPTIONS  = ['male', 'female', 'other'];

const EMPTY = {
  full_name: '', date_of_birth: '', sex: '', blood_group: '',
  phone: '', address: '', state_of_origin: '',
  next_of_kin_name: '', next_of_kin_contact: '',
  known_allergies: '', pre_existing_conditions: '',
};

export default function PatientForm({ patient = null, onSuccess, onCancel }) {
  const isEdit = !!patient;

  const [form, setForm] = useState(
    isEdit
      ? {
          full_name:               patient.full_name              ?? '',
          date_of_birth:           patient.date_of_birth?.slice(0, 10) ?? '',
          sex:                     patient.sex                    ?? '',
          blood_group:             patient.blood_group            ?? '',
          phone:                   patient.phone                  ?? '',
          address:                 patient.address                ?? '',
          state_of_origin:         patient.state_of_origin        ?? '',
          next_of_kin_name:        patient.next_of_kin_name       ?? '',
          next_of_kin_contact:     patient.next_of_kin_contact    ?? '',
          known_allergies:         patient.known_allergies        ?? '',
          pre_existing_conditions: patient.pre_existing_conditions ?? '',
        }
      : { ...EMPTY }
  );
  const [loading, setLoading] = useState(false);

  function handle(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.date_of_birth || !form.sex || !form.blood_group) {
      toast.error('Full name, date of birth, sex and blood group are required');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        // Only send updatable fields
        const payload = {
          phone:                   form.phone                   || undefined,
          address:                 form.address                 || undefined,
          next_of_kin_name:        form.next_of_kin_name        || undefined,
          next_of_kin_contact:     form.next_of_kin_contact     || undefined,
          known_allergies:         form.known_allergies         || undefined,
          pre_existing_conditions: form.pre_existing_conditions || undefined,
        };
        const res = await api.patch(`/patients/${patient.id}`, payload);
        toast.success('Patient updated successfully');
        onSuccess(res.data.data);
      } else {
        const res = await api.post('/patients', form);
        toast.success(`Patient registered — ID: ${res.data.data.carri_health_id}`);
        onSuccess(res.data.data);
      }
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.errors?.[0]?.msg ?? d?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const readOnly = isEdit; // non-updatable fields are disabled in edit mode

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Full Name <span className="text-danger">*</span></label>
          <input name="full_name" className="form-input" type="text"
            value={form.full_name} onChange={handle}
            disabled={readOnly} placeholder="e.g. Amaka Okonkwo" />
        </div>

        <div className="form-group">
          <label className="form-label">Date of Birth <span className="text-danger">*</span></label>
          <input name="date_of_birth" className="form-input" type="date"
            value={form.date_of_birth} onChange={handle} disabled={readOnly} />
        </div>

        <div className="form-group">
          <label className="form-label">Sex <span className="text-danger">*</span></label>
          <select name="sex" className="form-select" value={form.sex} onChange={handle} disabled={readOnly}>
            <option value="">Select sex</option>
            {SEX_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Blood Group <span className="text-danger">*</span></label>
          <select name="blood_group" className="form-select" value={form.blood_group} onChange={handle} disabled={readOnly}>
            <option value="">Select blood group</option>
            {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Phone</label>
          <input name="phone" className="form-input" type="tel"
            value={form.phone} onChange={handle} placeholder="+234 800 000 0000" />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Address</label>
          <input name="address" className="form-input" type="text"
            value={form.address} onChange={handle} />
        </div>

        <div className="form-group">
          <label className="form-label">State of Origin</label>
          <input name="state_of_origin" className="form-input" type="text"
            value={form.state_of_origin} onChange={handle} disabled={readOnly} />
        </div>

        <div className="form-group">
          <label className="form-label">Next of Kin Name</label>
          <input name="next_of_kin_name" className="form-input" type="text"
            value={form.next_of_kin_name} onChange={handle} />
        </div>

        <div className="form-group">
          <label className="form-label">Next of Kin Contact</label>
          <input name="next_of_kin_contact" className="form-input" type="tel"
            value={form.next_of_kin_contact} onChange={handle} />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" style={{ color: '#dc2626' }}>
            Known Allergies
            <span className="text-muted" style={{ fontWeight: 400, marginLeft: 6 }}>
              — used in automatic prescription safety checks
            </span>
          </label>
          <textarea name="known_allergies" className="form-textarea"
            value={form.known_allergies} onChange={handle}
            placeholder="e.g. Penicillin, Aspirin" />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Pre-existing Conditions</label>
          <textarea name="pre_existing_conditions" className="form-textarea"
            value={form.pre_existing_conditions} onChange={handle}
            placeholder="e.g. Type 2 Diabetes, Hypertension" />
        </div>
      </div>

      <div className="flex gap-8" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading
            ? <><span className="btn-spinner" /> Saving…</>
            : isEdit ? 'Save Changes' : 'Register Patient'
          }
        </button>
      </div>
    </form>
  );
}

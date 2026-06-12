import { useState } from 'react';
import toast from 'react-hot-toast';
import api  from '../services/api';
import { useAuth } from '../context/AuthContext';

const VITAL_FIELDS = [
  'blood_pressure_systolic', 'blood_pressure_diastolic',
  'temperature_celsius', 'pulse_rate', 'respiratory_rate',
  'spo2_percent', 'weight_kg', 'height_cm',
];

const EMPTY = {
  blood_pressure_systolic:  '',
  blood_pressure_diastolic: '',
  temperature_celsius:      '',
  pulse_rate:               '',
  respiratory_rate:         '',
  spo2_percent:             '',
  weight_kg:                '',
  height_cm:                '',
};

function UnitInput({ label, name, unit, value, onChange, placeholder }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="input-unit-wrap">
        <input
          name={name}
          className="form-input"
          type="number"
          step="any"
          min="0"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        <span className="input-unit">{unit}</span>
      </div>
    </div>
  );
}

export default function VitalsForm({ visitId, patientId, onSaved }) {
  const { user }  = useAuth();
  const [form,    setForm]    = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);

  if (!['nurse', 'doctor'].includes(user?.role)) return null;

  function handle(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    const hasAny = VITAL_FIELDS.some(f => form[f] !== '');
    if (!hasAny) { toast.error('At least one vital sign must be recorded'); return; }

    const payload = { visit_id: visitId, patient_id: patientId };
    for (const f of VITAL_FIELDS) {
      if (form[f] !== '') payload[f] = Number(form[f]);
    }

    setLoading(true);
    try {
      const res = await api.post('/vitals', payload);
      toast.success('Vitals recorded');
      setForm({ ...EMPTY });
      onSaved?.(res.data.data);
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.errors?.[0]?.msg ?? d?.message ?? 'Failed to record vitals');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* Blood Pressure — two inputs side by side */}
      <div className="form-group">
        <label className="form-label">Blood Pressure <span className="text-muted text-sm">mmHg</span></label>
        <div className="bp-inputs">
          <input
            name="blood_pressure_systolic"
            className="form-input"
            type="number" min="0" max="300"
            value={form.blood_pressure_systolic}
            onChange={handle}
            placeholder="Systolic"
          />
          <span className="bp-slash">/</span>
          <input
            name="blood_pressure_diastolic"
            className="form-input"
            type="number" min="0" max="200"
            value={form.blood_pressure_diastolic}
            onChange={handle}
            placeholder="Diastolic"
          />
        </div>
      </div>

      <div className="vitals-form-grid">
        <UnitInput label="Temperature"      name="temperature_celsius" unit="°C"    value={form.temperature_celsius} onChange={handle} placeholder="36.5" />
        <UnitInput label="Pulse Rate"       name="pulse_rate"          unit="b/min" value={form.pulse_rate}          onChange={handle} placeholder="72" />
        <UnitInput label="Respiratory Rate" name="respiratory_rate"    unit="b/min" value={form.respiratory_rate}    onChange={handle} placeholder="16" />
        <UnitInput label="SpO2"             name="spo2_percent"        unit="%"     value={form.spo2_percent}        onChange={handle} placeholder="98" />
        <UnitInput label="Weight"           name="weight_kg"           unit="kg"    value={form.weight_kg}           onChange={handle} placeholder="70" />
        <UnitInput label="Height"           name="height_cm"           unit="cm"    value={form.height_cm}           onChange={handle} placeholder="165" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Saving…</> : 'Record Vitals'}
        </button>
      </div>
    </form>
  );
}

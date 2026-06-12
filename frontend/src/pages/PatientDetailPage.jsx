import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal            from '../components/Modal';
import PatientForm      from '../components/PatientForm';
import ClinicalNoteForm from '../components/ClinicalNoteForm';
import VitalsForm       from '../components/VitalsForm';
import PrescriptionForm from '../components/PrescriptionForm';
import PrescriptionList from '../components/PrescriptionList';
import LabRequestForm   from '../components/LabRequestForm';
import LabRequestList   from '../components/LabRequestList';
import NursingNoteForm  from '../components/NursingNoteForm';
import NursingNoteList  from '../components/NursingNoteList';
import MARForm          from '../components/MARForm';
import MARList          from '../components/MARList';

const CAN_WRITE   = ['doctor', 'nurse', 'admin', 'super_admin'];
const CAN_EXPORT  = ['doctor', 'admin', 'super_admin'];
const VISIT_TYPES = ['outpatient', 'inpatient', 'emergency', 'follow_up'];

function fmt(d) {
  return d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}
function fmtDT(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function age(dob) {
  const b = new Date(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

// ─── Section form divider ─────────────────────────────────────────────────────
function AddArea({ label, children }) {
  return (
    <div className="visit-add-area">
      <p className="visit-add-area__label">{label}</p>
      {children}
    </div>
  );
}

// ─── VisitRow ─────────────────────────────────────────────────────────────────
function VisitRow({ visit, patientId }) {
  const { user }            = useAuth();
  const [open,              setOpen]          = useState(false);
  const [detail,            setDetail]        = useState(null);
  const [loadingDetail,     setLoadingDetail] = useState(false);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (detail) return;
    setLoadingDetail(true);
    try {
      // allSettled so a 403 on one endpoint (e.g. lab user can't see clinical
      // notes) doesn't block the sections the user IS allowed to see.
      const [notesR, prescR, labsR, vitalsR, nursingR] = await Promise.allSettled([
        api.get(`/clinical-notes/visit/${visit.id}`),
        api.get(`/prescriptions/visit/${visit.id}`),
        api.get(`/lab/visit/${visit.id}`),
        api.get(`/vitals/visit/${visit.id}`),
        api.get(`/nursing/notes/visit/${visit.id}`),
      ]);
      const ok = r => r.status === 'fulfilled' ? r.value.data.data : [];
      setDetail({
        notes:   ok(notesR),
        presc:   ok(prescR),
        labs:    ok(labsR),
        vitals:  ok(vitalsR),
        nursing: ok(nursingR),
      });
    } catch {
      toast.error('Failed to load visit details');
      setOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  }

  const isDoctor        = user?.role === 'doctor';
  const isNurse         = user?.role === 'nurse';
  const isDoctorOrNurse = isDoctor || isNurse;
  const canSeeNursing   = ['nurse', 'doctor', 'admin', 'super_admin'].includes(user?.role);

  return (
    <div className="visit-row">
      <button className="visit-row__header" onClick={toggle}>
        <div className="flex items-center gap-12">
          <span className={`badge ${visit.is_closed ? 'badge--gray' : 'badge--green'}`}>
            {visit.is_closed ? 'Closed' : 'Open'}
          </span>
          <span className="font-bold" style={{ textTransform: 'capitalize' }}>
            {visit.visit_type?.replace('_', ' ')}
          </span>
          <span className="text-muted">{fmtDT(visit.visit_date)}</span>
        </div>
        <div className="flex items-center gap-12">
          {visit.attending_doctor_name && (
            <span className="text-muted text-sm">Dr. {visit.attending_doctor_name}</span>
          )}
          <span className="visit-row__chevron">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="visit-row__body">
          {loadingDetail
            ? <div className="spinner-center" style={{ minHeight: 80 }}><div className="spinner" /></div>
            : detail && (
              <>
                {/* ── Clinical Notes ── */}
                <section className="visit-section">
                  <p className="visit-section__title">Clinical Notes</p>
                  {!detail.notes.length
                    ? <p className="text-muted text-sm">No clinical notes recorded.</p>
                    : detail.notes.map(n => (
                      <div key={n.id} className="soap-block">
                        {n.clerking   && <p><strong>Clerking:</strong> {n.clerking}</p>}
                        {n.subjective && <p><strong>S:</strong> {n.subjective}</p>}
                        {n.objective  && <p><strong>O:</strong> {n.objective}</p>}
                        {n.assessment && <p><strong>A:</strong> {n.assessment}</p>}
                        {n.plan       && <p><strong>P:</strong> {n.plan}</p>}
                        {n.diagnosis  && <p><strong>Diagnosis:</strong> {n.diagnosis}</p>}
                        <p className="text-muted text-sm" style={{ marginTop: 6 }}>
                          {n.created_by_name} · {fmtDT(n.created_at)}
                        </p>
                      </div>
                    ))
                  }
                  {isDoctor && (
                    <AddArea label="Add Clinical Note">
                      <ClinicalNoteForm
                        visitId={visit.id} patientId={patientId}
                        onSaved={n => setDetail(p => ({ ...p, notes: [n, ...p.notes] }))} />
                    </AddArea>
                  )}
                </section>

                {/* ── Vitals ── */}
                <section className="visit-section">
                  <p className="visit-section__title">Vitals (this visit)</p>
                  {!detail.vitals.length
                    ? <p className="text-muted text-sm">No vitals recorded.</p>
                    : detail.vitals.map(v => (
                      <div key={v.id} className="vitals-row">
                        <span className="text-muted text-sm">{fmtDT(v.recorded_at)}</span>
                        {v.blood_pressure_systolic && <span>BP: {v.blood_pressure_systolic}/{v.blood_pressure_diastolic} mmHg</span>}
                        {v.temperature_celsius     && <span>Temp: {v.temperature_celsius}°C</span>}
                        {v.pulse_rate              && <span>Pulse: {v.pulse_rate} bpm</span>}
                        {v.respiratory_rate        && <span>RR: {v.respiratory_rate}/min</span>}
                        {v.spo2_percent            && <span>SpO2: {v.spo2_percent}%</span>}
                        {v.weight_kg               && <span>Wt: {v.weight_kg} kg</span>}
                        {v.height_cm               && <span>Ht: {v.height_cm} cm</span>}
                      </div>
                    ))
                  }
                  {isDoctorOrNurse && (
                    <AddArea label="Record Vitals">
                      <VitalsForm
                        visitId={visit.id} patientId={patientId}
                        onSaved={v => setDetail(p => ({ ...p, vitals: [v, ...p.vitals] }))} />
                    </AddArea>
                  )}
                </section>

                {/* ── Prescriptions ── */}
                <section className="visit-section">
                  <p className="visit-section__title">Prescriptions</p>
                  <PrescriptionList prescriptions={detail.presc} />
                  {isDoctor && (
                    <AddArea label="Add Prescription">
                      <PrescriptionForm
                        visitId={visit.id} patientId={patientId}
                        onSaved={rx => setDetail(p => ({ ...p, presc: [...p.presc, rx] }))} />
                    </AddArea>
                  )}
                </section>

                {/* ── Lab Requests ── */}
                <section className="visit-section">
                  <p className="visit-section__title">Lab Requests</p>
                  <LabRequestList
                    labs={detail.labs}
                    onLabsChange={labs => setDetail(p => ({ ...p, labs }))} />
                  {isDoctorOrNurse && (
                    <AddArea label="Request Lab Test">
                      <LabRequestForm
                        visitId={visit.id} patientId={patientId}
                        onSaved={lab => setDetail(p => ({ ...p, labs: [...p.labs, lab] }))} />
                    </AddArea>
                  )}
                </section>

                {/* ── Nursing Notes ── */}
                {canSeeNursing && (
                  <section className="visit-section">
                    <p className="visit-section__title">Nursing Notes</p>
                    <NursingNoteList notes={detail.nursing} />
                    {isNurse && (
                      <AddArea label="Add Nursing Note">
                        <NursingNoteForm
                          visitId={visit.id} patientId={patientId}
                          onSaved={n => setDetail(p => ({ ...p, nursing: [n, ...p.nursing] }))} />
                      </AddArea>
                    )}
                  </section>
                )}
              </>
            )
          }
        </div>
      )}
    </div>
  );
}

// ─── NewVisitModal ────────────────────────────────────────────────────────────
function NewVisitModal({ patientId, onClose, onCreated }) {
  const [form,    setForm]    = useState({ visit_type: '', attending_doctor_id: '' });
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users', { params: { role: 'doctor' } })
      .then(r => setDoctors(r.data.data))
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.visit_type) { toast.error('Select a visit type'); return; }
    setLoading(true);
    try {
      const res = await api.post('/visits', {
        patient_id:          patientId,
        visit_type:          form.visit_type,
        attending_doctor_id: form.attending_doctor_id || undefined,
      });
      toast.success('Visit created');
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to create visit');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-group">
        <label className="form-label">Visit Type <span className="text-danger">*</span></label>
        <select className="form-select" value={form.visit_type}
          onChange={e => setForm(p => ({ ...p, visit_type: e.target.value }))}>
          <option value="">Select…</option>
          {VISIT_TYPES.map(t => (
            <option key={t} value={t}>{t.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Attending Doctor (optional)</label>
        <select className="form-select" value={form.attending_doctor_id}
          onChange={e => setForm(p => ({ ...p, attending_doctor_id: e.target.value }))}>
          <option value="">Not assigned</option>
          {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
        </select>
      </div>
      <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button type="submit"  className="btn btn--primary"   disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Creating…</> : 'Create Visit'}
        </button>
      </div>
    </form>
  );
}

// ─── PatientDetailPage ────────────────────────────────────────────────────────
export default function PatientDetailPage() {
  const { patientId }  = useParams();
  const { user }       = useAuth();
  const navigate       = useNavigate();

  const [patient,      setPatient]      = useState(null);
  const [visits,       setVisits]       = useState([]);
  const [allVitals,    setAllVitals]    = useState([]);
  const [allMAR,       setAllMAR]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('visits');
  const [exporting,    setExporting]    = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showEdit,     setShowEdit]     = useState(false);
  const [showNewVisit, setShowNewVisit] = useState(false);

  const canWrite  = CAN_WRITE.includes(user?.role);
  const canExport = CAN_EXPORT.includes(user?.role);
  const canSeeMAR = ['nurse', 'doctor', 'admin', 'super_admin'].includes(user?.role);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [pRes, vRes] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/visits/patient/${patientId}`),
        ]);
        setPatient(pRes.data.data);
        setVisits(vRes.data.data);
      } catch {
        toast.error('Failed to load patient');
        navigate('/patients');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId, navigate]);

  useEffect(() => {
    if (tab === 'vitals' && !allVitals.length) {
      api.get(`/vitals/patient/${patientId}`)
        .then(r => setAllVitals(r.data.data))
        .catch(() => toast.error('Failed to load vitals history'));
    }
    if (tab === 'mar' && !allMAR.length) {
      api.get(`/nursing/mar/patient/${patientId}`)
        .then(r => setAllMAR(r.data.data ?? []))
        .catch(() => toast.error('Failed to load medication record'));
    }
  }, [tab, patientId, allVitals.length, allMAR.length]);

  async function handleDeactivate() {
    if (!window.confirm(
      `Deactivate ${patient.full_name}?\n\nThis patient will be hidden from the patient list. All existing records are preserved.`
    )) return;
    setDeactivating(true);
    try {
      await api.patch(`/patients/${patient.id}/deactivate`);
      toast.success('Patient deactivated');
      navigate('/patients');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to deactivate patient');
    } finally {
      setDeactivating(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res  = await api.get(`/export/patient/${patientId}`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href  = url;
      link.download = `patient_${patient.carri_health_id}_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>;
  if (!patient) return null;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-12">
          <button className="btn btn--secondary btn--sm" onClick={() => navigate('/patients')}>
            ← Back
          </button>
          <h1 className="page-title">{patient.full_name}</h1>
        </div>
        <div className="flex gap-8">
          {canWrite && (
            <button className="btn btn--secondary" onClick={() => setShowEdit(true)}>Edit Patient</button>
          )}
          {canWrite && (
            <button className="btn btn--primary" onClick={() => setShowNewVisit(true)}>+ New Visit</button>
          )}
          {canExport && (
            <button className="btn btn--secondary" onClick={handleExport} disabled={exporting}>
              {exporting
                ? <><span className="btn-spinner" style={{ borderTopColor: '#374151' }} /> Exporting…</>
                : '⬇ Export PDF'}
            </button>
          )}
          {['admin', 'super_admin'].includes(user?.role) && patient?.is_active && (
            <button className="btn btn--danger" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? <><span className="btn-spinner" style={{ borderTopColor: '#fff' }} /> Deactivating…</> : 'Deactivate Patient'}
            </button>
          )}
        </div>
      </div>

      {/* Patient info card */}
      {!patient.is_active && (
        <div className="deactivated-banner">
          Patient deactivated
          {patient.deactivated_at ? ` on ${fmt(patient.deactivated_at)}` : ''}
        </div>
      )}
      <div className="card mb-16">
        <div className="grid-3" style={{ marginBottom: 12 }}>
          <div>
            <p className="text-muted text-sm">Carri Health ID</p>
            <p className="font-bold"><code className="cid">{patient.carri_health_id}</code></p>
          </div>
          <div>
            <p className="text-muted text-sm">Date of Birth</p>
            <p>{fmt(patient.date_of_birth)} (Age {age(patient.date_of_birth)})</p>
          </div>
          <div>
            <p className="text-muted text-sm">Sex</p>
            <p style={{ textTransform: 'capitalize' }}>{patient.sex}</p>
          </div>
          <div>
            <p className="text-muted text-sm">Blood Group</p>
            <p><span className="badge badge--blue">{patient.blood_group}</span></p>
          </div>
          <div><p className="text-muted text-sm">Phone</p><p>{patient.phone || '—'}</p></div>
          <div><p className="text-muted text-sm">State of Origin</p><p>{patient.state_of_origin || '—'}</p></div>
          <div style={{ gridColumn: '1/-1' }}>
            <p className="text-muted text-sm">Address</p><p>{patient.address || '—'}</p>
          </div>
          <div><p className="text-muted text-sm">Next of Kin</p><p>{patient.next_of_kin_name || '—'}</p></div>
          <div><p className="text-muted text-sm">Next of Kin Contact</p><p>{patient.next_of_kin_contact || '—'}</p></div>
          {patient.pre_existing_conditions && (
            <div style={{ gridColumn: '1/-1' }}>
              <p className="text-muted text-sm">Pre-existing Conditions</p>
              <p>{patient.pre_existing_conditions}</p>
            </div>
          )}
        </div>
        {patient.known_allergies && (
          <div className="allergy-alert">
            <strong>⚠ Known Allergies:</strong> {patient.known_allergies}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs mb-16">
        <button className={`tab ${tab === 'visits' ? 'tab--active' : ''}`} onClick={() => setTab('visits')}>
          Visits ({visits.length})
        </button>
        <button className={`tab ${tab === 'vitals' ? 'tab--active' : ''}`} onClick={() => setTab('vitals')}>
          Vitals History
        </button>
        {canSeeMAR && (
          <button className={`tab ${tab === 'mar' ? 'tab--active' : ''}`} onClick={() => setTab('mar')}>
            Medication Record
          </button>
        )}
      </div>

      {/* Visits tab */}
      {tab === 'visits' && (
        <div>
          {!visits.length
            ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                No visits recorded yet.
              </div>
            )
            : visits.map(v => (
              <VisitRow key={v.id} visit={v} patientId={patient.id} />
            ))
          }
        </div>
      )}

      {/* Vitals history tab */}
      {tab === 'vitals' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>BP</th><th>Temp</th><th>Pulse</th>
                  <th>RR</th><th>SpO2</th><th>Weight</th><th>Height</th>
                </tr>
              </thead>
              <tbody>
                {!allVitals.length
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No vitals recorded.</td></tr>
                  : allVitals.map(v => (
                    <tr key={v.id}>
                      <td className="text-sm">{fmtDT(v.recorded_at)}</td>
                      <td>{v.blood_pressure_systolic ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : '—'}</td>
                      <td>{v.temperature_celsius ?? '—'}</td>
                      <td>{v.pulse_rate          ?? '—'}</td>
                      <td>{v.respiratory_rate    ?? '—'}</td>
                      <td>{v.spo2_percent        ?? '—'}</td>
                      <td>{v.weight_kg           ?? '—'}</td>
                      <td>{v.height_cm           ?? '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MAR tab */}
      {tab === 'mar' && (
        <div>
          {user?.role === 'nurse' && (
            <div className="card mb-16">
              <p className="card__title">Record Medication Administration</p>
              <MARForm
                patientId={patient.id}
                onSaved={rec => setAllMAR(prev => [rec, ...prev])} />
            </div>
          )}
          <div className="card">
            <p className="card__title">Medication Administration Record</p>
            <MARList records={allMAR} />
          </div>
        </div>
      )}

      {/* Modals */}
      {showEdit && (
        <Modal title="Edit Patient" onClose={() => setShowEdit(false)} wide>
          <PatientForm
            patient={patient}
            onSuccess={updated => { setPatient(updated); setShowEdit(false); }}
            onCancel={() => setShowEdit(false)} />
        </Modal>
      )}

      {showNewVisit && (
        <Modal title="New Visit" onClose={() => setShowNewVisit(false)}>
          <NewVisitModal
            patientId={patient.id}
            onClose={() => setShowNewVisit(false)}
            onCreated={v => setVisits(prev => [v, ...prev])} />
        </Modal>
      )}
    </div>
  );
}

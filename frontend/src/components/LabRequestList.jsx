import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const URGENCY_BADGE = { routine: 'badge--gray', urgent: 'badge--yellow', stat: 'badge--red' };
const STATUS_BADGE  = { pending: 'badge--yellow', received: 'badge--blue', reviewed: 'badge--green' };

function fmtDT(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function UploadPanel({ labId, onDone }) {
  const [file,    setFile]    = useState(null);
  const [text,    setText]    = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!file && !text.trim()) {
      toast.error('Provide a PDF file or a text result (or both)');
      return;
    }
    const fd = new FormData();
    if (file)        fd.append('result_file', file);
    if (text.trim()) fd.append('result_text', text);

    setLoading(true);
    try {
      // Do NOT set Content-Type manually — axios sets it with the correct
      // multipart boundary automatically when the body is FormData.
      const res = await api.patch(`/lab/${labId}/upload`, fd);
      toast.success('Result uploaded');
      onDone(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="lab-upload-panel">
      <div className="form-group">
        <label className="form-label">PDF Result File <span className="text-muted text-sm">(optional)</span></label>
        <input type="file" accept="application/pdf" className="form-input"
          style={{ padding: '6px 10px' }}
          onChange={e => setFile(e.target.files[0] ?? null)} />
      </div>
      <div className="form-group">
        <label className="form-label">Text Result <span className="text-muted text-sm">(optional)</span></label>
        <textarea className="form-textarea" rows={3}
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Enter structured result values…" />
      </div>
      <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--secondary btn--sm"
          onClick={() => onDone(null)}>Cancel</button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Uploading…</> : 'Upload Result'}
        </button>
      </div>
    </form>
  );
}

export default function LabRequestList({ labs, onLabsChange }) {
  const { user }      = useAuth();
  const [uploadingId, setUploadingId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);

  if (!labs?.length) return <p className="text-muted text-sm">No lab requests for this visit.</p>;

  async function markReviewed(lab) {
    setReviewingId(lab.id);
    try {
      const res = await api.patch(`/lab/${lab.id}/review`);
      toast.success('Marked as reviewed');
      onLabsChange(labs.map(l => l.id === lab.id ? res.data.data : l));
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to mark reviewed');
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="lab-list">
      {labs.map(lab => (
        <div key={lab.id} className={`lab-card ${lab.status === 'reviewed' ? 'lab-card--reviewed' : ''}`}>
          <div className="lab-card__row">
            <div className="lab-card__info">
              <span className="lab-card__test">{lab.test_name}</span>
              <div className="flex items-center gap-8" style={{ marginTop: 4 }}>
                <span className={`badge ${URGENCY_BADGE[lab.urgency] ?? 'badge--gray'}`}>{lab.urgency}</span>
                <span className={`badge ${STATUS_BADGE[lab.status]  ?? 'badge--gray'}`}>{lab.status}</span>
              </div>
            </div>

            <div className="lab-card__meta">
              <span className="text-muted text-sm">{lab.requesting_clinician_name}</span>
              <span className="text-muted text-sm">{fmtDT(lab.created_at)}</span>
            </div>

            <div className="lab-card__actions">
              {user?.role === 'lab' && ['pending', 'received'].includes(lab.status) && (
                <button className="btn btn--secondary btn--sm"
                  onClick={() => setUploadingId(uploadingId === lab.id ? null : lab.id)}>
                  {uploadingId === lab.id ? 'Cancel' : '⬆ Upload Result'}
                </button>
              )}
              {user?.role === 'doctor' && lab.status === 'received' && (
                <button className="btn btn--primary btn--sm"
                  disabled={reviewingId === lab.id}
                  onClick={() => markReviewed(lab)}>
                  {reviewingId === lab.id
                    ? <><span className="btn-spinner" /> …</>
                    : '✓ Mark Reviewed'}
                </button>
              )}
            </div>
          </div>

          {lab.result_text && (
            <div className="lab-result-text">{lab.result_text}</div>
          )}

          {uploadingId === lab.id && (
            <UploadPanel
              labId={lab.id}
              onDone={updated => {
                setUploadingId(null);
                if (updated) onLabsChange(labs.map(l => l.id === lab.id ? updated : l));
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

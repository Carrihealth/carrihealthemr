const SHIFT_BADGE = { morning: 'badge--blue', afternoon: 'badge--yellow', night: 'badge--gray' };

function fmtDT(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function NursingNoteList({ notes }) {
  if (!notes?.length) return <p className="text-muted text-sm">No nursing notes recorded.</p>;

  return (
    <div className="nursing-list">
      {notes.map(n => (
        <div key={n.id} className="nursing-card">
          <div className="nursing-card__header">
            <span className={`badge ${SHIFT_BADGE[n.shift_label] ?? 'badge--gray'}`}>
              {n.shift_label}
            </span>
            <span className="text-muted text-sm">{fmtDT(n.created_at)}</span>
            <span className="text-muted text-sm">{n.nurse_name}</span>
          </div>
          <p className="nursing-card__text">{n.note_text}</p>
        </div>
      ))}
    </div>
  );
}

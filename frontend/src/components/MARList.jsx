const SHIFT_BADGE = { morning: 'badge--blue', afternoon: 'badge--yellow', night: 'badge--gray' };

function fmtDT(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function MARList({ records }) {
  if (!records?.length) {
    return (
      <p className="text-muted text-sm" style={{ padding: '20px 0' }}>
        No medication administrations recorded yet.
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Drug</th>
            <th>Dose Given</th>
            <th>Administered By</th>
            <th>Shift</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id}>
              <td className="text-sm">{fmtDT(r.administered_at)}</td>
              <td><strong>{r.drug_name}</strong></td>
              <td>{r.dose_given || '—'}</td>
              <td>{r.nurse_name}</td>
              <td>
                <span className={`badge ${SHIFT_BADGE[r.shift_label] ?? 'badge--gray'}`}>
                  {r.shift_label}
                </span>
              </td>
              <td className="text-sm" style={{ color: '#6b7280' }}>{r.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrescriptionList({ prescriptions }) {
  if (!prescriptions?.length) {
    return <p className="text-muted text-sm">No prescriptions for this visit.</p>;
  }

  return (
    <div className="rx-list">
      {prescriptions.map(rx => (
        <div key={rx.id} className={`rx-card ${rx.allergy_conflict_detected ? 'rx-card--conflict' : ''}`}>
          <div className="rx-card__header">
            <div className="flex items-center gap-8">
              <span className="rx-card__drug">{rx.drug_name}</span>
              {rx.allergy_conflict_detected && (
                <span className="badge badge--red">⚠ Allergy Alert</span>
              )}
            </div>
            <span className="text-muted text-sm">Dr. {rx.prescribing_doctor_name}</span>
          </div>

          {rx.allergy_conflict_detected && (
            <p className="rx-card__conflict-detail">{rx.allergy_conflict_detail}</p>
          )}

          <div className="rx-card__details">
            <div className="rx-detail"><span className="rx-detail__label">Dosage</span><span>{rx.dosage}</span></div>
            <div className="rx-detail"><span className="rx-detail__label">Frequency</span><span>{rx.frequency}</span></div>
            <div className="rx-detail"><span className="rx-detail__label">Duration</span><span>{rx.duration}</span></div>
            <div className="rx-detail"><span className="rx-detail__label">Route</span><span style={{ textTransform: 'capitalize' }}>{rx.route_of_administration}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

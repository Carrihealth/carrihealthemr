const PDFDocument = require('pdfkit');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

// ─── helpers ──────────────────────────────────────────────────────────────────

function calculateAge(dob) {
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function sectionTitle(doc, title) {
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a2e').text(title);
  doc
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9).fillColor('#000000');
}

function labelValue(doc, label, value, redValue = false) {
  const x = doc.page.margins.left;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555').text(label + ': ', x, doc.y, { continued: true });
  if (redValue && value && value !== 'None' && value !== 'N/A') {
    doc.font('Helvetica').fillColor('#cc0000').text(value);
  } else {
    doc.font('Helvetica').fillColor('#000000').text(value || 'N/A');
  }
}

function drawFooters(doc, exportingUser) {
  const range = doc.bufferedPageRange();
  const total = range.count;

  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);

    const bottom  = doc.page.height - doc.page.margins.bottom + 10;
    const left    = doc.page.margins.left;
    const right   = doc.page.width - doc.page.margins.right;

    doc.moveTo(left, bottom - 8).lineTo(right, bottom - 8)
      .strokeColor('#cccccc').lineWidth(0.5).stroke();

    doc.fontSize(7).font('Helvetica').fillColor('#888888');
    doc.text(`Page ${i + 1} of ${total}`, left, bottom, { width: 100, align: 'left' });
    doc.text('CONFIDENTIAL — Carri Health EMR', left, bottom, { align: 'center' });
    doc.text(
      `Exported by: ${exportingUser.full_name} (${exportingUser.role})`,
      left, bottom, { width: right - left, align: 'right' }
    );
  }
}

// ─── data fetching ────────────────────────────────────────────────────────────

async function fetchAllPatientData(patientId, hospitalId) {
  const [[patient]] = await pool.query(
    'SELECT * FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );

  const [[hospital]] = await pool.query(
    'SELECT name FROM hospitals WHERE id = ?', [hospitalId]
  );

  const [visits] = await pool.query(
    `SELECT v.*, u.full_name AS attending_doctor_name
     FROM visits v
     LEFT JOIN users u ON u.id = v.attending_doctor_id
     WHERE v.patient_id = ? AND v.hospital_id = ?
     ORDER BY v.visit_date DESC
     LIMIT 10`,
    [patientId, hospitalId]
  );

  // Fetch supporting data for each visit in parallel
  const visitData = await Promise.all(visits.map(async (visit) => {
    const [[latestVitals]] = await pool.query(
      `SELECT * FROM vitals WHERE visit_id = ? AND hospital_id = ?
       ORDER BY recorded_at DESC LIMIT 1`,
      [visit.id, hospitalId]
    );

    const [clinicalNotes] = await pool.query(
      'SELECT * FROM clinical_notes WHERE visit_id = ? AND hospital_id = ? ORDER BY created_at ASC',
      [visit.id, hospitalId]
    );

    const [prescriptions] = await pool.query(
      `SELECT p.*, u.full_name AS doctor_name
       FROM prescriptions p
       JOIN users u ON u.id = p.prescribing_doctor_id
       WHERE p.visit_id = ? AND p.hospital_id = ?
       ORDER BY p.created_at ASC`,
      [visit.id, hospitalId]
    );

    const [labRequests] = await pool.query(
      'SELECT test_name, urgency, status FROM lab_requests WHERE visit_id = ? AND hospital_id = ?',
      [visit.id, hospitalId]
    );

    const [[{ nursingCount }]] = await pool.query(
      'SELECT COUNT(*) AS nursingCount FROM nursing_notes WHERE visit_id = ? AND hospital_id = ?',
      [visit.id, hospitalId]
    );

    return { visit, latestVitals, clinicalNotes, prescriptions, labRequests, nursingCount };
  }));

  return { patient, hospital, visitData };
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

function buildPDF(doc, patient, hospital, visitData, exportingUser) {
  const margin = doc.page.margins.left;

  // ── PAGE HEADER ──────────────────────────────────────────────────────────────
  doc
    .fontSize(14).font('Helvetica-Bold').fillColor('#1a1a2e')
    .text(hospital.name.toUpperCase(), { align: 'center' });

  doc
    .fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50')
    .text('PATIENT MEDICAL RECORD', { align: 'center' });

  doc
    .fontSize(8).font('Helvetica').fillColor('#888888')
    .text(`Generated: ${formatDateTime(new Date())}`, { align: 'center' });

  doc.moveDown(0.3);
  doc
    .moveTo(margin, doc.y)
    .lineTo(doc.page.width - margin, doc.y)
    .strokeColor('#1a1a2e').lineWidth(1.5).stroke();
  doc.moveDown(0.8);

  // ── SECTION 1: PATIENT INFORMATION ───────────────────────────────────────────
  sectionTitle(doc, 'SECTION 1 — PATIENT INFORMATION');

  labelValue(doc, 'Full Name',        patient.full_name);
  labelValue(doc, 'Carri Health ID',  patient.carri_health_id);
  labelValue(doc, 'Date of Birth',    `${formatDate(patient.date_of_birth)}  (Age: ${calculateAge(patient.date_of_birth)} years)`);
  labelValue(doc, 'Sex',              patient.sex?.charAt(0).toUpperCase() + patient.sex?.slice(1));
  labelValue(doc, 'Blood Group',      patient.blood_group);
  labelValue(doc, 'Phone',            patient.phone);
  labelValue(doc, 'Address',          patient.address);
  labelValue(doc, 'State of Origin',  patient.state_of_origin);
  labelValue(doc, 'Next of Kin',      patient.next_of_kin_name);
  labelValue(doc, 'Next of Kin Contact', patient.next_of_kin_contact);
  labelValue(doc, 'Known Allergies',  patient.known_allergies || 'None', !!patient.known_allergies);
  labelValue(doc, 'Pre-existing Conditions', patient.pre_existing_conditions || 'None');

  // ── SECTION 2: VISIT HISTORY ──────────────────────────────────────────────────
  sectionTitle(doc, `SECTION 2 — VISIT HISTORY  (last ${visitData.length} visit${visitData.length !== 1 ? 's' : ''})`);

  if (!visitData.length) {
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#888888').text('No visits on record.');
  }

  visitData.forEach(({ visit, latestVitals, clinicalNotes, prescriptions, labRequests, nursingCount }, idx) => {
    // Visit block separator
    doc.moveDown(0.4);
    doc
      .fontSize(10).font('Helvetica-Bold').fillColor('#2c3e50')
      .text(`Visit ${idx + 1}:  ${visit.visit_type?.replace('_', ' ').toUpperCase()}  —  ${formatDateTime(visit.visit_date)}`);
    doc.font('Helvetica').fontSize(9).fillColor('#000000');

    labelValue(doc, 'Attending Doctor', visit.attending_doctor_name || 'Not assigned');
    labelValue(doc, 'Status', visit.is_closed ? 'Closed' : 'Open');

    // Vitals
    if (latestVitals) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#444444').text('Latest Vitals:');
      doc.font('Helvetica').fillColor('#000000');

      const bpVal = (latestVitals.blood_pressure_systolic && latestVitals.blood_pressure_diastolic)
        ? `${latestVitals.blood_pressure_systolic}/${latestVitals.blood_pressure_diastolic} mmHg`
        : null;

      const vitalsLine = [
        bpVal                         ? `BP: ${bpVal}`                                     : null,
        latestVitals.temperature_celsius ? `Temp: ${latestVitals.temperature_celsius} °C`  : null,
        latestVitals.pulse_rate          ? `Pulse: ${latestVitals.pulse_rate} bpm`          : null,
        latestVitals.respiratory_rate    ? `RR: ${latestVitals.respiratory_rate} /min`      : null,
        latestVitals.spo2_percent        ? `SpO2: ${latestVitals.spo2_percent}%`            : null,
        latestVitals.weight_kg           ? `Wt: ${latestVitals.weight_kg} kg`               : null,
        latestVitals.height_cm           ? `Ht: ${latestVitals.height_cm} cm`               : null,
      ].filter(Boolean).join('   ');

      doc.fontSize(9).text(vitalsLine || 'No vitals data', { indent: 16 });
    } else {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#aaaaaa').text('No vitals recorded for this visit.', { indent: 16 });
      doc.font('Helvetica').fillColor('#000000');
    }

    // Clinical Notes
    if (clinicalNotes.length) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#444444').text('Clinical Notes:');
      doc.font('Helvetica').fillColor('#000000');

      clinicalNotes.forEach((note) => {
        const soapFields = [
          note.clerking   ? ['Clerking',   note.clerking]   : null,
          note.subjective ? ['Subjective', note.subjective] : null,
          note.objective  ? ['Objective',  note.objective]  : null,
          note.assessment ? ['Assessment', note.assessment] : null,
          note.plan       ? ['Plan',       note.plan]       : null,
          note.diagnosis  ? ['Diagnosis',  note.diagnosis]  : null,
        ].filter(Boolean);

        soapFields.forEach(([label, value]) => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#666666')
            .text(`${label}: `, { indent: 16, continued: true });
          doc.font('Helvetica').fillColor('#000000').text(value);
        });
      });
    } else {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#aaaaaa')
        .text('No clinical notes for this visit.', { indent: 16 });
      doc.font('Helvetica').fillColor('#000000');
    }

    // Prescriptions
    if (prescriptions.length) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#444444').text('Prescriptions:');
      prescriptions.forEach((rx) => {
        const rxLine = `${rx.drug_name}  |  ${rx.dosage}  |  ${rx.frequency}  |  ${rx.duration}  |  Route: ${rx.route_of_administration}`;
        if (rx.allergy_conflict_detected) {
          doc.fontSize(9).font('Helvetica').fillColor('#cc0000')
            .text(`⚠  ${rxLine}`, { indent: 16 });
          doc.fontSize(8).font('Helvetica-Oblique').fillColor('#cc0000')
            .text(`   Allergy alert: ${rx.allergy_conflict_detail}`, { indent: 24 });
          doc.fillColor('#000000');
        } else {
          doc.fontSize(9).font('Helvetica').fillColor('#000000')
            .text(`•  ${rxLine}`, { indent: 16 });
        }
      });
    } else {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#aaaaaa')
        .text('No prescriptions for this visit.', { indent: 16 });
      doc.font('Helvetica').fillColor('#000000');
    }

    // Lab Requests
    if (labRequests.length) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#444444').text('Lab Requests:');
      labRequests.forEach((lr) => {
        doc.fontSize(9).font('Helvetica').fillColor('#000000')
          .text(`•  ${lr.test_name}  [${lr.urgency.toUpperCase()}]  —  Status: ${lr.status}`, { indent: 16 });
      });
    }

    // Nursing Notes Count
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').fillColor('#555555')
      .text(`Nursing notes on file: ${nursingCount}`);

    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y)
      .lineTo(doc.page.width - margin, doc.y)
      .strokeColor('#eeeeee').lineWidth(0.5).stroke();
  });
}

// ─── exportPatientRecord ──────────────────────────────────────────────────────

async function exportPatientRecord(req, res) {
  const { hospitalId, userId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const { patient, hospital, visitData } = await fetchAllPatientData(patientId, hospitalId);

  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  // Fetch exporting user's full name and role
  const [[exportingUser]] = await pool.query(
    `SELECT u.full_name, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.hospital_id = ?`,
    [userId, hospitalId]
  );

  await logAction(userId, hospitalId, 'record_export', 'patient_record', patientId, req);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename  = `patient_${patient.carri_health_id}_${dateStamp}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size:        'A4',
    margin:      50,
    bufferPages: true,   // required for footer post-processing
    info: {
      Title:   `Patient Record — ${patient.full_name}`,
      Author:  `${exportingUser.full_name} via Carri Health EMR`,
    },
  });

  doc.pipe(res);

  buildPDF(doc, patient, hospital, visitData, exportingUser);

  // Add footers to every buffered page before flushing
  drawFooters(doc, exportingUser);

  doc.flushPages();
  doc.end();
}

module.exports = { exportPatientRecord };

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

// Build the ordered 12-month label array ending at the current month
function buildLast12MonthLabels() {
  const months = [];
  const now    = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
    });
  }
  return months;
}

async function getDashboardStats(req, res) {
  const { hospitalId, userId } = req.user;

  try {
    const [
      [totalPatientsRows],
      [totalPatientsMonthRows],
      [totalVisitsRows],
      [totalVisitsMonthRows],
      [visitTypeRows],
      [diagnosisRows],
      [activePrescriptionsRows],
      [pendingLabRows],
      [trendRows],
    ] = await Promise.all([

      // 1. Total patients all time
      pool.query(
        'SELECT COUNT(*) AS count FROM patients WHERE hospital_id = ?',
        [hospitalId]
      ),

      // 2. Total patients this month
      pool.query(
        `SELECT COUNT(*) AS count FROM patients
         WHERE hospital_id = ?
           AND MONTH(created_at) = MONTH(NOW())
           AND YEAR(created_at)  = YEAR(NOW())`,
        [hospitalId]
      ),

      // 3. Total visits all time
      pool.query(
        'SELECT COUNT(*) AS count FROM visits WHERE hospital_id = ?',
        [hospitalId]
      ),

      // 4. Total visits this month
      pool.query(
        `SELECT COUNT(*) AS count FROM visits
         WHERE hospital_id = ?
           AND MONTH(visit_date) = MONTH(NOW())
           AND YEAR(visit_date)  = YEAR(NOW())`,
        [hospitalId]
      ),

      // 5. Visit type breakdown
      pool.query(
        `SELECT visit_type, COUNT(*) AS count
         FROM visits
         WHERE hospital_id = ?
         GROUP BY visit_type
         ORDER BY count DESC`,
        [hospitalId]
      ),

      // 6. Diagnosis text for JS-side splitting & counting
      pool.query(
        `SELECT diagnosis FROM clinical_notes
         WHERE hospital_id = ?
           AND diagnosis IS NOT NULL
           AND diagnosis != ''`,
        [hospitalId]
      ),

      // 7. Active prescriptions (last 7 days)
      pool.query(
        `SELECT COUNT(*) AS count FROM prescriptions
         WHERE hospital_id = ?
           AND created_at >= NOW() - INTERVAL 7 DAY`,
        [hospitalId]
      ),

      // 8. Pending lab results
      pool.query(
        `SELECT COUNT(*) AS count FROM lab_requests
         WHERE hospital_id = ? AND status = 'pending'`,
        [hospitalId]
      ),

      // 9. Registration trend — last 12 months
      pool.query(
        `SELECT YEAR(created_at) AS year, MONTH(created_at) AS month, COUNT(*) AS count
         FROM patients
         WHERE hospital_id = ?
           AND created_at >= DATE_FORMAT(NOW() - INTERVAL 11 MONTH, '%Y-%m-01')
         GROUP BY YEAR(created_at), MONTH(created_at)`,
        [hospitalId]
      ),
    ]);

    // Top diagnoses — split comma-delimited strings, count via Map
    const diagnosisMap = new Map();
    for (const row of diagnosisRows) {
      const terms = row.diagnosis
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      for (const term of terms) {
        const key = term.toLowerCase();
        diagnosisMap.set(key, (diagnosisMap.get(key) || 0) + 1);
      }
    }
    const topDiagnoses = [...diagnosisMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([diagnosis, count]) => ({ diagnosis, count }));

    // Registration trend — zero-fill missing months
    const trendIndex = new Map(
      trendRows.map(r => [`${r.year}-${r.month}`, Number(r.count)])
    );
    const registrationTrend = buildLast12MonthLabels().map(({ year, month, label }) => ({
      month: label,
      count: trendIndex.get(`${year}-${month}`) ?? 0,
    }));

    await logAction(userId, hospitalId, 'record_view', 'dashboard', null, req);

    return res.json({
      success: true,
      data: {
        totalPatientsAllTime:     Number(totalPatientsRows[0].count),
        totalPatientsThisMonth:   Number(totalPatientsMonthRows[0].count),
        totalVisitsAllTime:       Number(totalVisitsRows[0].count),
        totalVisitsThisMonth:     Number(totalVisitsMonthRows[0].count),
        visitTypeBreakdown:       visitTypeRows.map(r => ({ visit_type: r.visit_type, count: Number(r.count) })),
        topDiagnoses,
        activePrescriptionsCount: Number(activePrescriptionsRows[0].count),
        pendingLabResultsCount:   Number(pendingLabRows[0].count),
        registrationTrend,
      },
    });

  } catch (err) {
    console.error('[reports] getDashboardStats error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── getReportsByRange ────────────────────────────────────────────────────────

async function getReportsByRange(req, res) {
  const { hospitalId } = req.user;
  const { date_from, date_to } = req.query;

  function buildDateRange(col) {
    const clauses = [];
    const values  = [];
    if (date_from) { clauses.push(`${col} >= ?`);                              values.push(date_from); }
    if (date_to)   { clauses.push(`${col} <= DATE_ADD(?, INTERVAL 1 DAY)`);    values.push(date_to);   }
    return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', values };
  }

  const created = buildDateRange('created_at');
  const visited = buildDateRange('visit_date');

  try {
    const [
      [[patientsRow]],
      [visitRows],
      [[prescRow]],
      [labRows],
      [diagRows],
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS count FROM patients
         WHERE hospital_id = ? AND is_active = true${created.sql}`,
        [hospitalId, ...created.values]
      ),
      pool.query(
        `SELECT visit_type, COUNT(*) AS count FROM visits
         WHERE hospital_id = ?${visited.sql}
         GROUP BY visit_type ORDER BY count DESC`,
        [hospitalId, ...visited.values]
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM prescriptions
         WHERE hospital_id = ?${created.sql}`,
        [hospitalId, ...created.values]
      ),
      pool.query(
        `SELECT status, COUNT(*) AS count FROM lab_requests
         WHERE hospital_id = ?${created.sql}
         GROUP BY status`,
        [hospitalId, ...created.values]
      ),
      pool.query(
        `SELECT diagnosis FROM clinical_notes
         WHERE hospital_id = ? AND diagnosis IS NOT NULL AND diagnosis != ''${created.sql}`,
        [hospitalId, ...created.values]
      ),
    ]);

    // Top diagnoses processing
    const dMap = new Map();
    for (const r of diagRows) {
      r.diagnosis.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
        const k = t.toLowerCase();
        dMap.set(k, (dMap.get(k) || 0) + 1);
      });
    }
    const topDiagnoses = [...dMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([diagnosis, count]) => ({ diagnosis, count }));

    const labByStatus = Object.fromEntries(labRows.map(r => [r.status, Number(r.count)]));

    return res.json({
      success: true,
      data: {
        period:              { date_from: date_from || null, date_to: date_to || null },
        patientsRegistered:  Number(patientsRow.count),
        totalVisits:         visitRows.reduce((s, r) => s + Number(r.count), 0),
        visitTypeBreakdown:  visitRows.map(r => ({ visit_type: r.visit_type, count: Number(r.count) })),
        prescriptionsWritten: Number(prescRow.count),
        labRequests: {
          pending:  labByStatus.pending  ?? 0,
          received: labByStatus.received ?? 0,
          reviewed: labByStatus.reviewed ?? 0,
          total:    Object.values(labByStatus).reduce((s, n) => s + n, 0),
        },
        topDiagnoses,
      },
    });
  } catch (err) {
    console.error('[reports] getReportsByRange error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── exportReport ─────────────────────────────────────────────────────────────

async function exportReport(req, res) {
  const { hospitalId, userId } = req.user;
  const { date_from, date_to } = req.query;

  function buildDateRange(col) {
    const clauses = [];
    const values  = [];
    if (date_from) { clauses.push(`${col} >= ?`);                              values.push(date_from); }
    if (date_to)   { clauses.push(`${col} <= DATE_ADD(?, INTERVAL 1 DAY)`);    values.push(date_to);   }
    return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', values };
  }

  try {
    const [[hospital]] = await pool.query(
      'SELECT hospital_code FROM hospitals WHERE id = ?', [hospitalId]
    );

    const patCreated = buildDateRange('patients.created_at');
    const prCreated  = buildDateRange('pr.created_at');
    const lrCreated  = buildDateRange('lr.created_at');
    const visited    = buildDateRange('v.visit_date');

    const [[patients], [visits], [prescriptions], [labRequests]] = await Promise.all([
      pool.query(
        `SELECT carri_health_id, full_name, sex, date_of_birth, blood_group, phone, created_at
         FROM patients WHERE hospital_id = ?${patCreated.sql} ORDER BY created_at DESC`,
        [hospitalId, ...patCreated.values]
      ),
      pool.query(
        `SELECT v.visit_type, v.visit_date, p.full_name AS patient_name, p.carri_health_id
         FROM visits v JOIN patients p ON p.id = v.patient_id
         WHERE v.hospital_id = ?${visited.sql} ORDER BY v.visit_date DESC`,
        [hospitalId, ...visited.values]
      ),
      pool.query(
        `SELECT pr.drug_name, pr.dosage, pr.frequency, pr.duration,
                pr.route_of_administration, pr.created_at, p.full_name AS patient_name
         FROM prescriptions pr JOIN patients p ON p.id = pr.patient_id
         WHERE pr.hospital_id = ?${prCreated.sql} ORDER BY pr.created_at DESC`,
        [hospitalId, ...prCreated.values]
      ),
      pool.query(
        `SELECT lr.test_name, lr.urgency, lr.status, lr.created_at, p.full_name AS patient_name
         FROM lab_requests lr JOIN patients p ON p.id = lr.patient_id
         WHERE lr.hospital_id = ?${lrCreated.sql} ORDER BY lr.created_at DESC`,
        [hospitalId, ...lrCreated.values]
      ),
    ]);

    await logAction(userId, hospitalId, 'record_export', 'report', null, req);

    const periodStr = [date_from, date_to].filter(Boolean).join('_to_') || 'all_time';
    const filename  = `report_${hospital.hospital_code}_${periodStr}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    function csvLine(...fields) {
      return fields.map(f => {
        const s = String(f ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',') + '\n';
    }
    function isoDate(v) { return v ? new Date(v).toISOString().slice(0, 10) : ''; }

    res.write('PATIENTS\n');
    res.write(csvLine('CID', 'Full Name', 'Sex', 'Date of Birth', 'Blood Group', 'Phone', 'Registered'));
    for (const p of patients) {
      res.write(csvLine(p.carri_health_id, p.full_name, p.sex, isoDate(p.date_of_birth), p.blood_group, p.phone, isoDate(p.created_at)));
    }

    res.write('\nVISITS\n');
    res.write(csvLine('Visit Type', 'Visit Date', 'Patient Name', 'CID'));
    for (const v of visits) {
      res.write(csvLine(v.visit_type, isoDate(v.visit_date), v.patient_name, v.carri_health_id));
    }

    res.write('\nPRESCRIPTIONS\n');
    res.write(csvLine('Drug', 'Dosage', 'Frequency', 'Duration', 'Route', 'Date', 'Patient'));
    for (const p of prescriptions) {
      res.write(csvLine(p.drug_name, p.dosage, p.frequency, p.duration, p.route_of_administration, isoDate(p.created_at), p.patient_name));
    }

    res.write('\nLAB REQUESTS\n');
    res.write(csvLine('Test Name', 'Urgency', 'Status', 'Date', 'Patient'));
    for (const l of labRequests) {
      res.write(csvLine(l.test_name, l.urgency, l.status, isoDate(l.created_at), l.patient_name));
    }

    res.end();
  } catch (err) {
    console.error('[reports] exportReport error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.end();
  }
}

module.exports = { getDashboardStats, getReportsByRange, exportReport };

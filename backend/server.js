require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

require('./config/db');

const { authenticateToken } = require('./middleware/auth');

const authRoutes          = require('./routes/auth.routes');
const patientRoutes       = require('./routes/patients.routes');
const visitRoutes         = require('./routes/visits.routes');
const clinicalRoutes      = require('./routes/clinical.routes');
const vitalsRoutes        = require('./routes/vitals.routes');
const prescriptionRoutes  = require('./routes/prescriptions.routes');
const labRoutes           = require('./routes/lab.routes');
const nursingRoutes       = require('./routes/nursing.routes');
const auditRoutes         = require('./routes/audit.routes');
const reportsRoutes       = require('./routes/reports.routes');
const exportRoutes        = require('./routes/export.routes');
const userRoutes          = require('./routes/users.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Carri Health EMR API is running' });
});

// Global hospital-context guard — runs authenticateToken for every /api route
// except the two public auth endpoints, then verifies hospitalId is present.
// Individual routes still carry their own authenticateToken + authorize calls
// (belt-and-suspenders); this guard is the safety net for any route accidentally
// mounted without authentication middleware.
const AUTH_EXEMPT = /^\/auth\/(login|register-hospital)$/;

app.use('/api', (req, res, next) => {
  if (AUTH_EXEMPT.test(req.path) || req.path === '/health') return next();

  authenticateToken(req, res, () => {
    if (!req.user || !req.user.hospitalId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
  });
});

app.use('/api/auth',          authRoutes);
app.use('/api/patients',      patientRoutes);
app.use('/api/visits',        visitRoutes);
app.use('/api/clinical-notes', clinicalRoutes);
app.use('/api/vitals',        vitalsRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/lab',           labRoutes);
app.use('/api/nursing',       nursingRoutes);
app.use('/api/audit',         auditRoutes);
app.use('/api/reports',       reportsRoutes);
app.use('/api/export',        exportRoutes);
app.use('/api/users',         userRoutes);

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Carri Health EMR server running on port ${PORT}`);
});

module.exports = app;

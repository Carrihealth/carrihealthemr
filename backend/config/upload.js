const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const LAB_RESULTS_DIR = path.join(__dirname, '..', 'uploads', 'lab-results');

// Ensure directory exists at startup
if (!fs.existsSync(LAB_RESULTS_DIR)) {
  fs.mkdirSync(LAB_RESULTS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LAB_RESULTS_DIR),
  filename:    (_req, file, cb) => {
    const sanitised = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${sanitised}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only PDF files are accepted'));
  }
}

const uploadLabResult = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB
});

module.exports = { uploadLabResult };

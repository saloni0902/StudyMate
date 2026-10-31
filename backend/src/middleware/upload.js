import crypto from 'node:crypto';
import fs from 'node:fs';
import multer from 'multer';
import env from '../config/env.js';
import HttpError from '../utils/httpError.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

// Files are saved under a random name; the student's file name is only
// stored in the database, never used as a path.
const storage = multer.diskStorage({
  destination: env.uploadDir,
  filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.pdf`),
});

const pdfUpload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const looksLikePdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(looksLikePdf ? null : new HttpError(400, 'Only PDF files can be uploaded'), looksLikePdf);
  },
}).single('file');

// Real PDFs start with "%PDF-"; checking the bytes catches renamed files.
function isPdfFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(5);
    fs.readSync(fd, header, 0, 5, 0);
    return header.toString('latin1') === '%PDF-';
  } finally {
    fs.closeSync(fd);
  }
}

// Accepts one PDF in the "file" field and sets req.file.
export default function uploadPdf(req, res, next) {
  pdfUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? `PDF is too large (max ${env.maxUploadMb} MB)` : 'Upload one PDF at a time';
      return next(new HttpError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message));
    }
    if (err) return next(err);
    if (!req.file) return next(new HttpError(400, 'Choose a PDF file to upload'));

    if (!isPdfFile(req.file.path)) {
      fs.rmSync(req.file.path, { force: true });
      return next(new HttpError(400, 'This file is not a valid PDF'));
    }

    // Browsers send non-ASCII file names as UTF-8 but multer reads them as latin1.
    req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    next();
  });
}

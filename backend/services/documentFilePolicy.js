const { Worker } = require('node:worker_threads');
const path = require('node:path');
const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
const DOCUMENT_FILE_HELP = 'PDF, JPG or PNG · Maximum 6 MB per requirement.';
const TYPES = Object.freeze({ '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' });
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
let activeChecks = 0;
const parseDocumentEnvelope = (fileName, fileData, maxBytes = MAX_DOCUMENT_BYTES) => {
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 255 || /[\x00-\x1f\\/]/.test(fileName)) throw fail('Choose a file with a valid name and a PDF, JPG or PNG extension.');
  const extension = path.extname(fileName.trim()).toLowerCase();
  if (!TYPES[extension]) throw fail('This file format is not allowed. Choose PDF, JPG or PNG.');
  if (typeof fileData !== 'string') throw fail('The document could not be read. Choose the file again.');
  if (fileData.length > Math.ceil(maxBytes / 3) * 4 + 128) throw fail(`Use a file no larger than ${maxBytes / 1024 / 1024} MB.`, 413);
  const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]*={0,2})$/.exec(fileData);
  if (!match || !match[2] || match[2].length % 4) throw fail('The document data is invalid. Choose the original PDF, JPG or PNG file again.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.toString('base64') !== match[2]) throw fail('The document data is invalid or empty. Choose the original file again.');
  if (buffer.length > maxBytes) throw fail(`Use a file no larger than ${maxBytes / 1024 / 1024} MB.`, 413);
  const detected = buffer.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
    : buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
      : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 ? 'image/jpeg' : null;
  if (!detected || detected !== match[1] || detected !== TYPES[extension]) throw fail('The file contents do not match its name or format. Choose the original file; renaming its extension does not convert it.');
  return { contentType: detected, buffer };
};
const inspectDocument = ({ contentType, buffer }) => new Promise((resolve, reject) => {
  if (activeChecks >= 2) return reject(fail('Document checking is busy. Your previous file is unchanged; please retry shortly.', 503));
  activeChecks++;
  let worker, settled = false;
  const finish = (error) => {
    if (settled) return;
    settled = true; activeChecks--; clearTimeout(timer);
    if (worker) worker.terminate().catch(() => {});
    if (error) reject(error); else resolve();
  };
  const timer = setTimeout(() => finish(fail('The document could not be checked within the time limit. Export a smaller fresh copy and retry.')), 8000);
  try {
    worker = new Worker(path.join(__dirname, 'documentInspectionWorker.js'), { workerData: { contentType, buffer }, resourceLimits: { maxOldGenerationSizeMb: 128 }, stdout: true, stderr: true });
    // Do not forward parser diagnostics containing document contents to application logs.
    worker.stdout.resume(); worker.stderr.resume();
    worker.on('message', message => finish(message.ok ? null : fail(message.encrypted ? 'Password-protected PDFs cannot be reviewed. Export an unlocked PDF and upload it.' : 'This document is unreadable, damaged or too complex. Export a fresh PDF, JPG or PNG copy and try again.')));
    worker.on('error', () => finish(fail('The document could not be checked. Export a smaller fresh copy and retry.')));
    worker.on('exit', () => { if (!settled) finish(fail('The document check did not complete. Please choose the file again.')); });
  } catch { finish(fail('Document checking is temporarily unavailable. Please retry.', 503)); }
});
const validateDocumentUpload = async (fileName, fileData, { maxBytes = MAX_DOCUMENT_BYTES } = {}) => {
  const parsed = parseDocumentEnvelope(fileName, fileData, maxBytes);
  await inspectDocument(parsed);
  return parsed;
};
module.exports = { MAX_DOCUMENT_BYTES, DOCUMENT_FILE_HELP, parseDocumentEnvelope, validateDocumentUpload };

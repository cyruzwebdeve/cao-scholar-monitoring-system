const { parentPort, workerData } = require('node:worker_threads');
const MAX_PIXELS = 25 * 1000 * 1000;
(async () => {
  try {
    const bytes = Buffer.from(workerData.buffer);
    if (workerData.contentType === 'application/pdf') {
      if (!/%%EOF\s*$/.test(bytes.subarray(-1024).toString('latin1'))) throw new Error('Incomplete PDF');
      const { PDFDocument } = require('pdf-lib');
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
      if (!pdf.getPageCount()) throw new Error('No pages');
      for (const page of pdf.getPages()) {
        const { width, height } = page.getSize();
        if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid page');
      }
    } else if (workerData.contentType === 'image/png') {
      if (bytes.length < 33 || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > MAX_PIXELS) throw new Error('Image dimensions');
      const png = require('pngjs').PNG.sync.read(bytes, { checkCRC: true });
      if (!png.width || !png.height || png.width * png.height > MAX_PIXELS) throw new Error('Image dimensions');
    } else {
      const image = require('jpeg-js').decode(bytes, { useTArray: true, tolerantDecoding: false, maxResolutionInMP: 25, maxMemoryUsageInMB: 128 });
      if (!image.width || !image.height || image.width * image.height > MAX_PIXELS) throw new Error('Image dimensions');
    }
    parentPort.postMessage({ ok: true });
  } catch (error) {
    parentPort.postMessage({ ok: false, encrypted: error.name === 'EncryptedPDFError' || /^Input document to .*PDFDocument\.load.* is encrypted\./.test(error.message || '') });
  }
})();

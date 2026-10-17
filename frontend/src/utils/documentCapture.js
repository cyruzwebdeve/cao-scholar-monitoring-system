export const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
export const MAX_CAPTURE_PAGES = 10;
export const readCaptureFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Unable to read this file. Try capturing it again.')); reader.readAsDataURL(file);
});
export const loadCaptureImage = (source) => new Promise((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('This image cannot be opened. Use JPG or PNG.')); image.src = source;
});
export const renderCapture = async (source, { rotate = false, crop = [0, 0, 0, 0] } = {}) => {
  const image = typeof source === 'string' ? await loadCaptureImage(source) : source;
  const width = image.videoWidth || image.naturalWidth, height = image.videoHeight || image.naturalHeight;
  if (!width || !height) throw new Error('The camera is not ready. Wait for the preview, then capture again.');
  const [left, top, right, bottom] = crop;
  const sw = width * (100 - left - right) / 100, sh = height * (100 - top - bottom) / 100;
  const scale = Math.min(1, 2200 / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((rotate ? sh : sw) * scale); canvas.height = Math.round((rotate ? sw : sh) * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image editing is unavailable in this browser. Use the file upload fallback.');
  if (rotate) { ctx.translate(canvas.width, 0); ctx.rotate(Math.PI / 2); }
  ctx.drawImage(image, width * left / 100, height * top / 100, sw, sh, 0, 0, sw * scale, sh * scale);
  return canvas.toDataURL('image/jpeg', 0.88);
};
export const buildCapturePdf = async (pages) => {
  if (!pages.length || pages.length > MAX_CAPTURE_PAGES) throw new Error(`Capture between 1 and ${MAX_CAPTURE_PAGES} pages per requirement.`);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (let index = 0; index < pages.length; index += 1) {
    const page = await loadCaptureImage(pages[index]);
    if (index) pdf.addPage();
    const scale = Math.min(190 / page.naturalWidth, 277 / page.naturalHeight);
    const width = page.naturalWidth * scale, height = page.naturalHeight * scale;
    pdf.addImage(pages[index], 'JPEG', (210 - width) / 2, (297 - height) / 2, width, height);
  }
  if (pdf.output('arraybuffer').byteLength > MAX_DOCUMENT_BYTES) throw new Error('This document exceeds 6 MB. Remove duplicate pages or recapture more closely.');
  return `data:application/pdf;base64,${pdf.output('datauristring').split(',')[1]}`;
};

// Single-document intake must not depend on any other required document.
export const captureDocumentReady = (key, drafts = {}, saved = {}) => Boolean(key && !saved[key] && (drafts[key]?.pages?.length || (drafts[key]?.file?.fileName && drafts[key]?.file?.fileData)));

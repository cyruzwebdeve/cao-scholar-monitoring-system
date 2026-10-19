export const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
export const DOCUMENT_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
export const DOCUMENT_FILE_HELP = 'PDF, JPG or PNG · Maximum 6 MB per requirement.';
export const CAPTURE_FILE_HELP = 'PDF up to 6 MB, or JPG/PNG photo up to 12 MB for conversion. Final document: maximum 6 MB.';
const types = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
export const documentFileType = (file, { capturePhoto = false, imagesOnly = false } = {}) => {
  const extension = String(file?.name || '').split('.').at(-1).toLowerCase(), type = types[extension];
  if (!type || (imagesOnly && type === 'application/pdf')) throw new Error(imagesOnly ? 'Choose a JPG or PNG photo.' : 'This file format is not allowed. Choose PDF, JPG or PNG.');
  if (file.type && file.type.toLowerCase() !== type) throw new Error('The file name and format do not match. Choose the original file; renaming its extension does not convert it.');
  if (!file.size) throw new Error('This file is empty. Choose the original document.');
  const maxBytes = capturePhoto && type !== 'application/pdf' ? 12 * 1024 * 1024 : MAX_DOCUMENT_BYTES;
  if (file.size > maxBytes) throw new Error(`Use a ${capturePhoto && type !== 'application/pdf' ? 'photo' : 'file'} no larger than ${maxBytes / 1024 / 1024} MB.`);
  return type;
};
const decodeBrowserImage = async file => {
  if (typeof createImageBitmap === 'function') {
    const image = await createImageBitmap(file);
    try { if (!image.width || !image.height || image.width * image.height > 25 * 1000 * 1000) throw new Error('Image dimensions'); }
    finally { image.close(); }
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => reject(new Error('Image timeout')), 8000);
      image.onload = () => { clearTimeout(timer); if (image.naturalWidth * image.naturalHeight > 25 * 1000 * 1000) reject(new Error('Image dimensions')); else resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('Invalid image')); };
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
};
export const validateDocumentFile = async (file, options = {}) => {
  const type = documentFileType(file, options);
  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { throw new Error('The file could not be read. Choose it again.'); }
  const prefix = String.fromCharCode(...bytes.subarray(0, 5));
  const detected = prefix === '%PDF-' ? 'application/pdf'
    : [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value) ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
  if (detected !== type) throw new Error('The file contents do not match its format. Choose the original PDF, JPG or PNG file.');
  if (type === 'application/pdf') {
    if (!/%%EOF\s*$/.test(String.fromCharCode(...bytes.subarray(-1024)))) throw new Error('This PDF appears incomplete or damaged. Export a fresh copy and try again.');
  } else {
    try { await (options.decodeImage || decodeBrowserImage)(file); }
    catch { throw new Error('This image cannot be opened or is too large to process. Export a smaller JPG or PNG copy.'); }
  }
  return type;
};
// Supply the expected MIME when the operating system leaves File.type empty.
export const documentDataUrl = (file, contentType) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('The selected file could not be read. Choose it again.'));
  reader.onload = () => {
    const result = String(reader.result || ''), comma = result.indexOf(',');
    if (comma < 0) reject(new Error('The selected file could not be read. Choose it again.'));
    else resolve(`data:${contentType};base64,${result.slice(comma + 1)}`);
  };
  reader.readAsDataURL(file);
});

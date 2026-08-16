const DATA_URL_PATTERN = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i;

class BlobStorageConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BlobStorageConfigurationError';
    this.statusCode = 503;
  }
}

const normalizeFileName = (fileName = 'upload') => String(fileName)
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120) || 'upload';

const normalizePathSegment = (value) => String(value || 'unknown')
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'unknown';

const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(DATA_URL_PATTERN);
  if (!match) throw new TypeError('The uploaded file is not a valid base64 data URL.');
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new TypeError('The uploaded file is empty.');
  return { contentType: match[1].toLowerCase(), buffer };
};

const isBlobUrl = (value) => /^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i.test(String(value || ''));

const uploadDataUrl = async ({ dataUrl, fileName, contentType, pathSegments, token, access }) => {
  if (!token) {
    throw new BlobStorageConfigurationError('Cloud file storage is not configured for this deployment.');
  }
  const parsed = parseDataUrl(dataUrl);
  const { put } = await import('@vercel/blob');
  const pathname = [...pathSegments.map(normalizePathSegment), normalizeFileName(fileName)].join('/');
  const blob = await put(pathname, parsed.buffer, {
    access,
    addRandomSuffix: true,
    contentType: contentType || parsed.contentType,
    token,
  });
  return {
    url: blob.url,
    downloadUrl: blob.downloadUrl || null,
    pathname: blob.pathname,
    contentType: blob.contentType || contentType || parsed.contentType,
    size: parsed.buffer.length,
  };
};

const deleteBlob = async (url, token) => {
  if (!token || !isBlobUrl(url)) return;
  try {
    const { del } = await import('@vercel/blob');
    await del(url, { token });
  } catch (error) {
    console.warn(`Unable to remove the replaced blob: ${error.message}`);
  }
};

module.exports = {
  BlobStorageConfigurationError,
  deleteBlob,
  isBlobUrl,
  parseDataUrl,
  uploadDataUrl,
};

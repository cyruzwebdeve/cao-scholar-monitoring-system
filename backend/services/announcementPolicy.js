const { parseDataUrl } = require('./blobStorage');
const MAX_ANNOUNCEMENT_IMAGE_BYTES = 3 * 1024 * 1024;
const validateAnnouncementImage = (data, declaredType) => {
  const parsed = parseDataUrl(data);
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(parsed.contentType)) throw new Error('Upload a valid JPG, PNG, WEBP, or GIF image.');
  if (declaredType && declaredType !== parsed.contentType) throw new Error('The image type does not match the uploaded image.');
  if (parsed.buffer.length > MAX_ANNOUNCEMENT_IMAGE_BYTES) throw new Error('Announcement image must not exceed 3 MB.');
  return parsed.contentType;
};
const latestPriorityAnnouncement = async (client, where) => {
  // Limit only after priority selection, so an older urgent notice cannot be starved.
  for (const priority of ['urgent', 'high', 'normal']) {
    const record = await client.announcements.findFirst({ where: { ...where, priority }, orderBy: [{ published_at: 'desc' }, { updated_at: 'desc' }, { id: 'desc' }] });
    if (record) return record;
  }
  return null;
};
module.exports = { validateAnnouncementImage, latestPriorityAnnouncement, MAX_ANNOUNCEMENT_IMAGE_BYTES };

const FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
]);

const normalizeFacebookPostUrl = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (parsed.protocol !== 'https:' || !FACEBOOK_HOSTS.has(hostname) || parsed.username || parsed.password) {
    return null;
  }

  parsed.hash = '';
  return parsed.toString();
};

module.exports = { normalizeFacebookPostUrl };

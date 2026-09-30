const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SITE_ACCESS_TOKEN_TTL = '12h';
const SITE_ACCESS_ISSUER = 'pgceap-site-access';
const SITE_ACCESS_AUDIENCE = 'pgceap-testers';

const isSiteAccessEnabled = (env = process.env) => String(env.SITE_ACCESS_ENABLED || '').trim().toLowerCase() === 'true';

const digest = (value) => crypto.createHash('sha256').update(String(value || ''), 'utf8').digest();

const passwordsMatch = (candidate, expected) => {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || !candidate || !expected) return false;
  return crypto.timingSafeEqual(digest(candidate), digest(expected));
};

const tokenOptions = {
  issuer: SITE_ACCESS_ISSUER,
  audience: SITE_ACCESS_AUDIENCE,
};

const issueSiteAccessToken = ({ secret, expiresIn = SITE_ACCESS_TOKEN_TTL } = {}) => {
  if (!secret) throw new Error('A site-access signing secret is required.');
  return jwt.sign({ purpose: 'site-access' }, secret, { ...tokenOptions, expiresIn });
};

const verifySiteAccessToken = (token, { secret } = {}) => {
  if (!token || !secret) return null;
  try {
    const payload = jwt.verify(token, secret, tokenOptions);
    return payload?.purpose === 'site-access' ? payload : null;
  } catch {
    return null;
  }
};

module.exports = {
  SITE_ACCESS_TOKEN_TTL,
  isSiteAccessEnabled,
  issueSiteAccessToken,
  passwordsMatch,
  verifySiteAccessToken,
};

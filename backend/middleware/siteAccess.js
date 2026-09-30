const { isSiteAccessEnabled, verifySiteAccessToken } = require('../services/siteAccess');

const readAccessToken = (req) => String(req.get('X-Site-Access-Token') || '').trim();

const requireSiteAccess = (req, res, next) => {
  if (!isSiteAccessEnabled()) return next();

  const payload = verifySiteAccessToken(readAccessToken(req), { secret: process.env.JWT_SECRET });
  if (!payload) {
    res.set('X-Site-Access-Required', 'true');
    return res.status(401).json({
      code: 'SITE_ACCESS_REQUIRED',
      message: 'This invitation-only testing deployment requires a tester access code.',
    });
  }

  req.siteAccess = { authorized: true, expiresAt: payload.exp ? new Date(payload.exp * 1000) : null };
  return next();
};

module.exports = { readAccessToken, requireSiteAccess };

const express = require('express');
const { siteAccessRateLimiter } = require('../middleware/rateLimits');
const { readAccessToken } = require('../middleware/siteAccess');
const {
  isSiteAccessEnabled,
  issueSiteAccessToken,
  passwordsMatch,
  verifySiteAccessToken,
} = require('../services/siteAccess');

const router = express.Router();

router.get('/status', (req, res) => {
  const required = isSiteAccessEnabled();
  if (!required) return res.json({ required: false, authorized: true });

  const payload = verifySiteAccessToken(readAccessToken(req), { secret: process.env.JWT_SECRET });
  return res.json({
    required: true,
    authorized: Boolean(payload),
    expiresAt: payload?.exp ? new Date(payload.exp * 1000).toISOString() : null,
  });
});

router.post('/unlock', siteAccessRateLimiter, (req, res) => {
  if (!isSiteAccessEnabled()) return res.json({ required: false, authorized: true, token: null });

  const password = req.body?.password;
  if (typeof password !== 'string' || password.length > 256
    || !passwordsMatch(password, process.env.SITE_ACCESS_PASSWORD)) {
    return res.status(401).json({ message: 'The tester access code is incorrect.' });
  }

  const token = issueSiteAccessToken({ secret: process.env.JWT_SECRET });
  const payload = verifySiteAccessToken(token, { secret: process.env.JWT_SECRET });
  return res.json({
    required: true,
    authorized: true,
    token,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  });
});

module.exports = router;

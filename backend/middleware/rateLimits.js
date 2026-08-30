const { ipKeyGenerator, rateLimit } = require('express-rate-limit');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const rateLimitMessage = (message) => ({ message });

const accountOrIpKey = (req) => {
  if (req.user?.id) return `${req.user.role || 'user'}:${req.user.id}`;
  return ipKeyGenerator(req.ip);
};

const commonOptions = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
};

const createRateLimiters = ({ isProduction = process.env.NODE_ENV === 'production' } = {}) => ({
  loginRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: 15 * MINUTE,
    limit: isProduction ? 10 : 500,
    skipSuccessfulRequests: true,
    message: rateLimitMessage('Too many failed sign-in attempts. Please wait 15 minutes and try again.'),
  }),
  registrationRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 5 : 100,
    message: rateLimitMessage('Too many account registrations from this connection. Please try again later.'),
  }),
  passwordResetRequestRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 5 : 100,
    message: rateLimitMessage('Too many password reset requests. Please wait before trying again.'),
  }),
  passwordResetAttemptRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: 15 * MINUTE,
    limit: isProduction ? 10 : 200,
    message: rateLimitMessage('Too many password reset attempts. Please wait 15 minutes and try again.'),
  }),
  applicationSubmissionRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 10 : 100,
    message: rateLimitMessage('Too many application submissions from this connection. Please try again later.'),
  }),
  documentUploadRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 30 : 300,
    keyGenerator: accountOrIpKey,
    message: rateLimitMessage('Document upload limit reached. Please wait before uploading another file.'),
  }),
  announcementWriteRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 30 : 300,
    keyGenerator: accountOrIpKey,
    message: rateLimitMessage('Announcement update limit reached. Please wait before trying again.'),
  }),
  staffWriteRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 30 : 300,
    keyGenerator: accountOrIpKey,
    message: rateLimitMessage('Staff account update limit reached. Please wait before trying again.'),
  }),
  scholarshipDecisionRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 60 : 500,
    keyGenerator: accountOrIpKey,
    message: rateLimitMessage('Scholarship decision limit reached. Please wait before trying again.'),
  }),
  documentReviewRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 120 : 500,
    keyGenerator: accountOrIpKey,
    message: rateLimitMessage('Document review limit reached. Please wait before reviewing another file.'),
  }),
  billingWriteRateLimiter: rateLimit({
    ...commonOptions,
    windowMs: HOUR,
    limit: isProduction ? 60 : 500,
    keyGenerator: accountOrIpKey,
    message: rateLimitMessage('Billing processing limit reached. Please wait before trying again.'),
  }),
});

module.exports = {
  ...createRateLimiters(),
  createRateLimiters,
};

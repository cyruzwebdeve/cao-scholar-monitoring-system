const crypto = require('crypto');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_TOKEN_BYTES = 32;

const generateResetToken = () => crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');

const hashResetToken = (token) => crypto
  .createHash('sha256')
  .update(String(token || ''), 'utf8')
  .digest('hex');

const isStrongPassword = (password) => typeof password === 'string'
  && password.length >= 12
  && password.length <= 128
  && /[a-z]/.test(password)
  && /[A-Z]/.test(password)
  && /\d/.test(password);

module.exports = {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
  isStrongPassword,
};

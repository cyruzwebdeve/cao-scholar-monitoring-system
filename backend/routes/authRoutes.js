const express = require('express');
const {
  register,
  login,
  me,
  requestPasswordReset,
  resetPassword,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
} = require('../middleware/validators');
const {
  loginRateLimiter,
  registrationRateLimiter,
  passwordResetRequestRateLimiter,
  passwordResetAttemptRateLimiter,
} = require('../middleware/rateLimits');
const router = express.Router();

router.post('/register', registrationRateLimiter, validateRegister, register);
router.post('/login', loginRateLimiter, validateLogin, login);
router.post('/forgot-password', passwordResetRequestRateLimiter, validatePasswordResetRequest, requestPasswordReset);
router.post('/reset-password', passwordResetAttemptRateLimiter, validatePasswordReset, resetPassword);
router.get('/me', authenticate, me);

module.exports = router;

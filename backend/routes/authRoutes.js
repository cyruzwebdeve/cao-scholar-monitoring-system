const express = require('express');
const { register, login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validators');
const { loginRateLimiter, registrationRateLimiter } = require('../middleware/rateLimits');
const router = express.Router();

router.post('/register', registrationRateLimiter, validateRegister, register);
router.post('/login', loginRateLimiter, validateLogin, login);
router.get('/me', authenticate, me);

module.exports = router;

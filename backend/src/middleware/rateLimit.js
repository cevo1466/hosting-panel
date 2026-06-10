const rateLimit = require('express-rate-limit');
const { rateLimit: rlConfig } = require('../config/config');

const generalLimiter = rateLimit({
  windowMs: rlConfig.windowMs,
  max: rlConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: rlConfig.loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
  skipSuccessfulRequests: true,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Rate limit exceeded for this operation' },
});

module.exports = { generalLimiter, loginLimiter, strictLimiter };

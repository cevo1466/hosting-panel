'use strict';

const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/login',
  loginLimiter,
  [
    body('username').notEmpty().withMessage('Kullanıcı adı gerekli'),
    body('password').notEmpty().withMessage('Şifre gerekli'),
    body('twoFactorCode').optional().isString(),
  ],
  validate,
  authController.login
);

router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.me);

router.post('/setup-2fa', authenticate, authController.setup2fa);

router.post(
  '/verify-2fa',
  authenticate,
  [
    body('code').notEmpty().withMessage('Verification code is required'),
  ],
  validate,
  authController.verify2fa
);

router.post(
  '/disable-2fa',
  authenticate,
  [
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.disable2fa
);

router.post(
  '/refresh-token',
  [
    body('token').notEmpty().withMessage('Refresh token is required'),
  ],
  validate,
  authController.refreshToken
);

router.put(
  '/change-password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('Old password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
  ],
  validate,
  authController.changePassword
);

module.exports = router;

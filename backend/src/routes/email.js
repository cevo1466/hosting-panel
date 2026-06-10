'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/emailController');

router.get('/', authenticate, ctrl.list);
router.post('/', authenticate, [
  body('address').isEmail().withMessage('Geçersiz e-posta adresi'),
  body('password').isLength({ min: 8 }).withMessage('Şifre en az 8 karakter olmalı'),
  body('domainId').isUUID(),
  body('quotaMB').optional().isInt({ min: 50 }),
], validate, ctrl.create);
router.put('/:id/password', authenticate, [
  body('password').isLength({ min: 8 }),
], validate, ctrl.changePassword);
router.put('/:id/forward', authenticate, [
  body('forwardTo').optional().isEmail(),
], validate, ctrl.setForward);
router.put('/:id/autoresponder', authenticate, ctrl.setAutoResponder);
router.post('/catchall', authenticate, ctrl.setCatchAll);
router.patch('/:id/toggle', authenticate, ctrl.toggleActive);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;

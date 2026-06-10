'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/databaseController');

router.get('/', authenticate, ctrl.list);
router.post('/', authenticate, [
  body('name').matches(/^[a-z0-9_]{1,32}$/).withMessage('Geçersiz veritabanı adı'),
  body('dbUser').matches(/^[a-z0-9_]{1,32}$/).withMessage('Geçersiz kullanıcı adı'),
  body('password').isLength({ min: 8 }).withMessage('Şifre en az 8 karakter'),
  body('domainId').isUUID(),
], validate, ctrl.create);
router.put('/:id/password', authenticate, [
  body('password').isLength({ min: 8 }),
], validate, ctrl.changePassword);
router.get('/:id/size', authenticate, ctrl.getSize);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;

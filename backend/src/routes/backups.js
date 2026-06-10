'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { strictLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/backupController');

router.get('/', authenticate, ctrl.list);
router.post('/', authenticate, strictLimiter, [
  body('domainId').isUUID(),
  body('type').isIn(['full', 'files', 'database', 'email']).withMessage('Geçersiz yedek türü'),
], validate, ctrl.create);
router.post('/:id/restore', authenticate, strictLimiter, ctrl.restore);
router.post('/schedule', authenticate, [
  body('domainId').isUUID(),
  body('cronExpression').notEmpty(),
  body('type').isIn(['full', 'files', 'database', 'email']),
], validate, ctrl.schedule);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;

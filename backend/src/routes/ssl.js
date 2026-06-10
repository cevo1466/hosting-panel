'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { strictLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/sslController');

router.get('/', authenticate, ctrl.list);
router.post('/install', authenticate, strictLimiter, [
  body('domainId').optional().isUUID(),
  body('subdomainId').optional().isUUID(),
  body('email').optional().isEmail(),
], validate, ctrl.install);
router.post('/:id/renew', authenticate, strictLimiter, ctrl.renew);
router.get('/:id/status', authenticate, ctrl.getStatus);
router.delete('/:id', authenticate, ctrl.revoke);

module.exports = router;

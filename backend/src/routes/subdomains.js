'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/subdomainController');

router.get('/', authenticate, ctrl.listAll);
router.get('/:domainId', authenticate, ctrl.list);

router.post('/:domainId', authenticate, [
  param('domainId').isUUID(),
  body('name').matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/).withMessage('Geçersiz subdomain adı'),
  body('phpVersion').optional().isIn(['8.3', '8.4']),
], validate, ctrl.create);

router.put('/:domainId/:id/php', authenticate, [
  body('phpVersion').isIn(['8.3', '8.4']).withMessage('Geçersiz PHP sürümü'),
], validate, ctrl.updatePhp);

router.delete('/:domainId/:id', authenticate, ctrl.remove);

module.exports = router;

'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/dnsController');

const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'];

router.get('/:domainId', authenticate, ctrl.getZone);
router.post('/:domainId/records', authenticate, [
  body('type').isIn(DNS_TYPES).withMessage('Geçersiz kayıt türü'),
  body('name').notEmpty().trim(),
  body('value').notEmpty(),
  body('ttl').optional().isInt({ min: 60 }),
  body('priority').optional().isInt({ min: 0 }),
], validate, ctrl.addRecord);
router.put('/:domainId/records/:recordId', authenticate, [
  body('type').optional().isIn(DNS_TYPES),
  body('value').optional().notEmpty(),
], validate, ctrl.updateRecord);
router.delete('/:domainId/records/:recordId', authenticate, ctrl.deleteRecord);
router.post('/:domainId/reload', authenticate, ctrl.reloadZone);

module.exports = router;

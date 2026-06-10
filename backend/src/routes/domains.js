'use strict';

const express = require('express');
const { body } = require('express-validator');
const domainController = require('../controllers/domainController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/', authenticate, domainController.list);

router.post(
  '/',
  authenticate,
  [
    body('name').notEmpty().withMessage('Domain name is required'),
    body('phpVersion').optional().isString(),
  ],
  validate,
  audit('CREATE_DOMAIN', 'DOMAIN'),
  domainController.create
);

router.get('/:id', authenticate, domainController.get);

router.put(
  '/:id/php',
  authenticate,
  [
    body('phpVersion').notEmpty().withMessage('PHP version is required'),
  ],
  validate,
  domainController.updatePhp
);

router.post('/:id/suspend', authenticate, requireAdmin, domainController.suspend);

router.post('/:id/unsuspend', authenticate, requireAdmin, domainController.unsuspend);

router.delete('/:id', authenticate, requireAdmin, audit('DELETE_DOMAIN', 'DOMAIN'), domainController.delete);

module.exports = router;

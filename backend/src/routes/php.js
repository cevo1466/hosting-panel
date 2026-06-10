'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/phpController');

router.get('/', authenticate, ctrl.list);
router.get('/:version/status', authenticate, requireAdmin, ctrl.getFpmStatus);
router.put('/domain/:domainId', authenticate, [
  body('phpVersion').isIn(['8.3', '8.4']),
], validate, ctrl.switchVersion);

module.exports = router;

'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/serviceController');

router.get('/', authenticate, requireAdmin, ctrl.list);

router.post(
  '/:service/:action',
  authenticate,
  requireAdmin,
  [
    param('service').notEmpty(),
    param('action').isIn(['start', 'stop', 'restart', 'reload', 'status']),
  ],
  validate,
  (req, res, next) => {
    req.body.action = req.params.action;
    return ctrl.action(req, res, next);
  }
);

router.post(
  '/:service',
  authenticate,
  requireAdmin,
  [body('action').isIn(['start', 'stop', 'restart', 'reload', 'status'])],
  validate,
  ctrl.action
);

router.get('/:service/logs', authenticate, requireAdmin, ctrl.getLogs);

module.exports = router;

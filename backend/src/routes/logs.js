'use strict';

const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/logController');

router.get('/domains/:domainId/access', authenticate, ctrl.getAccessLog);
router.get('/domains/:domainId/error', authenticate, ctrl.getErrorLog);
router.get('/mail', authenticate, requireAdmin, ctrl.getMailLog);
router.get('/ftp', authenticate, requireAdmin, ctrl.getFtpLog);
router.get('/panel', authenticate, ctrl.getPanelLog);
router.get('/ssl', authenticate, requireAdmin, ctrl.getSslLog);

module.exports = router;

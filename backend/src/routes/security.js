'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/securityController');

router.get('/audit-logs', authenticate, requireAdmin, ctrl.getAuditLogs);
router.get('/login-attempts', authenticate, requireAdmin, ctrl.getLoginAttempts);
router.get('/fail2ban', authenticate, requireAdmin, ctrl.getFail2banStatus);
router.post('/ip-blocks', authenticate, requireAdmin, [body('ip').isIP()], validate, ctrl.blockIp);
router.delete('/ip-blocks/:ip', authenticate, requireAdmin, [param('ip').isIP()], validate, ctrl.unblockIp);

module.exports = router;

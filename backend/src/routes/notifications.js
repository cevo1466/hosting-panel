'use strict';

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/', authenticate, ctrl.list);
router.get('/unread', authenticate, ctrl.getUnread);
router.patch('/read-all', authenticate, ctrl.markAllRead);
router.patch('/:id/read', authenticate, ctrl.markRead);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;

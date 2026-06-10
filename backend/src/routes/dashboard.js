'use strict';

const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticate, dashboardController.getStats);
router.get('/activity', authenticate, dashboardController.getRecentActivity);
router.get('/alerts', authenticate, dashboardController.getAlerts);
router.get('/services', authenticate, dashboardController.getServiceStatus);

module.exports = router;

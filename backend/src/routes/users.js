'use strict';

const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /users - List all users
router.get('/', authenticate, requireAdmin, userController.list);

// POST /users - Create a new user
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('username').notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').optional().isIn(['admin', 'reseller', 'client']),
    body('fullName').optional().isString(),
    body('phone').optional().isString(),
    body('packageId').optional().isUUID(),
  ],
  validate,
  audit('CREATE_USER', 'USER'),
  userController.create
);

// GET /users/packages - List packages (available to all authenticated users)
router.get('/packages', authenticate, userController.listPackages);

// POST /users/packages - Create package (admin only)
router.post(
  '/packages',
  authenticate,
  requireAdmin,
  [
    body('name').notEmpty().withMessage('Package name is required'),
    body('diskLimitMB').optional().isInt({ min: 1 }),
    body('bandwidthLimitMB').optional().isInt({ min: 1 }),
    body('maxDomains').optional().isInt({ min: 0 }),
    body('maxSubdomains').optional().isInt({ min: 0 }),
    body('maxEmailAccounts').optional().isInt({ min: 0 }),
    body('maxFtpAccounts').optional().isInt({ min: 0 }),
    body('maxDatabases').optional().isInt({ min: 0 }),
    body('phpVersion').optional().isString(),
  ],
  validate,
  userController.createPackage
);

// PUT /users/packages/:id - Update package (admin only)
router.put(
  '/packages/:id',
  authenticate,
  requireAdmin,
  [
    body('name').optional().notEmpty().withMessage('Package name cannot be empty'),
  ],
  validate,
  userController.updatePackage
);

// DELETE /users/packages/:id - Delete package (admin only)
router.delete('/packages/:id', authenticate, requireAdmin, userController.deletePackage);

// GET /users/:id - Get user profile
router.get('/:id', authenticate, requireAdmin, userController.get);

// PUT /users/:id - Update user profile
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [
    body('email').optional().isEmail().withMessage('Please provide a valid email'),
  ],
  validate,
  userController.update
);

// POST /users/:id/suspend - Suspend user
router.post(
  '/:id/suspend',
  authenticate,
  requireAdmin,
  [
    body('suspend').optional().isBoolean(),
  ],
  validate,
  userController.suspend
);

// POST /users/:id/unsuspend - Unsuspend user
router.post(
  '/:id/unsuspend',
  authenticate,
  requireAdmin,
  [
    body('suspend').optional().isBoolean(),
  ],
  validate,
  userController.unsuspend
);

// DELETE /users/:id - Delete user
router.delete('/:id', authenticate, requireAdmin, audit('DELETE_USER', 'USER'), userController.delete);

// POST /users/:id/package - Assign package to user
router.post(
  '/:id/package',
  authenticate,
  requireAdmin,
  [
    body('packageId').notEmpty().withMessage('Package ID is required'),
  ],
  validate,
  userController.assignPackage
);

module.exports = router;

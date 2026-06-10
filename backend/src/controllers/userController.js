'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const config = require('../config/config');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = config.bcryptRounds || 12;

// List all users
async function list(req, res) {
  try {
    const users = await prisma.user.findMany({
      include: {
        package: true,
        _count: {
          select: { domains: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: users.map(user => {
        const { passwordHash, twoFactorSecret, ...safeUser } = user;
        return safeUser;
      }),
    });
  } catch (error) {
    logger.error('Failed to list users', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Create a new user
async function create(req, res) {
  const { email, username, password, role, fullName, phone, packageId } = req.body;

  try {
    if (!email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Email, username, and password are required' });
    }

    // Check uniqueness
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email or username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: role || 'client',
        fullName,
        phone,
        packageId,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_USER',
        resource: 'USER',
        resourceId: user.id,
        status: 'success',
        ipAddress: req.ip,
      },
    });

    const { passwordHash: _, twoFactorSecret: __, ...safeUser } = user;
    return res.status(201).json({
      success: true,
      data: safeUser,
    });
  } catch (error) {
    logger.error('Failed to create user', { email, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Get user profile + statistics
async function get(req, res) {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        package: true,
        domains: true,
        _count: {
          select: {
            domains: true,
            ftpAccounts: true,
            emailAccounts: true,
            databases: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { passwordHash, twoFactorSecret, ...safeUser } = user;
    return res.status(200).json({
      success: true,
      data: safeUser,
    });
  } catch (error) {
    logger.error('Failed to get user profile', { userId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Update user details
async function update(req, res) {
  const { id } = req.params;
  const { fullName, phone, email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (email && email !== user.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        fullName,
        phone,
        email,
      },
    });

    const { passwordHash, twoFactorSecret, ...safeUser } = updatedUser;
    return res.status(200).json({
      success: true,
      data: safeUser,
    });
  } catch (error) {
    logger.error('Failed to update user', { userId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Suspend/Unsuspend user toggle
async function toggleSuspend(req, res) {
  const { id } = req.params;
  const { suspend } = req.body; // boolean

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot suspend admin users' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        isSuspended: suspend === undefined ? !user.isSuspended : !!suspend,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: updatedUser.isSuspended ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
        resource: 'USER',
        resourceId: id,
        status: 'success',
        ipAddress: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: `User successfully ${updatedUser.isSuspended ? 'suspended' : 'unsuspended'}`,
      data: { isSuspended: updatedUser.isSuspended },
    });
  } catch (error) {
    logger.error('Failed to toggle suspend for user', { userId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Delete user (security check: block if there are active domains)
async function deleteUser(req, res) {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { domains: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user._count.domains > 0) {
      return res.status(400).json({
        success: false,
        message: 'Security constraint: Cannot delete a user that owns active domains.',
      });
    }

    // Delete cascading items if any, then the user
    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_USER',
        resource: 'USER',
        resourceId: id,
        status: 'success',
        ipAddress: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete user', { userId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Assign hosting package to user
async function assignPackage(req, res) {
  const { id } = req.params;
  const { packageId } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (packageId) {
      const packageExists = await prisma.package.findUnique({ where: { id: packageId } });
      if (!packageExists) {
        return res.status(404).json({ success: false, message: 'Hosting package not found' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { packageId },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ASSIGN_PACKAGE',
        resource: 'USER',
        resourceId: id,
        details: JSON.stringify({ packageId }),
        status: 'success',
        ipAddress: req.ip,
      },
    });

    const { passwordHash, twoFactorSecret, ...safeUser } = updatedUser;
    return res.status(200).json({
      success: true,
      data: safeUser,
    });
  } catch (error) {
    logger.error('Failed to assign package to user', { userId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Package CRUD: Create
async function createPackage(req, res) {
  const {
    name,
    description,
    diskLimitMB,
    bandwidthLimitMB,
    maxDomains,
    maxSubdomains,
    maxEmailAccounts,
    maxFtpAccounts,
    maxDatabases,
    phpVersion,
  } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ success: false, message: 'Package name is required' });
    }

    const existingPackage = await prisma.package.findUnique({ where: { name } });
    if (existingPackage) {
      return res.status(400).json({ success: false, message: 'Package name already exists' });
    }

    const newPackage = await prisma.package.create({
      data: {
        name,
        description,
        diskLimitMB: diskLimitMB || 5120,
        bandwidthLimitMB: bandwidthLimitMB || 51200,
        maxDomains: maxDomains || 5,
        maxSubdomains: maxSubdomains || 20,
        maxEmailAccounts: maxEmailAccounts || 10,
        maxFtpAccounts: maxFtpAccounts || 5,
        maxDatabases: maxDatabases || 5,
        phpVersion: phpVersion || '8.3',
      },
    });

    return res.status(201).json({
      success: true,
      data: newPackage,
    });
  } catch (error) {
    logger.error('Failed to create package', { name, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Package CRUD: List
async function listPackages(req, res) {
  try {
    const packages = await prisma.package.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({
      success: true,
      data: packages,
    });
  } catch (error) {
    logger.error('Failed to list packages', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Package CRUD: Update
async function updatePackage(req, res) {
  const { id } = req.params;
  const {
    name,
    description,
    diskLimitMB,
    bandwidthLimitMB,
    maxDomains,
    maxSubdomains,
    maxEmailAccounts,
    maxFtpAccounts,
    maxDatabases,
    phpVersion,
    isActive,
  } = req.body;

  try {
    const packageExists = await prisma.package.findUnique({ where: { id } });
    if (!packageExists) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    if (name && name !== packageExists.name) {
      const nameExists = await prisma.package.findUnique({ where: { name } });
      if (nameExists) {
        return res.status(400).json({ success: false, message: 'Package name already in use' });
      }
    }

    const updatedPackage = await prisma.package.update({
      where: { id },
      data: {
        name,
        description,
        diskLimitMB,
        bandwidthLimitMB,
        maxDomains,
        maxSubdomains,
        maxEmailAccounts,
        maxFtpAccounts,
        maxDatabases,
        phpVersion,
        isActive,
      },
    });

    return res.status(200).json({
      success: true,
      data: updatedPackage,
    });
  } catch (error) {
    logger.error('Failed to update package', { packageId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Package CRUD: Delete
async function deletePackage(req, res) {
  const { id } = req.params;

  try {
    const packageExists = await prisma.package.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!packageExists) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    if (packageExists._count.users > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete package while users are assigned to it.',
      });
    }

    await prisma.package.delete({ where: { id } });
    return res.status(200).json({
      success: true,
      message: 'Package deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete package', { packageId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  list,
  create,
  get,
  update,
  suspend: toggleSuspend,
  unsuspend: toggleSuspend,
  delete: deleteUser,
  assignPackage,
  createPackage,
  listPackages,
  updatePackage,
  deletePackage,
};

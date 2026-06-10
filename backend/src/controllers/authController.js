'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const prisma = require('../config/database');
const config = require('../config/config');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

const { jwtSecret, jwtExpiresIn, jwtRefreshExpiresIn, bcryptRounds } = config;

// Simple in-memory token blacklist (use Redis in production)
const tokenBlacklist = new Set();

function generateTokens(userId, role) {
  const accessToken = jwt.sign({ userId, role }, jwtSecret, { expiresIn: jwtExpiresIn });
  const refreshToken = jwt.sign({ userId, role, type: 'refresh' }, jwtSecret, { expiresIn: jwtRefreshExpiresIn });
  return { accessToken, refreshToken };
}

async function login(req, res) {
  try {
    const { username, password, totpCode } = req.body;
    const ip = req.ip;

    // username ile ara (e-posta da olabilir)
    const user = await prisma.user.findFirst({
      where: username.includes('@')
        ? { email: username }
        : { username: username },
    });

    if (!user || !user.isActive || user.isSuspended) {
      await createAuditLog({ action: 'login', resource: 'auth', details: { username }, ipAddress: ip, userAgent: req.headers['user-agent'], status: 'failed' });
      return res.status(401).json({ success: false, message: 'Kullanıcı adı veya şifre hatalı' });
    }

    // Check lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(user.lockedUntil) - Date.now()) / 1000 / 60);
      return res.status(429).json({ success: false, message: `Account locked. Try again in ${remaining} minutes.` });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      const attempts = user.loginAttempts + 1;
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, lockedUntil },
      });
      await createAuditLog({ userId: user.id, action: 'login', resource: 'auth', ipAddress: ip, userAgent: req.headers['user-agent'], status: 'failed' });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        return res.status(200).json({ success: true, message: '2FA required', data: { requiresTwoFactor: true } });
      }
      const valid = authenticator.verify({ token: totpCode, secret: user.twoFactorSecret });
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
      }
    }

    // Reset attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
        lastLoginIp: ip,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await createAuditLog({ userId: user.id, action: 'login', resource: 'auth', ipAddress: ip, userAgent: req.headers['user-agent'], status: 'success' });

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
        },
      },
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function logout(req, res) {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) tokenBlacklist.add(token);

    await createAuditLog({ userId: req.user?.id, action: 'logout', resource: 'auth', ipAddress: req.ip, userAgent: req.headers['user-agent'], status: 'success' });

    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, username: true, fullName: true, phone: true,
        role: true, isActive: true, isSuspended: true, twoFactorEnabled: true,
        lastLogin: true, lastLoginIp: true, createdAt: true,
        package: { select: { id: true, name: true, diskLimitMB: true, bandwidthLimitMB: true, maxDomains: true } },
      },
    });
    return res.json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function setup2fa(req, res) {
  try {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(req.user.email, 'HostingPanel', secret);
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    // Store temp secret
    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorSecret: secret },
    });

    return res.json({
      success: true,
      message: '2FA setup initiated',
      data: { secret, qrCode: qrDataUrl, otpauthUrl },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function verify2fa(req, res) {
  try {
    const { token } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: '2FA not set up. Call /setup2fa first.' });
    }

    const valid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid TOTP code' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: true },
    });

    return res.json({ success: true, message: '2FA enabled successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function disable2fa(req, res) {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    return res.json({ success: true, message: '2FA disabled successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Refresh token required' });

    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.type !== 'refresh') return res.status(401).json({ success: false, message: 'Invalid token type' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive || user.isSuspended) {
      return res.status(401).json({ success: false, message: 'Account not active' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);
    return res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password too short' });
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain uppercase letter and number' });
    }

    const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

    await createAuditLog({ userId: req.user.id, action: 'change_password', resource: 'auth', ipAddress: req.ip, userAgent: req.headers['user-agent'], status: 'success' });

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function changePasswordAdmin(req, res) {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password too short' });

    const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await createAuditLog({ userId: req.user.id, action: 'admin_change_password', resource: 'user', resourceId: userId, ipAddress: req.ip, userAgent: req.headers['user-agent'], status: 'success' });

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = { login, logout, me, setup2fa, verify2fa, disable2fa, refreshToken, changePassword, changePasswordAdmin, tokenBlacklist };

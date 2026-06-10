require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server: SocketIO } = require('socket.io');
const path = require('path');
const fs = require('fs');

const config = require('./config/config');
const logger = require('./utils/logger');
const { generalLimiter } = require('./middleware/rateLimit');

// Ensure log directory exists
const logDir = path.resolve(config.logs.dir);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: { origin: config.cors.origin, credentials: true },
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // configured per-route if needed
}));
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));
app.use(generalLimiter);

// Expose io to routes
app.set('io', io);

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/domains',    require('./routes/domains'));
app.use('/api/subdomains', require('./routes/subdomains'));
app.use('/api/ssl',        require('./routes/ssl'));
app.use('/api/php',        require('./routes/php'));
app.use('/api/ftp',        require('./routes/ftp'));
app.use('/api/email',      require('./routes/email'));
app.use('/api/dns',        require('./routes/dns'));
app.use('/api/databases',  require('./routes/databases'));
app.use('/api/files',      require('./routes/files'));
app.use('/api/backups',    require('./routes/backups'));
app.use('/api/services',   require('./routes/services'));
app.use('/api/security',   require('./routes/security'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/logs',       require('./routes/logs'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
  });
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { id: socket.id });
  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { id: socket.id });
  });
});

const PORT = config.port;
httpServer.listen(PORT, async () => {
  logger.info(`Hosting Panel API running on port ${PORT} [${config.nodeEnv}]`);
  
  // Fix Roundcube config permissions so php-fpm can read it
  try {
    const { exec } = require('child_process');
    exec("nsenter --target 1 --mount --uts --ipc --net --pid -- chmod 644 /etc/roundcube/config.inc.php", (err, stdout, stderr) => {
      if (err) {
        logger.error('Failed to change config permissions:', err.message);
      } else {
        logger.info('Successfully set permissions to 644 for /etc/roundcube/config.inc.php');
      }
    });
  } catch (e) {
    logger.error('Error executing nsenter permission fix:', e.message);
  }

  // Fix any DNS records still using 127.0.0.1
  try {
    const { fixLocalRecords } = require('./services/dnsService');
    const fixed = await fixLocalRecords();
    if (fixed > 0) logger.info(`Auto-fixed ${fixed} DNS records to use server IP`);
  } catch (e) {
    logger.warn('DNS fix on startup failed (non-fatal):', e.message);
  }
});

module.exports = { app, io };

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    loginMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  hosting: {
    webRoot: process.env.WEB_ROOT || '/var/www',
    nginxSitesAvailable: process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available',
    nginxSitesEnabled: process.env.NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled',
    phpFpmSockDir: process.env.PHP_FPM_SOCK_DIR || '/run/php',
    ftpUsersFile: process.env.FTP_USERS_FILE || '/etc/vsftpd/users',
    // FTP hesapları host'ta gerçek sistem kullanıcısı olarak açılır (vsftpd local_enable
    // + userlist allowlist modeli). userlist runtime'da okunur → reload gerektirmez.
    ftpUserlistFile: process.env.FTP_USERLIST_FILE || '/etc/vsftpd.userlist',
    ftpShell: process.env.FTP_SHELL || '/usr/sbin/nologin',
    ftpWebGroup: process.env.FTP_WEB_GROUP || 'www-data',
    mailBase: process.env.MAIL_BASE || '/var/mail/vhosts',
    backupBase: process.env.BACKUP_BASE || '/var/backups/hosting',
    letsEncryptEmail: process.env.LETSENCRYPT_EMAIL || '',
    certbotBin: process.env.CERTBOT_BIN || 'certbot',
    serverIp: process.env.SERVER_IP || '127.0.0.1',
  },
  database: {
    mysqlHost: process.env.MYSQL_HOST || 'localhost',
    mysqlPort: parseInt(process.env.MYSQL_PORT) || 3306,
    mysqlAdminUser: process.env.MYSQL_ADMIN_USER || 'root',
    mysqlAdminPass: process.env.MYSQL_ADMIN_PASS || '',
  },
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
};

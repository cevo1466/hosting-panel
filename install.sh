#!/usr/bin/env bash
# ==============================================================================
# HostPanel — Üretim Kurulum Sihirbazı
# Sıfır bir Ubuntu/Debian sunucuda paneli tamamen ayağa kaldırır.
# İnteraktif · idempotent · güvenli rastgele secret · sağlık kontrolü
#
# Kullanım:   sudo ./install.sh
# ==============================================================================
set -euo pipefail

# ---- Renkler ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ---- Yollar ve loglama ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
LOG_FILE="$SCRIPT_DIR/install-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

log()      { echo -e "$@"; }
info()     { echo -e "${CYAN}ℹ ${NC}$*"; }
ok()       { echo -e "${GREEN}✓ ${NC}$*"; }
warn()     { echo -e "${YELLOW}⚠ ${NC}$*"; }
err()      { echo -e "${RED}✗ ${NC}$*"; }
step()     { echo -e "\n${CYAN}${BOLD}▶ $*${NC}"; }

trap 'err "Kurulum satır $LINENO'\''de durdu. Ayrıntı için: $LOG_FILE"; exit 1' ERR

# ---- Yardımcılar ----
gen_secret()   { openssl rand -base64 "${1:-32}" | tr -dc 'a-zA-Z0-9' | head -c "${2:-32}"; }
command_exists(){ command -v "$1" >/dev/null 2>&1; }

ask() { # ask "Soru" "varsayilan" -> echo cevap
  local prompt="$1" default="${2:-}" answer
  if [ -n "$default" ]; then
    read -rp "$(echo -e "  ${BOLD}${prompt}${NC} [${default}]: ")" answer
    echo "${answer:-$default}"
  else
    read -rp "$(echo -e "  ${BOLD}${prompt}${NC}: ")" answer
    echo "$answer"
  fi
}

ask_yes_no() { # ask_yes_no "Soru" "y|n" -> 0(yes)/1(no)
  local prompt="$1" default="${2:-y}" answer
  read -rp "$(echo -e "  ${BOLD}${prompt}${NC} [$([ "$default" = y ] && echo "E/h" || echo "e/H")]: ")" answer
  answer="${answer:-$default}"
  [[ "$answer" =~ ^[EeYy] ]]
}

ask_secret() { # ask_secret "Soru" -> echo (gizli giriş)
  local prompt="$1" s1 s2
  while true; do
    read -rsp "$(echo -e "  ${BOLD}${prompt}${NC}: ")" s1; echo >&2
    read -rsp "$(echo -e "  ${BOLD}Tekrar${NC}: ")" s2; echo >&2
    if [ "$s1" != "$s2" ]; then err "Parolalar eşleşmedi, tekrar deneyin." >&2; continue; fi
    if [ ${#s1} -lt 8 ] || ! [[ "$s1" =~ [A-Z] ]] || ! [[ "$s1" =~ [a-z] ]] || ! [[ "$s1" =~ [0-9] ]]; then
      err "Parola en az 8 karakter, büyük+küçük harf ve rakam içermeli." >&2; continue
    fi
    echo "$s1"; return 0
  done
}

clear
log "${CYAN}${BOLD}======================================================================${NC}"
log "${GREEN}${BOLD}                 HostPanel — Kurulum Sihirbazı                       ${NC}"
log "${CYAN}${BOLD}======================================================================${NC}"
log "Tarih    : $(date)"
log "Log      : $LOG_FILE"
log ""

# ------------------------------------------------------------------------------
# 1) Ön kontroller
# ------------------------------------------------------------------------------
step "[1/9] Ön kontroller"

if [ "$EUID" -ne 0 ]; then
  err "Bu script root yetkisi ister. Çalıştırın:  ${YELLOW}sudo ./install.sh${NC}"
  exit 1
fi
ok "Root yetkisi mevcut."

if [ -f /etc/os-release ]; then . /etc/os-release; fi
OS_ID="${ID:-bilinmiyor}"
if [[ "$OS_ID" != "ubuntu" && "$OS_ID" != "debian" ]]; then
  warn "Bu installer Ubuntu/Debian için tasarlandı (algılanan: $OS_ID). Devam riskli olabilir."
  ask_yes_no "Yine de devam edilsin mi?" "n" || { err "Kurulum iptal edildi."; exit 1; }
else
  ok "İşletim sistemi: ${PRETTY_NAME:-$OS_ID}"
fi

ARCH="$(uname -m)"
ok "Mimari: $ARCH"

# ------------------------------------------------------------------------------
# 2) İnteraktif yapılandırma
# ------------------------------------------------------------------------------
step "[2/9] Yapılandırma bilgileri"

if [ -f "$SCRIPT_DIR/.env" ]; then
  warn "Mevcut bir .env dosyası bulundu."
  if ask_yes_no "Mevcut .env korunsun ve yeniden kullanılsın mı?" "y"; then
    REUSE_ENV=1; ok "Mevcut .env kullanılacak."
  else
    REUSE_ENV=0; cp "$SCRIPT_DIR/.env" "$SCRIPT_DIR/.env.bak-$(date +%s)"; info "Eski .env yedeklendi."
  fi
else
  REUSE_ENV=0
fi

if [ "${REUSE_ENV:-0}" -eq 0 ]; then
  # Public IP algıla
  info "Sunucu public IP'si algılanıyor..."
  DETECTED_IP="$(curl -fsS --max-time 8 https://ipinfo.io/ip 2>/dev/null || curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  DETECTED_IP="${DETECTED_IP:-127.0.0.1}"
  SERVER_IP="$(ask "Sunucu public IP adresi" "$DETECTED_IP")"

  # Panel erişim adresi
  log ""
  info "Panele tarayıcıdan hangi adresle erişeceksiniz?"
  info "  • IP ile:    http://${SERVER_IP}"
  info "  • Domain ile: https://panel.alanadiniz.com (DNS'i bu sunucuya yönlendirin)"
  PANEL_HOST="$(ask "Panel erişim adresi (IP veya domain)" "$SERVER_IP")"
  if [[ "$PANEL_HOST" =~ ^https?:// ]]; then FRONTEND_URL="$PANEL_HOST"; else FRONTEND_URL="http://${PANEL_HOST}"; fi

  HTTP_PORT="$(ask "HTTP portu" "80")"
  HTTPS_PORT="$(ask "HTTPS portu" "443")"

  # Admin hesabı
  log ""
  info "İlk panel yöneticisi (admin) hesabı:"
  ADMIN_USER="$(ask "Admin kullanıcı adı" "admin")"
  ADMIN_EMAIL="$(ask "Admin e-posta" "admin@${PANEL_HOST#http*://}")"
  if ask_yes_no "Admin parolasını otomatik üreteyim mi? (Hayır = kendiniz girin)" "y"; then
    ADMIN_PASSWORD="$(gen_secret 18 18)A1!"
    AUTO_ADMIN_PW=1
  else
    ADMIN_PASSWORD="$(ask_secret "Admin parolası")"
    AUTO_ADMIN_PW=0
  fi

  # Veritabanı şifreleri
  log ""
  if ask_yes_no "Veritabanı/Redis şifrelerini otomatik güçlü üreteyim mi?" "y"; then
    MYSQL_ROOT_PASSWORD="$(gen_secret 24 24)"
    MYSQL_PASSWORD="$(gen_secret 24 24)"
    REDIS_PASSWORD="$(gen_secret 24 24)"
    ok "Güçlü rastgele şifreler üretildi."
  else
    MYSQL_ROOT_PASSWORD="$(ask_secret "MySQL root parolası")"
    MYSQL_PASSWORD="$(ask_secret "MySQL panel kullanıcı parolası")"
    REDIS_PASSWORD="$(ask_secret "Redis parolası")"
  fi
  JWT_SECRET="$(gen_secret 48 48)"

  # Opsiyonel servisler
  log ""
  INSTALL_HOST_SVC=1
  ask_yes_no "Mail/DNS/FTP host servisleri kurulsun mu? (postfix, dovecot, bind9, vsftpd, opendkim, fail2ban)" "y" || INSTALL_HOST_SVC=0

  # SSL
  SETUP_SSL=0; LETSENCRYPT_EMAIL="admin@${PANEL_HOST#http*://}"
  if [[ ! "$PANEL_HOST" =~ ^[0-9.]+$ ]]; then
    if ask_yes_no "Panel domaini için Let's Encrypt SSL kurulsun mu? (domain DNS'i bu sunucuya bakmalı)" "n"; then
      SETUP_SSL=1
      LETSENCRYPT_EMAIL="$(ask "Let's Encrypt bildirim e-postası" "$LETSENCRYPT_EMAIL")"
    fi
  fi

  # Webmail (opsiyonel)
  NEXT_PUBLIC_WEBMAIL_URL=""
  if ask_yes_no "Webmail (Roundcube) bağlantısı tanımlanacak mı?" "n"; then
    NEXT_PUBLIC_WEBMAIL_URL="$(ask "Webmail adresi (örn. https://webmail.alanadiniz.com)" "")"
  fi
fi

# ------------------------------------------------------------------------------
# 3) Sistem paketleri
# ------------------------------------------------------------------------------
step "[3/9] Sistem paketleri kuruluyor"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || warn "apt-get update kısmen başarısız."
apt-get install -y curl ca-certificates openssl ufw >/dev/null 2>&1 || true
ok "Temel araçlar hazır (curl, openssl, ufw)."

# ------------------------------------------------------------------------------
# 4) Docker & Docker Compose
# ------------------------------------------------------------------------------
step "[4/9] Docker & Docker Compose"
if ! command_exists docker; then
  info "Docker kuruluyor..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh >/dev/null 2>&1
  systemctl enable --now docker >/dev/null 2>&1 || true
  ok "Docker kuruldu."
else
  ok "Docker zaten kurulu."
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command_exists docker-compose; then
  COMPOSE="docker-compose"
else
  info "Docker Compose plugin kuruluyor..."
  apt-get install -y docker-compose-plugin >/dev/null 2>&1 || true
  if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else
    curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    COMPOSE="docker-compose"
  fi
fi
ok "Compose komutu: $COMPOSE"

# ------------------------------------------------------------------------------
# 5) Host servisleri (opsiyonel)
# ------------------------------------------------------------------------------
step "[5/9] Host servisleri"
if [ "${INSTALL_HOST_SVC:-0}" -eq 1 ]; then
  info "Mail/DNS/FTP/PHP servisleri kuruluyor (birkaç dakika sürebilir)..."
  PKGS="php8.3-fpm postfix dovecot-core dovecot-imapd vsftpd bind9 opendkim opendkim-tools fail2ban"
  if ! apt-get install -y $PKGS >/dev/null 2>&1; then
    warn "Bazı paketler kurulamadı (php8.3 deposu eksik olabilir). Genel php-fpm deneniyor..."
    apt-get install -y php-fpm postfix dovecot-core dovecot-imapd vsftpd bind9 opendkim opendkim-tools fail2ban >/dev/null 2>&1 || warn "Host servis kurulumu kısmen başarısız — log'a bakın."
  fi
  for svc in php8.3-fpm postfix dovecot vsftpd named bind9 opendkim fail2ban; do
    systemctl enable --now "$svc" >/dev/null 2>&1 || true
  done
  ok "Host servisleri kuruldu ve etkinleştirildi (per-domain ayarı paneli kullanırken yapılır)."
else
  warn "Host servisleri atlandı. Web + panel çalışır; mail/DNS/FTP için sonra kurabilirsiniz."
fi

# vsftpd userlist (panel FTP modeli) — boş allowlist
touch /etc/vsftpd.userlist 2>/dev/null || true

# ------------------------------------------------------------------------------
# 6) Dizin yapısı, SSL ve .env
# ------------------------------------------------------------------------------
step "[6/9] Dizinler, sertifika ve .env"
mkdir -p /var/www/nginx-vhosts /var/backups/hosting /etc/letsencrypt/_default /var/run/php /var/mail/vhosts
ok "Gerekli dizinler oluşturuldu."

if [ ! -f /etc/letsencrypt/_default/fullchain.pem ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -subj "/CN=default.local" \
    -keyout /etc/letsencrypt/_default/privkey.pem \
    -out /etc/letsencrypt/_default/fullchain.pem >/dev/null 2>&1
  ok "Varsayılan self-signed SSL sertifikası üretildi (443 catch-all için)."
else
  ok "Varsayılan SSL sertifikası zaten mevcut."
fi

if [ "${REUSE_ENV:-0}" -eq 0 ]; then
  umask 077
  cat > "$SCRIPT_DIR/.env" <<EOF
# HostPanel .env — install.sh tarafından $(date) üretildi. GİZLİDİR, paylaşmayın.
NODE_ENV=production
PORT=4000

SERVER_IP=${SERVER_IP}
FRONTEND_URL=${FRONTEND_URL}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

DATABASE_URL=file:/var/www/hosting_panel.db

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=hosting_panel
MYSQL_USER=panel_user
MYSQL_ADMIN_USER=root
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_ADMIN_PASS=${MYSQL_ROOT_PASSWORD}

REDIS_PASSWORD=${REDIS_PASSWORD}

WEB_ROOT=/var/www
NGINX_SITES_AVAILABLE=/var/www/nginx-vhosts
NGINX_SITES_ENABLED=/var/www/nginx-vhosts
PHP_FPM_SOCK_DIR=/var/run/php
FTP_USERLIST_FILE=/etc/vsftpd.userlist
FTP_SHELL=/usr/sbin/nologin
FTP_WEB_GROUP=www-data
MAIL_BASE=/var/mail/vhosts
BACKUP_BASE=/var/backups/hosting

LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}
CERTBOT_BIN=certbot

NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_WEBMAIL_URL=${NEXT_PUBLIC_WEBMAIL_URL}

LOG_LEVEL=info
LOG_DIR=./logs
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_MAX=5
EOF
  umask 022
  ok ".env güvenli izinlerle (600) oluşturuldu."
fi

# ------------------------------------------------------------------------------
# 7) Güvenlik duvarı
# ------------------------------------------------------------------------------
step "[7/9] Güvenlik duvarı (ufw)"
if command_exists ufw; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT:-80}/tcp" >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT:-443}/tcp" >/dev/null 2>&1 || true
  if [ "${INSTALL_HOST_SVC:-0}" -eq 1 ]; then
    ufw allow 21/tcp >/dev/null 2>&1 || true              # FTP
    ufw allow 40000:40100/tcp >/dev/null 2>&1 || true     # FTP passive
    ufw allow 25/tcp >/dev/null 2>&1 || true               # SMTP
    ufw allow 587/tcp >/dev/null 2>&1 || true              # Submission
    ufw allow 993/tcp >/dev/null 2>&1 || true              # IMAPS
    ufw allow 53 >/dev/null 2>&1 || true                   # DNS
  fi
  ok "Gerekli portlar açıldı (SSH dahil). ufw'yi siz etkinleştirebilirsiniz: ufw enable"
else
  warn "ufw bulunamadı, güvenlik duvarı adımı atlandı."
fi

# ------------------------------------------------------------------------------
# 8) Konteynerleri başlat + DB + admin
# ------------------------------------------------------------------------------
step "[8/9] Panel konteynerleri ayağa kaldırılıyor (build birkaç dakika sürebilir)"
$COMPOSE up -d --build

info "Backend hazır olana kadar bekleniyor..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T backend node -e "process.exit(0)" >/dev/null 2>&1; then break; fi
  sleep 2
done

info "Veritabanı şeması uygulanıyor (prisma db push)..."
$COMPOSE exec -T backend npx prisma db push --skip-generate >/dev/null 2>&1 || \
  $COMPOSE exec -T backend npx prisma db push --skip-generate

info "İlk admin ve başlangıç verisi oluşturuluyor..."
$COMPOSE exec -T \
  -e ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}" \
  -e ADMIN_USER="${ADMIN_USER:-admin}" \
  -e ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" \
  backend node prisma/seed.js
ok "Veritabanı hazır."

# ------------------------------------------------------------------------------
# 9) Sağlık kontrolü
# ------------------------------------------------------------------------------
step "[9/9] Servis sağlık kontrolü"
sleep 3
declare -A RESULTS
for c in hosting_mysql hosting_redis hosting_backend hosting_frontend hosting_nginx; do
  if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
    RESULTS[$c]="çalışıyor"; ok "$c: çalışıyor"
  else
    RESULTS[$c]="DURMUŞ"; err "$c: DURMUŞ — '$COMPOSE logs ${c#hosting_}' ile bakın"
  fi
done

if [ "${INSTALL_HOST_SVC:-0}" -eq 1 ]; then
  for s in php8.3-fpm postfix dovecot vsftpd named opendkim fail2ban; do
    if systemctl is-active --quiet "$s" 2>/dev/null; then ok "host/$s: aktif"; else warn "host/$s: aktif değil (panelden başlatılabilir)"; fi
  done
fi

# ---- SSL (opsiyonel, en sonda) ----
if [ "${SETUP_SSL:-0}" -eq 1 ]; then
  step "Let's Encrypt SSL"
  if ! command_exists certbot; then apt-get install -y certbot >/dev/null 2>&1 || true; fi
  warn "SSL kurulumunu panel arayüzünden (SSL Sertifikaları) yapmanız önerilir; DNS doğrulaması gerekir."
fi

# ------------------------------------------------------------------------------
# Özet
# ------------------------------------------------------------------------------
PANEL_URL="${FRONTEND_URL:-http://localhost}"
[ "${HTTP_PORT:-80}" != "80" ] && PANEL_URL="${PANEL_URL}:${HTTP_PORT}"

log ""
log "${CYAN}${BOLD}======================================================================${NC}"
log "${GREEN}${BOLD}  🎉 HostPanel kurulumu tamamlandı!${NC}"
log "${CYAN}${BOLD}======================================================================${NC}"
log "  Panel adresi : ${CYAN}${BOLD}${PANEL_URL}${NC}"
log "  Admin kul.adı: ${YELLOW}${ADMIN_USER:-admin}${NC}"
log "  Admin e-posta: ${YELLOW}${ADMIN_EMAIL:-admin@example.com}${NC}"
if [ "${AUTO_ADMIN_PW:-0}" -eq 1 ]; then
  log "  Admin parola : ${YELLOW}${ADMIN_PASSWORD}${NC}  ${RED}(bu parolayı kaydedin!)${NC}"
else
  log "  Admin parola : ${YELLOW}(kurulumda belirlediğiniz parola)${NC}"
fi
log ""
log "  • İlk girişten sonra parolanızı değiştirin."
log "  • Tüm secret'lar ${BOLD}.env${NC} dosyasında (izin 600, git'e gitmez)."
log "  • Kurulum logu: ${BOLD}${LOG_FILE}${NC}"
log "  • Yönetim: ${BOLD}${COMPOSE} ps${NC} | ${BOLD}${COMPOSE} logs -f${NC} | ${BOLD}./update.sh${NC} | ${BOLD}./uninstall.sh${NC}"
log "${CYAN}${BOLD}======================================================================${NC}"

#!/usr/bin/env bash
# ==============================================================================
# HostPanel — Güncelleme Scripti
# Yeni sürümü çeker, konteynerleri yeniden derler ve şema değişikliklerini uygular.
# Veriler (DB, /var/www) korunur.
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ok(){ echo -e "${GREEN}✓ ${NC}$*"; }
info(){ echo -e "${CYAN}ℹ ${NC}$*"; }
warn(){ echo -e "${YELLOW}⚠ ${NC}$*"; }
err(){ echo -e "${RED}✗ ${NC}$*"; }

if [ "$EUID" -ne 0 ]; then err "Root yetkisi gerekli:  sudo ./update.sh"; exit 1; fi
if [ ! -f "$SCRIPT_DIR/.env" ]; then err ".env bulunamadı. Önce install.sh çalıştırın."; exit 1; fi

if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi

echo -e "${CYAN}${BOLD}HostPanel Güncelleme${NC}"

# Yeni kodu çek (git repo ise)
if [ -d "$SCRIPT_DIR/.git" ]; then
  info "Yeni sürüm çekiliyor (git pull)..."
  git -C "$SCRIPT_DIR" pull --ff-only || warn "git pull başarısız — yerel değişiklikler olabilir."
else
  warn "Git reposu değil; yeni dosyaları elle yüklediğinizi varsayıyorum."
fi

# Yedek öner
info "Güncellemeden önce veritabanı yedeği almanız önerilir (panel > Yedeklemeler)."

# Yeniden derle ve başlat
info "Konteynerler yeniden derleniyor..."
$COMPOSE up -d --build

# Şema değişikliklerini uygula
info "Veritabanı şeması güncelleniyor..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T backend node -e "process.exit(0)" >/dev/null 2>&1; then break; fi
  sleep 2
done
$COMPOSE exec -T backend npx prisma db push --skip-generate || warn "prisma db push başarısız — log'a bakın."

# Sağlık kontrolü
sleep 3
for c in hosting_mysql hosting_redis hosting_backend hosting_frontend hosting_nginx; do
  if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then ok "$c: çalışıyor"; else err "$c: DURMUŞ"; fi
done

ok "Güncelleme tamamlandı."

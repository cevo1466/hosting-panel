#!/usr/bin/env bash
# ==============================================================================
# HostPanel — Kaldırma Scripti
# Panel konteynerlerini durdurur ve (isteğe bağlı) verileri siler.
# Müşteri site dosyaları (/var/www) VARSAYILAN OLARAK KORUNUR.
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ok(){ echo -e "${GREEN}✓ ${NC}$*"; }
warn(){ echo -e "${YELLOW}⚠ ${NC}$*"; }
err(){ echo -e "${RED}✗ ${NC}$*"; }

if [ "$EUID" -ne 0 ]; then err "Root yetkisi gerekli:  sudo ./uninstall.sh"; exit 1; fi

if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi

echo -e "${CYAN}${BOLD}HostPanel Kaldırma${NC}"
echo -e "${YELLOW}Bu işlem panel konteynerlerini durduracak.${NC}"
read -rp "$(echo -e "  Devam edilsin mi? [e/H]: ")" c
[[ "$c" =~ ^[EeYy] ]] || { echo "İptal edildi."; exit 0; }

# Konteynerleri durdur
read -rp "$(echo -e "  Veritabanı/Redis volume'leri de SİLİNSİN Mİ? (panel verisi gider) [e/H]: ")" delvol
if [[ "$delvol" =~ ^[EeYy] ]]; then
  $COMPOSE down -v || true
  ok "Konteynerler ve volume'ler kaldırıldı."
else
  $COMPOSE down || true
  ok "Konteynerler durduruldu (volume'ler korundu)."
fi

# İmajlar
read -rp "$(echo -e "  Panel Docker imajları silinsin mi? [e/H]: ")" delimg
if [[ "$delimg" =~ ^[EeYy] ]]; then
  docker rmi hostpanel-backend hostpanel-frontend >/dev/null 2>&1 || true
  ok "Panel imajları silindi."
fi

warn "Müşteri site dosyaları (/var/www) ve host servisleri (postfix, bind, ...) KORUNDU."
warn ".env dosyası korundu. Tamamen temizlemek için elle silin: rm -f $SCRIPT_DIR/.env"
ok "Kaldırma tamamlandı."

#!/usr/bin/env bash
# ==============================================================================
# HostPanel — Kurulum Sonrası Sağlık Kontrolü
# Tüm servislerin durumunu raporlar. Kurulumdan sonra istediğiniz zaman çalıştırın.
# ==============================================================================
set -uo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok(){ echo -e "${GREEN}✓ ${NC}$*"; }
bad(){ echo -e "${RED}✗ ${NC}$*"; }
warn(){ echo -e "${YELLOW}⚠ ${NC}$*"; }

echo -e "${CYAN}${BOLD}HostPanel — Sağlık Kontrolü ($(date))${NC}"
echo "----------------------------------------------------------------------"

FAIL=0

echo -e "\n${BOLD}Docker konteynerleri:${NC}"
for c in hosting_mysql hosting_redis hosting_backend hosting_frontend hosting_nginx; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${c}$"; then
    ok "$c"
  else
    bad "$c (durmuş)"; FAIL=$((FAIL+1))
  fi
done

echo -e "\n${BOLD}Host servisleri (systemd):${NC}"
for s in php8.3-fpm postfix dovecot vsftpd named opendkim fail2ban; do
  if systemctl is-active --quiet "$s" 2>/dev/null; then
    ok "$s"
  else
    warn "$s (aktif değil — kullanmıyorsanız normal)"
  fi
done

echo -e "\n${BOLD}Panel HTTP yanıtı:${NC}"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://localhost 2>/dev/null || echo 000)"
if [[ "$CODE" =~ ^(200|301|302|307|308)$ ]]; then ok "Panel yanıt veriyor (HTTP $CODE)"; else bad "Panel yanıt vermedi (HTTP $CODE)"; FAIL=$((FAIL+1)); fi

echo "----------------------------------------------------------------------"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}Tüm kritik servisler çalışıyor.${NC}"
else
  echo -e "${RED}${BOLD}$FAIL kritik sorun bulundu.${NC} 'docker compose logs -f' ile inceleyin."
  exit 1
fi

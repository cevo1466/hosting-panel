# Servisler & Portlar

## Docker Konteynerleri

| Konteyner | İmaj | Görev | Port (host) |
|-----------|------|-------|-------------|
| `hosting_nginx` | nginx:1.25-alpine | Ön yüz / reverse proxy | 80, 443 |
| `hosting_frontend` | hostpanel-frontend | Next.js panel arayüzü | (iç) 3000 |
| `hosting_backend` | hostpanel-backend | Express API + Socket.IO | (iç) 4000 |
| `hosting_mysql` | mariadb:10.11 | Müşteri veritabanları | 127.0.0.1:3306 |
| `hosting_redis` | redis:7-alpine | Kuyruk / önbellek / oturum | 127.0.0.1:6379 |

> Panelin **kendi** verisi SQLite'tadır (`/var/www/hosting_panel.db`). MariaDB müşteri
> veritabanları içindir.

## Host Servisleri (systemd)

Backend bunlara `nsenter --target 1` ile erişip yapılandırır:

| Servis | Görev |
|--------|-------|
| `php8.3-fpm` | PHP çalıştırma (FastCGI) |
| `postfix` | SMTP / giden-gelen posta |
| `dovecot` | IMAP/POP3 posta erişimi |
| `vsftpd` | FTP (sistem kullanıcısı + userlist allowlist modeli) |
| `named` (bind9) | Yetkili DNS sunucusu |
| `opendkim` | Posta DKIM imzalama |
| `fail2ban` | Kaba kuvvet koruması |

## Açılması Gereken Portlar

| Port | Protokol | Servis | Zorunlu mu? |
|------|----------|--------|-------------|
| 22 | TCP | SSH | Evet |
| 80 | TCP | HTTP (panel + siteler) | Evet |
| 443 | TCP | HTTPS | Evet (SSL için) |
| 21 | TCP | FTP kontrol | FTP kullanılıyorsa |
| 40000–40100 | TCP | FTP pasif mod | FTP kullanılıyorsa |
| 25 | TCP | SMTP | Mail kullanılıyorsa |
| 587 | TCP | SMTP submission | Mail kullanılıyorsa |
| 993 | TCP | IMAPS | Mail kullanılıyorsa |
| 53 | TCP/UDP | DNS | DNS kullanılıyorsa |

`install.sh` bu portları `ufw` ile açar (host servisleri seçildiyse mail/DNS/FTP dahil).
Güvenlik duvarını etkinleştirmek için kurulumdan sonra: `sudo ufw enable`.

## Servis Yönetimi

```bash
docker compose ps                 # konteyner durumları
docker compose restart backend    # bir konteyneri yeniden başlat
docker compose logs -f nginx      # canlı log
bash scripts/healthcheck.sh       # toplu sağlık kontrolü
```

Host servisleri panel arayüzünden **Servisler** sayfasında başlatılıp durdurulabilir.

## Yeniden Başlatma Davranışı

- Konteynerler: `restart: always` → sunucu açılışında otomatik başlar.
- Host servisleri: `systemctl enable` → otomatik başlar.

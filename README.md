# HostPanel

Açık, kendi sunucunuzda barındırabileceğiniz (self-hosted) web hosting kontrol paneli.
Domain, subdomain, DNS, SSL, FTP, dosya yöneticisi, veritabanı, e-posta, PHP sürüm
yönetimi, yedekleme ve sunucu izleme — tek arayüzden.

> **Tek komutla kurulum:** `sudo ./install.sh` — sihirbaz size IP, domain, admin
> hesabı ve portları sorar; güçlü secret'ları kendisi üretir; tüm servisleri ayağa
> kaldırır ve sağlık kontrolü yapar.

---

## Özellikler

| Modül | Açıklama |
|------|----------|
| 🌐 Domain & Subdomain | Alan adı/alt alan adı ekleme, nginx vhost otomatik üretimi |
| 🧭 DNS Yönetimi | BIND zone dosyaları, kayıt yönetimi |
| 🔒 SSL | Let's Encrypt ile ücretsiz sertifika kurulum/yenileme |
| 📁 Dosya Yöneticisi | Tarama, yükleme, düzenleme, **çöp kutusu** (geri yükle / kalıcı sil) |
| 👤 FTP/SFTP | Sistem kullanıcısı tabanlı FTP hesapları, sistemle senkronizasyon |
| 🗄️ Veritabanı | MariaDB veritabanı + kullanıcı yönetimi |
| ✉️ E-posta | Posta hesapları, Postfix/Dovecot, webmail bağlantısı |
| 🐘 PHP | Sürüm yönetimi (PHP-FPM) |
| 💾 Yedekleme | Site/veritabanı yedekleme ve geri yükleme |
| 📊 İzleme | CPU/RAM/Disk/Ağ, servis durumu, loglar |
| 🛡️ Güvenlik | Fail2Ban, güvenlik duvarı, oturum yönetimi, 2FA |

---

## Mimari

```
                 ┌──────────────────────── Docker ────────────────────────┐
  İnternet ──►  nginx (80/443)  ─►  frontend (Next.js)  ─►  backend (Express API)
                                                              │   │   │
                                                       ┌──────┘   │   └──────┐
                                                    MariaDB     Redis    (SQLite: panel verisi)
                 └─────────────────────────────────────────────────────────┘
                                                              │ nsenter --target 1
                 ┌──────────────────── Host (systemd) ────────┼─────────────┐
                 php-fpm · postfix · dovecot · vsftpd · bind9 · opendkim · fail2ban
                 └─────────────────────────────────────────────────────────┘
```

- **Docker** katmanı: nginx, frontend, backend, MariaDB, Redis.
- **Host** katmanı: mail/DNS/FTP/PHP servisleri. Backend bunlara `nsenter` ile erişir
  (bu yüzden `backend` konteyneri `privileged: true` + `pid: host` çalışır).
- Panel; domain/e-posta eklediğinizde nginx vhost, BIND zone ve mail yapılandırmasını
  **otomatik** üretir.

---

## Hızlı Kurulum

```bash
# 1) Dosyaları sunucuya yükleyin (FileZilla/SFTP) veya git ile çekin:
git clone https://github.com/<kullanici>/hosting-panel.git
cd hosting-panel

# 2) Kurulum sihirbazını çalıştırın:
chmod +x install.sh
sudo ./install.sh

# 3) Tarayıcıdan panele girin:  http://SUNUCU_IP
```

Ayrıntılı adımlar: [docs/INSTALL.md](docs/INSTALL.md)

---

## Minimum Sistem Gereksinimleri

| | Minimum | Önerilen |
|--|--|--|
| İşletim sistemi | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 40 GB+ SSD |
| Public IP | Gerekli | Gerekli |
| Domain | Opsiyonel (IP ile de çalışır) | Önerilir (SSL için) |

Açılması gereken portlar: [docs/SERVICES.md](docs/SERVICES.md)

---

## Yönetim Komutları

```bash
sudo ./install.sh        # kurulum sihirbazı
sudo ./update.sh         # yeni sürüme güncelle (veriler korunur)
sudo ./uninstall.sh      # kaldır (müşteri verisi korunur)
bash scripts/healthcheck.sh   # servis sağlık kontrolü
docker compose ps        # konteyner durumu
docker compose logs -f   # canlı log
```

---

## Dokümantasyon

- [Kurulum](docs/INSTALL.md)
- [Güvenlik](docs/SECURITY.md)
- [Servisler & Portlar](docs/SERVICES.md)
- [Sorun Giderme](docs/TROUBLESHOOTING.md)

---

## Güvenlik Özeti

- Tüm secret'lar kurulumda **rastgele üretilir**, `.env`'de (izin 600) tutulur, git'e gönderilmez.
- Parolalar bcrypt ile hashlenir. Varsayılan/sabit admin parolası **yoktur**.
- Ayrıntı ve sıkılaştırma: [docs/SECURITY.md](docs/SECURITY.md).

## Lisans

Ticari ürün. Tüm hakları saklıdır.

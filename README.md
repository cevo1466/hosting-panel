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

## Nasıl Kurulur?

Kurulum tamamen otomatiktir. Docker, tüm servisler ve veritabanı sihirbaz tarafından
kurulur — sizin elle bir şey yapılandırmanız gerekmez.

### Gereksinimler

- Temiz bir **Ubuntu 22.04 / 24.04 LTS** (veya Debian 12) sunucu
- **root** erişimi (`sudo`)
- Bir **public IP** (domain opsiyonel — IP ile de çalışır)
- En az **2 GB RAM**, **20 GB** disk

### Adım 1 — Kodu sunucuya indirin

Sunucuya root ile bağlanın, sonra iki yoldan biriyle kodu çekin:

**Yol A — Git ile (önerilen):**
```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/cevo1466/hosting-panel.git
cd hosting-panel
```

**Yol B — ZIP ile (git istemiyorsanız):**
```bash
sudo apt update && sudo apt install -y wget unzip
wget https://github.com/cevo1466/hosting-panel/archive/refs/heads/main.zip
unzip main.zip
cd hosting-panel-main
```

> FileZilla/SFTP ile elle yüklemeyi tercih ederseniz, klasörü sunucuya atıp o dizine `cd` yapın.

### Adım 2 — Kurulum sihirbazını çalıştırın

```bash
chmod +x install.sh
sudo ./install.sh
```

Sihirbaz size sırayla şunları sorar (çoğunun makul varsayılanı vardır, Enter'a basabilirsiniz):

- **Sunucu IP'si** — otomatik algılanır, onaylamanız yeterli
- **Panel adresi** — IP veya domain (örn. `panel.alanadiniz.com`)
- **Admin kullanıcı adı, e-posta ve parola** — parolayı otomatik üretebilir
- **Veritabanı/Redis şifreleri** — otomatik güçlü üretim önerilir
- **Mail/DNS/FTP servisleri kurulsun mu?** — evet/hayır
- **SSL kurulsun mu?** (domain kullanıyorsanız)

Sonra her şeyi kendi yapar: Docker kurulumu → servisler → konteynerler → veritabanı →
ilk admin → **10 servisin sağlık kontrolü** → özet ekran.

### Adım 3 — Panele girin

Kurulum bitince ekranda panel adresi ve admin bilgileri gösterilir. Tarayıcıdan:

```
http://SUNUCU_IP
```

adresine gidip kurulumda belirlediğiniz **kullanıcı adı/e-posta ve parola** ile giriş yapın.
**İlk işiniz parolayı değiştirmek olsun.**

### Kurulum sonrası kontrol

```bash
bash scripts/healthcheck.sh    # tüm servisleri tek tek kontrol eder
```

> Sorun yaşarsanız: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) · Ayrıntılı kurulum: [docs/INSTALL.md](docs/INSTALL.md)

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

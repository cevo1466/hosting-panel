# HostPanel

Açık, kendi sunucunuzda barındırabileceğiniz (self-hosted) web hosting kontrol paneli.
Domain, subdomain, DNS, SSL, FTP, dosya yöneticisi, veritabanı, e-posta, PHP sürüm
yönetimi, yedekleme ve sunucu izleme — tek arayüzden.

🌐 **English:** [jump to English section ↓](#english)

> **Tek komutla kurulum:** `sudo ./install.sh` — sihirbaz size IP, domain, admin
> hesabı ve portları sorar; güçlü secret'ları kendisi üretir; tüm servisleri ayağa
> kaldırır ve sağlık kontrolü yapar.

---

## Özellikler

Tek arayüzden eksiksiz hosting yönetimi:

### 🌐 Web & Alan Adı
- **Domain yönetimi** — alan adı ekleme/silme/askıya alma, nginx vhost **otomatik** üretimi
- **Subdomain** — sınırsız alt alan adı, her biri için ayrı doküman kökü
- **DNS yönetimi** — BIND zone dosyaları; A, AAAA, CNAME, MX, TXT, NS kayıtları
- **SSL sertifikaları** — Let's Encrypt ile ücretsiz kurulum + **otomatik yenileme**
- **PHP sürüm yönetimi** — domain başına PHP-FPM sürümü seçimi

### 📂 Dosya & Aktarım
- **Dosya yöneticisi** — tarama, yükleme, düzenleme, klasör oluşturma, yeniden adlandırma
- **Çöp kutusu** — silinen dosyalar önce çöpe gider; **geri yükle** veya **kalıcı sil**
- **Toplu işlem** — tümünü seç, toplu silme
- **FTP/SFTP** — sistem kullanıcısı tabanlı hesaplar, kota, mevcut sistemle **senkronizasyon**

### 🗄️ Veritabanı & E-posta
- **MariaDB/MySQL** — veritabanı + kullanıcı oluşturma/yönetme, yetkilendirme
- **E-posta hesapları** — Postfix + Dovecot (IMAP/POP3), OpenDKIM imzalama
- **Webmail** — Roundcube vb. bağlantı entegrasyonu

### 💾 Yedekleme & İzleme
- **Yedekleme** — site + veritabanı yedeği alma, planlama
- **Geri yükleme** — yedekten tek tıkla dönüş
- **Sunucu izleme** — gerçek zamanlı CPU / RAM / Disk / Ağ grafikleri
- **Servis durumu** — 10 servisin canlı durumu, panelden başlat/durdur/yeniden başlat
- **Loglar** — sistem ve servis loglarını arayüzden görüntüleme

### 🛡️ Güvenlik & Yönetim
- **Kimlik doğrulama** — JWT oturum, **iki adımlı doğrulama (2FA/TOTP)**
- **Fail2Ban** — kaba kuvvet saldırılarına karşı koruma
- **Güvenlik duvarı** — ufw port yönetimi
- **Kullanıcı & paket yönetimi** — çoklu kullanıcı, Starter/Professional/Enterprise paket limitleri
- **Bildirimler** — sistem olayları için bildirim merkezi
- **Denetim kaydı (audit log)** — kritik işlemlerin izi

---

## Ekran Görüntüleri

> 📸 Görseller hazırlanıyor. `docs/screenshots/` klasörüne `dashboard.png`, `files.png`,
> `domains.png`, `services.png` eklendiğinde aşağıdaki ızgara otomatik görünür —
> bunun için aşağıdaki HTML yorumunu kaldırmanız yeterli.
> Rehber: [docs/screenshots/README.md](docs/screenshots/README.md).

<!-- Görseller eklendikten sonra bu yorum satırlarını silin:
| Panel (Dashboard) | Dosya Yöneticisi |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Dosya Yöneticisi](docs/screenshots/files.png) |

| Domain Yönetimi | Servis Durumu |
|---|---|
| ![Domainler](docs/screenshots/domains.png) | ![Servisler](docs/screenshots/services.png) |
-->

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

---

## English

**HostPanel** is a self-hosted web hosting control panel — manage domains, subdomains,
DNS, SSL, FTP/SFTP, files, databases, e-mail, PHP versions, backups and server monitoring
from a single interface. Built with Next.js (UI) + Node.js/Express (API) + MariaDB + Redis,
orchestrated with Docker Compose.

### Key features

- **Web & domains** — domain/subdomain management with automatic nginx vhost generation,
  BIND-based DNS, free Let's Encrypt SSL with auto-renewal, per-domain PHP version selection
- **Files & transfer** — full file manager with **trash** (restore / permanently delete),
  bulk actions, system-based FTP/SFTP accounts with sync
- **Databases & e-mail** — MariaDB database/user management, Postfix + Dovecot mail with
  OpenDKIM, webmail integration
- **Backup & monitoring** — site/database backup & restore, real-time CPU/RAM/disk/network
  graphs, live status of all services, log viewer
- **Security** — JWT auth with **2FA (TOTP)**, Fail2Ban, firewall (ufw), multi-user with
  package limits, audit logging

### Quick install

```bash
# On a fresh Ubuntu 22.04/24.04 server, as root:
git clone https://github.com/cevo1466/hosting-panel.git
cd hosting-panel
chmod +x install.sh
sudo ./install.sh
```

The interactive wizard auto-detects your IP, asks for the panel address, admin
credentials and ports, generates strong secrets, brings up all containers, creates the
database and first admin, then health-checks every service. When it finishes, open
`http://YOUR_SERVER_IP` and sign in with the credentials you chose.

### Requirements

Ubuntu 22.04/24.04 LTS (or Debian 12) · root access · public IP · min 2 GB RAM, 20 GB disk.
A domain is optional (works by IP; required for SSL).

### Security

All secrets are randomly generated at install time, stored in `.env` (mode 600, never
committed). Passwords are bcrypt-hashed. There is **no default/fixed admin password** — you
create your own admin during installation. See [docs/SECURITY.md](docs/SECURITY.md).

### Documentation

[Install](docs/INSTALL.md) · [Security](docs/SECURITY.md) · [Services & Ports](docs/SERVICES.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)

---

## Lisans / License

Ticari ürün, tüm hakları saklıdır. · Commercial product, all rights reserved.

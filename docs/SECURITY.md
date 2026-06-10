# Güvenlik

## Secret Yönetimi

- Tüm parolalar ve `JWT_SECRET` kurulumda **kriptografik olarak rastgele** üretilir
  (`openssl rand`). Sabit/varsayılan değer **yoktur**.
- Secret'lar yalnızca `.env` dosyasında tutulur; izinleri **600** (sadece root okur) ve
  `.gitignore` ile depodan **dışlanır**.
- Panel kullanıcı parolaları veritabanında **bcrypt** (12 tur) ile saklanır; düz metin tutulmaz.
- `.env.example` yalnızca şablondur, gerçek secret içermez.

## İlk Admin

- İlk admin yalnızca kurulum sırasında, sizin belirlediğiniz (veya otomatik üretilen)
  parolayla oluşturulur. `admin/admin`, `root/root`, `123456` gibi varsayılanlar kullanılmaz.
- Otomatik üretilen parola kurulum çıktısında **bir kez** gösterilir — kaydedin.
- **İlk girişten sonra parolanızı değiştirin** ve 2FA'yı etkinleştirin.

## Ağ / Güvenlik Duvarı

- `install.sh` yalnızca gerekli portları açar (bkz. [SERVICES.md](SERVICES.md)).
- MariaDB ve Redis yalnızca **127.0.0.1**'e bağlanır (dışarıya kapalı).
- `ufw enable` komutunu kurulumdan sonra siz çalıştırın (SSH portu önceden açılır).
- Eşleşmeyen HTTPS istekleri nginx tarafından `444` ile reddedilir → SSL'siz domainlerden
  başka müşterinin sitesi sızmaz.

## Oturum Güvenliği

- JWT tabanlı kimlik doğrulama, erişim + yenileme token'ı.
- Giriş hız sınırı (`LOGIN_RATE_LIMIT_MAX`) ve hesap kilitleme.
- TOTP tabanlı iki adımlı doğrulama (2FA) desteklenir.
- Fail2Ban ile kaba kuvvet saldırılarına karşı koruma (host servisi).

## privileged Backend Hakkında

`backend` konteyneri host systemd servislerini (php-fpm, postfix, bind, vsftpd, ...)
yönetebilmek için `privileged: true` + `pid: host` çalışır. Bu **bilinçli** bir tasarımdır:
panel, host servis yapılandırmasını üretip yeniden yükler. Sunucuya yalnızca güvendiğiniz
yöneticilerin SSH erişimi olmalıdır.

## Üretim Öncesi Sıkılaştırma Önerileri

1. İlk admin parolasını değiştirin, 2FA açın.
2. `ufw enable` ile güvenlik duvarını etkinleştirin.
3. SSH'ı anahtar tabanlı yapın, parola girişini kapatın.
4. Panel için bir domain + Let's Encrypt SSL kullanın (IP yerine).
5. Düzenli yedek alın (panel > Yedeklemeler) ve yedeği sunucu dışında saklayın.
6. `docker compose pull` + `./update.sh` ile düzenli güncelleyin.
7. `.env` dosyasını yedekleyin (secret'lar burada) ama **asla** paylaşmayın/commit'lemeyin.

## Bir Secret Sızarsa

`.env`'deki ilgili değeri değiştirin ve `./update.sh` (veya `docker compose up -d`)
ile yeniden başlatın. `JWT_SECRET` değişirse tüm oturumlar geçersiz olur (kullanıcılar
yeniden giriş yapar) — bu beklenen davranıştır.

# Kurulum Kılavuzu

## 1. Sunucu Hazırlığı

Temiz bir **Ubuntu 22.04 / 24.04 LTS** (veya Debian 12) sunucu, **root** erişimi ve bir
**public IP** gerekir. Domain opsiyoneldir (panele IP ile de girebilirsiniz; SSL için domain gerekir).

## 2. Dosyaları Yükleme

### Seçenek A — Git ile
```bash
git clone https://github.com/<kullanici>/hosting-panel.git
cd hosting-panel
```

### Seçenek B — FileZilla / SFTP ile
1. FileZilla ile `sftp://SUNUCU_IP` adresine root olarak bağlanın.
2. Proje klasörünü `/opt/hostpanel` (veya istediğiniz dizine) yükleyin.
3. SSH ile bağlanıp o dizine girin:
   ```bash
   cd /opt/hostpanel
   ```

## 3. Kurulum Sihirbazı

```bash
chmod +x install.sh
sudo ./install.sh
```

Sihirbaz sırasıyla şunları sorar / yapar:

1. **Ön kontroller** — root yetkisi, işletim sistemi, mimari.
2. **Yapılandırma** —
   - Sunucu public IP (otomatik algılanır, onaylatılır)
   - Panel erişim adresi (IP veya domain)
   - HTTP / HTTPS portları (varsayılan 80 / 443)
   - Admin kullanıcı adı, e-posta, parola (otomatik üretilebilir)
   - Veritabanı/Redis şifreleri (otomatik güçlü üretim önerilir)
   - Mail/DNS/FTP host servisleri kurulsun mu?
   - SSL ve webmail opsiyonları
3. **Sistem paketleri** ve **Docker/Compose** kurulumu (yoksa).
4. **Host servisleri** (seçildiyse): php-fpm, postfix, dovecot, vsftpd, bind9, opendkim, fail2ban.
5. **Dizinler + self-signed SSL + `.env`** üretimi (secret'lar rastgele).
6. **Güvenlik duvarı** (ufw) port açılışı.
7. **Konteynerler** `docker compose up -d --build`.
8. **Veritabanı şeması** (`prisma db push`) + **ilk admin** ve başlangıç verisi.
9. **Sağlık kontrolü** — tüm servisler tek tek raporlanır.

Kurulum sonunda panel adresi ve admin bilgileri ekranda gösterilir. Tüm çıktı
`install-YYYYMMDD-HHMMSS.log` dosyasına da yazılır.

## 4. İlk Giriş

Tarayıcıdan panel adresine gidin (örn. `http://SUNUCU_IP`), kurulumda belirlediğiniz
kullanıcı adı/e-posta ve parola ile giriş yapın. **İlk işiniz parolayı değiştirmek olsun.**

## 5. Kurulum Sonrası Kontrol

```bash
bash scripts/healthcheck.sh
```

## İdempotentlik

`install.sh` tekrar çalıştırılabilir. Mevcut `.env` bulunursa korunup kullanılabilir;
admin zaten varsa parolası sıfırlanmaz; paketler/dizinler yeniden oluşturulmaz.

## Elle (Docker'sız meraklılar için)

Panel Docker tabanlıdır; Docker olmadan kurulum desteklenmez. Geliştirme için
`backend/` ve `frontend/` klasörlerinde `npm install && npm run dev` çalıştırılabilir,
ancak host servis entegrasyonu (nsenter) yalnızca Docker + `privileged` modda çalışır.

## Yeniden Başlatma Sonrası

Tüm konteynerler `restart: always` ve host servisleri `systemctl enable` ile
işaretlidir → sunucu yeniden başladığında her şey otomatik ayağa kalkar.

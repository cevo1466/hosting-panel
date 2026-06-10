# Sorun Giderme

İlk adım her zaman: **sağlık kontrolü** ve **loglar**.
```bash
bash scripts/healthcheck.sh
docker compose ps
docker compose logs -f --tail=100
```

---

## Panel açılmıyor (tarayıcıda erişilemiyor)

1. Konteynerler ayakta mı? `docker compose ps` — hepsi `Up` olmalı.
2. nginx logu: `docker compose logs nginx`.
3. Güvenlik duvarı portu açık mı? `sudo ufw status` → 80/443 görünmeli.
4. Doğru adresi mi kullanıyorsunuz? Kurulumdaki `FRONTEND_URL` ile aynı olmalı.
5. Port 80 başka bir serviste mi? `sudo ss -tlnp | grep :80` — Apache vb. varsa durdurun.

## "Servisler" sayfasında her şey "durmuş" görünüyor

Backend host servislerine `nsenter` ile erişir; bunun için konteynerin
`privileged: true` + `pid: host` çalışması gerekir.
```bash
docker inspect hosting_backend --format '{{.HostConfig.Privileged}} {{.HostConfig.PidMode}}'
# çıktı:  true host   olmalı
```
Değilse `docker-compose.yml`'i kontrol edip `docker compose up -d backend` çalıştırın.

## Konteyner build hatası (frontend)

Frontend imajı kendi içinde derlenir (multi-stage). Build belleği yetmezse:
```bash
docker compose build --no-cache frontend
```
RAM 2 GB'tan azsa swap ekleyin.

## Veritabanı / admin sorunları

- Şema eksikse: `docker compose exec backend npx prisma db push --skip-generate`
- Admin'i yeniden oluşturmak (parola sıfırlamaz, yoksa ekler):
  ```bash
  docker compose exec -e ADMIN_EMAIL=admin@example.com -e ADMIN_USER=admin \
    -e ADMIN_PASSWORD='YeniGuclu1!' backend node prisma/seed.js
  ```
- Admin parolasını tamamen sıfırlamak isterseniz mevcut admin kaydını silip yukarıdakini çalıştırın.

## FTP bağlanamıyor

1. `vsftpd` çalışıyor mu? `systemctl status vsftpd`
2. Kullanıcı allowlist'te mi? `/etc/vsftpd.userlist` içinde olmalı.
3. Pasif port aralığı (40000–40100) güvenlik duvarında açık mı?
4. Panelde **FTP > Sistemi Senkronize Et** ile mevcut sistem hesaplarını panele aktarın.

## Mail çalışmıyor

Mail için ek DNS kaydı gerekir: MX, SPF, DKIM, PTR (reverse DNS). Postfix/Dovecot kurulu
olsa da bu kayıtlar tanımlı değilse posta gönderimi/teslimi başarısız olur. Panelde domain
+ e-posta hesabı ekleyince temel yapılandırma üretilir; DKIM/SPF/PTR'yi domain sağlayıcınızda
tamamlayın.

## SSL kurulamıyor

- Domainin DNS'i bu sunucunun IP'sine bakmalı (A kaydı).
- 80 portu Let's Encrypt doğrulaması için dışarıdan erişilebilir olmalı.
- Hız limiti: aynı domain için çok deneme yaptıysanız bir süre bekleyin.

## Kurulum yarıda kaldı

`install.sh` idempotenttir — tekrar çalıştırın. Mevcut `.env` korunabilir. Önceki
deneme loglarına `install-*.log` dosyalarından bakabilirsiniz.

## Disk doldu

```bash
docker system prune -a        # kullanılmayan imaj/konteynerleri temizle (dikkatli)
journalctl --vacuum-size=300M # systemd loglarını küçült
```

## Reboot sonrası servisler gelmedi

```bash
systemctl status docker        # docker etkin mi?
systemctl enable --now docker
docker compose up -d
```

---

Sorun çözülmezse `install-*.log` ve `docker compose logs` çıktısını saklayın; hata
mesajının tamamı tanı için gereklidir.

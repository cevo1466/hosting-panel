const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// İlk admin bilgileri ORTAM DEĞİŞKENLERİNDEN okunur (install.sh bunları set eder).
// Sabit/varsayılan parola YOKTUR: ADMIN_PASSWORD verilmezse güvenli rastgele bir
// parola üretilir ve ekrana BİR KEZ yazdırılır.
// ----------------------------------------------------------------------------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
let generatedPassword = false;

if (!ADMIN_PASSWORD) {
  // 18+ karakter, alfanümerik rastgele parola + kompleksite eki.
  ADMIN_PASSWORD = crypto.randomBytes(15).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 18) + 'A1!';
  generatedPassword = true;
}

function validatePassword(pw) {
  if (pw.length < 8) throw new Error('ADMIN_PASSWORD en az 8 karakter olmalı');
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    throw new Error('ADMIN_PASSWORD büyük harf, küçük harf ve rakam içermeli');
  }
}

async function main() {
  console.log('Veritabanı seed ediliyor...');

  // ---- Varsayılan paketler (generic ürün verisi) ----
  const packages = [
    { name: 'Starter', description: 'Başlangıç paketi - küçük projeler için',
      diskLimitMB: 1024, bandwidthLimitMB: 10240, maxDomains: 1, maxSubdomains: 5,
      maxEmailAccounts: 3, maxFtpAccounts: 2, maxDatabases: 2, phpVersion: '8.3' },
    { name: 'Professional', description: 'Profesyonel paket - orta ölçekli projeler',
      diskLimitMB: 10240, bandwidthLimitMB: 102400, maxDomains: 5, maxSubdomains: 25,
      maxEmailAccounts: 20, maxFtpAccounts: 10, maxDatabases: 10, phpVersion: '8.3' },
    { name: 'Enterprise', description: 'Kurumsal paket - büyük projeler ve yoğun trafik',
      diskLimitMB: 51200, bandwidthLimitMB: 1048576, maxDomains: 50, maxSubdomains: 250,
      maxEmailAccounts: 100, maxFtpAccounts: 50, maxDatabases: 50, phpVersion: '8.4' },
  ];
  for (const pkg of packages) {
    await prisma.package.upsert({ where: { name: pkg.name }, update: {}, create: pkg });
    console.log(`✓ Paket: ${pkg.name}`);
  }

  // ---- İlk admin kullanıcısı ----
  validatePassword(ADMIN_PASSWORD);
  const adminPass = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Idempotent: admin zaten varsa parolası KORUNUR (yeniden kurulumda sıfırlanmaz).
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: ADMIN_EMAIL }, { username: ADMIN_USER }] },
  });
  if (existing) {
    console.log(`✓ Admin zaten mevcut: ${existing.email} (değiştirilmedi)`);
  } else {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        username: ADMIN_USER,
        passwordHash: adminPass,
        role: 'admin',
        fullName: 'Panel Admin',
        isActive: true,
      },
    });
    console.log(`✓ Admin oluşturuldu: ${ADMIN_EMAIL} (kullanıcı adı: ${ADMIN_USER})`);
    if (generatedPassword) {
      console.log('');
      console.log('  ============================================================');
      console.log('  OTOMATİK ÜRETİLEN ADMIN PAROLASI (bir kez gösterilir):');
      console.log(`  >>>  ${ADMIN_PASSWORD}`);
      console.log('  ============================================================');
      console.log('');
    }
  }

  // ---- Sistem ayarları ----
  const settings = [
    { key: 'panel_name', value: 'HostPanel' },
    { key: 'panel_version', value: '1.0.0' },
    { key: 'ssl_auto_renew', value: 'true' },
    { key: 'backup_retention_days', value: '7' },
    { key: 'max_login_attempts', value: '5' },
    { key: 'login_lockout_minutes', value: '30' },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }
  console.log('✓ Sistem ayarları hazırlandı');

  console.log('\n✅ Veritabanı başarıyla seed edildi!');
  console.log('   ⚠️  İlk girişten sonra admin parolanızı değiştirin.');
}

main()
  .catch((e) => {
    console.error('Seed başarısız:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/ftpController');

const pwPolicy = body('password')
  .isLength({ min: 8 })
  // En az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter.
  // Boşlukları tamamen reddediyoruz; görünmez sondaki boşluklar FTP girişinde
  // "parola yanlış" gibi görünür ve tekrar eden destek hatasına dönüşür.
  .matches(/^(?=\S+$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])/)
  .withMessage('Şifre en az 8 karakter olmalı; boşluk içermemeli ve en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter (örn. . _ - ! @ # gibi) içermelidir');

router.get('/', authenticate, ctrl.list);
router.post('/sync', authenticate, ctrl.syncAccounts);
router.post('/', authenticate, [
  body('username').matches(/^[a-z0-9_]{3,32}$/).withMessage('Kullanıcı adı 3-32 karakter olmalı; yalnızca küçük harf, rakam ve alt çizgi (_) kullanılabilir (büyük harf, boşluk, tire veya nokta olamaz)'),
  pwPolicy,
  body('domainId').isUUID().withMessage('Geçerli bir domain seçilmedi'),
  body('subdomainId').optional({ nullable: true }).isUUID(),
  body('quota').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage('Kota 0 veya daha büyük bir sayı olmalı'),
], validate, ctrl.create);
router.put('/:id/password', authenticate, [pwPolicy], validate, ctrl.changePassword);
router.patch('/:id/toggle', authenticate, ctrl.toggleActive);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;

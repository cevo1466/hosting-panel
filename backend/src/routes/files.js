'use strict';

const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/fileController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/subdomains/:subdomainId/trash', authenticate, ctrl.trashList);
router.post('/subdomains/:subdomainId/trash/move', authenticate, ctrl.trashMove);
router.post('/subdomains/:subdomainId/trash/restore', authenticate, ctrl.trashRestore);
router.post('/subdomains/:subdomainId/trash/delete', authenticate, ctrl.trashDelete);
router.delete('/subdomains/:subdomainId/trash/empty', authenticate, ctrl.trashEmpty);
router.get('/subdomains/:subdomainId', authenticate, ctrl.list);
router.get('/subdomains/:subdomainId/read', authenticate, ctrl.read);
router.get('/subdomains/:subdomainId/permissions', authenticate, ctrl.getPermissions);
router.post('/subdomains/:subdomainId/write', authenticate, ctrl.write);
router.post('/subdomains/:subdomainId/mkdir', authenticate, ctrl.mkdir);
router.post('/subdomains/:subdomainId/rename', authenticate, ctrl.rename);
router.post('/subdomains/:subdomainId/upload', authenticate, upload.single('file'), ctrl.upload);
router.post('/subdomains/:subdomainId/extract', authenticate, ctrl.extractZip);
router.post('/subdomains/:subdomainId/compress', authenticate, ctrl.createZip);
router.put('/subdomains/:subdomainId/permissions', authenticate, ctrl.setPermissions);
router.post('/subdomains/:subdomainId/delete-many', authenticate, ctrl.removeMany);
router.delete('/subdomains/:subdomainId', authenticate, ctrl.remove);

router.get('/:domainId/trash', authenticate, ctrl.trashList);
router.post('/:domainId/trash/move', authenticate, ctrl.trashMove);
router.post('/:domainId/trash/restore', authenticate, ctrl.trashRestore);
router.post('/:domainId/trash/delete', authenticate, ctrl.trashDelete);
router.delete('/:domainId/trash/empty', authenticate, ctrl.trashEmpty);
router.get('/:domainId', authenticate, ctrl.list);
router.get('/:domainId/read', authenticate, ctrl.read);
router.get('/:domainId/permissions', authenticate, ctrl.getPermissions);
router.post('/:domainId/write', authenticate, ctrl.write);
router.post('/:domainId/mkdir', authenticate, ctrl.mkdir);
router.post('/:domainId/rename', authenticate, ctrl.rename);
router.post('/:domainId/upload', authenticate, upload.single('file'), ctrl.upload);
router.post('/:domainId/extract', authenticate, ctrl.extractZip);
router.post('/:domainId/compress', authenticate, ctrl.createZip);
router.put('/:domainId/permissions', authenticate, ctrl.setPermissions);
router.post('/:domainId/delete-many', authenticate, ctrl.removeMany);
router.delete('/:domainId', authenticate, ctrl.remove);

module.exports = router;
